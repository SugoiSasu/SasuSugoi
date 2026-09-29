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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string | null
          created_at: string
          criteria: Json
          description: string | null
          enabled: boolean
          icon_url: string | null
          id: string
          name: string
          self_unlockable: boolean
          slug: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          criteria: Json
          description?: string | null
          enabled?: boolean
          icon_url?: string | null
          id?: string
          name: string
          self_unlockable?: boolean
          slug: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          criteria?: Json
          description?: string | null
          enabled?: boolean
          icon_url?: string | null
          id?: string
          name?: string
          self_unlockable?: boolean
          slug?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ad_events: {
        Row: {
          ad_id: string
          created_at: string
          id: number
          kind: string
          session_key: string | null
          user_id: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: number
          kind: string
          session_key?: string | null
          user_id?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: number
          kind?: string
          session_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: number
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: never
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: never
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_changelog: {
        Row: {
          created_at: string
          id: string
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string
          link_url: string | null
          message: string
          place_id: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url: string
          link_url?: string | null
          message: string
          place_id?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string
          link_url?: string | null
          message?: string
          place_id?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      award_ballots: {
        Row: {
          event_id: string
          id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_ballots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "awards_events"
            referencedColumns: ["id"]
          },
        ]
      }
      award_votes: {
        Row: {
          created_at: string
          cuisine_id: string
          event_id: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cuisine_id: string
          event_id: string
          id?: string
          place_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cuisine_id?: string
          event_id?: string
          id?: string
          place_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_votes_cuisine_id_fkey"
            columns: ["cuisine_id"]
            isOneToOne: false
            referencedRelation: "cuisines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "awards_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_votes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      award_winners: {
        Row: {
          created_at: string
          cuisine_id: string
          event_id: string
          id: string
          place_id: string
          vote_count: number
        }
        Insert: {
          created_at?: string
          cuisine_id: string
          event_id: string
          id?: string
          place_id: string
          vote_count: number
        }
        Update: {
          created_at?: string
          cuisine_id?: string
          event_id?: string
          id?: string
          place_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "award_winners_cuisine_id_fkey"
            columns: ["cuisine_id"]
            isOneToOne: false
            referencedRelation: "cuisines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_winners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "awards_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_winners_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      awards_events: {
        Row: {
          closed_at: string | null
          created_at: string
          cuisine_ids: string[]
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          cuisine_ids?: string[]
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          cuisine_ids?: string[]
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          status?: string
        }
        Relationships: []
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
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          author_id?: string | null
          content_md?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          place_id?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content_md?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          place_id?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          criteria: Json
          description: string | null
          enabled: boolean
          ends_at: string | null
          icon: string | null
          id: string
          slug: string
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criteria: Json
          description?: string | null
          enabled?: boolean
          ends_at?: string | null
          icon?: string | null
          id?: string
          slug: string
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string | null
          enabled?: boolean
          ends_at?: string | null
          icon?: string | null
          id?: string
          slug?: string
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
        Insert: {
          author_id?: string | null
          body: string
          channel?: string
          created_at?: string
          id?: string
          sent_at?: string
          submission_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          channel?: string
          created_at?: string
          id?: string
          sent_at?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_replies_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "collab_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_send_log: {
        Row: {
          created_at: string
          email_hash: string
          id: number
        }
        Insert: {
          created_at?: string
          email_hash: string
          id?: number
        }
        Update: {
          created_at?: string
          email_hash?: string
          id?: number
        }
        Relationships: []
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
        Insert: {
          admin_notes?: string | null
          brand: string
          consent_accepted_at: string
          consent_version: string
          created_at?: string
          email: string
          id?: string
          message: string
          status?: Database["public"]["Enums"]["collab_status"]
          status_updated_at?: string | null
          status_updated_by?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          brand?: string
          consent_accepted_at?: string
          consent_version?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["collab_status"]
          status_updated_at?: string | null
          status_updated_by?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_excerpt: string | null
          target_id: string
          target_image: string | null
          target_kind: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_excerpt?: string | null
          target_id: string
          target_image?: string | null
          target_kind: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_excerpt?: string | null
          target_id?: string
          target_image?: string | null
          target_kind?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      cookie_consent_log: {
        Row: {
          ad_personalization: boolean
          ad_storage: boolean
          ad_user_data: boolean
          analytics_storage: boolean
          anon_id: string
          consent_version: string
          created_at: string
          id: string
        }
        Insert: {
          ad_personalization: boolean
          ad_storage: boolean
          ad_user_data: boolean
          analytics_storage: boolean
          anon_id: string
          consent_version: string
          created_at?: string
          id?: string
        }
        Update: {
          ad_personalization?: boolean
          ad_storage?: boolean
          ad_user_data?: boolean
          analytics_storage?: boolean
          anon_id?: string
          consent_version?: string
          created_at?: string
          id?: string
        }
        Relationships: []
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
        Insert: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          enabled?: boolean
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          enabled?: boolean
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
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
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      food_challenge_completions: {
        Row: {
          challenge_id: string
          completed_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "food_challenges"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      friend_favorites: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
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
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          inviter_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          inviter_id?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      friend_list_members: {
        Row: {
          created_at: string
          friend_id: string
          list_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          list_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "friend_lists"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_notes: {
        Row: {
          friend_id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          friend_id: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          friend_id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: []
      }
      moderation_log: {
        Row: {
          created_at: string
          excerpt: string | null
          id: number
          kind: string
          note: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          excerpt?: string | null
          id?: never
          kind: string
          note?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          excerpt?: string | null
          id?: never
          kind?: string
          note?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      moderation_terms: {
        Row: {
          created_at: string
          enabled: boolean
          id: number
          kind: string
          note: string | null
          pattern: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: never
          kind: string
          note?: string | null
          pattern: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: never
          kind?: string
          note?: string | null
          pattern?: string
        }
        Relationships: []
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
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
        Insert: {
          created_at?: string
          email: string
          id?: string
          instagram_url?: string | null
          message?: string | null
          name: string
          place_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          instagram_url?: string | null
          message?: string | null
          name?: string
          place_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_requests_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_enrichment: {
        Row: {
          blad: string | null
          created_by: string | null
          place_id: string
          propozycja: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          blad?: string | null
          created_by?: string | null
          place_id: string
          propozycja?: Json | null
          status: string
          updated_at?: string
        }
        Update: {
          blad?: string | null
          created_by?: string | null
          place_id?: string
          propozycja?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_enrichment_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_favorites: {
        Row: {
          created_at: string
          id: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_favorites_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_follows: {
        Row: {
          created_at: string
          id: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_follows_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_list_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          note: string | null
          place_id: string
          sort_order: number
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          note?: string | null
          place_id: string
          sort_order?: number
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          note?: string | null
          place_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "place_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_list_items_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_lists: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
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
        Insert: {
          address: string
          created_at?: string
          id?: string
          label?: string | null
          lat: number
          lng: number
          place_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string | null
          lat?: number
          lng?: number
          place_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_locations_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "place_owners_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          place_id: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          place_id?: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "place_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      place_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "place_posts"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          owner_id?: string | null
          place_id: string
          post_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          owner_id?: string | null
          place_id?: string
          post_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_posts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          address?: string | null
          approved_place_id?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          approved_place_id?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_suggestions_approved_place_id_fkey"
            columns: ["approved_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_swipe_skips: {
        Row: {
          place_id: string
          skipped_at: string
          user_id: string
        }
        Insert: {
          place_id: string
          skipped_at?: string
          user_id: string
        }
        Update: {
          place_id?: string
          skipped_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_swipe_skips_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          status: Database["public"]["Enums"]["place_visit_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          status?: Database["public"]["Enums"]["place_visit_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_visits_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string
          avatar_cutout_enabled: boolean
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
        Insert: {
          address?: string
          avatar_cutout_enabled?: boolean
          avatar_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          cuisine: string
          description?: string
          district?: string | null
          has_takeaway?: boolean
          id?: string
          is_published?: boolean
          lat: number
          lng: number
          menu_image_url?: string | null
          menu_items?: Json | null
          menu_url?: string | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          price_range?: string | null
          promo_active?: boolean
          promo_label?: string | null
          rating?: number
          reel_url?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          website?: string | null
          wheelchair_accessible?: boolean
        }
        Update: {
          address?: string
          avatar_cutout_enabled?: boolean
          avatar_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          cuisine?: string
          description?: string
          district?: string | null
          has_takeaway?: boolean
          id?: string
          is_published?: boolean
          lat?: number
          lng?: number
          menu_image_url?: string | null
          menu_items?: Json | null
          menu_url?: string | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          price_range?: string | null
          promo_active?: boolean
          promo_label?: string | null
          rating?: number
          reel_url?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          website?: string | null
          wheelchair_accessible?: boolean
        }
        Relationships: []
      }
      points_rules: {
        Row: {
          description: string | null
          enabled: boolean
          event_key: string
          points: number
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          event_key: string
          points: number
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          event_key?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
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
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          points: number
          ref_id?: string | null
          ref_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          points?: number
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_title: string | null
          active_title_achievement_id: string | null
          avatar_source: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          district: string | null
          facebook_url: string | null
          favorite_cuisines: string[]
          gender: string | null
          id: string
          ig_popup_dismissed_at: string | null
          instagram_url: string | null
          is_beta_tester: boolean
          is_public: boolean
          is_vip: boolean
          notification_prefs: Json
          onboarding_seen_at: string | null
          points_total: number
          returned_after_break_at: string | null
          share_swipes: boolean
          tiktok_url: string | null
          updated_at: string
          username: string | null
          vip_nick_color: string | null
          vip_until: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          active_title?: string | null
          active_title_achievement_id?: string | null
          avatar_source?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          district?: string | null
          facebook_url?: string | null
          favorite_cuisines?: string[]
          gender?: string | null
          id: string
          ig_popup_dismissed_at?: string | null
          instagram_url?: string | null
          is_beta_tester?: boolean
          is_public?: boolean
          is_vip?: boolean
          notification_prefs?: Json
          onboarding_seen_at?: string | null
          points_total?: number
          returned_after_break_at?: string | null
          share_swipes?: boolean
          tiktok_url?: string | null
          updated_at?: string
          username?: string | null
          vip_nick_color?: string | null
          vip_until?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          active_title?: string | null
          active_title_achievement_id?: string | null
          avatar_source?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          district?: string | null
          facebook_url?: string | null
          favorite_cuisines?: string[]
          gender?: string | null
          id?: string
          ig_popup_dismissed_at?: string | null
          instagram_url?: string | null
          is_beta_tester?: boolean
          is_public?: boolean
          is_vip?: boolean
          notification_prefs?: Json
          onboarding_seen_at?: string | null
          points_total?: number
          returned_after_break_at?: string | null
          share_swipes?: boolean
          tiktok_url?: string | null
          updated_at?: string
          username?: string | null
          vip_nick_color?: string | null
          vip_until?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_title_achievement_id_fkey"
            columns: ["active_title_achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_points_claims: {
        Row: {
          created_at: string
          event_key: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_points_claims_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reactions: {
        Row: {
          created_at: string
          review_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reactions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          content: string
          created_at?: string
          id?: string
          owner_id: string
          place_id: string
          review_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          place_id?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_tags: {
        Row: {
          created_at: string
          review_id: string
          tagged_user_id: string
          tagger_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          tagged_user_id: string
          tagger_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          tagged_user_id?: string
          tagger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_tags_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          place_id: string
          rating: number
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          place_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
        Insert: {
          created_at?: string
          extra?: Json
          followers_count?: number | null
          handle: string
          id?: string
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          posts_count?: number | null
          profile_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra?: Json
          followers_count?: number | null
          handle?: string
          id?: string
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          posts_count?: number | null
          profile_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_challenge_completions: {
        Row: {
          challenge_id: string
          completed_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ranks: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          rank_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          rank_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          rank_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ranks_rank_id_fkey"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sanctions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          source_excerpt: string | null
          source_kind: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          source_excerpt?: string | null
          source_kind?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          source_excerpt?: string | null
          source_kind?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wall_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          ref_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          ref_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wall_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          image_url: string | null
          place_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          place_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          place_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wall_posts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      wall_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          ref_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          ref_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wall_saves: {
        Row: {
          created_at: string
          id: string
          item_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          user_id?: string
        }
        Relationships: []
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
        Insert: {
          followers_count?: number | null
          handle?: string | null
          is_active?: boolean | null
          platform?: Database["public"]["Enums"]["social_platform"] | null
          posts_count?: number | null
          profile_url?: string | null
        }
        Update: {
          followers_count?: number | null
          handle?: string | null
          is_active?: boolean | null
          platform?: Database["public"]["Enums"]["social_platform"] | null
          posts_count?: number | null
          profile_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _moderation_apply: {
        Args: {
          _action: string
          _actor: string
          _days: number
          _id: string
          _kind: string
          _reason: string
          _report?: string
        }
        Returns: undefined
      }
      _moderation_check_target_user: {
        Args: { _actor: string; _days: number; _kind: string; _user: string }
        Returns: undefined
      }
      _moderation_delete: {
        Args: { _id: string; _kind: string }
        Returns: undefined
      }
      _moderation_sanction: {
        Args: {
          _actor: string
          _days: number
          _kind: string
          _reason: string
          _src_excerpt: string
          _src_kind: string
          _user: string
        }
        Returns: string
      }
      _moderation_target: {
        Args: { _id: string; _kind: string }
        Returns: {
          excerpt: string
          image: string
          user_id: string
        }[]
      }
      accept_friend_invite: { Args: { _token: string }; Returns: string }
      achievement_metric: {
        Args: { _criteria: Json; _user_id: string }
        Returns: Json
      }
      achievement_stats: {
        Args: never
        Returns: {
          achievement_id: string
          holders: number
          total_players: number
        }[]
      }
      ad_stats: {
        Args: never
        Returns: {
          ad_id: string
          clicks: number
          clicks_7d: number
          impressions: number
          impressions_7d: number
          sessions: number
          unique_users: number
        }[]
      }
      admin_grant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_beta_tester: {
        Args: { _user_id: string; _value: boolean }
        Returns: undefined
      }
      alpha_gate_enabled: { Args: never; Returns: boolean }
      alpha_gate_get: {
        Args: never
        Returns: {
          enabled: boolean
          has_password: boolean
        }[]
      }
      alpha_gate_set: {
        Args: { _enabled: boolean; _password: string }
        Returns: undefined
      }
      alpha_gate_verify: { Args: { _password: string }; Returns: boolean }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      award_points: {
        Args: {
          _event_key: string
          _multiplier?: number
          _ref_id: string
          _ref_type: string
          _user_id: string
        }
        Returns: undefined
      }
      award_review_points_once: {
        Args: {
          _event_key: string
          _place_id: string
          _review_id: string
          _user_id: string
        }
        Returns: undefined
      }
      check_achievements: {
        Args: { _typy?: string[]; _user_id: string }
        Returns: undefined
      }
      check_challenges: { Args: { _user_id: string }; Returns: undefined }
      close_awards_event: { Args: { _event_id: string }; Returns: undefined }
      collab_send_allowed: { Args: { _email: string }; Returns: boolean }
      debug_achievement_metrics: {
        Args: { _user_id: string }
        Returns: {
          current_value: string
          meets: boolean
          slug: string
          threshold: string
          type: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      friend_activity_feed: {
        Args: { _before?: string; _limit?: number; _user: string }
        Returns: {
          author_avatar: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          kind: string
          photo_url: string
          place_id: string
          place_name: string
          place_slug: string
          rating: number
          review_id: string
        }[]
      }
      friend_leaderboard: {
        Args: { _user: string }
        Returns: {
          achievements_count: number
          active_title: string
          avatar_source: string
          avatar_url: string
          display_name: string
          is_vip: boolean
          points_total: number
          reviews_count: number
          user_id: string
          username: string
          vip_nick_color: string
          vip_until: string
        }[]
      }
      friends_of: {
        Args: { _user: string }
        Returns: {
          friend_id: string
        }[]
      }
      generate_username: {
        Args: { _gender?: string; _name: string }
        Returns: string
      }
      get_friends_count: { Args: { _user_id: string }; Returns: number }
      get_invite_preview: {
        Args: { _token: string }
        Returns: {
          expired: boolean
          inviter_avatar_url: string
          inviter_display_name: string
          inviter_username: string
          status: string
        }[]
      }
      get_shared_list: {
        Args: { _id: string }
        Returns: {
          cover_image_url: string
          created_at: string
          description: string
          id: string
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }[]
      }
      get_shared_list_items: {
        Args: { _id: string }
        Returns: {
          added_at: string
          id: string
          list_id: string
          note: string
          place_id: string
          sort_order: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_banned: { Args: { _uid: string }; Returns: boolean }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_friend_with: { Args: { _user_id: string }; Returns: boolean }
      is_place_owner: {
        Args: { _place_id: string; _user_id: string }
        Returns: boolean
      }
      is_verified_owner: { Args: { _user_id: string }; Returns: boolean }
      list_is_visible_to_me: { Args: { _list_id: string }; Returns: boolean }
      moderation_act: {
        Args: {
          _action: string
          _days?: number
          _id: string
          _kind: string
          _reason: string
        }
        Returns: undefined
      }
      moderation_image_check_allowed: { Args: never; Returns: boolean }
      moderation_log_blocked: {
        Args: { _text: string; _where?: string }
        Returns: undefined
      }
      moderation_log_image: {
        Args: { _kind: string; _note?: string }
        Returns: undefined
      }
      moderation_match: { Args: { _t: string }; Returns: string }
      moderation_resolve_report: {
        Args: {
          _action: string
          _days?: number
          _reason?: string
          _report: string
        }
        Returns: undefined
      }
      moderation_revoke: { Args: { _sanction: string }; Returns: undefined }
      moderation_sanction_user: {
        Args: { _days?: number; _kind: string; _reason: string; _user: string }
        Returns: undefined
      }
      moderation_variants: { Args: { _t: string }; Returns: string[] }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_achievement_progress: {
        Args: never
        Returns: {
          achievement_id: string
          lower_better: boolean
          measurable: boolean
          meets: boolean
          target: number
          value: number
        }[]
      }
      my_ban_status: {
        Args: never
        Returns: {
          banned: boolean
          expires_at: string
          permanent: boolean
          reason: string
        }[]
      }
      notify: {
        Args: {
          _body: string
          _link: string
          _ref_id: string
          _ref_type: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      owns_place_photo_path: {
        Args: { _name: string; _uid: string }
        Returns: boolean
      }
      place_favorite_counts: {
        Args: never
        Returns: {
          count: number
          place_id: string
        }[]
      }
      place_follow_counts: {
        Args: never
        Returns: {
          count: number
          place_id: string
        }[]
      }
      place_rating_breakdown: {
        Args: { _place_id: string }
        Returns: {
          count: number
          rating: number
        }[]
      }
      points_daily_cap_reached: {
        Args: { _cap_key: string; _event_key: string; _user_id: string }
        Returns: boolean
      }
      porownanie_graczy: {
        Args: { _inny: string }
        Returns: {
          kto: string
          lokale: number
          odznaki: number
          points_total: number
          recenzje: number
          srednia_ocena: number
        }[]
      }
      propose_outing: {
        Args: { _place_id: string }
        Returns: number
      }
      ranking_tablica: {
        Args: { _metryka: string; _okres: string }
        Returns: {
          active_title: string
          avatar_source: string
          avatar_url: string
          created_at: string
          display_name: string
          gender: string
          is_friend: boolean
          is_me: boolean
          is_vip: boolean
          points_total: number
          user_id: string
          username: string
          vip_nick_color: string
          vip_until: string
          wartosc: number
          wartosc_tydzien_temu: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      report_content: {
        Args: { _details?: string; _id: string; _kind: string; _reason: string }
        Returns: undefined
      }
      reverse_points_for_ref: {
        Args: {
          _ref_id: string
          _ref_type: string
          _reversal_key: string
          _user_id: string
        }
        Returns: undefined
      }
      run_achievement_tests: {
        Args: never
        Returns: {
          detail: string
          status: string
          test_name: string
        }[]
      }
      search_users: {
        Args: { _query: string }
        Returns: {
          avatar_source: string
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      set_active_title: {
        Args: { _achievement_id: string }
        Returns: undefined
      }
      shared_friend_wants: {
        Args: { _since: string; _user_ids: string[] }
        Returns: {
          created_at: string
          id: string
          place_id: string
          user_id: string
        }[]
      }
      slugify: { Args: { _input: string }; Returns: string }
      submit_award_ballot: {
        Args: { _event_id: string; _picks: Json }
        Returns: undefined
      }
      unlock_manual_achievement: { Args: { _slug: string }; Returns: boolean }
      visible_lists: {
        Args: { _owner?: string }
        Returns: {
          cover_image_url: string
          created_at: string
          description: string
          id: string
          places_count: number
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }[]
      }
      wall_item_owner: {
        Args: { _kind: string; _ref_id: string }
        Returns: string
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user", "super_admin"],
      collab_status: ["new", "read", "replied", "archived"],
      friendship_status: ["pending", "accepted", "blocked"],
      place_visit_status: ["want", "visited"],
      post_status: ["draft", "published"],
      social_platform: ["instagram", "tiktok", "youtube", "facebook"],
    },
  },
} as const
