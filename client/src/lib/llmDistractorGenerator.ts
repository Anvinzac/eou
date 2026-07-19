// Helper to generate random string of similar length
function generateRandomText(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  // Add some random words structure
  for (let i = 0; i < length; i++) {
    if (i > 0 && i % 6 === 0 && i < length - 1) {
      result += ' ';
    } else {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

/**
 * Mock generator that simulates a network delay and returns randomized text.
 */
export async function generateLLMDistractors(correctAnswer: string, questionText: string = ''): Promise<string[]> {
  if (!correctAnswer || !correctAnswer.trim()) {
    return ['', '', ''];
  }

  // Simulate network delay of ~2 seconds to demonstrate loading
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

  const targetLength = Math.max(correctAnswer.length, 5);

  return [
    generateRandomText(targetLength),
    generateRandomText(Math.max(targetLength - 2, 5)),
    generateRandomText(targetLength + 2)
  ];
}
