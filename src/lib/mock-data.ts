import type { Tables } from '@/integrations/supabase/types';

export const getMockQuizzes = (userId: string): Tables<'quizzes'>[] => [
  {
    id: 'mock-quiz-1',
    user_id: userId,
    title: 'My Awesome Mock Quiz',
    is_active: true,
    is_open: true,
    language: 'en',
    max_questions: 10,
    quiz_type: 'preference',
    draft_token: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mock-quiz-2',
    user_id: userId,
    title: 'Couples Compatibility Test',
    is_active: true,
    is_open: false,
    language: 'en',
    max_questions: 15,
    quiz_type: 'preference',
    draft_token: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const getMockInvitations = (quizId: string): Tables<'invitations'>[] => [
  {
    id: 'mock-inv-1',
    quiz_id: quizId,
    code: 'ABC123XYZ',
    label: 'Best Friend',
    is_used: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-inv-2',
    quiz_id: quizId,
    code: 'DEF456UVW',
    label: 'Mom',
    is_used: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  }
];

export const getMockAttempts = (quizId: string): Tables<'quiz_attempts'>[] => [
  {
    id: 'mock-attempt-1',
    quiz_id: quizId,
    invitation_id: 'mock-inv-1',
    respondent_name: 'Best Friend',
    score: 8,
    total_questions: 10,
    completed_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 7200000).toISOString(),
  }
];

export const getMockCoupleSessions = (quizId: string): Tables<'couple_sessions'>[] => [
  {
    id: 'mock-session-1',
    quiz_id: quizId,
    session_code: 'COUPLE123',
    first_attempt_id: 'mock-attempt-1',
    second_attempt_id: null,
    first_name: 'Me',
    second_name: 'Partner',
    match_count: 7,
    total_compared: 10,
    match_percentage: 70,
    status: 'completed',
    match_details: null,
    completed_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  }
];
