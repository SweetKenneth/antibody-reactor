// Large-scale smoke / property tests. Scale with SMOKE_SCALE (default 1 = CI size).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AntibodyReactorScanner, BENIGN_CONFIDENCE_CAP, MALICIOUS_CONFIDENCE_CAP } from '../src/oasb-scanner.js';
import { validateVaccine } from '../src/vaccine-validate.js';
import { verifyLedgerEntries } from '../src/ledger.js';
import { DeploymentController, type Approval } from '../src/deployment.js';
import type { LedgerEntry, VaccineArtifact } from '../src/types.js';

const SCALE = Math.max(1, Number(process.env['SMOKE_SCALE'] ?? 1) | 0);
const VAX = JSON.parse(readFileSync('artifacts/oasb-final/vaccine.json', 'utf8')) as VaccineArtifact;
const LEDGER = JSON.parse(readFileSync('artifacts/oasb-final/evidence-ledger.json', 'utf8')) as LedgerEntry[];
let seed = 0x5eed;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const TERMS = VAX.policy.rules.map(r => r.term.replace(/^__|__$/g, '').replace(/_/g, ' '));
const NOISE = ['\u200b', '\u202e', '\ud800', '\udfff', '\u0000', '\ufeff', 'é', '𝓪', '\r\n', '{"a":', '<script>', '../../', '${', '%00', 'ı', 'ﬁ'];
function randText(): string {
  const n = Math.floor(rnd() * 60); let s = '';
  for (let i = 0; i < n; i++) s += rnd() < 0.3 ? pick(NOISE) : rnd() < 0.5 ? pick(TERMS) + ' ' : String.fromCharCode(Math.floor(rnd() * 0xffff));
  return s;
}

test('smoke: scanner invariants over random and hostile inputs', () => {
  const s = new AntibodyReactorScanner(VAX);
  const N = 20_000 * SCALE;
  const counts = { benign: 0, malicious: 0, unknown: 0 };
  for (let i = 0; i < N; i++) {
    const t = randText();
    const a = s.scanDetailed(t, `s${i}`), b = s.scanDetailed(t, `s${i}`);
    assert.equal(a.verdict, b.verdict); assert.equal(a.score, b.score); // deterministic
    counts[a.verdict]++;
    assert.ok(Number.isFinite(a.confidence));
    if (a.verdict === 'unknown') { assert.equal(a.confidence, 0); assert.ok(a.error); }
    else {
      const cap = a.verdict === 'malicious' ? MALICIOUS_CONFIDENCE_CAP : BENIGN_CONFIDENCE_CAP;
      assert.ok(a.confidence! >= 0.5 && a.confidence! <= cap, `conf ${a.confidence}`);
      assert.equal(a.verdict === 'malicious', a.score >= a.threshold);
    }
  }
  for (const bad of [null, undefined, 1, {}, [], Symbol('x'), 1n, () => 1, new String('x')]) {
    const r = s.scanDetailed(bad as unknown, 'x');
    assert.equal(r.verdict, 'unknown');
  }
  assert.equal(s.scanDetailed('a'.repeat(1024 * 1024 + 1), 'x').verdict, 'unknown');
  assert.equal(s.scanDetailed('é'.repeat(600_000), 'x').verdict, 'unknown'); // 1.2 MB UTF-8
  assert.ok(counts.malicious > 0 && counts.benign > 0, JSON.stringify(counts));
});

test('smoke: scanner throughput stays bounded on max-size input', () => {
  const s = new AntibodyReactorScanner(VAX);
  const big = (TERMS.join(' ') + ' ').repeat(2000).slice(0, 1024 * 1024 - 1);
  const t0 = performance.now(); const r = s.scanDetailed(big, 'big');
  assert.notEqual(r.verdict, 'unknown'); assert.ok(performance.now() - t0 < 5000);
});

test('smoke: mutated vaccines are either rejected or scan without ever erroring into benign', () => {
  const N = 3_000 * SCALE; let rejected = 0;
  const muts: Array<(v: any) => void> = [
    v => { v.policy.threshold = pick([0, -1, NaN, Infinity, 1e9, '3', null]); },
    v => { const r = pick(v.policy.rules) as any; r.weight = pick([0, -2, NaN, Infinity, 11, '1', null]); },
    v => { const r = pick(v.policy.rules) as any; r.term = pick(['', 'x'.repeat(200), 'NOT_A_SENSOR', 42, null]); },
    v => { v.policy.rules = pick([[], null, 'x', [null]]); },
    v => { v.policy.rules.push(structuredClone(v.policy.rules[0])); },
    v => { delete v[pick(['policy', 'champion', 'schema', 'id'])]; },
    v => { v.champion.threshold = (v.champion.threshold ?? 0) + 1; },
    v => { v.__proto__polluted = true; v.policy.rules[0].id = pick(['', null, 7]); },
  ];
  for (let i = 0; i < N; i++) {
    const v = structuredClone(VAX) as any; try { pick(muts)(v); if (rnd() < 0.3) pick(muts)(v); } catch { /* mutation hit an already-deleted field */ }
    let s: AntibodyReactorScanner | undefined;
    try { s = new AntibodyReactorScanner(v); } catch { rejected++; assert.equal(validateVaccine(v).ok, false); continue; }
    const r = s.scanDetailed(randText(), 'x');
    assert.ok(['benign', 'malicious', 'unknown'].includes(r.verdict));
  }
  assert.ok(rejected > N * 0.5, `only ${rejected}/${N} rejected`);
});

test('smoke: every single-field ledger tamper is detected', () => {
  assert.equal(verifyLedgerEntries(LEDGER).valid, true);
  const N = Math.min(LEDGER.length, 100 * SCALE);
  for (let i = 0; i < N; i++) {
    const idx = Math.floor(rnd() * LEDGER.length);
    const t = structuredClone(LEDGER) as any[];
    const e = t[idx]; const k = pick(Object.keys(e));
    e[k] = typeof e[k] === 'string' ? e[k] + 'x' : typeof e[k] === 'number' ? e[k] + 1 : { tampered: true };
    assert.equal(verifyLedgerEntries(t as LedgerEntry[]).valid, false, `tamper ${idx}.${k} undetected`);
  }
  const dropped = LEDGER.slice(0, -1); // truncation must fail against pinned count
  assert.equal(verifyLedgerEntries(dropped, undefined, { expectedEntries: LEDGER.length }).valid, false);
});

test('smoke: canary decide() fails closed on malformed request keys', () => {
  let now = 0; const fp = new AntibodyReactorScanner(VAX).policyFingerprint;
  const g: Approval = { approver: 'g', role: 'gov', reason: 'r', credential: 'ok' };
  const c = new DeploymentController(() => true, () => now);
  const id = c.plan(VAX, { expectedPolicyFingerprint: fp, envelope: { maxFalsePositiveRate: 1, minRecall: 0, maxUnknownRate: 1, minLabelledBenign: 1, minLabelledMalicious: 1 } }).id;
  c.activate(id, g);
  c.observe(id, { verdict: 'benign', policyFingerprint: fp, label: 'benign' });
  c.observe(id, { verdict: 'malicious', policyFingerprint: fp, label: 'malicious' });
  c.promote(id, g);
  assert.equal(c.get(id).stage, 'canary');
  for (const k of [undefined, null, 5, '', {}] as unknown[]) assert.equal(c.decide(id, { verdict: 'malicious', policyFingerprint: fp }, k as string), 'hold');
});

test('smoke: deployment state machine never enforces without authorized approval', () => {
  const N = 4_000 * SCALE;
  let now = 1_700_000_000_000;
  const good: Approval = { approver: 'gov', role: 'governor', reason: 'r', credential: 'ok' };
  const auth = (a: Approval) => a.credential === 'ok';
  let ctrl = new DeploymentController(auth, () => now);
  const ids: string[] = []; let blocks = 0, errors = 0, unauthorizedEnforce = 0;
  const approved = new Set<string>();
  const fp = new AntibodyReactorScanner(VAX).policyFingerprint;
  for (let i = 0; i < N; i++) {
    const op = Math.floor(rnd() * 10);
    try {
      if (op === 0 || ids.length === 0) ids.push(ctrl.plan(VAX, { expectedPolicyFingerprint: fp, ttlMs: 3_600_000, canaryPercent: Math.floor(rnd() * 101) }).id);
      else {
        const id = pick(ids);
        if (op === 1) { const ok = rnd() < 0.5; ctrl.activate(id, ok ? good : { ...good, credential: 'bad' }); }
        else if (op === 2) { const ok = rnd() < 0.5; ctrl.promote(id, ok ? good : { ...good, credential: 'bad' }); approved.add(id); }
        else if (op <= 6) for (let k = 0; k < 50; k++) {
          const label = rnd() < 0.5 ? 'malicious' as const : 'benign' as const;
          const verdict = rnd() < 0.02 ? 'unknown' as const : label;
          ctrl.observe(id, { verdict, policyFingerprint: rnd() < 0.01 ? 'forged' : fp, label });
        }
        else if (op === 7) { const d = ctrl.decide(id, { verdict: pick(['malicious', 'benign', 'unknown', 'bogus'] as any), policyFingerprint: rnd() < 0.1 ? 'forged' : fp }, `k${i}`);
          if (d === 'block') { blocks++; const st = ctrl.get(id).stage; if (!approved.has(id) || (st !== 'canary' && st !== 'general')) unauthorizedEnforce++; } }
        else if (op === 8) now += Math.floor(rnd() * 900_000);
        else if (rnd() < 0.1) { ctrl = DeploymentController.restore(structuredClone(ctrl.snapshot()), auth, () => now);
          for (const id of ids) { const st = ctrl.get(id).stage; assert.ok(st !== 'canary' && st !== 'general', 'restart resumed enforcement'); } }
      }
    } catch { errors++; }
    if (i % 97 === 0) for (const id of ids) { const c = ctrl.get(id); if (c.integrity !== 'pinned') assert.ok(c.stage !== 'canary' && c.stage !== 'general'); }
  }
  assert.equal(unauthorizedEnforce, 0);
  assert.equal(verifyLedgerEntries(ctrl.ledger.all()).valid, true);
  assert.ok(errors > 0); // refusals happened and were survivable
});
