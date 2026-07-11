/**
 * Distractor generation backed by a Qwen (Qwen Cloud / DashScope) LLM.
 *
 * The call is made from the browser against Qwen's OpenAI-compatible chat
 * endpoint. If the key/model/endpoint is missing or the request fails for any
 * reason (invalid key, CORS, offline), it transparently falls back to the
 * existing rule-based generator in `distractorGenerator.ts` so the UI never
 * breaks.
 *
 * Configure via environment variables (see `.env.example`):
 *   VITE_QWEN_API_KEY   – the API key
 *   VITE_QWEN_API_BASE  – OpenAI-compatible base URL (default DashScope)
 *   VITE_QWEN_MODEL     – model id (default qwen-plus)
 */

import { generateDistractors } from './distractorGenerator';

const DEFAULT_API_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';

export type DistractorSource = 'llm' | 'fallback';

export interface DistractorResult {
  distractors: string[];
  source: DistractorSource;
}

function getEnv(key: string): string | undefined {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return v && v.length > 0 ? v : undefined;
}

function buildPrompt(questionText: string, correctAnswer: string, category: string, count: number): string {
  const catHint = category && category !== 'Custom' ? ` The question is in the category "${category}".` : '';
  return [
    'You are helping build a "how well do you know me" personality quiz.',
    `Question: ${questionText || '(not provided)'}`,
    `Correct answer: ${correctAnswer}`,
    catHint,
    '',
    `Generate exactly ${count} plausible but WRONG distractors (wrong answer options).`,
    'Rules:',
    '- Each must be believable and confusing, but clearly not the correct answer.',
    '- Keep the same language and tone as the correct answer.',
    '- Do NOT repeat the correct answer or each other.',
    '- Keep each option short (under 60 characters).',
    '',
    'Respond with ONLY a JSON object: {"distractors": ["...", "...", "..."]}.',
  ].join('\n');
}

function parseLLMOutput(raw: string, correctAnswer: string, count: number): string[] {
  const text = raw.trim();
  const found: string[] = [];

  // Try JSON object or array.
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const arr = Array.isArray(parsed) ? parsed : parsed?.distractors;
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === 'string') found.push(item.trim());
        }
      }
    } catch {
      /* fall through to line parsing */
    }
  }

  // Fallback: one distractor per non-empty line.
  if (found.length === 0) {
    for (const line of text.split('\n')) {
      const cleaned = line.replace(/^[\s\d.\-–—)*+]+/, '').trim();
      if (cleaned) found.push(cleaned);
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];
  const correctLower = correctAnswer.trim().toLowerCase();
  for (const d of found) {
    const dl = d.toLowerCase();
    if (!dl || dl === correctLower) continue;
    if (seen.has(dl)) continue;
    seen.add(dl);
    result.push(d);
    if (result.length >= count) break;
  }
  return result;
}

/**
 * Generate distractors via the Qwen LLM, falling back to the rule-based
 * generator when the LLM is unavailable or returns too few options.
 */
export async function generateDistractorsWithLLM(
  correctAnswer: string,
  count = 3,
  opts: { questionText?: string; category?: string } = {},
): Promise<DistractorResult> {
  const answer = (correctAnswer || '').trim();
  const apiKey = getEnv('VITE_QWEN_API_KEY');
  const apiBase = getEnv('VITE_QWEN_API_BASE') ?? DEFAULT_API_BASE;
  const model = getEnv('VITE_QWEN_MODEL') ?? DEFAULT_MODEL;

  if (!apiKey || !answer) {
    return { distractors: generateDistractors(answer, count), source: 'fallback' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You generate quiz distractor options. Reply with JSON only.' },
          { role: 'user', content: buildPrompt(opts.questionText ?? '', answer, opts.category ?? '', count) },
        ],
        temperature: 0.9,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { distractors: generateDistractors(answer, count), source: 'fallback' };
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseLLMOutput(content, answer, count);

    if (parsed.length >= Math.min(count, 1)) {
      return { distractors: parsed.slice(0, count), source: 'llm' };
    }
    // Not enough — pad with rule-based distractors.
    const fallback = generateDistractors(answer, count);
    const merged = [...parsed];
    for (const f of fallback) {
      if (merged.length >= count) break;
      if (!merged.some((m) => m.toLowerCase() === f.toLowerCase())) merged.push(f);
    }
    return { distractors: merged.slice(0, count), source: 'llm' };
  } catch {
    return { distractors: generateDistractors(answer, count), source: 'fallback' };
  }
}
