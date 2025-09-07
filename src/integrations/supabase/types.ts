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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      cms_pages: {
        Row: {
          allowed_tag_ids: string[]
          blocked_tag_ids: string[]
          content: string | null
          content_blocks: Json
          created_at: string
          expire_action: string
          id: string
          internal_name: string | null
          internal_timer: boolean
          is_published: boolean
          passcode: string | null
          require_passcode: boolean
          share_code: string
          show_milliseconds: boolean
          slug: string
          tag_label: string | null
          timer_bg_color: string
          timer_day_label: string | null
          timer_deadline: string | null
          timer_display_mode: string
          timer_duration_seconds: number | null
          timer_enabled: boolean
          timer_hour_label: string | null
          timer_minute_label: string | null
          timer_mode: string
          timer_mode_step_delivery: boolean | null
          timer_scenario_id: string | null
          timer_second_label: string | null
          timer_step_id: string | null
          timer_style: string
          timer_text: string | null
          timer_text_color: string
          title: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["page_visibility"]
        }
        Insert: {
          allowed_tag_ids?: string[]
          blocked_tag_ids?: string[]
          content?: string | null
          content_blocks?: Json
          created_at?: string
          expire_action?: string
          id?: string
          internal_name?: string | null
          internal_timer?: boolean
          is_published?: boolean
          passcode?: string | null
          require_passcode?: boolean
          share_code?: string
          show_milliseconds?: boolean
          slug: string
          tag_label?: string | null
          timer_bg_color?: string
          timer_day_label?: string | null
          timer_deadline?: string | null
          timer_display_mode?: string
          timer_duration_seconds?: number | null
          timer_enabled?: boolean
          timer_hour_label?: string | null
          timer_minute_label?: string | null
          timer_mode?: string
          timer_mode_step_delivery?: boolean | null
          timer_scenario_id?: string | null
          timer_second_label?: string | null
          timer_step_id?: string | null
          timer_style?: string
          timer_text?: string | null
          timer_text_color?: string
          title: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["page_visibility"]
        }
        Update: {
          allowed_tag_ids?: string[]
          blocked_tag_ids?: string[]
          content?: string | null
          content_blocks?: Json
          created_at?: string
          expire_action?: string
          id?: string
          internal_name?: string | null
          internal_timer?: boolean
          is_published?: boolean
          passcode?: string | null
          require_passcode?: boolean
          share_code?: string
          show_milliseconds?: boolean
          slug?: string
          tag_label?: string | null
          timer_bg_color?: string
          timer_day_label?: string | null
          timer_deadline?: string | null
          timer_display_mode?: string
          timer_duration_seconds?: number | null
          timer_enabled?: boolean
          timer_hour_label?: string | null
          timer_minute_label?: string | null
          timer_mode?: string
          timer_mode_step_delivery?: boolean | null
          timer_scenario_id?: string | null
          timer_second_label?: string | null
          timer_step_id?: string | null
          timer_style?: string
          timer_text?: string | null
          timer_text_color?: string
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["page_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "cms_pages_timer_scenario_id_fkey"
            columns: ["timer_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_pages_timer_step_id_fkey"
            columns: ["timer_step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_migration_log: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          migration_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          migration_type: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          migration_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
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
      form_submissions: {
        Row: {
          data: Json
          form_id: string
          friend_id: string | null
          id: string
          line_user_id: string | null
          meta: Json | null
          source_uid: string | null
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          data: Json
          form_id: string
          friend_id?: string | null
          id?: string
          line_user_id?: string | null
          meta?: Json | null
          source_uid?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          data?: Json
          form_id?: string
          friend_id?: string | null
          id?: string
          line_user_id?: string | null
          meta?: Json | null
          source_uid?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          accent_color: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_public: boolean
          name: string
          post_submit_scenario_id: string | null
          prevent_duplicate_per_friend: boolean
          require_line_friend: boolean
          submit_button_bg_color: string
          submit_button_text: string | null
          submit_button_text_color: string
          submit_button_variant: string | null
          success_message: string | null
          success_message_mode: string
          success_message_plain: string | null
          success_message_template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_public?: boolean
          name: string
          post_submit_scenario_id?: string | null
          prevent_duplicate_per_friend?: boolean
          require_line_friend?: boolean
          submit_button_bg_color?: string
          submit_button_text?: string | null
          submit_button_text_color?: string
          submit_button_variant?: string | null
          success_message?: string | null
          success_message_mode?: string
          success_message_plain?: string | null
          success_message_template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_public?: boolean
          name?: string
          post_submit_scenario_id?: string | null
          prevent_duplicate_per_friend?: boolean
          require_line_friend?: boolean
          submit_button_bg_color?: string
          submit_button_text?: string | null
          submit_button_text_color?: string
          submit_button_variant?: string | null
          success_message?: string | null
          success_message_mode?: string
          success_message_plain?: string | null
          success_message_template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_post_submit_scenario_id_fkey"
            columns: ["post_submit_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_success_message_template_id_fkey"
            columns: ["success_message_template_id"]
            isOneToOne: false
            referencedRelation: "success_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_page_access: {
        Row: {
          access_enabled: boolean
          access_source: string | null
          created_at: string
          first_access_at: string | null
          friend_id: string
          id: string
          page_share_code: string
          scenario_id: string | null
          step_id: string | null
          timer_end_at: string | null
          timer_start_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_enabled?: boolean
          access_source?: string | null
          created_at?: string
          first_access_at?: string | null
          friend_id: string
          id?: string
          page_share_code: string
          scenario_id?: string | null
          step_id?: string | null
          timer_end_at?: string | null
          timer_start_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_enabled?: boolean
          access_source?: string | null
          created_at?: string
          first_access_at?: string | null
          friend_id?: string
          id?: string
          page_share_code?: string
          scenario_id?: string | null
          step_id?: string | null
          timer_end_at?: string | null
          timer_start_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_tags: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          tag_id?: string
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
      line_accounts: {
        Row: {
          access_token: string | null
          account_name: string
          channel_id: string | null
          channel_secret: string | null
          created_at: string
          id: string
          is_active: boolean
          line_bot_id: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_name?: string
          channel_id?: string | null
          channel_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          line_bot_id?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_name?: string
          channel_id?: string | null
          channel_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          line_bot_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
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
          campaign_id: string | null
          created_at: string
          display_name: string | null
          id: string
          line_user_id: string
          picture_url: string | null
          registration_source: string | null
          scenario_name: string | null
          short_uid: string | null
          short_uid_ci: string | null
          total_payment_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          campaign_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id: string
          picture_url?: string | null
          registration_source?: string | null
          scenario_name?: string | null
          short_uid?: string | null
          short_uid_ci?: string | null
          total_payment_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          campaign_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id?: string
          picture_url?: string | null
          registration_source?: string | null
          scenario_name?: string | null
          short_uid?: string | null
          short_uid_ci?: string | null
          total_payment_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_videos: {
        Row: {
          completion_percentage: number | null
          created_at: string
          custom_text: string | null
          id: string
          show_timer: boolean | null
          updated_at: string
          video_duration: number | null
          video_type: string
          video_url: string
        }
        Insert: {
          completion_percentage?: number | null
          created_at?: string
          custom_text?: string | null
          id?: string
          show_timer?: boolean | null
          updated_at?: string
          video_duration?: number | null
          video_type: string
          video_url: string
        }
        Update: {
          completion_percentage?: number | null
          created_at?: string
          custom_text?: string | null
          id?: string
          show_timer?: boolean | null
          updated_at?: string
          video_duration?: number | null
          video_type?: string
          video_url?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          friend_uid: string | null
          id: string
          livemode: boolean | null
          metadata: Json | null
          product_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          friend_uid?: string | null
          id?: string
          livemode?: boolean | null
          metadata?: Json | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          friend_uid?: string | null
          id?: string
          livemode?: boolean | null
          metadata?: Json | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plan_configs: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          message_limit: number
          monthly_price: number
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          updated_at: string
          yearly_price: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          message_limit?: number
          monthly_price?: number
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          message_limit?: number
          monthly_price?: number
          name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      product_actions: {
        Row: {
          action_type: string
          add_tag_ids: string[] | null
          created_at: string
          failure_message: string | null
          id: string
          notification_method: string | null
          notify_user: boolean | null
          product_id: string
          remove_tag_ids: string[] | null
          scenario_action: string | null
          target_scenario_id: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          add_tag_ids?: string[] | null
          created_at?: string
          failure_message?: string | null
          id?: string
          notification_method?: string | null
          notify_user?: boolean | null
          product_id: string
          remove_tag_ids?: string[] | null
          scenario_action?: string | null
          target_scenario_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          add_tag_ids?: string[] | null
          created_at?: string
          failure_message?: string | null
          id?: string
          notification_method?: string | null
          notify_user?: boolean | null
          product_id?: string
          remove_tag_ids?: string[] | null
          scenario_action?: string | null
          target_scenario_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_settings: {
        Row: {
          button_color: string | null
          button_text: string | null
          cancel_redirect_url: string | null
          created_at: string
          custom_parameters: Json | null
          id: string
          landing_page_content: string | null
          landing_page_image_url: string | null
          landing_page_title: string | null
          product_id: string
          success_redirect_url: string | null
          updated_at: string
        }
        Insert: {
          button_color?: string | null
          button_text?: string | null
          cancel_redirect_url?: string | null
          created_at?: string
          custom_parameters?: Json | null
          id?: string
          landing_page_content?: string | null
          landing_page_image_url?: string | null
          landing_page_title?: string | null
          product_id: string
          success_redirect_url?: string | null
          updated_at?: string
        }
        Update: {
          button_color?: string | null
          button_text?: string | null
          cancel_redirect_url?: string | null
          created_at?: string
          custom_parameters?: Json | null
          id?: string
          landing_page_content?: string | null
          landing_page_image_url?: string | null
          landing_page_title?: string | null
          product_id?: string
          success_redirect_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          currency: string | null
          description: string | null
          id: string
          interval: string | null
          is_active: boolean | null
          name: string
          price: number | null
          product_type: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_period_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          name: string
          price?: number | null
          product_type: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_period_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          name?: string
          price?: number | null
          product_type?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_period_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          add_friend_url: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          current_month: number | null
          current_year: number | null
          delivery_count: number | null
          delivery_limit: number | null
          display_name: string | null
          first_name: string | null
          first_name_kana: string | null
          friends_count: number | null
          google_id: string | null
          has_line_business: boolean | null
          id: string
          is_business: boolean | null
          last_name: string | null
          last_name_kana: string | null
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
          onboarding_completed: boolean | null
          onboarding_step: number | null
          phone_number: string | null
          provider: string | null
          quota_updated_at: string | null
          total_payment_amount: number | null
          updated_at: string
          user_id: string
          user_role: string | null
          user_suspended: boolean
          webhook_url: string | null
        }
        Insert: {
          add_friend_url?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          current_month?: number | null
          current_year?: number | null
          delivery_count?: number | null
          delivery_limit?: number | null
          display_name?: string | null
          first_name?: string | null
          first_name_kana?: string | null
          friends_count?: number | null
          google_id?: string | null
          has_line_business?: boolean | null
          id?: string
          is_business?: boolean | null
          last_name?: string | null
          last_name_kana?: string | null
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
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          phone_number?: string | null
          provider?: string | null
          quota_updated_at?: string | null
          total_payment_amount?: number | null
          updated_at?: string
          user_id: string
          user_role?: string | null
          user_suspended?: boolean
          webhook_url?: string | null
        }
        Update: {
          add_friend_url?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          current_month?: number | null
          current_year?: number | null
          delivery_count?: number | null
          delivery_limit?: number | null
          display_name?: string | null
          first_name?: string | null
          first_name_kana?: string | null
          friends_count?: number | null
          google_id?: string | null
          has_line_business?: boolean | null
          id?: string
          is_business?: boolean | null
          last_name?: string | null
          last_name_kana?: string | null
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
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          phone_number?: string | null
          provider?: string | null
          quota_updated_at?: string | null
          total_payment_amount?: number | null
          updated_at?: string
          user_id?: string
          user_role?: string | null
          user_suspended?: boolean
          webhook_url?: string | null
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          action_type: string
          attempts: number
          blocked_until: string | null
          created_at: string
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          action_type?: string
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          action_type?: string
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          identifier?: string
          window_start?: string
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
        Relationships: [
          {
            foreignKeyName: "fk_scenario_friend_logs_friend"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_scenario_friend_logs_scenario"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sfl_friend"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sfl_scenario"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_friend_logs_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_friend_logs_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "fk_invite_codes_scenario"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "fk_scenario_transitions_from"
            columns: ["from_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_scenario_transitions_to"
            columns: ["to_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_transitions_from_fkey"
            columns: ["from_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_transitions_from_scenario_id_fkey"
            columns: ["from_scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_transitions_to_fkey"
            columns: ["to_scenario_id"]
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
      secure_line_credentials: {
        Row: {
          created_at: string | null
          credential_type: string
          encrypted_value: string | null
          id: string
          updated_at: string | null
          user_id: string
          vault_secret_id: string | null
        }
        Insert: {
          created_at?: string | null
          credential_type: string
          encrypted_value?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          vault_secret_id?: string | null
        }
        Update: {
          created_at?: string | null
          credential_type?: string
          encrypted_value?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          vault_secret_id?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_events_log: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      step_delivery_logs: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          delivery_status: string
          error_message: string | null
          friend_id: string | null
          id: string
          retry_count: number | null
          scenario_id: string | null
          scheduled_at: string | null
          step_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string
          error_message?: string | null
          friend_id?: string | null
          id?: string
          retry_count?: number | null
          scenario_id?: string | null
          scheduled_at?: string | null
          step_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string
          error_message?: string | null
          friend_id?: string | null
          id?: string
          retry_count?: number | null
          scenario_id?: string | null
          scheduled_at?: string | null
          step_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "step_delivery_logs_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_delivery_logs_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_delivery_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      step_delivery_tracking: {
        Row: {
          campaign_id: string | null
          created_at: string
          delivered_at: string | null
          error_count: number | null
          friend_id: string
          id: string
          last_error: string | null
          next_check_at: string | null
          registration_source: string | null
          scenario_id: string
          scheduled_delivery_at: string | null
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_count?: number | null
          friend_id: string
          id?: string
          last_error?: string | null
          next_check_at?: string | null
          registration_source?: string | null
          scenario_id: string
          scheduled_delivery_at?: string | null
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_count?: number | null
          friend_id?: string
          id?: string
          last_error?: string | null
          next_check_at?: string | null
          registration_source?: string | null
          scenario_id?: string
          scheduled_delivery_at?: string | null
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sdt_friend"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sdt_scenario"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sdt_step"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_delivery_tracking_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "line_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_delivery_tracking_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_delivery_tracking_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
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
          restore_config: Json | null
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
          restore_config?: Json | null
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
          restore_config?: Json | null
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
            foreignKeyName: "fk_step_messages_step"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
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
          prevent_auto_exit: boolean
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
          prevent_auto_exit?: boolean
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
          prevent_auto_exit?: boolean
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
          delivery_relative_to_previous: boolean | null
          delivery_seconds: number
          delivery_time_of_day: string | null
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
          delivery_relative_to_previous?: boolean | null
          delivery_seconds?: number
          delivery_time_of_day?: string | null
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
          delivery_relative_to_previous?: boolean | null
          delivery_seconds?: number
          delivery_time_of_day?: string | null
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
            foreignKeyName: "fk_steps_scenario"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steps_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_credentials: {
        Row: {
          created_at: string
          id: string
          is_live_mode: boolean | null
          live_publishable_key: string | null
          live_secret_key: string | null
          test_publishable_key: string | null
          test_secret_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_live_mode?: boolean | null
          live_publishable_key?: string | null
          live_secret_key?: string | null
          test_publishable_key?: string | null
          test_secret_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_live_mode?: boolean | null
          live_publishable_key?: string | null
          live_secret_key?: string | null
          test_publishable_key?: string | null
          test_secret_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          livemode: boolean | null
          metadata: Json | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          livemode?: boolean | null
          metadata?: Json | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          livemode?: boolean | null
          metadata?: Json | null
          processed_at?: string
        }
        Relationships: []
      }
      success_message_templates: {
        Row: {
          content_html: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_html: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_yearly: boolean
          monthly_revenue: number | null
          plan_end_date: string | null
          plan_start_date: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_yearly?: boolean
          monthly_revenue?: number | null
          plan_end_date?: string | null
          plan_start_date?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_yearly?: boolean
          monthly_revenue?: number | null
          plan_end_date?: string | null
          plan_start_date?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_watch_progress: {
        Row: {
          completion_percentage: number | null
          created_at: string
          id: string
          is_completed: boolean | null
          updated_at: string
          user_id: string
          video_type: string
          watch_time: number | null
        }
        Insert: {
          completion_percentage?: number | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          updated_at?: string
          user_id: string
          video_type: string
          watch_time?: number | null
        }
        Update: {
          completion_percentage?: number | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          updated_at?: string
          user_id?: string
          video_type?: string
          watch_time?: number | null
        }
        Relationships: []
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
        Insert: {
          clicks?: never
          created_at?: string | null
          friends?: never
          invite_code?: string | null
          is_active?: boolean | null
          scenario_id?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          clicks?: never
          created_at?: string | null
          friends?: never
          invite_code?: string | null
          is_active?: boolean | null
          scenario_id?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invite_codes_scenario"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "step_scenarios"
            referencedColumns: ["id"]
          },
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
      calculate_scheduled_delivery_time: {
        Args:
          | {
              p_delivery_days: number
              p_delivery_hours: number
              p_delivery_minutes: number
              p_delivery_seconds: number
              p_delivery_time_of_day?: string
              p_delivery_type: string
              p_friend_added_at: string
              p_previous_step_delivered_at?: string
              p_specific_time?: string
            }
          | {
              p_delivery_days: number
              p_delivery_hours: number
              p_delivery_minutes: number
              p_delivery_seconds: number
              p_delivery_type: string
              p_friend_added_at: string
              p_specific_time?: string
            }
        Returns: string
      }
      check_rate_limit: {
        Args: {
          identifier: string
          max_requests: number
          time_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_old_security_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_short_uid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_line_credentials_for_user: {
        Args: { p_user_id: string }
        Returns: {
          bot_id: string
          channel_access_token: string
          channel_id: string
          channel_secret: string
          liff_id: string
        }[]
      }
      get_line_credentials_secure: {
        Args: { p_credential_type: string; p_user_id: string }
        Returns: string
      }
      get_public_form_meta: {
        Args: { p_form_id: string }
        Returns: {
          accent_color: string
          description: string
          fields: Json
          id: string
          is_public: boolean
          liff_id: string
          name: string
          post_submit_scenario_id: string
          prevent_duplicate_per_friend: boolean
          require_line_friend: boolean
          submit_button_bg_color: string
          submit_button_text: string
          submit_button_text_color: string
          submit_button_variant: string
          success_message: string
          user_id: string
        }[]
      }
      get_public_profile_info: {
        Args: { profile_user_id: string }
        Returns: {
          display_name: string
          user_role: string
        }[]
      }
      get_user_line_credentials: {
        Args: { p_user_id: string }
        Returns: {
          bot_id: string
          channel_access_token: string
          channel_id: string
          channel_secret: string
          liff_id: string
        }[]
      }
      get_user_profile_secure: {
        Args: { profile_user_id: string }
        Returns: {
          display_name: string
          friends_count: number
          line_api_status: string
          user_role: string
        }[]
      }
      get_user_revenue_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          display_name: string
          is_active: boolean
          monthly_revenue: number
          plan_end_date: string
          plan_start_date: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          revenue_rank: number
          user_id: string
        }[]
      }
      log_security_event: {
        Args: {
          p_action?: string
          p_details?: Json
          p_ip_address?: string
          p_success?: boolean
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      log_security_event_enhanced: {
        Args:
          | {
              p_action?: string
              p_details?: Json
              p_ip_address?: string
              p_severity?: string
              p_success?: boolean
              p_user_agent?: string
              p_user_id?: string
            }
          | {
              p_details?: Json
              p_event_type: string
              p_ip_address?: string
              p_record_id?: string
              p_table_name?: string
              p_user_agent?: string
            }
        Returns: undefined
      }
      lookup_friend_by_uid: {
        Args: { p_form_id: string; p_uid: string }
        Returns: {
          friend_id: string
          line_user_id: string
        }[]
      }
      manage_friend_page_access: {
        Args: {
          p_action: string
          p_friend_id: string
          p_page_share_code: string
          p_scenario_id?: string
          p_step_id?: string
          p_timer_start_at?: string
        }
        Returns: Json
      }
      migrate_line_credentials_to_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          migrated_users: number
        }[]
      }
      migrate_user_credentials_to_secure: {
        Args: { p_user_id: string }
        Returns: Json
      }
      register_friend_to_scenario: {
        Args: {
          p_display_name?: string
          p_invite_code: string
          p_line_user_id: string
          p_picture_url?: string
        }
        Returns: Json
      }
      register_friend_with_scenario: {
        Args: {
          p_campaign_id?: string
          p_display_name?: string
          p_line_user_id: string
          p_picture_url?: string
          p_registration_source?: string
          p_scenario_name?: string
        }
        Returns: Json
      }
      sanitize_text_input: {
        Args: { input_text: string }
        Returns: string
      }
      trigger_scenario_delivery_for_friend: {
        Args: { p_line_user_id: string; p_scenario_id: string }
        Returns: Json
      }
      validate_and_sanitize_display_name: {
        Args: { name: string }
        Returns: string
      }
      validate_and_sanitize_json_input: {
        Args: { input_json: Json }
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
      validate_json_security: {
        Args: { input_json: Json }
        Returns: boolean
      }
      validate_line_user_id: {
        Args: { line_user_id: string }
        Returns: boolean
      }
      validate_line_user_id_enhanced: {
        Args: { line_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      message_kind: "incoming" | "outgoing"
      page_visibility: "friends_only" | "public"
      plan_type: "free" | "basic" | "premium" | "developer"
      step_message_type: "text" | "media" | "flex" | "restore_access"
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
      page_visibility: ["friends_only", "public"],
      plan_type: ["free", "basic", "premium", "developer"],
      step_message_type: ["text", "media", "flex", "restore_access"],
    },
  },
} as const
