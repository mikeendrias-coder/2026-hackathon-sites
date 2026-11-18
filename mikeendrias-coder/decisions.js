// Coding decisions applied on top of data.js (which is generated from the spreadsheet).
// Each one was reviewed Nov 18, 2026: Claude plus three independent reviewers agreed on all of them.
// Keep these here, not in data.js, so they survive a regenerate and stay easy to audit.
(() => {
  const D = window.FRT_DATA;
  const law = (st, name) => D.laws.find(x => x.state === st && x.name === name);
  const bill = (st, name) => D.bills.find(x => x.state === st && x.name === name);
  // Remove a protection from a law or bill. Its quotes stay, marked as related text (rule: null).
  const drop = (x, r) => {
    x.rules = x.rules.filter(k => k !== r); delete x.limits[r];
    const same = q => q.state === x.state && q.item === x.name;
    D.quotes = D.quotes.filter(q => !(same(q) && q.rule === r && D.quotes.some(o => o !== q && same(o) && o.rule !== r && o.text === q.text)));
    D.quotes.forEach(q => { if (same(q) && q.rule === r) q.rule = null; });
  };
  const dedupe = () => { const seen = new Set(); D.quotes = D.quotes.filter(q => { const k = [q.state, q.item, q.rule, q.text].join('|'); if (seen.has(k)) return false; seen.add(k); return true; }); };

  // D1. Maine LD 1585: probable cause with no judge is not "Judge must approve".
  const me = law('Maine', 'Facial surveillance law (LD 1585)');
  drop(me, '1');
  me.note = 'Police need probable cause, but no judge has to approve the search.';

  // D2. Bans sit outside the 7 protections.
  const vt = law('Vermont', 'Moratorium (S.124, Act 166)');
  drop(vt, '1');
  vt.ban = { who: ['local', 'state'], kind: 'Pause',
    text: "Police can't use face recognition until the legislature allows it.",
    except: 'Exceptions: where the drone law would allow a drone (a warrant or a recognized warrant exception), and child sexual exploitation cases.' };
  const vt2 = law('Vermont', 'Child exploitation exception (H.195, Act 17)');
  drop(vt2, '3');
  vt2.banException = true;
  vt2.note = "This is an exception to Vermont's pause, not a protection.";
  const va = law('Virginia', 'Purchase and deployment ban (HB 2031)');
  va.ban = { who: ['local'], kind: 'Ban',
    text: "Local and campus police can't buy or use face recognition unless a state law expressly allows it.",
    except: '' };

  // D3. Colorado SB 26-070: face recognition was cut in committee.
  const co = bill('Colorado', 'SB 26-070 (2026)');
  drop(co, '1'); drop(co, '7');
  co.note = 'Face recognition was in the first version, then removed in committee. Not scored.';

  // D5. Illinois: drone footage can't be run through face recognition, with two narrow exceptions.
  const il = law('Illinois', 'Drone facial recognition limit (HB 3902)');
  il.bars = { src: 'drone',
    text: "Illinois bars running police drone footage through face recognition. The only exceptions: a credible terrorism risk confirmed by Homeland Security, or a need for swift action to prevent imminent harm, a suspect's imminent escape, or destroyed evidence. Investigating a crime that already happened is neither." };
  il.does = "Police drones can't use onboard facial recognition during a flight. Drone footage can't be run through facial recognition except for a credible terrorism risk, or when swift action is needed to prevent imminent harm, a suspect's imminent escape, or the destruction of evidence.";
  D.quotes.push({ kind: 'Law', state: 'Illinois', item: il.name, rule: '6', cite: '725 ILCS 167/17 (second sentence)',
    text: '"A law enforcement agency operating a drone under this Act is prohibited from using any information gathered by a drone with any facial recognition software, unless either (i) the law enforcement agency is using a drone to counter a high risk of a terrorist attack by a specific individual or organization and the United States Secretary of Homeland Security has determined that credible intelligence indicates that there is such a risk or (ii) the law enforcement agency possesses reasonable suspicion that, under particular circumstances, swift action is needed to prevent imminent harm to life or to forestall the imminent escape of a suspect or the destruction of evidence."' });

  // D9. Say what is unclear, and only flag the protections actually in doubt.
  // reviewRules: [] means the doubt is about the law as a whole, so no protection row gets a "?".
  const NOTES = {
    'Colorado|Facial recognition services law (SB 22-113)': [[], 'Its limits on real-time and ongoing surveillance have broad exceptions, so we did not count that part.'],
    'Illinois|Immigration limit on Secretary of State photos (SB 225)': [[], 'It only limits searches for immigration enforcement, so it sits outside the 7 protections.'],
    'Kentucky|Use policy requirement (SB 176)': [[], 'It requires a written policy but does not say what the policy must contain.'],
    'Louisiana|Limit on sharing license facial data (SB 227)': [[], 'It limits sharing license photos with other states and nations, not use by Louisiana police.'],
    'Maine|Limit on license photo searches (LD 1899)': [[], 'Searches are also allowed "under rules it adopts", so how far the limit reaches depends on those rules.'],
    'Maryland|Immigration limit on license photo searches (HB 23; amended by HB 711)': [[], 'It only limits searches for immigration enforcement, so it sits outside the 7 protections.'],
    'New Hampshire|State AI law, real-time ban (HB 1688)': [['1', '6'], 'It is a general AI law for state agencies, so how it applies to police face recognition is not settled.'],
    'New Hampshire|Body camera law (HB 1584)': [[], 'It bars face recognition on body-camera recordings, but police may still share a still image to identify a suspect.'],
    'Oregon|Body camera law (HB 2571)': [[], 'It works through agency policy, so it only covers body-camera footage.'],
    'Texas|TRAIGA, government AI identification limit (HB 149)': [[], 'It reaches face recognition only through images taken from the internet, and only the attorney general can enforce it.'],
    'Virginia|Purchase and deployment ban (HB 2031)': [[], 'The ban covers local and campus police. With the old State Police rules expired, how State Police are covered is not settled.']
  };
  D.laws.forEach(l => { const n = NOTES[l.state + '|' + l.name]; if (l.review && n) { l.reviewRules = n[0]; l.reviewNote = n[1]; } else if (l.review) { l.reviewRules = l.rules.slice(); } });

  // D10. North Carolina H 1062 limits federal agents under immigration agreements, not police searches.
  const nc = bill('North Carolina', 'H 1062 (2025 Session)');
  drop(nc, '3');
  nc.note = 'Related bill, not scored. It covers federal agents working under immigration agreements, not North Carolina police searches.';

  dedupe();
})();
