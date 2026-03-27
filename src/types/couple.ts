import type { Tables } from '@/integrations/supabase/types';

export type CoupleSession = Tables<'couple_sessions'>;

export interface StoredCoupleSessionState {
  code: string;
  slot: 'first' | 'second';
}
