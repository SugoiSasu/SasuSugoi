export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          criteria: Json
          description: string | null
          enabled: boolean
          icon_url: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
      }
      ad_events: {
        Row: {
          ad_id: string
          created_at: string
          id: number
          kind: string
          session_key: string | null
        }
      }
      ads: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          image_url: string
          link_url: string | null
          message: string
          place_id: string | null
          starts_at: string | null
          updated_at: string
        }
      }
      blog_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content_md: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          place_id: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          tags: string[]
          title: string
          updated_at: string
        }
      }
      collab_replies: {
        Row: {
          author_id: string | null
          body: string
          channel: string
          created_at: string
          id: string
          sent_at: string
          submission_id: string
        }
      }
      collab_submissions: {
        Row: {
          admin_notes: string | null
          brand: string
          consent_accepted_at: string
          consent_version: string
          created_at: string
          email: string
          id: string
          message: string
          status: Database["public"]["Enums"]["collab_status"]
          status_updated_at: string | null
          status_updated_by: string | null
          user_agent: string | null
        }
      }
      cuisines: {
        Row: {
          color: string | null
          created_at: string
          emoji: string | null
          enabled: boolean
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
      }
      food_challenge_completions: {
        Row: {
          challenge_id: string
          completed_at: string
          id: string
          user_id: string
        }
      }
      food_challenges: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          icon: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
      }
      friend_favorites: {
        Row: { created_at: string; friend_id: string; user_id: string }
      }
      friend_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          inviter_id: string
          status: string
          token: string
        }
      }
      friend_list_members: {
        Row: { created_at: string; friend_id: string; list_id: string }
      }
      friend_lists: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
      }
      friend_notes: {
        Row: { friend_id: string; note: string; updated_at: string; user_id: string }
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
        }
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          ref_id: string | null
          ref_type: string | null
          title: string
          type: string
          user_id: string
        }
      }
      owner_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          instagram_url: string | null
          message: string | null
          name: string
          place_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string | null
          website_url: string | null
        }
      }
      place_favorites: {
        Row: { created_at: string; id: string; place_id: string; user_id: string }
      }
      place_follows: {
        Row: { created_at: string; id: string; place_id: string; user_id: string }
      }
      place_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string | null
          lat: number
          lng: number
          place_id: string
          sort_order: number
          updated_at: string
        }
      }
      place_owners: {
        Row: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
          verified: boolean
        }
      }
      place_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          place_id: string
          sort_order: number
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
          url: string
        }
      }
      place_post_comments: {
        Row: { body: string; created_at: string; id: string; post_id: string; user_id: string }
      }
      place_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
      }
      place_posts: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          owner_id: string | null
          place_id: string
          post_type: string
          title: string
          updated_at: string
        }
      }
      place_suggestions: {
        Row: {
          address: string | null
          approved_place_id: string | null
          created_at: string
          cuisine: string | null
          id: string
          instagram: string | null
          name: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          submitter_email: string | null
          submitter_name: string | null
          updated_at: string
          website: string | null
        }
      }
      place_visits: {
        Row: {
          created_at: string
          id: string
          place_id: string
          status: Database["public"]["Enums"]["place_visit_status"]
          updated_at: string
          user_id: string
        }
      }
      places: {
        Row: {
          address: string
          avatar_url: string | null
          cover_image_url: string | null
          created_at: string
          cuisine: string
          description: string
          district: string | null
          has_takeaway: boolean
          id: string
          is_published: boolean
          lat: number
          lng: number
          menu_image_url: string | null
          menu_items: Json | null
          menu_url: string | null
          name: string
          opening_hours: Json | null
          phone: string | null
          price_range: string | null
          promo_active: boolean
          promo_label: string | null
          rating: number
          reel_url: string | null
          slug: string
          sort_order: number
          updated_at: string
          website: string | null
          wheelchair_accessible: boolean
        }
      }
      points_rules: {
        Row: {
          description: string | null
          enabled: boolean
          event_key: string
          points: number
          updated_at: string
        }
      }
      points_transactions: {
        Row: {
          created_at: string
          event_key: string
          id: string
          points: number
          ref_id: string | null
          ref_type: string | null
          user_id: string
        }
      }
      profiles: {
        Row: {
          avatar_source: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          district: string | null
          facebook_url: string | null
          favorite_cuisines: string[]
          id: string
          instagram_url: string | null
          is_beta_tester: boolean
          is_public: boolean
          points_total: number
          returned_after_break_at: string | null
          tiktok_url: string | null
          updated_at: string
          username: string | null
          x_url: string | null
          youtube_url: string | null
        }
      }
      ranks: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
      }
      review_comments: {
        Row: { body: string; created_at: string; id: string; review_id: string; updated_at: string; user_id: string }
      }
      review_reactions: {
        Row: { created_at: string; review_id: string; type: string; user_id: string }
      }
      review_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          place_id: string
          review_id: string
          updated_at: string
        }
      }
      review_tags: {
        Row: { created_at: string; review_id: string; tagged_user_id: string; tagger_id: string }
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          photo_url: string | null
          place_id: string
          rating: number
          updated_at: string
          user_id: string
          video_url: string | null
        }
      }
      site_settings: {
        Row: { key: string; updated_at: string; value: Json }
      }
      social_accounts: {
        Row: {
          created_at: string
          extra: Json
          followers_count: number | null
          handle: string
          id: string
          is_active: boolean
          last_sync_error: string | null
          last_synced_at: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          posts_count: number | null
          profile_url: string | null
          updated_at: string
        }
      }
      suppressed_emails: {
        Row: { created_at: string; email: string; id: string; metadata: Json | null; reason: string }
      }
      user_achievements: {
        Row: { achievement_id: string; id: string; unlocked_at: string; user_id: string }
      }
      user_blocks: {
        Row: { blocked_id: string; blocker_id: string; created_at: string }
      }
      user_ranks: {
        Row: { granted_at: string; granted_by: string | null; id: string; rank_id: string; user_id: string }
      }
      user_roles: {
        Row: { id: string; role: Database["public"]["Enums"]["app_role"]; user_id: string }
      }
    }
    Views: {
      social_accounts_public: {
        Row: {
          followers_count: number | null
          handle: string | null
          is_active: boolean | null
          platform: Database["public"]["Enums"]["social_platform"] | null
          posts_count: number | null
          profile_url: string | null
        }
      }
    }
    Functions: {
      accept_friend_invite: { Args: { _token: string }; Returns: string }
      ad_stats: {
        Args: never
        Returns: { ad_id: string; clicks: number; clicks_7d: number; impressions: number; impressions_7d: number }[]
      }
      admin_set_beta_tester: { Args: { _user_id: string; _value: boolean }; Returns: undefined }
      alpha_gate_enabled: { Args: never; Returns: boolean }
      alpha_gate_get: { Args: never; Returns: { enabled: boolean; password: string }[] }
      alpha_gate_set: { Args: { _enabled: boolean; _password: string }; Returns: undefined }
      alpha_gate_verify: { Args: { _password: string }; Returns: boolean }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      award_points: {
        Args: { _event_key: string; _multiplier?: number; _ref_id: string; _ref_type: string; _user_id: string }
        Returns: undefined
      }
      check_achievements: { Args: { _user_id: string }; Returns: undefined }
      debug_achievement_metrics: {
        Args: { _user_id: string }
        Returns: { current_value: string; meets: boolean; slug: string; threshold: string; type: string }[]
      }
      delete_email: { Args: { message_id: number; queue_name: string }; Returns: boolean }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: { Args: { payload: Json; queue_name: string }; Returns: number }
      friend_activity_feed: {
        Args: { _before?: string; _limit?: number; _user: string }
        Returns: {
          author_avatar: string; author_id: string; author_name: string; body: string
          created_at: string; kind: string; photo_url: string; place_id: string
          place_name: string; place_slug: string; rating: number; review_id: string
        }[]
      }
      friend_leaderboard: {
        Args: { _user: string }
        Returns: {
          achievements_count: number; avatar_url: string; display_name: string
          points_total: number; reviews_count: number; user_id: string; username: string
        }[]
      }
      friends_of: { Args: { _user: string }; Returns: { friend_id: string }[] }
      get_friends_count: { Args: { _user_id: string }; Returns: number }
      has_role: { Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }; Returns: boolean }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_place_owner: { Args: { _place_id: string; _user_id: string }; Returns: boolean }
      is_verified_owner: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: { Args: { dlq_name: string; message_id: number; payload: Json; source_queue: string }; Returns: number }
      notify: {
        Args: { _body: string; _link: string; _ref_id: string; _ref_type: string; _title: string; _type: string; _user_id: string }
        Returns: undefined
      }
      place_rating_breakdown: { Args: { _place_id: string }; Returns: { count: number; rating: number }[] }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: { message: Json; msg_id: number; read_ct: number }[]
      }
      run_achievement_tests: {
        Args: never
        Returns: { detail: string; status: string; test_name: string }[]
      }
      search_users: {
        Args: { _query: string }
        Returns: { avatar_source: string; avatar_url: string; display_name: string; id: string; username: string }[]
      }
      slugify: { Args: { _input: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
      collab_status: "new" | "read" | "replied" | "archived"
      friendship_status: "pending" | "accepted" | "blocked"
      place_visit_status: "want" | "visited"
      post_status: "draft" | "published"
      social_platform: "instagram" | "tiktok" | "youtube" | "facebook"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
/* NOTE: Insert/Update variants trimmed for brevity in this migration copy —
   they mirror Row with optional (?) fields and are auto-regenerated anyway
   by `supabase gen types typescript` once the new project is connected. */

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
