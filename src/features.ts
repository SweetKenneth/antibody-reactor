import type { CorpusSample, DefenseRule } from './types.js';
import { shortHash } from './hash.js';

const STOP = new Set([
  'this','that','with','from','your','have','will','into','when','then','than','them','they','their','there','here','what','where','which',
  'about','using','used','uses','user','users','skill','agent','agents','system','prompt','tool','tools','name','description','usage','return',
  'returns','output','input','data','read','write','file','files','access','request','response','true','false','json','yaml','markdown','config',
  'configuration','provides','provide','allows','allow','must','should','cannot','only','also','more','each','before','after','through','these',
  'those','into','over','under','between','without','within','external','internal','service','services','application','applications','process'
]);

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

export function extractTerms(text: string): Set<string> {
  const normalized = normalize(text);
  const rawTokens = normalized.match(/[a-z][a-z0-9_.:/-]{2,}/g) ?? [];
  const tokens = rawTokens
    .map(t => t.replace(/^[-./:]+|[-./:]+$/g, ''))
    .filter(t => t.length >= 4 && t.length <= 64 && !STOP.has(t) && !/^https?$/.test(t));

  const out = new Set<string>();
  for (const token of tokens) out.add(token);

  // Adjacent phrase evidence is substantially harder to spoof than isolated words.
  const words = tokens.filter(t => /^[a-z][a-z0-9-]{3,24}$/.test(t));
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i]!;
    const b = words[i + 1]!;
    if (a !== b) out.add(`${a} ${b}`);
  }

  // Structural sensors are generic properties, never benchmark IDs.
  if (/https?:\/\//i.test(text)) out.add('__has_url__');
  if (/\b(?:curl|wget|powershell|bash|sh|cmd\.exe)\b/i.test(text)) out.add('__shell_surface__');
  if (/\b(?:token|secret|password|credential|api[_ -]?key)\b/i.test(text)) out.add('__credential_surface__');
  if (/\b(?:ignore|override|disable|bypass)\b.{0,48}\b(?:instruction|rule|guard|security|policy|scan)/is.test(text)) out.add('__instruction_override__');
  if (/\b(?:send|post|upload|forward|exfil|export)\b.{0,80}\b(?:token|secret|credential|environment|data|record)/is.test(text)) out.add('__exfil_motif__');
  if (/[^\x00-\x7F]/.test(text)) out.add('__non_ascii__');
  if (/\u200b|\u200c|\u200d|\ufeff/.test(text)) out.add('__zero_width_literal__');
  if (/[\u200B\u200C\u200D\u2060\uFEFF]/u.test(text)) out.add('__zero_width_actual__');
  if (/[A-Za-z0-9+/]{80,}={0,2}/.test(text)) out.add('__long_base64ish__');
  return out;
}

interface Counts { mal: number; safe: number; categories: Map<string, number> }

export interface RuleDiscovery {
  pool: DefenseRule[];
  maliciousDocs: number;
  safeDocs: number;
}

export function discoverRules(samples: CorpusSample[], limit = 320): RuleDiscovery {
  const counts = new Map<string, Counts>();
  let maliciousDocs = 0;
  let safeDocs = 0;

  for (const sample of samples) {
    const malicious = sample.label === 'malicious';
    if (malicious) maliciousDocs++; else safeDocs++;
    for (const term of extractTerms(sample.content)) {
      const c = counts.get(term) ?? { mal: 0, safe: 0, categories: new Map<string, number>() };
      if (malicious) {
        c.mal++;
        if (sample.category) c.categories.set(sample.category, (c.categories.get(sample.category) ?? 0) + 1);
      } else {
        c.safe++;
      }
      counts.set(term, c);
    }
  }

  const pool: DefenseRule[] = [];
  for (const [term, c] of counts) {
    if (c.mal < 2) continue;
    const malRate = c.mal / Math.max(1, maliciousDocs);
    const safeRate = c.safe / Math.max(1, safeDocs);
    const logOdds = Math.log((c.mal + 0.75) / (maliciousDocs - c.mal + 0.75))
      - Math.log((c.safe + 0.75) / (safeDocs - c.safe + 0.75));
    // Demand meaningful positive discrimination. Generic boilerplate dies here.
    if (logOdds < 1.0 || malRate <= safeRate * 1.25) continue;
    const topCategory = [...c.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const rarityBoost = Math.min(1.8, 0.8 + Math.log2(1 + c.mal) / 4);
    const structuralBoost = term.startsWith('__') ? 1.25 : 1;
    const weight = Math.min(7, Math.max(0.35, logOdds * rarityBoost * structuralBoost));
    pool.push({
      id: `rule-${shortHash(term, 10)}`,
      term,
      weight: Number(weight.toFixed(4)),
      source: 'seeded',
      category: topCategory,
      evidence: {
        maliciousDocs: c.mal,
        benignDocs: c.safe,
        maliciousRate: malRate,
        benignRate: safeRate,
        logOdds,
      },
    });
  }

  pool.sort((a, b) => {
    const aScore = a.weight * Math.log2(2 + a.evidence.maliciousDocs);
    const bScore = b.weight * Math.log2(2 + b.evidence.maliciousDocs);
    return bScore - aScore || a.term.localeCompare(b.term);
  });

  return { pool: pool.slice(0, limit), maliciousDocs, safeDocs };
}

export function scoreText(text: string, rules: readonly DefenseRule[]): { score: number; matchedRuleIds: string[] } {
  const terms = extractTerms(text);
  let score = 0;
  const matchedRuleIds: string[] = [];
  for (const rule of rules) {
    if (terms.has(rule.term)) {
      score += rule.weight;
      matchedRuleIds.push(rule.id);
    }
  }
  return { score, matchedRuleIds };
}
