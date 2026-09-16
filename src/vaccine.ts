import type { DefenseStrain, VaccineArtifact } from './types.js';
import { shortHash } from './hash.js';

const SHPBL_PARENTS = [
  { unit: 'IMMUNITY::createAntibodyGenerator', seal: '655cd4a8b9403925' },
  { unit: 'IMMUNITY::createDefenseBreeder', seal: '0db02d516df916d7' },
  { unit: 'ECHO::createMutationRehearsalEngine', seal: '793f191c3e86b64d' },
  { unit: 'CORE::createEvidenceLedger', seal: '10a4adfdbecbbc13' },
  { unit: 'IMMUNITY::synthesizeVaccine', seal: 'f96209bdd34a3380' },
  { unit: 'IMMUNITY::planCampaign', seal: 'e11b7b6f64363741' },
] as const;

export function synthesizeVaccine(champion: DefenseStrain, targets: string[], generatedAt = new Date().toISOString()): VaccineArtifact {
  if (!champion.validation || !champion.holdout) throw new Error('Champion must have validation and holdout evaluations');
  const rules = champion.rules
    .map(r => ({ id: r.id, term: r.term, weight: r.weight, category: r.category, source: r.source }))
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));

  return {
    schema: 'shpbl.antibody-reactor.vaccine/v1',
    id: `vax-${shortHash(`${champion.id}:${champion.holdout.metrics.fitness}`, 14)}`,
    threatFamily: 'agentic-malicious-artifact',
    generatedAt,
    champion: {
      strainId: champion.id,
      generation: champion.generation,
      parentIds: [...champion.parentIds],
      threshold: champion.threshold,
      ruleCount: champion.rules.length,
    },
    policy: { kind: 'weighted-evidence', threshold: champion.threshold, rules },
    validation: champion.validation.metrics,
    holdout: champion.holdout.metrics,
    categoryMetrics: champion.holdout.categoryMetrics,
    deployment: {
      status: 'planning',
      targets,
      phases: [
        { name: 'shadow', percent: 10, exitCriterion: 'No enforcement; compare verdicts against existing telemetry.' },
        { name: 'canary', percent: 25, exitCriterion: 'False-positive rate remains within validated envelope.' },
        { name: 'general', percent: 100, exitCriterion: 'Recall and specificity remain within validated envelope.' },
      ],
    },
    provenance: {
      externalOracle: 'Open Agent Security Benchmark corpus/v2.json labels; train/validation/holdout partitioned by stable salted hash.',
      shpblParents: SHPBL_PARENTS.map(p => ({ ...p })),
      trainingPolicy: 'Rules are learned only from training content. Validation labels drive evolutionary selection. Holdout labels are opened exactly once after champion selection. Sample IDs are never emitted into rules.',
    },
  };
}
