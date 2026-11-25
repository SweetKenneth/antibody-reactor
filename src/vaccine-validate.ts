import type { VaccineArtifact } from './types.js';
import { canonical } from './ledger.js';
import { sha256 } from './hash.js';

/**
 * Structural and value limits a vaccine must satisfy before any scan runs.
 * They are derived from what the reactor can actually emit (discoverRules caps
 * weights to [0.35, 7], the candidate pool to 320 rules, extracted terms to 64
 * characters, two-word phrases to 2x25+1) with headroom, not tuned to OASB.
 * A vaccine outside them is either corrupt or hand-edited and is refused:
 * a policy whose threshold no score can reach, or whose rules cannot fire,
 * would otherwise return "benign" for everything.
 */
export const VACCINE_LIMITS = {
  maxRules: 512,
  minRules: 1,
  maxTermLength: 128,
  minWeight: 0.01,
  maxWeight: 10,
  maxIdLength: 64,
} as const;

const RULE_SOURCES = new Set(['seeded', 'bred', 'mutated']);
const ID = /^[A-Za-z0-9._:-]+$/;

export class VaccineValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(`Vaccine rejected: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ''}`);
    this.name = 'VaccineValidationError';
  }
}

export interface VaccineValidation { ok: boolean; errors: string[] }

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function validateVaccine(input: unknown): VaccineValidation {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['vaccine is not an object'] };
  if (input['schema'] !== 'shpbl.antibody-reactor.vaccine/v1') errors.push('unsupported schema');
  if (typeof input['id'] !== 'string' || !ID.test(input['id']) || input['id'].length > VACCINE_LIMITS.maxIdLength) errors.push('invalid id');
  const policy = input['policy'];
  if (!isObj(policy)) return { ok: false, errors: [...errors, 'policy missing'] };
  if (policy['kind'] !== 'weighted-evidence') errors.push('unsupported policy kind');
  const rules = policy['rules'];
  if (!Array.isArray(rules)) return { ok: false, errors: [...errors, 'policy.rules is not an array'] };
  if (rules.length < VACCINE_LIMITS.minRules || rules.length > VACCINE_LIMITS.maxRules) errors.push(`rule count ${rules.length} outside [${VACCINE_LIMITS.minRules}, ${VACCINE_LIMITS.maxRules}]`);
  const ids = new Set<string>();
  const terms = new Set<string>();
  let totalWeight = 0;
  rules.forEach((r, i) => {
    if (!isObj(r)) { errors.push(`rule ${i} is not an object`); return; }
    const id = r['id'], term = r['term'], weight = r['weight'], source = r['source'], category = r['category'];
    if (typeof id !== 'string' || !ID.test(id) || id.length > VACCINE_LIMITS.maxIdLength) errors.push(`rule ${i}: invalid id`);
    else if (ids.has(id)) errors.push(`rule ${i}: duplicate id ${id}`); else ids.add(id);
    if (typeof term !== 'string' || term.length === 0 || term.length > VACCINE_LIMITS.maxTermLength || term !== term.normalize('NFKC').toLowerCase()) errors.push(`rule ${i}: invalid term`);
    else if (terms.has(term)) errors.push(`rule ${i}: duplicate term`); else terms.add(term);
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < VACCINE_LIMITS.minWeight || weight > VACCINE_LIMITS.maxWeight) errors.push(`rule ${i}: weight outside [${VACCINE_LIMITS.minWeight}, ${VACCINE_LIMITS.maxWeight}]`);
    else totalWeight += weight;
    if (typeof source !== 'string' || !RULE_SOURCES.has(source)) errors.push(`rule ${i}: invalid source`);
    if (category !== undefined && (typeof category !== 'string' || category.length > 64)) errors.push(`rule ${i}: invalid category`);
  });
  const threshold = policy['threshold'];
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0) errors.push('threshold must be a positive finite number');
  else if (totalWeight > 0 && threshold > totalWeight) errors.push('threshold exceeds total rule weight: policy could never flag anything');
  const champion = input['champion'];
  if (isObj(champion) && typeof threshold === 'number' && champion['threshold'] !== threshold) errors.push('champion.threshold disagrees with policy.threshold');
  if (isObj(champion) && champion['ruleCount'] !== rules.length) errors.push('champion.ruleCount disagrees with policy.rules');
  return { ok: errors.length === 0, errors };
}

export function assertValidVaccine(input: unknown): asserts input is VaccineArtifact {
  const v = validateVaccine(input);
  if (!v.ok) throw new VaccineValidationError(v.errors);
}

/** SHA-256 over the canonical policy: what actually decides verdicts. */
export function policyFingerprint(vaccine: Pick<VaccineArtifact, 'policy'>): string {
  return sha256(canonical(vaccine.policy));
}
