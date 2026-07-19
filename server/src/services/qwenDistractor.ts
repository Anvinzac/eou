import { env } from '../lib/env.js';
import { generateDistractors } from './distractorGenerator.js';

export type DistractorSource = 'llm' | 'fallback';

export interface DistractorResult {
  distractors: string[];
  source: DistractorSource;
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
      /* fall through */
    }
  }

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

export async function generateDistractorsWithLLM(
  correctAnswer: string,
  count = 3,
  questionText = '',
  category = '',
): Promise<DistractorResult> {
  const apiKey = env.qwenApiKey;
  if (!apiKey || apiKey.startsWith('your-')) {
    return { distractors: generateDistractors(correctAnswer, count), source: 'fallback' };
  }

  try {
    const res = await fetch(`${env.qwenApiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.qwenModel,
        temperature: 0.9,
        messages: [
          { role: 'system', content: 'You output only valid JSON.' },
          { role: 'user', content: buildPrompt(questionText, correctAnswer, category, count) },
        ],
      }),
    });

    if (!res.ok) {
      return { distractors: generateDistractors(correctAnswer, count), source: 'fallback' };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseLLMOutput(content, correctAnswer, count);
    if (parsed.length < count) {
      const fallback = generateDistractors(correctAnswer, count);
      const merged = [...parsed];
      for (const d of fallback) {
        if (merged.length >= count) break;
        if (!merged.some((x) => x.toLowerCase() === d.toLowerCase())) merged.push(d);
      }
      return { distractors: merged.slice(0, count), source: parsed.length ? 'llm' : 'fallback' };
    }
    return { distractors: parsed, source: 'llm' };
  } catch {
    return { distractors: generateDistractors(correctAnswer, count), source: 'fallback' };
  }
}
