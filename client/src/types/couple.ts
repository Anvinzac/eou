export type CoupleSession = {
  id: string;
  quiz_id: string;
  session_code: string;
  first_name: string | null;
  second_name: string | null;
  first_attempt_id: string | null;
  second_attempt_id: string | null;
  status: string;
  match_percentage: number | null;
  match_count: number | null;
  total_compared: number | null;
  match_details: unknown;
  completed_at: string | null;
};

export interface StoredCoupleSessionState {
  code: string;
  slot: 'first' | 'second';
}
