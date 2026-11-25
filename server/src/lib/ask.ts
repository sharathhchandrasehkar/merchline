/**
 * "Ask Merchline": turn a plain-English question into a trace-to-season query.
 *
 * With ANTHROPIC_API_KEY set, Claude reads the question and fills in a structured tool call
 * (which table to start from, what to search for, which seasons). Without a key, a small
 * keyword parser does the same job less flexibly, so the feature still works on free hosting.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { q } from '../db.js';
import { ENTITIES, SEASON_CODES, entity } from '../model.js';
import { TRACE_STARTS } from './trace.js';

export interface AskResult { engine: 'claude' | 'rules'; start: string; q: string; seasons: string[]; explanation: string }

const Intent = z.object({
  start: z.enum(TRACE_STARTS as [string, ...string[]]),
  query: z.string().max(80).default(''),
  seasons: z.array(z.enum(SEASON_CODES as [string, ...string[]])).default([]),
  explanation: z.string().max(400).default(''),
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

function systemPrompt() {
  const tables = ENTITIES.filter((e) => TRACE_STARTS.includes(e.name))
    .map((e) => `- ${e.name} (business name: ${e.plural}): ${e.description}`).join('\n');
  return `You translate questions about an apparel product catalog into a "trace to season" query.
A trace starts from one table, optionally filtered by a search text that is matched against record names,
and follows every link up to the season the product sells in. Seasons are ${SEASON_CODES.join(', ')}
(SS = Spring/Summer, FW = Fall/Winter, two-digit year).

Tables you can start from:
${tables}

Rules:
- Pick the table the question is about. "Which styles use X fabric" starts from Material with query X.
  "Lab dips" or "fabric colors" start from Materialcolor. Margin or landed-cost questions start from Skucostsheet.
- query is a short name fragment that appears in record names (for example "Ripstop", "Summit", "Black"), not a sentence. Leave it empty if nothing specific is named.
- Only include seasons the question mentions.
- explanation is one plain sentence telling the user what you will show.
Always answer by calling the run_trace tool.`;
}

async function askClaude(question: string): Promise<AskResult> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: systemPrompt(),
    tools: [{
      name: 'run_trace',
      description: 'Run a trace-to-season report.',
      input_schema: {
        type: 'object',
        properties: {
          start: { type: 'string', enum: TRACE_STARTS, description: 'Table to start from' },
          query: { type: 'string', description: 'Name fragment to search for, or empty' },
          seasons: { type: 'array', items: { type: 'string', enum: SEASON_CODES } },
          explanation: { type: 'string' },
        },
        required: ['start', 'query', 'seasons', 'explanation'],
      },
    }],
    tool_choice: { type: 'tool', name: 'run_trace' },
    messages: [{ role: 'user', content: question }],
  });
  const call = msg.content.find((b) => b.type === 'tool_use');
  if (!call || call.type !== 'tool_use') throw new Error('Claude did not return a query');
  const intent = Intent.parse(call.input);
  return { engine: 'claude', start: intent.start, q: intent.query, seasons: intent.seasons, explanation: intent.explanation };
}

// ---------- keyword fallback ----------
const KEYWORDS: [RegExp, string][] = [
  [/lab ?dips?|material colou?rs?|fabric colou?rs?/, 'Materialcolor'],
  [/material prices?|unit prices?/, 'Materialsupplier'],
  [/margins?|landed|colou?rway costs?/, 'Skucostsheet'],
  [/cost ?sheets?|fob/, 'Costsheet'],
  [/suppl(y|ies|ying|iers?)|vendors?|mills?/, 'Supplier'],
  [/factor(y|ies)|sourcing/, 'Sourcingconfiguration'],
  [/bom lines?/, 'Bomlink'],
  [/bom sections?|bill of materials/, 'BOMPart'],
  [/fabrics?|materials?|trims?|zippers?|insulation|linings?/, 'Material'],
  [/colou?rways?|skus?/, 'Sku'],
  [/colou?rs?/, 'Color'],
];
const STOP = new Set(['which', 'what', 'where', 'who', 'show', 'me', 'all', 'the', 'a', 'an', 'of', 'in', 'for', 'and', 'or', 'to', 'is', 'are', 'use', 'uses', 'using',
  'used', 'with', 'from', 'by', 'do', 'does', 'our', 'my', 'that', 'this', 'season', 'seasons', 'style', 'styles', 'list', 'find', 'trace', 'how', 'many', 'much',
  'cost', 'costs', 'supply', 'supplies', 'supplying', 'made', 'make', 'have', 'has', 'any', 'on', 'it', 'they', 'them', 'low', 'lowest', 'high', 'highest']);

function seasonsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(ss|fw)\s?(?:20)?(\d{2})\b/gi)) out.add(m[1].toUpperCase() + m[2]);
  for (const m of text.matchAll(/\b(spring|summer|fall|autumn|winter)[\s/&-]*(?:summer|winter)?\s*(?:20)?(\d{2})\b/gi))
    out.add((/spring|summer/i.test(m[1]) ? 'SS' : 'FW') + m[2]);
  return [...out].filter((s) => SEASON_CODES.includes(s));
}

async function bestPhrase(table: string, words: string[]): Promise<string> {
  // longest run of words (up to 3) that matches some record names in this table
  for (let len = Math.min(3, words.length); len > 0; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (phrase.length < 3) continue;
      const hit = await q<{ n: number }>(`SELECT count(*)::int AS n FROM (SELECT 1 FROM ${table} WHERE label ILIKE $1 LIMIT 1) x`, [`%${phrase}%`]);
      if (hit[0].n) return phrase;
    }
  }
  return '';
}

async function askRules(question: string): Promise<AskResult> {
  const text = question.toLowerCase();
  const seasons = seasonsIn(question);
  const keyword = KEYWORDS.find(([re]) => re.test(text))?.[1];
  const cleaned = text.replace(/\b(ss|fw)\s?(?:20)?\d{2}\b/g, ' ').replace(/\b(spring|summer|fall|autumn|winter)\b[^a-z]*\d{0,4}/g, ' ');
  let words = cleaned.replace(/[^a-z0-9#\s-]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
  KEYWORDS.forEach(([re]) => (words = words.filter((w) => !re.test(w))));
  let start = keyword || 'Product', best = '';
  if (keyword) best = await bestPhrase(entity(keyword)!.table, words);
  else {
    // no table named: find which library the words belong to ("ripstop" is a material, "Boreal" a supplier)
    for (const cand of ['Material', 'Supplier', 'Color', 'Product']) {
      best = await bestPhrase(entity(cand)!.table, words);
      if (best) { start = cand; break; }
    }
  }
  const e = entity(start)!;
  const what = best ? `${e.plural.toLowerCase()} matching “${best}”` : `all ${e.plural.toLowerCase()}`;
  return { engine: 'rules', start, q: best, seasons, explanation: `Tracing ${what}${seasons.length ? ` in ${seasons.join(', ')}` : ''} up to season.` };
}

export async function ask(question: string): Promise<AskResult> {
  if (aiEnabled()) {
    try { return await askClaude(question); }
    catch (err) { console.warn('[ask] Claude failed, using keyword parser:', (err as Error).message); }
  }
  return askRules(question);
}
