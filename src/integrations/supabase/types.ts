export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      couple_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          first_attempt_id: string | null
          first_name: string | null
          id: string
          match_count: number | null
          match_details: Json | null
          match_percentage: number | null
          quiz_id: string
          second_attempt_id: string | null
          second_name: string | null
          session_code: string
          status: string
          total_compared: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_attempt_id?: string | null
          first_name?: string | null
          id?: string
          match_count?: number | null
          match_details?: Json | null
          match_percentage?: number | null
          quiz_id: string
          second_attempt_id?: string | null
          second_name?: string | null
          session_code: string
          status?: string
          total_compared?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_attempt_id?: string | null
          first_name?: string | null
          id?: string
          match_count?: number | null
          match_details?: Json | null
          match_percentage?: number | null
          quiz_id?: string
          second_attempt_id?: string | null
          second_name?: string | null
          session_code?: string
          status?: string
          total_compared?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_sessions_first_attempt_id_fkey"
            columns: ["first_attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_sessions_second_attempt_id_fkey"
            columns: ["second_attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_key: string
          flag_label: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_key: string
          flag_label: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_key?: string
          flag_label?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_used: boolean
          label: string
          quiz_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_used?: boolean
          label: string
          quiz_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_used?: boolean
          label?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          id: string
          options: string[]
          options_vi: string[] | null
          question_text: string
          question_text_vi: string | null
          quiz_id: string
          votes: Json
        }
        Insert: {
          created_at?: string
          id?: string
          options: string[]
          options_vi?: string[] | null
          question_text: string
          question_text_vi?: string | null
          quiz_id: string
          votes?: Json
        }
        Update: {
          created_at?: string
          id?: string
          options?: string[]
          options_vi?: string[] | null
          question_text?: string
          question_text_vi?: string | null
          quiz_id?: string
          votes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "polls_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_packs: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          is_system: boolean
          questions: Json
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_system?: boolean
          questions?: Json
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_system?: boolean
          questions?: Json
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          invitation_id: string | null
          quiz_id: string
          respondent_name: string | null
          score: number
          total_questions: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          invitation_id?: string | null
          quiz_id: string
          respondent_name?: string | null
          score?: number
          total_questions?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          invitation_id?: string | null
          quiz_id?: string
          respondent_name?: string | null
          score?: number
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          category: string
          correct_answers: string[]
          correct_answers_vi: string[] | null
          created_at: string
          distractor_answers: string[]
          distractor_answers_vi: string[] | null
          id: string
          is_custom: boolean
          order_number: number
          question_ref_id: number
          question_text: string
          question_text_vi: string | null
          quiz_id: string
        }
        Insert: {
          category: string
          correct_answers: string[]
          correct_answers_vi?: string[] | null
          created_at?: string
          distractor_answers: string[]
          distractor_answers_vi?: string[] | null
          id?: string
          is_custom?: boolean
          order_number: number
          question_ref_id: number
          question_text: string
          question_text_vi?: string | null
          quiz_id: string
        }
        Update: {
          category?: string
          correct_answers?: string[]
          correct_answers_vi?: string[] | null
          created_at?: string
          distractor_answers?: string[]
          distractor_answers_vi?: string[] | null
          id?: string
          is_custom?: boolean
          order_number?: number
          question_ref_id?: number
          question_text?: string
          question_text_vi?: string | null
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
          selected_answer: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          draft_token: string | null
          id: string
          is_active: boolean
          is_open: boolean
          language: string
          max_questions: number
          quiz_type: Database["public"]["Enums"]["quiz_type"]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          draft_token?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean
          language?: string
          max_questions?: number
          quiz_type?: Database["public"]["Enums"]["quiz_type"]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          draft_token?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean
          language?: string
          max_questions?: number
          quiz_type?: Database["public"]["Enums"]["quiz_type"]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      quiz_type: "preference" | "poll"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      quiz_type: ["preference", "poll"],
    },
  },
} as const
