export interface QuestionData {
  id: number;
  category: string;
  text: string;
  options: string[];
}

export interface SelectedQuestion {
  questionId: number;
  category: string;
  text: string;
  options: string[];
  orderNumber: number;
  correctAnswer: string;
  distractors: string[];
  isCustom: boolean;
  customCorrect?: string;
  customDistractors?: string[];
}

export interface QuizDraft {
  selectedQuestions: SelectedQuestion[];
  step: 'select' | 'reorder' | 'answers' | 'review';
  maxQuestions: number;
}

export interface Invitation {
  id: string;
  code: string;
  label: string;
  isUsed: boolean;
}

export interface QuizAttempt {
  id: string;
  respondentName: string | null;
  score: number;
  totalQuestions: number;
  completedAt: string | null;
  createdAt: string;
  invitationId: string | null;
}
