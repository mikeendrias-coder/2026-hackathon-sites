'use strict';
// An in-memory GitHub for the sheet tests: contents, blobs, commits, branch protection flag, token expiry header,
// a static "Pages" site served from the branch, and fault injection (409, 401, 403, 404, 5xx).
const crypto = require('crypto');

const blobSha = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text, 'utf8') + '\0').update(text, 'utf8').digest('hex');
const b64 = text => Buffer.from(text, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');

class GitHubFake {
  constructor(opts = {}) {
    this.owner = opts.owner || 'mikeendrias-coder';
    this.repo = opts.repo || '2026-hackathon-sites';
    this.branch = opts.branch || 'mikeendrias-coder/face-value';
    this.tokens = opts.tokens || { 'tok-good': { login: 'mikeendrias-coder', expires: '2027-02-01 00:00:00 UTC', write: true } };
    this.protected = !!opts.protected;
    this.blobs = {}; this.commits = []; this.head = null; this.writes = []; this.calls = []; this.faults = []; this.hooks = {};
    this.n = 0;
    if (opts.files) this.commit(opts.files, 'initial', '2026-11-18T22:14:41Z');
  }
  tree() { return this.head ? Object.assign({}, this.commits.find(c => c.sha === this.head).tree) : {}; }
  commit(files, message, date) {
    const tree = this.tree();
    Object.keys(files).forEach(p => { const t = files[p]; const sha = blobSha(t); this.blobs[sha] = t; tree[p] = sha; });
    const sha = crypto.createHash('sha1').update(String(++this.n) + message + JSON.stringify(tree)).digest('hex');
    this.commits.unshift({ sha, parent: this.head, message, tree, date: date || new Date(Date.UTC(2026, 10, 24, 12, this.n)).toISOString() });
    this.head = sha;
    return sha;
  }
  file(path, ref) { const c = ref ? this.commits.find(x => x.sha === ref) : this.commits.find(x => x.sha === this.head); if (!c || !c.tree[path]) return null; return { sha: c.tree[path], text: this.blobs[c.tree[path]] }; }
  /** fail({method, path (RegExp), code, times, body, headers}) */
  fail(f) { this.faults.push(Object.assign({ times: 1, body: '{"message":"injected"}', headers: {} }, f)); }
  puts() { return this.writes.filter(w => w.method === 'PUT'); }
  blobPosts() { return this.writes.filter(w => w.method === 'POST'); }
  res(code, obj, headers) { return { code, body: typeof obj === 'string' ? obj : JSON.stringify(obj), headers: Object.assign({ 'github-authentication-token-expiration': this.expiry || '' }, headers || {}) }; }

  handle(method, url, headers, payload) {
    this.calls.push({ method, url });
    const [pathPart, query = ''] = url.split('?'), q = {};
    query.split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    for (const f of this.faults) {
      if (f.times > 0 && (!f.method || f.method === method) && (!f.path || f.path.test(pathPart))) { f.times--; return this.res(f.code, f.body, f.headers); }
    }
    const auth = String(headers.Authorization || headers.authorization || ''), tok = this.tokens[auth.replace(/^Bearer /, '')];
    if (!tok) return this.res(401, { message: 'Bad credentials' });
    this.expiry = tok.expires;
    const body = payload ? JSON.parse(payload) : null, P = '/repos/' + this.owner + '/' + this.repo;
    const enc = s => s.split('/').map(decodeURIComponent).join('/');
    if (pathPart === '/user' && method === 'GET') return this.res(200, { login: tok.login });
    if (!pathPart.startsWith('/repos/')) return this.res(404, { message: 'Not Found' });
    const parts = pathPart.split('/'), owner = decodeURIComponent(parts[2]), repo = decodeURIComponent(parts[3]);
    if (owner !== this.owner || repo !== this.repo) return this.res(404, { message: 'Not Found' });
    const rest = pathPart.slice(('/repos/' + parts[2] + '/' + parts[3]).length);
    if (rest === '' && method === 'GET') return this.res(200, { full_name: this.owner + '/' + this.repo, permissions: { push: tok.write } });
    let m = /^\/branches\/(.+)$/.exec(rest);
    if (m && method === 'GET') return decodeURIComponent(m[1]) === this.branch ? this.res(200, { name: this.branch, protected: this.protected }) : this.res(404, { message: 'Branch not found' });
    if (rest === '/git/blobs' && method === 'POST') {
      if (!tok.write) return this.res(403, { message: 'Resource not accessible by personal access token' });
      const t = body.encoding === 'base64' ? Buffer.from(body.content, 'base64').toString('utf8') : body.content, sha = blobSha(t);
      this.blobs[sha] = t; this.writes.push({ method: 'POST', path: 'git/blobs', sha });
      return this.res(201, { sha, url: 'https://api.github.com' + P + '/git/blobs/' + sha });
    }
    m = /^\/git\/blobs\/([0-9a-f]+)$/.exec(rest);
    if (m && method === 'GET') { const t = this.blobs[m[1]]; return t === undefined ? this.res(404, { message: 'Not Found' }) : this.res(200, { sha: m[1], encoding: 'base64', content: b64(t), size: Buffer.byteLength(t) }); }
    if (rest === '/commits' && method === 'GET') {
      const path = q.path, list = [];
      let prev = null;
      [...this.commits].reverse().forEach(c => { const s = c.tree[path]; if (s && s !== prev) list.unshift(c); prev = s; });
      return this.res(200, list.slice(0, +q.per_page || 30).map(c => ({ sha: c.sha, html_url: 'https://github.com/' + this.owner + '/' + this.repo + '/commit/' + c.sha, commit: { message: c.message, committer: { date: c.date } } })));
    }
    m = /^\/contents\/(.+)$/.exec(rest);
    if (m) {
      const path = enc(m[1]);
      if (method === 'GET') {
        const ref = q.ref || this.branch;
        const c = ref === this.branch ? this.commits.find(x => x.sha === this.head) : this.commits.find(x => x.sha === ref);
        if (!c || !c.tree[path]) return this.res(404, { message: 'Not Found' });
        const t = this.blobs[c.tree[path]], big = Buffer.byteLength(t) > 1000000;
        return this.res(200, { type: 'file', path, sha: c.tree[path], size: Buffer.byteLength(t), encoding: big ? 'none' : 'base64', content: big ? '' : b64(t) });
      }
      if (method === 'PUT') {
        if (!tok.write) return this.res(403, { message: 'Resource not accessible by personal access token' });
        if (body.branch !== this.branch) return this.res(404, { message: 'Branch not found' });
        if (this.hooks.beforePut) { const h = this.hooks.beforePut; this.hooks.beforePut = null; h(path); }
        const cur = this.file(path);
        if (cur && !body.sha) return this.res(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
        if (cur && body.sha !== cur.sha) return this.res(409, { message: path + ' does not match ' + body.sha });
        const text = Buffer.from(body.content, 'base64').toString('utf8');
        const csha = this.commit({ [path]: text }, body.message);
        this.writes.push({ method: 'PUT', path, message: body.message, sha: blobSha(text), committer: body.committer || null, author: body.author || null });
        return this.res(cur ? 200 : 201, { content: { path, sha: blobSha(text) }, commit: { sha: csha, html_url: 'https://github.com/' + this.owner + '/' + this.repo + '/commit/' + csha, message: body.message } });
      }
    }
    return this.res(404, { message: 'Not Found' });
  }
  /** GitHub Pages: serves the branch head. relPath is the path after the site base (e.g. "mikeendrias-coder/data/live.json?t=1"). */
  pages(relPath) {
    const path = relPath.split('?')[0], f = this.file(path);
    return f ? { code: 200, body: f.text, headers: {} } : { code: 404, body: 'Not found', headers: {} };
  }
}
module.exports = { GitHubFake, blobSha };
