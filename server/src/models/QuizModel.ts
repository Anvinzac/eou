import { supabaseAdmin } from '../lib/supabase.js';
import { notFound } from '../lib/errors.js';

export type QuizInsert = {
  user_id: string | null;
  title: string;
  max_questions: number;
  draft_token?: string | null;
  is_open?: boolean;
};

export type QuestionInsert = {
  quiz_id: string;
  question_ref_id: number;
  category: string;
  question_text: string;
  order_number: number;
  correct_answers: string[];
  distractor_answers: string[];
  is_custom: boolean;
};

export const QuizModel = {
  async create(payload: QuizInsert) {
    const { data, error } = await supabaseAdmin.from('quizzes').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async insertQuestions(rows: QuestionInsert[]) {
    const { data, error } = await supabaseAdmin.from('quiz_questions').insert(rows).select();
    if (error) throw error;
    return data;
  },

  async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('quizzes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findActiveById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listByUser(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('quizzes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async update(id: string, patch: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin.from('quizzes').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async claimDraft(quizId: string, draftToken: string, userId: string) {
    const { data, error } = await supabaseAdmin
      .from('quizzes')
      .update({ user_id: userId, draft_token: null })
      .eq('id', quizId)
      .eq('draft_token', draftToken)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getQuestions(quizId: string) {
    const { data, error } = await supabaseAdmin
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_number');
    if (error) throw error;
    return data || [];
  },

  async requireOwned(quizId: string, userId: string) {
    const quiz = await this.findById(quizId);
    if (!quiz) throw notFound('Quiz not found');
    if (quiz.user_id !== userId) throw notFound('Quiz not found');
    return quiz;
  },
};
