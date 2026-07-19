const ADJECTIVES = [
  'Happy', 'Lucky', 'Sunny', 'Sweet', 'Cool', 'Brave', 'Gentle', 'Kind',
  'Calm', 'Smart', 'Witty', 'Bold', 'Warm', 'Bright', 'Free', 'Pure',
  'Soft', 'Wild', 'True', 'Fair', 'Noble', 'Jolly', 'Keen', 'Wise',
];

const NOUNS = [
  'Star', 'Moon', 'Sun', 'Cloud', 'River', 'Ocean', 'Forest', 'Mountain',
  'Flower', 'Bird', 'Dolphin', 'Tiger', 'Fox', 'Bear', 'Wolf', 'Eagle',
  'Panda', 'Bunny', 'Kitten', 'Puppy', 'Phoenix', 'Dragon', 'Owl', 'Hawk',
];

export function generateCloudName(initials?: string): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  
  if (initials && initials.trim().length > 0) {
    // Filter nouns starting with initial letters
    const firstChar = initials.trim()[0].toUpperCase();
    const matching = NOUNS.filter(n => n[0] === firstChar);
    const selectedNoun = matching.length > 0 
      ? matching[Math.floor(Math.random() * matching.length)]
      : noun;
    return `${adj} ${selectedNoun}`;
  }
  
  return `${adj} ${noun} ${num}`;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
