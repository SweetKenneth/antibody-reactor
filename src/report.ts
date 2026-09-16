import type { ReactorRunResult } from './reactor.js';
import type { DefenseStrain } from './types.js';

function pct(n: number): string { return `${(n * 100).toFixed(2)}%`; }
function esc(s: string): string { return s.replaceAll('|', '\\|'); }

export function renderRunReport(result: ReactorRunResult, ancestry: readonly DefenseStrain[], fossilCount: number): string {
  const v = result.champion.validation!.metrics;
  const h = result.champion.holdout!.metrics;
  const first = result.generations[0];
  const last = result.generations.at(-1);
  const categories = result.champion.holdout!.categoryMetrics
    .map(c => `| ${esc(c.category)} | ${c.detected}/${c.malicious} | ${pct(c.recall)} |`)
    .join('\n');
  const topRules = [...result.champion.rules].sort((a,b)=>b.weight-a.weight).slice(0,20)
    .map(r => `| \`${esc(r.term)}\` | ${r.weight.toFixed(3)} | ${r.category ?? '—'} | ${r.source} |`)
    .join('\n');

  return `# SHPBL ANTIBODY REACTOR — Run Report\n\n` +
`**What happened:** a population of defensive policies was bred under OASB-labeled selection pressure. The final holdout was not evaluated until one champion had already been selected from validation fitness.\n\n` +
`## Receipt\n\n` +
`- Corpus mode: \`${result.config.corpusMode}\`\n` +
`- External corpus: ${result.corpus.total} samples, SHA-256 \`${result.corpus.sha256}\`\n` +
`- Partition: ${result.corpus.train} train / ${result.corpus.validation} validation / **${result.corpus.holdout} sealed holdout**\n` +
`- Generations: ${result.config.generations}; population ${result.config.population}; elite ${result.config.elite}\n` +
`- Candidate antibodies discovered from training content: ${result.discovery.candidateRules}\n` +
`- Fossil record: ${fossilCount} strains; champion ancestry: ${ancestry.length} strains\n` +
`- Mutation rehearsals: ${result.rehearsals.length}\n` +
`- Evidence ledger: ${result.ledger.entries} entries, verified=${result.ledger.verified}, head \`${result.ledger.head}\`\n` +
`- Vaccine: \`${result.vaccine.id}\`\n\n` +
`## Evolution\n\n` +
`Generation 1 best validation fitness was **${first?.bestFitness.toFixed(3) ?? 'n/a'}**. Generation ${last?.generation ?? 0} reached **${last?.bestFitness.toFixed(3) ?? 'n/a'}**. The promoted descendant is \`${result.champion.id}\`, generation ${result.champion.generation}, with ${result.champion.rules.length} inherited/mutated rules at threshold ${result.champion.threshold}.\n\n` +
`## Validation vs sealed holdout\n\n` +
`| Measure | Validation | Holdout |\n|---|---:|---:|\n` +
`| Recall | ${pct(v.recall)} | **${pct(h.recall)}** |\n` +
`| Precision* | ${pct(v.precision)} | ${pct(h.precision)} |\n` +
`| F1* | ${pct(v.f1)} | ${pct(h.f1)} |\n` +
`| MCC* | ${v.mcc.toFixed(4)} | ${h.mcc.toFixed(4)} |\n` +
`| Corpus-labeled benign disagreement* | ${pct(v.falsePositiveRate)} | ${pct(h.falsePositiveRate)} |\n` +
`| Reactor fitness | ${v.fitness.toFixed(3)} | ${h.fitness.toFixed(3)} |\n\n` +
`\* **Do not market these starred values as real-world accuracy.** OASB itself withdrew benign-derived scanner metrics for its published HMA comparison because most registry benign labels were selected by HMA's own export rule. Antibody Reactor retains the benign class as evolutionary counter-pressure, but the defensible external detection statistic is recall on categorized malicious fixtures.\n\n` +
`## Holdout attack-family recall\n\n| Attack family | Detected | Recall |\n|---|---:|---:|\n${categories}\n\n` +
`## Champion genome — strongest weighted evidence\n\n| Evidence term / motif | Weight | Learned family | Origin |\n|---|---:|---|---|\n${topRules}\n\n` +
`## What makes this a reactor instead of a tuned regex list\n\n` +
`The candidate evidence pool is discovered from the training split. Seed strains inherit different subsets and thresholds. Children are produced by crossover and mutation. Every child is evaluated by the external corpus oracle, then passed through mutation rehearsal; compound regressions are blocked and recorded as extinct. Selection pressure retains stronger descendants. Only after evolution stops is the holdout opened once. The promoted strain is converted into a vaccine artifact with an explicit deployment campaign.\n\n` +
`The repository preserves the dead strains too. \`fossil-record.json\` is not cleanup debris; it is the experimental record of defenses that failed to survive.\n`;
}

export function renderLineageDot(champion: DefenseStrain, ancestry: readonly DefenseStrain[]): string {
  const ids = new Set(ancestry.map(s => s.id));
  const lines = ['digraph AntibodyReactor {', '  rankdir=LR;', '  node [shape=box,fontname="monospace"];'];
  for (const s of ancestry) {
    const fit = s.validation?.metrics.fitness.toFixed(1) ?? '?';
    const label = `${s.id}\\nG${s.generation} fit=${fit}\\nrules=${s.rules.length}`;
    const attrs = s.id === champion.id ? ',penwidth=3' : '';
    lines.push(`  "${s.id}" [label="${label}"${attrs}];`);
    for (const p of s.parentIds) if (ids.has(p)) lines.push(`  "${p}" -> "${s.id}";`);
  }
  lines.push('}');
  return `${lines.join('\n')}\n`;
}
