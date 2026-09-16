export type SampleLabel = 'malicious' | 'benign' | 'edge_case';
export type StrainState = 'candidate' | 'surviving' | 'extinct' | 'promoted';
export type RuleSource = 'seeded' | 'bred' | 'mutated';

export interface CorpusSample {
  id: string;
  label: SampleLabel;
  category?: string;
  source?: string;
  version?: string;
  artifactType?: string;
  content: string;
  [key: string]: unknown;
}

export interface CorpusEnvelope {
  version?: string;
  createdAt?: string;
  totalSamples?: number;
  samples: CorpusSample[];
}

export interface DefenseRule {
  id: string;
  term: string;
  weight: number;
  source: RuleSource;
  category?: string;
  evidence: {
    maliciousDocs: number;
    benignDocs: number;
    maliciousRate: number;
    benignRate: number;
    logOdds: number;
  };
}

export interface ConfusionMatrix {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

export interface EvaluationMetrics extends ConfusionMatrix {
  sampleCount: number;
  precision: number;
  recall: number;
  specificity: number;
  f1: number;
  balancedAccuracy: number;
  mcc: number;
  falsePositiveRate: number;
  fitness: number;
}

export interface CategoryMetric {
  category: string;
  malicious: number;
  detected: number;
  recall: number;
}

export interface StrainEvaluation {
  metrics: EvaluationMetrics;
  categoryMetrics: CategoryMetric[];
}

export interface DefenseStrain {
  id: string;
  name: string;
  generation: number;
  parentIds: string[];
  rules: DefenseRule[];
  threshold: number;
  survivalScore: number;
  state: StrainState;
  createdAt: string;
  validation?: StrainEvaluation;
  holdout?: StrainEvaluation;
  deathReason?: string;
}

export interface RehearsalResult {
  id: string;
  mutation: string;
  performanceDelta: number;
  failureModes: string[];
  verdict: 'safe' | 'risky' | 'blocked';
  rollbackSafe: boolean;
  confidence: number;
  rehearsedAt: string;
}

export interface LedgerEntry<T = unknown> {
  index: number;
  timestamp: string;
  type: string;
  payload: T;
  previousHash: string;
  hash: string;
}

export interface ReactorConfig {
  seed: number;
  corpusMode: 'oasb-categorized' | 'all';
  generations: number;
  population: number;
  elite: number;
  minRules: number;
  maxRules: number;
  candidatePoolSize: number;
}

export interface GenerationSummary {
  generation: number;
  strainsTested: number;
  survivors: number;
  extinct: number;
  /**
   * Children that could not be admitted, so an elite was cloned to refill the
   * population. A high number means the generation was mostly copying, not
   * evolving, and a run report that hides it overstates how much breeding
   * actually happened.
   */
  fallbackClones: number;
  bestStrainId: string;
  bestFitness: number;
  bestRecall: number;
  bestFalsePositiveRate: number;
}

export interface VaccineArtifact {
  schema: 'shpbl.antibody-reactor.vaccine/v1';
  id: string;
  threatFamily: string;
  generatedAt: string;
  champion: {
    strainId: string;
    generation: number;
    parentIds: string[];
    threshold: number;
    ruleCount: number;
  };
  policy: {
    kind: 'weighted-evidence';
    threshold: number;
    rules: Array<Pick<DefenseRule, 'id' | 'term' | 'weight' | 'category' | 'source'>>;
  };
  validation: EvaluationMetrics;
  holdout: EvaluationMetrics;
  categoryMetrics: CategoryMetric[];
  deployment: {
    status: 'planning';
    targets: string[];
    phases: Array<{ name: string; percent: number; exitCriterion: string }>;
  };
  provenance: {
    externalOracle: string;
    shpblParents: Array<{ unit: string; seal: string }>;
    trainingPolicy: string;
  };
}
