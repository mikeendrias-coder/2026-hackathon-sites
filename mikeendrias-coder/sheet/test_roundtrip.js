// Runs the whole sheet test suite (sheet/test/*.test.js) and prints ROUND TRIP OK when every test passes.
// Run: node sheet/test_roundtrip.js
// The suite covers: a v1 sheet built by v1's own code, the upgrade dry run and upgrade, parity with data/live.json,
// seeded errors, idempotency, fuzz, structural robustness, publish flows, gating and time zones.
const { runAll } = require('./test/run.js');
const r = runAll();
console.log(r.ok ? 'ROUND TRIP OK' : r.fail + ' test(s) failed');
process.exit(r.ok ? 0 : 1);
