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

// No 0/O or 1/I, so codes survive being read aloud or typed from a screenshot.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function generateInviteCode(): string {
  return randomCode(6);
}

/** Code for a quiz's public short link, e.g. /s/K7Q2XPA. */
export function generateShareCode(): string {
  return randomCode(7);
}
