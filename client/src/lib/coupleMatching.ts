/** Domain matching lives on the server (`server/src/services/coupleMatching.ts`). */
export interface MatchDetail {
  questionId: string;
  questionText: string;
  category: string;
  orderNumber: number;
  firstAnswer: string;
  secondAnswer: string;
  isMatch: boolean;
}

export interface MatchSummary {
  matchPercentage: number;
  matchCount: number;
  totalCompared: number;
  details: MatchDetail[];
}
