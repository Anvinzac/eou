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

export interface MatchQuestion {
  id: string;
  question_text: string;
  category: string;
  order_number: number;
}

export interface MatchResponse {
  question_id: string;
  selected_answer: string | null;
  attempt_id?: string;
}

export function buildCoupleMatchSummary(
  questions: MatchQuestion[],
  firstResponses: MatchResponse[],
  secondResponses: MatchResponse[],
): MatchSummary {
  const firstByQuestionId = new Map(
    firstResponses.map((response) => [response.question_id, response.selected_answer]),
  );
  const secondByQuestionId = new Map(
    secondResponses.map((response) => [response.question_id, response.selected_answer]),
  );

  const details = questions
    .map((question) => {
      const firstAnswer = firstByQuestionId.get(question.id);
      const secondAnswer = secondByQuestionId.get(question.id);

      if (!firstAnswer || !secondAnswer) {
        return null;
      }

      return {
        questionId: question.id,
        questionText: question.question_text,
        category: question.category,
        orderNumber: question.order_number,
        firstAnswer,
        secondAnswer,
        isMatch: firstAnswer === secondAnswer,
      } satisfies MatchDetail;
    })
    .filter((detail): detail is MatchDetail => detail !== null);

  const matchCount = details.filter((detail) => detail.isMatch).length;
  const totalCompared = details.length;
  const matchPercentage = totalCompared > 0 ? Math.round((matchCount / totalCompared) * 100) : 0;

  return {
    matchPercentage,
    matchCount,
    totalCompared,
    details,
  };
}
