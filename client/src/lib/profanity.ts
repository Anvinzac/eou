const FORBIDDEN_WORDS = [
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'dick', 'cock',
  'pussy', 'cunt', 'whore', 'slut', 'nigger', 'faggot', 'retard',
  'kill', 'die', 'hate', 'stupid', 'idiot', 'dumb', 'ugly',
  // Vietnamese curse words
  'đụ', 'địt', 'lồn', 'cặc', 'đéo', 'đồ chó', 'con chó', 'mẹ mày',
  'đồ ngu', 'ngu', 'khốn', 'chết', 'đĩ',
];

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return FORBIDDEN_WORDS.some(word => {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lower) || lower.includes(word);
  });
}

export function cleanText(text: string): string {
  let cleaned = text;
  FORBIDDEN_WORDS.forEach(word => {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  return cleaned.trim();
}
