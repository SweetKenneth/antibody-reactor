import type { VaccineArtifact } from './types.js';
import type { DetailedScanResult } from './oasb-scanner.js';
import { assertValidVaccine, policyFingerprint } from './vaccine-validate.js';
import { sha256 } from './hash.js';
import type { Clock } from './clock.js';
import { EvidenceLedger } from './ledger.js';
import type { DeploymentStore } from './deployment-store.js';

/**
 * Staged vaccine deployment: shadow -> canary -> general, with rollback.
 *
 * Restores controls the parent capabilities carried and the v0.2.0
 * composition dropped:
 *  - IMMUNITY::planCampaign  : campaigns start in 'planning', at most 3 run
 *                              concurrently, and can be aborted.
 *  - IMMUNITY::createAntibodyGenerator : explicit activation (never automatic),
 *                              a time-to-live (24h default), revocation, and
 *                              false-positive feedback.
 *  - ECHO::createMutationRehearsalEngine : recorded outcomes are kept so
 *                              observed accuracy can be compared with the
 *                              validated envelope.
 *
 * Authority rule: every step that INCREASES enforcement (activate, promote)
 * requires an approval the injected authorizer accepts. The default authorizer
 * accepts nothing. Steps that REDUCE enforcement (rollback on an envelope
 * breach, expiry) happen automatically, because failing toward less blocking
 * never removes the human's say over blocking.
 */

export type Stage = 'planning' | 'shadow' | 'canary' | 'general' | 'rolled_back' | 'revoked' | 'expired' | 'aborted';
export const MAX_CONCURRENT_CAMPAIGNS = 3;
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface Approval {
  approver: string;
  role: string;
  reason: string;
  /** Opaque credential checked by the authorizer (signature, session id...). Never stored in the ledger. */
  credential: string;
}

export type Authorizer = (approval: Approval, action: 'activate' | 'promote', campaign: Readonly<CampaignView>) => boolean;
export const denyAll: Authorizer = () => false;

export interface Envelope {
  /** Max observed false-positive rate on labelled benign traffic. */
  maxFalsePositiveRate: number;
  /** Min observed recall on labelled malicious traffic. */
  minRecall: number;
  /** Max share of scans that came back 'unknown'. */
  maxUnknownRate: number;
  /** Labelled observations required in a stage before promotion can be approved. */
  minLabelledBenign: number;
  minLabelledMalicious: number;
}

export interface Observation {
  verdict: DetailedScanResult['verdict'];
  /** Set by the trusted scanner adapter, never by submitted artifact data. */
  policyFingerprint: string;
  /** Ground truth when a human or downstream system has labelled the item. */
  label?: 'malicious' | 'benign';
}

export interface StageStats {
  scans: number; unknown: number;
  labelledMalicious: number; detected: number;
  labelledBenign: number; flaggedBenign: number;
}

export interface CampaignView {
  id: string; vaccineId: string; policyFingerprint: string;
  integrity: 'pinned' | 'unpinned';
  stage: Stage; canaryPercent: number; expiresAtMs: number;
  stats: StageStats; envelope: Envelope; breaches: string[];
}

function zero(): StageStats { return { scans: 0, unknown: 0, labelledMalicious: 0, detected: 0, labelledBenign: 0, flaggedBenign: 0 }; }

export function envelopeFromVaccine(v: VaccineArtifact): Envelope {
  assertValidVaccine(v);
  // Operator budget, not an accuracy estimate from scanner-derived OASB benign labels.
  return { maxFalsePositiveRate: 0.01, minRecall: 0.95, maxUnknownRate: 0.01,
    minLabelledBenign: 500, minLabelledMalicious: 30 };
}

function validateEnvelope(e: Envelope): void {
  if (!e || ![e.maxFalsePositiveRate, e.minRecall, e.maxUnknownRate].every(n => Number.isFinite(n) && n >= 0 && n <= 1)
    || ![e.minLabelledBenign, e.minLabelledMalicious].every(n => Number.isSafeInteger(n) && n > 0)) {
    throw new Error('invalid monitoring envelope');
  }
}
function validVerdict(value: unknown): value is Observation['verdict'] {
  return value === 'malicious' || value === 'benign' || value === 'unknown';
}
export interface DeploymentSnapshot {
  schema: 'shpbl.antibody-reactor.deployment/v1';
  campaigns: CampaignView[];
  ledger: ReturnType<EvidenceLedger['all']>;
}

const ACTIVE: Stage[] = ['shadow', 'canary', 'general'];

export class DeploymentController {
  private readonly campaigns = new Map<string, CampaignView>();
  readonly ledger: EvidenceLedger;
  private faulted = false;
  private approving = false;

  constructor(
    private readonly authorize: Authorizer = denyAll,
    private readonly nowMs: () => number = Date.now,
    clock?: Clock,
    private readonly store?: DeploymentStore,
  ) {
    this.ledger = new EvidenceLedger('deployment', clock ?? { now: () => new Date(this.nowMs()).toISOString() });
  }

  snapshot(): DeploymentSnapshot {
    return { schema: 'shpbl.antibody-reactor.deployment/v1', campaigns: [...this.campaigns.values()].map(c => structuredClone(c)), ledger: this.ledger.all() };
  }

  static restore(raw: unknown, authorize: Authorizer = denyAll, nowMs: () => number = Date.now, store?: DeploymentStore): DeploymentController {
    if (!raw || typeof raw !== 'object') throw new Error('invalid deployment checkpoint');
    const snapshot = raw as DeploymentSnapshot;
    if (snapshot.schema !== 'shpbl.antibody-reactor.deployment/v1' || !Array.isArray(snapshot.campaigns) || snapshot.campaigns.length > 10_000) throw new Error('invalid deployment checkpoint');
    const c = new DeploymentController(authorize, nowMs, undefined, store);
    c.ledger.restore(snapshot.ledger);
    for (const campaign of snapshot.campaigns) {
      if (!campaign || typeof campaign.id !== 'string' || c.campaigns.has(campaign.id)
        || !/^[0-9a-f]{64}$/.test(campaign.policyFingerprint)
        || typeof campaign.vaccineId !== 'string'
        || !['planning', ...ACTIVE, 'rolled_back', 'revoked', 'expired', 'aborted'].includes(campaign.stage)
        || (campaign.integrity !== 'pinned' && campaign.integrity !== 'unpinned')
        || !Number.isSafeInteger(campaign.expiresAtMs) || !Number.isFinite(campaign.canaryPercent) || !(campaign.canaryPercent > 0 && campaign.canaryPercent < 100)
        || !Array.isArray(campaign.breaches) || !campaign.breaches.every(b => typeof b === 'string')) throw new Error('invalid campaign checkpoint');
      validateEnvelope(campaign.envelope);
      const stats = campaign.stats;
      if (!stats || !Object.keys(zero()).every(k => Number.isSafeInteger(stats[k as keyof StageStats]) && stats[k as keyof StageStats] >= 0)
        || stats.unknown > stats.scans || stats.detected > stats.labelledMalicious || stats.flaggedBenign > stats.labelledBenign
        || stats.labelledBenign + stats.labelledMalicious > stats.scans
        || stats.unknown + stats.detected + stats.flaggedBenign > stats.scans) throw new Error('invalid monitoring checkpoint');
      c.campaigns.set(campaign.id, structuredClone(campaign));
    }
    if ([...c.campaigns.values()].filter(v => ACTIVE.includes(v.stage) || v.stage === 'planning').length > MAX_CONCURRENT_CAMPAIGNS) throw new Error('too many checkpoint campaigns');
    for (const v of c.campaigns.values()) c.expireIfDue(v);
    // Restart never resumes blocking automatically, even with a valid checkpoint.
    for (const v of c.campaigns.values()) {
      if (v.stage === 'canary' || v.stage === 'general') {
        v.stage = 'shadow'; v.stats = zero();
        c.ledger.append('campaign.restart_shadow', { id: v.id });
      }
    }
    if (store) c.commit();
    return c;
  }

  private commit(): void {
    try { this.store?.save(this.snapshot()); }
    catch (error) { this.faulted = true; throw error; }
  }

  private healthy(): void {
    if (this.faulted) throw new Error('deployment controller faulted: checkpoint persistence failed');
    if (!Number.isFinite(this.nowMs())) throw new Error('invalid deployment clock');
  }

  plan(vaccine: VaccineArtifact, opts: { envelope?: Envelope; ttlMs?: number; canaryPercent?: number; expectedPolicyFingerprint?: string } = {}): CampaignView {
    this.healthy();
    assertValidVaccine(vaccine);
    for (const c of this.campaigns.values()) this.expireIfDue(c);
    const active = [...this.campaigns.values()].filter(c => ACTIVE.includes(c.stage) || c.stage === 'planning');
    if (active.length >= MAX_CONCURRENT_CAMPAIGNS) throw new Error(`at most ${MAX_CONCURRENT_CAMPAIGNS} concurrent campaigns`);
    const canaryPercent = opts.canaryPercent ?? 10;
    if (!Number.isFinite(canaryPercent) || !(canaryPercent > 0 && canaryPercent < 100)) throw new RangeError('canaryPercent must be finite and in (0, 100)');
    const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
    if (!Number.isSafeInteger(ttl) || ttl <= 0 || ttl > DEFAULT_TTL_MS) throw new RangeError('ttlMs must be an integer within the 24h ceiling');
    const envelope = structuredClone(opts.envelope ?? envelopeFromVaccine(vaccine));
    validateEnvelope(envelope);
    if (!Number.isSafeInteger(this.nowMs() + ttl)) throw new Error('invalid expiry');
    const fp = policyFingerprint(vaccine);
    if (opts.expectedPolicyFingerprint !== undefined && opts.expectedPolicyFingerprint !== fp) throw new Error('vaccine differs from trusted policy pin');
    const c: CampaignView = {
      id: `camp-${sha256(`${fp}:${this.nowMs()}:${this.campaigns.size}`).slice(0, 12)}`,
      vaccineId: vaccine.id, policyFingerprint: fp, stage: 'planning', canaryPercent,
      integrity: opts.expectedPolicyFingerprint === undefined ? 'unpinned' : 'pinned',
      expiresAtMs: this.nowMs() + ttl, stats: zero(), envelope, breaches: [],
    };
    this.campaigns.set(c.id, c);
    this.ledger.append('campaign.planned', { id: c.id, vaccineId: c.vaccineId, policyFingerprint: fp, envelope: c.envelope, expiresAtMs: c.expiresAtMs });
    this.commit();
    return structuredClone(c);
  }

  get(id: string): CampaignView {
    this.healthy();
    const c = this.campaigns.get(id);
    if (!c) throw new Error(`unknown campaign ${id}`);
    this.expireIfDue(c);
    return structuredClone(c);
  }

  private mustGet(id: string): CampaignView {
    this.healthy();
    const c = this.campaigns.get(id);
    if (!c) throw new Error(`unknown campaign ${id}`);
    this.expireIfDue(c);
    return c;
  }

  private expireIfDue(c: CampaignView): void {
    if ((ACTIVE.includes(c.stage) || c.stage === 'planning') && this.nowMs() >= c.expiresAtMs) {
      c.stage = 'expired';
      this.ledger.append('campaign.expired', { id: c.id });
      this.commit();
    }
  }

  private approve(c: CampaignView, action: 'activate' | 'promote', approval: Approval): void {
    if (this.approving) throw new Error('reentrant approval refused');
    if (!approval || typeof approval.approver !== 'string' || !approval.approver.trim() || typeof approval.reason !== 'string' || !approval.reason.trim()) {
      throw new Error('approval requires approver and reason');
    }
    if (typeof approval.role !== 'string' || !approval.role.trim() || typeof approval.credential !== 'string' || !approval.credential) throw new Error('approval requires role and credential');
    const stage = c.stage;
    let ok = false;
    this.approving = true;
    try { ok = this.authorize(structuredClone(approval), action, structuredClone(c)) === true; } catch { ok = false; }
    finally { this.approving = false; }
    this.expireIfDue(c);
    ok = ok && c.stage === stage && !this.faulted;
    this.ledger.append(ok ? 'approval.accepted' : 'approval.refused', { id: c.id, action, approver: approval.approver, role: approval.role, reason: approval.reason, stage: c.stage });
    if (!ok) { this.commit(); throw new Error(`approval refused for ${action}`); }
  }

  /** planning -> shadow. Shadow never enforces. */
  activate(id: string, approval: Approval): CampaignView {
    const c = this.mustGet(id);
    if (c.stage !== 'planning') throw new Error(`cannot activate from ${c.stage}`);
    this.approve(c, 'activate', approval);
    c.stage = 'shadow'; c.stats = zero(); c.breaches = [];
    this.ledger.append('campaign.stage', { id, stage: c.stage });
    this.commit();
    return structuredClone(c);
  }

  /** Reasons a promotion would be refused right now, before asking for approval. */
  promotionBlockers(id: string): string[] {
    const c = this.mustGet(id);
    const out: string[] = [];
    if (c.integrity !== 'pinned') out.push('vaccine must be independently fingerprint-pinned before enforcement');
    if (c.stage !== 'shadow' && c.stage !== 'canary') out.push(`stage ${c.stage} cannot be promoted`);
    if (c.breaches.length) out.push(`envelope breached: ${c.breaches.join(', ')}`);
    if (c.stats.labelledBenign < c.envelope.minLabelledBenign) out.push(`needs ${c.envelope.minLabelledBenign} labelled benign, has ${c.stats.labelledBenign}`);
    if (c.stats.labelledMalicious < c.envelope.minLabelledMalicious) out.push(`needs ${c.envelope.minLabelledMalicious} labelled malicious, has ${c.stats.labelledMalicious}`);
    if (c.stats.labelledBenign > 0 && c.stats.flaggedBenign / c.stats.labelledBenign > c.envelope.maxFalsePositiveRate) out.push('false-positive-rate');
    if (c.stats.labelledMalicious > 0 && c.stats.detected / c.stats.labelledMalicious < c.envelope.minRecall) out.push('recall');
    if (c.stats.scans > 0 && c.stats.unknown / c.stats.scans > c.envelope.maxUnknownRate) out.push('unknown-rate');
    return out;
  }

  /** shadow -> canary -> general. Requires evidence AND an authorized approval. Never automatic. */
  promote(id: string, approval: Approval): CampaignView {
    const blockers = this.promotionBlockers(id);
    const c = this.mustGet(id);
    if (blockers.length) {
      this.ledger.append('promotion.blocked', { id, stage: c.stage, blockers });
      this.commit();
      throw new Error(`promotion blocked: ${blockers.join('; ')}`);
    }
    this.approve(c, 'promote', approval);
    if (this.promotionBlockers(id).length) throw new Error('promotion eligibility changed during approval');
    const from = c.stage;
    c.stage = c.stage === 'shadow' ? 'canary' : 'general';
    c.stats = zero(); c.breaches = [];
    this.ledger.append('campaign.stage', { id, from, stage: c.stage, evidence: 'stats reset for the new stage' });
    this.commit();
    return structuredClone(c);
  }

  /** Record an observed scan. Breaching the envelope in canary/general rolls back automatically. */
  observe(id: string, o: Observation): CampaignView {
    const c = this.mustGet(id);
    if (!o || !validVerdict(o.verdict) || o.policyFingerprint !== c.policyFingerprint || (o.label !== undefined && o.label !== 'benign' && o.label !== 'malicious')) throw new Error('invalid observation or policy fingerprint');
    if (!ACTIVE.includes(c.stage)) return structuredClone(c);
    const s = c.stats;
    s.scans++;
    if (o.verdict === 'unknown') s.unknown++;
    if (o.label === 'malicious') { s.labelledMalicious++; if (o.verdict === 'malicious') s.detected++; }
    if (o.label === 'benign') { s.labelledBenign++; if (o.verdict === 'malicious') s.flaggedBenign++; }
    const breaches: string[] = [];
    if (s.labelledBenign >= 50 && s.flaggedBenign / s.labelledBenign > c.envelope.maxFalsePositiveRate) breaches.push('false-positive-rate');
    if (s.labelledMalicious >= 10 && s.detected / s.labelledMalicious < c.envelope.minRecall) breaches.push('recall');
    if (s.scans >= 100 && s.unknown / s.scans > c.envelope.maxUnknownRate) breaches.push('unknown-rate');
    if (breaches.length && breaches.join() !== c.breaches.join()) {
      c.breaches = breaches;
      this.ledger.append('envelope.breached', { id, stage: c.stage, breaches, stats: { ...s } });
      if (c.stage === 'canary' || c.stage === 'general') this.rollback(id, `envelope breach: ${breaches.join(', ')}`);
    }
    this.commit();
    return structuredClone(c);
  }

  /** Reduce enforcement to none. Allowed without approval. */
  rollback(id: string, reason: string): CampaignView {
    const c = this.mustGet(id);
    if (!ACTIVE.includes(c.stage)) return structuredClone(c);
    const from = c.stage;
    c.stage = 'rolled_back';
    this.ledger.append('campaign.rolled_back', { id, from, reason });
    this.commit();
    return structuredClone(c);
  }

  revoke(id: string, reason: string): CampaignView {
    const c = this.mustGet(id);
    c.stage = 'revoked';
    this.ledger.append('campaign.revoked', { id, reason });
    this.commit();
    return structuredClone(c);
  }

  abort(id: string, reason: string): CampaignView {
    const c = this.mustGet(id);
    if (c.stage !== 'planning') throw new Error('only a planning campaign can be aborted; use rollback or revoke');
    c.stage = 'aborted';
    this.ledger.append('campaign.aborted', { id, reason });
    this.commit();
    return structuredClone(c);
  }

  /**
   * What to do with one scan result. 'block' only in canary (for the
   * deterministic traffic bucket) or general. 'hold' for unknown verdicts
   * while enforcing: the item waits for a human instead of passing as safe.
   */
  decide(id: string, result: Pick<DetailedScanResult, 'verdict'> & { policyFingerprint?: string }, requestKey: string): 'allow' | 'log' | 'block' | 'hold' {
    const c = this.mustGet(id);
    // A malformed request key cannot be bucketed; in canary it fails closed to 'hold' rather than throwing.
    if (c.stage === 'canary' && (typeof requestKey !== 'string' || !requestKey)) return 'hold';
    const enforcing = c.stage === 'general' || (c.stage === 'canary' && bucket(requestKey) < c.canaryPercent);
    if (!result || !validVerdict(result.verdict)) return enforcing ? 'hold' : 'log';
    if (enforcing && result.policyFingerprint !== c.policyFingerprint) return 'hold';
    if (!enforcing) return result.verdict === 'malicious' || result.verdict === 'unknown' ? 'log' : 'allow';
    if (result.verdict === 'malicious') return 'block';
    if (result.verdict === 'unknown') return 'hold';
    return 'allow';
  }
}

function bucket(key: string): number {
  return parseInt(sha256(key).slice(0, 8), 16) % 100;
}
