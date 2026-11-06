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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_messages: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: string
          sent_by: string
          status: string
          subject: string
          to_email: string
          to_user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: string
          sent_by: string
          status?: string
          subject: string
          to_email: string
          to_user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          sent_by?: string
          status?: string
          subject?: string
          to_email?: string
          to_user_id?: string | null
        }
        Relationships: []
      }
      agent_mind_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          images: string[]
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_posts: {
        Row: {
          created_at: string
          description: string
          id: string
          images: string[]
          tags: string[]
          title: string
          understanding: string
          understood: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          tags?: string[]
          title?: string
          understanding?: string
          understood?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          tags?: string[]
          title?: string
          understanding?: string
          understood?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_rules: {
        Row: {
          created_at: string
          id: string
          kind: string
          rule: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          rule: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          rule?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          category: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      image_history: {
        Row: {
          aspect: string
          created_at: string
          id: string
          images: Json
          liked: boolean
          prompt: string
          user_id: string
        }
        Insert: {
          aspect?: string
          created_at?: string
          id?: string
          images: Json
          liked?: boolean
          prompt: string
          user_id: string
        }
        Update: {
          aspect?: string
          created_at?: string
          id?: string
          images?: Json
          liked?: boolean
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      kb_conversations: {
        Row: {
          ai_message: string
          created_at: string
          heading_id: string | null
          id: string
          lang: string
          tags: string[]
          updated_at: string
          user_id: string
          user_message: string
        }
        Insert: {
          ai_message: string
          created_at?: string
          heading_id?: string | null
          id?: string
          lang?: string
          tags?: string[]
          updated_at?: string
          user_id: string
          user_message: string
        }
        Update: {
          ai_message?: string
          created_at?: string
          heading_id?: string | null
          id?: string
          lang?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_conversations_heading_id_fkey"
            columns: ["heading_id"]
            isOneToOne: false
            referencedRelation: "kb_headings"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entries: {
        Row: {
          content: string
          created_at: string
          heading_id: string
          id: string
          lang: string
          source: string
          subtopic: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          content: string
          created_at?: string
          heading_id: string
          id?: string
          lang?: string
          source?: string
          subtopic?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          content?: string
          created_at?: string
          heading_id?: string
          id?: string
          lang?: string
          source?: string
          subtopic?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_entries_heading_id_fkey"
            columns: ["heading_id"]
            isOneToOne: false
            referencedRelation: "kb_headings"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_folders: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kb_headings: {
        Row: {
          created_at: string
          description: string
          id: string
          lang: string | null
          name: string
          source_heading_id: string | null
          translation_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          lang?: string | null
          name: string
          source_heading_id?: string | null
          translation_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lang?: string | null
          name?: string
          source_heading_id?: string | null
          translation_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_headings_source_heading_id_fkey"
            columns: ["source_heading_id"]
            isOneToOne: false
            referencedRelation: "kb_headings"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_images: {
        Row: {
          created_at: string
          description: string
          heading_id: string | null
          id: string
          label: string
          storage_path: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          heading_id?: string | null
          id?: string
          label?: string
          storage_path: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          heading_id?: string | null
          id?: string
          label?: string
          storage_path?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_images_heading_id_fkey"
            columns: ["heading_id"]
            isOneToOne: false
            referencedRelation: "kb_headings"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_languages: {
        Row: {
          code: string
          enabled: boolean
          instructions: string
          is_source: boolean
          name: string
          native_name: string
          sort: number
        }
        Insert: {
          code: string
          enabled?: boolean
          instructions?: string
          is_source?: boolean
          name: string
          native_name?: string
          sort?: number
        }
        Update: {
          code?: string
          enabled?: boolean
          instructions?: string
          is_source?: boolean
          name?: string
          native_name?: string
          sort?: number
        }
        Relationships: []
      }
      kb_ml_items: {
        Row: {
          created_at: string
          heading_id: string | null
          id: string
          original_hindi: string
          statuses: Json
          translations: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          heading_id?: string | null
          id?: string
          original_hindi: string
          statuses?: Json
          translations?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Update: {
          created_at?: string
          heading_id?: string | null
          id?: string
          original_hindi?: string
          statuses?: Json
          translations?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_ml_items_heading_id_fkey"
            columns: ["heading_id"]
            isOneToOne: false
            referencedRelation: "kb_headings"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_model_docs: {
        Row: {
          answer: string
          heading_id: string | null
          heading_name: string
          id: string
          length: number
          model_id: string
          source_id: string | null
          source_kind: string
          text: string
          title: string
          user_id: string
        }
        Insert: {
          answer?: string
          heading_id?: string | null
          heading_name?: string
          id?: string
          length?: number
          model_id: string
          source_id?: string | null
          source_kind: string
          text: string
          title?: string
          user_id: string
        }
        Update: {
          answer?: string
          heading_id?: string | null
          heading_name?: string
          id?: string
          length?: number
          model_id?: string
          source_id?: string | null
          source_kind?: string
          text?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_model_docs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "kb_models"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_model_terms: {
        Row: {
          df: number
          heading_weights: Json
          id: string
          idf: number
          model_id: string
          postings: Json
          term: string
          user_id: string
        }
        Insert: {
          df?: number
          heading_weights?: Json
          id?: string
          idf?: number
          model_id: string
          postings?: Json
          term: string
          user_id: string
        }
        Update: {
          df?: number
          heading_weights?: Json
          id?: string
          idf?: number
          model_id?: string
          postings?: Json
          term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_model_terms_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "kb_models"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_models: {
        Row: {
          created_at: string
          doc_count: number
          id: string
          is_active: boolean
          metrics: Json
          name: string
          params: Json
          status: string
          trained_at: string | null
          updated_at: string
          user_id: string
          version: number
          vocab_size: number
        }
        Insert: {
          created_at?: string
          doc_count?: number
          id?: string
          is_active?: boolean
          metrics?: Json
          name: string
          params?: Json
          status?: string
          trained_at?: string | null
          updated_at?: string
          user_id: string
          version?: number
          vocab_size?: number
        }
        Update: {
          created_at?: string
          doc_count?: number
          id?: string
          is_active?: boolean
          metrics?: Json
          name?: string
          params?: Json
          status?: string
          trained_at?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          vocab_size?: number
        }
        Relationships: []
      }
      kb_tests: {
        Row: {
          created_at: string
          expected: string
          id: string
          last_answer: string
          last_run_at: string | null
          last_score: number | null
          question: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected?: string
          id?: string
          last_answer?: string
          last_run_at?: string | null
          last_score?: number | null
          question: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected?: string
          id?: string
          last_answer?: string
          last_run_at?: string | null
          last_score?: number | null
          question?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kb_training_runs: {
        Row: {
          finished_at: string | null
          id: string
          log: string
          model_id: string | null
          started_at: string
          stats: Json
          status: string
          user_id: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          log?: string
          model_id?: string | null
          started_at?: string
          stats?: Json
          status?: string
          user_id: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          log?: string
          model_id?: string | null
          started_at?: string
          stats?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_training_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "kb_models"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_packs: {
        Row: {
          doc_count: number
          docs: Json
          id: string
          published: boolean
          updated_at: string
        }
        Insert: {
          doc_count?: number
          docs?: Json
          id?: string
          published?: boolean
          updated_at?: string
        }
        Update: {
          doc_count?: number
          docs?: Json
          id?: string
          published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          language: string | null
          last_active_date: string | null
          onboarded: boolean
          streak_count: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          country?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          language?: string | null
          last_active_date?: string | null
          onboarded?: boolean
          streak_count?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string | null
          last_active_date?: string | null
          onboarded?: boolean
          streak_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          category: string | null
          content: Json
          created_at: string
          id: string
          kind: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: Json
          created_at?: string
          id?: string
          kind: string
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: Json
          created_at?: string
          id?: string
          kind?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      site_versions: {
        Row: {
          created_at: string
          html: string
          id: string
          instruction: string | null
          site_id: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          html: string
          id?: string
          instruction?: string | null
          site_id: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          html?: string
          id?: string
          instruction?: string | null
          site_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_versions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          html: string
          id: string
          kind: string
          prompt: string
          published: boolean
          slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          html?: string
          id?: string
          kind?: string
          prompt: string
          published?: boolean
          slug: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          html?: string
          id?: string
          kind?: string
          prompt?: string
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      voice_credits: {
        Row: {
          created_at: string
          day: string
          seconds_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          seconds_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          seconds_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_connections: {
        Row: {
          channel_id: string
          channel_thumbnail: string | null
          channel_title: string
          created_at: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          channel_thumbnail?: string | null
          channel_title: string
          created_at?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          channel_thumbnail?: string | null
          channel_title?: string
          created_at?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_voice_seconds: {
        Args: { _cap?: number; _seconds: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_agent_user: { Args: { _user_id: string }; Returns: boolean }
      kb_ml_set: {
        Args: { _code: string; _id: string; _status: string; _text?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
