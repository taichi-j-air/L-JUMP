export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          line_message_id: string | null
          message_text: string
          message_type: Database["public"]["Enums"]["message_kind"]
          read_at: string | null
          sent_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          line_message_id?: string | null
          message_text: string
          message_type?: Database["public"]["Enums"]["message_kind"]
          read_at?: string | null
          sent_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          line_message_id?: string | null
          message_text?: string
          message_type?: Database["public"]["Enums"]["message_kind"]
          read_at?: string | null
          sent_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invite_clicks: {
        Row: {
          clicked_at: string | null
          id: string
          invite_code: string
          ip: string | null
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          invite_code: string
          ip?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string | null
          id?: string
          invite_code?: string
          ip?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      invite_page_views: {
        Row: {
          device_type: string | null
          id: string
          invite_code: string
          referer: string | null
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          device_type?: string | null
          id?: string
          invite_code: string
          referer?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          device_type?: string | null
          id?: string
          invite_code?: string
          referer?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      line_api_credentials: {
        Row: {
          created_at: string | null
          encrypted_at: string | null
          id: string
          liff_id: string | null
          liff_url: string | null
          line_bot_id: string | null
          line_channel_access_token: string | null
          line_channel_id: string | null
          line_channel_secret: string | null
          line_login_channel_id: string | null
          line_login_channel_secret: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_at?: string | null
          id?: string
          liff_id?: string | null
          liff_url?: string | null
          line_bot_id?: string | null
          line_channel_access_token?: string | null
          line_channel_id?: string | null
          line_channel_secret?: string | null
          line_login_channel_id?: string | null
          line_login_channel_secret?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_at?: string | null
          id?: string
          liff_id?: string | null
          liff_url?: string | null
          line_bot_id?: string | null
          line_channel_access_token?: string | null
          line_channel_id?: string | null
          line_channel_secret?: string | null
          line_login_channel_id?: string | null
          line_login_channel_secret?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      line_friends: {
        Row: {
          added_at: string
          created_at: string
          display_name: string | null
          id: string
          line_user_id: string
          picture_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id: string
          picture_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id?: string
          picture_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          add_friend_url: string | null
          created_at: string
          current_month: number | null
          current_year: number | null
          delivery_count: number | null
          delivery_limit: number | null
          display_name: string | null
          friends_count: number | null
          id: string
          liff_id: string | null
          liff_url: string | null
          line_api_status: string | null
          line_bot_id: string | null
          line_channel_access_token: string | null
          line_channel_id: string | null
          line_channel_secret: string | null
          line_login_channel_id: string | null
          line_login_channel_secret: string | null
          line_user_id: string | null
          monthly_message_limit: number | null
          monthly_message_used: number | null
          quota_updated_at: string | null
          updated_at: string
          user_id: string
          user_role: string | null
          webhook_url: string | null
        }
        Insert: {
          add_friend_url?: string | null
          created_at?: string
          current_month?: number | null
          current_year?: number | null
          delivery_count?: number | null
          delivery_limit?: number | null
          display_name?: string | null
          friends_count?: number | null
          id?: string
          liff_id?: string | null
          liff_url?: string | null
          line_api_status?: string | null
          line_bot_id?: string | null
          line_channel_access_token?: string | null
          line_channel_id?: string | null
          line_channel_secret?: string | null
          line_login_channel_id?: string | null
          line_login_channel_secret?: string | null
          line_user_id?: string | null
          monthly_message_limit?: number | null
          monthly_message_used?: number | null
          quota_updated_at?: string | null
          updated_at?: string
          user_id: string
          user_role?: string | null
          webhook_url?: string | null
        }
        Update: {
          add_friend_url?: string | null
          created_at?: string
          current_month?: number | null
          current_year?: number | null
          delivery_count?: number | null
          delivery_limit?: number | null
          display_name?: string | null
          friends_count?: number | null
          id?: string
          liff_id?: string | null
          liff_url?: string | null
          line_api_status?: string | null
          line_bot_id?: string | null
          line_channel_access_token?: string | null
          line_channel_id?: string | null
          line_channel_secret?: string | null
          line_login_channel_id?: string | null
          line_login_channel_secret?: string | null
          line_user_id?: string | null
          monthly_message_limit?: number | null
          monthly_message_used?: number | null
          quota_updated_at?: string | null
          updated_at?: string
          user_id?: string
          user_role?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      scenario_friend_logs: {
        Row: {
          added_at: string
          friend_id: string | null
          id: string
          invite_code: string
          line_user_id: string | null
          scenario_id: string
        }
        Insert: {
          added_at?: string
          friend_id?: string | null
          id?: string
          invite_code: string
          line_user_id?: string | null
          scenario_id: string
        }
        Update: {
          added_at?: string
          friend_id?: string | null
          id?: string
          invite_code?: string
          line_user_id?: string | null
          scenario_id?: string
        }
        Relationships: []
      }
      scenario_invite_codes: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          is_active: boolean
          max_usage: number | null
          scenario_id: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          is_active?: boolean
          max_usage?: number | null
          scenario_id: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          max_usage?: number | null
          scenario_id?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_invite_codes_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_transitions: {
        Row: {
          condition_type: string
          created_at: string
          from_scenario_id: string
          id: string
          to_scenario_id: string
          updated_at: string
        }
        Insert: {
          condition_type?: string
          created_at?: string
          from_scenario_id: string
          id?: string
          to_scenario_id: string
          updated_at?: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          from_scenario_id?: string
          id?: string
          to_scenario_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_transitions_from_scenario_id_fkey"
            columns: ["from_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_transitions_to_scenario_id_fkey"
            columns: ["to_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      step_delivery_tracking: {
        Row: {
          created_at: string
          delivered_at: string | null
          friend_id: string
          id: string
          scenario_id: string
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          friend_id: string
          id?: string
          scenario_id: string
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          friend_id?: string
          id?: string
          scenario_id?: string
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      step_messages: {
        Row: {
          content: string
          created_at: string
          flex_message_id: string | null
          id: string
          media_url: string | null
          message_order: number
          message_type: Database["public"]["Enums"]["step_message_type"]
          step_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          flex_message_id?: string | null
          id?: string
          media_url?: string | null
          message_order: number
          message_type: Database["public"]["Enums"]["step_message_type"]
          step_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          flex_message_id?: string | null
          id?: string
          media_url?: string | null
          message_order?: number
          message_type?: Database["public"]["Enums"]["step_message_type"]
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_step_messages_flex_message_id"
            columns: ["flex_message_id"]
            isOneToOne: false
            referencedRelation: "flex_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_messages_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      step_scenarios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          scenario_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          scenario_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scenario_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_step_scenarios_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      steps: {
        Row: {
          created_at: string
          delivery_days: number | null
          delivery_hours: number | null
          delivery_minutes: number | null
          delivery_seconds: number
          delivery_type: string
          id: string
          name: string
          scenario_id: string
          specific_time: string | null
          step_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_days?: number | null
          delivery_hours?: number | null
          delivery_minutes?: number | null
          delivery_seconds?: number
          delivery_type: string
          id?: string
          name: string
          scenario_id: string
          specific_time?: string | null
          step_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_days?: number | null
          delivery_hours?: number | null
          delivery_minutes?: number | null
          delivery_seconds?: number
          delivery_type?: string
          id?: string
          name?: string
          scenario_id?: string
          specific_time?: string | null
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "steps_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      scenario_invite_stats: {
        Row: {
          clicks: number | null
          created_at: string | null
          friends: number | null
          invite_code: string | null
          is_active: boolean | null
          scenario_id: string | null
          usage_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenario_invite_codes_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_public_profile_info: {
        Args: { profile_user_id: string }
        Returns: {
          display_name: string
          user_role: string
        }[]
      }
      register_friend_to_scenario: {
        Args: {
          p_line_user_id: string
          p_invite_code: string
          p_display_name?: string
          p_picture_url?: string
        }
        Returns: Json
      }
      trigger_scenario_delivery_for_friend: {
        Args: { p_line_user_id: string; p_scenario_id: string }
        Returns: Json
      }
      validate_display_name: {
        Args: { name: string }
        Returns: boolean
      }
      validate_invite_code: {
        Args: { code: string }
        Returns: boolean
      }
    }
    Enums: {
      message_kind: "incoming" | "outgoing"
      step_message_type: "text" | "media" | "flex"
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
      message_kind: ["incoming", "outgoing"],
      step_message_type: ["text", "media", "flex"],
    },
  },
} as const
