'use strict';
// Runs every sheet/test/*.test.js file and prints a per-scenario summary.
// Each test file exports {scenario, title, tests: [[name, fn], ...]}. A test passes if fn returns without throwing.
const fs = require('fs'), path = require('path');

function runAll(opts = {}) {
  const files = fs.readdirSync(__dirname).filter(f => /\.test\.js$/.test(f)).sort();
  const results = [], log = opts.quiet ? () => {} : console.log;
  files.forEach(f => {
    let mod;
    try { mod = require(path.join(__dirname, f)); } catch (e) { results.push({ scenario: f, title: f, pass: 0, fail: 1, failures: [['load', e.stack]] }); return; }
    [].concat(mod).forEach(group => {
      const r = { scenario: group.scenario, title: group.title, pass: 0, fail: 0, failures: [], ms: 0 };
      const t0 = Date.now();
      group.tests.forEach(([name, fn]) => {
        try { fn(); r.pass++; } catch (e) { r.fail++; r.failures.push([name, e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : String(e)]); }
      });
      r.ms = Date.now() - t0;
      results.push(r);
    });
  });
  results.sort((a, b) => String(a.scenario).localeCompare(String(b.scenario)));
  log('');
  log('Sheet v2 test suite');
  results.forEach(r => {
    log((r.fail ? 'FAIL ' : 'ok   ') + '(' + r.scenario + ') ' + r.title + ': ' + r.pass + '/' + (r.pass + r.fail) + ' passed' + (r.ms ? ' [' + (r.ms / 1000).toFixed(1) + 's]' : ''));
    r.failures.forEach(([n, e]) => log('       x ' + n + '\n         ' + String(e).replace(/\n/g, '\n         ')));
  });
  const pass = results.reduce((n, r) => n + r.pass, 0), fail = results.reduce((n, r) => n + r.fail, 0);
  log('Total: ' + pass + ' passed, ' + fail + ' failed');
  return { ok: fail === 0, pass, fail, results };
}
if (require.main === module) process.exit(runAll().ok ? 0 : 1);
module.exports = { runAll };
