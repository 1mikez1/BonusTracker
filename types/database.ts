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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      apps: {
        Row: {
          app_type: string | null
          country: string | null
          deadline_days: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
        }
        Insert: {
          app_type?: string | null
          country?: string | null
          deadline_days?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
        }
        Update: {
          app_type?: string | null
          country?: string | null
          deadline_days?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      client_apps: {
        Row: {
          app_id: string
          client_id: string
          completed_at: string | null
          completed_steps: Json | null
          created_at: string
          deadline_at: string | null
          deposit_amount: number | null
          deposit_paid_back: boolean
          deposit_paid_back_at: string | null
          deposit_source: string | null
          deposited: boolean
          finished: boolean
          id: string
          invited_by_client_id: string | null
          is_our_deposit: boolean
          notes: string | null
          profit_client: number | null
          profit_us: number | null
          promotion_id: string | null
          referral_link_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["client_app_status"]
        }
        Insert: {
          app_id: string
          client_id: string
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          deadline_at?: string | null
          deposit_amount?: number | null
          deposit_paid_back?: boolean
          deposit_paid_back_at?: string | null
          deposit_source?: string | null
          deposited?: boolean
          finished?: boolean
          id?: string
          invited_by_client_id?: string | null
          is_our_deposit?: boolean
          notes?: string | null
          profit_client?: number | null
          profit_us?: number | null
          promotion_id?: string | null
          referral_link_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["client_app_status"]
        }
        Update: {
          app_id?: string
          client_id?: string
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          deadline_at?: string | null
          deposit_amount?: number | null
          deposit_paid_back?: boolean
          deposit_paid_back_at?: string | null
          deposit_source?: string | null
          deposited?: boolean
          finished?: boolean
          id?: string
          invited_by_client_id?: string | null
          is_our_deposit?: boolean
          notes?: string | null
          profit_client?: number | null
          profit_us?: number | null
          promotion_id?: string | null
          referral_link_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["client_app_status"]
        }
        Relationships: [
          {
            foreignKeyName: "client_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_apps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_apps_invited_by_client_id_fkey"
            columns: ["invited_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_apps_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_apps_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_link_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_apps_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          cleared_at: string | null
          client_app_id: string | null
          client_id: string
          description: string | null
          detected_at: string
          error_type: string
          id: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          cleared_at?: string | null
          client_app_id?: string | null
          client_id: string
          description?: string | null
          detected_at?: string
          error_type: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          title: string
        }
        Update: {
          cleared_at?: string | null
          client_app_id?: string | null
          client_id?: string
          description?: string | null
          detected_at?: string
          error_type?: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_errors_client_app_id_fkey"
            columns: ["client_app_id"]
            isOneToOne: false
            referencedRelation: "client_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_errors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_partner_assignments: {
        Row: {
          assigned_at: string
          client_id: string
          id: string
          notes: string | null
          partner_id: string
          split_owner_override: number | null
          split_partner_override: number | null
        }
        Insert: {
          assigned_at?: string
          client_id: string
          id?: string
          notes?: string | null
          partner_id: string
          split_owner_override?: number | null
          split_partner_override?: number | null
        }
        Update: {
          assigned_at?: string
          client_id?: string
          id?: string
          notes?: string | null
          partner_id?: string
          split_owner_override?: number | null
          split_partner_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_partner_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_partner_assignments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "client_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      client_partners: {
        Row: {
          contact_info: string | null
          created_at: string
          default_split_owner: number
          default_split_partner: number
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          default_split_owner?: number
          default_split_partner?: number
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          default_split_owner?: number
          default_split_partner?: number
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          contact: string | null
          created_at: string
          email: string | null
          goated: boolean
          id: string
          invited_by_client_id: string | null
          invited_by_name: string | null
          invited_by_partner_id: string | null
          name: string
          needs_rewrite: boolean
          notes: string | null
          rewrite_j: boolean
          surname: string | null
          tier_id: string | null
          trusted: boolean
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          goated?: boolean
          id?: string
          invited_by_client_id?: string | null
          invited_by_name?: string | null
          invited_by_partner_id?: string | null
          name: string
          needs_rewrite?: boolean
          notes?: string | null
          rewrite_j?: boolean
          surname?: string | null
          tier_id?: string | null
          trusted?: boolean
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          goated?: boolean
          id?: string
          invited_by_client_id?: string | null
          invited_by_name?: string | null
          invited_by_partner_id?: string | null
          name?: string
          needs_rewrite?: boolean
          notes?: string | null
          rewrite_j?: boolean
          surname?: string | null
          tier_id?: string | null
          trusted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_invited_by_client_id_fkey"
            columns: ["invited_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_invited_by_partner_id_fkey"
            columns: ["invited_by_partner_id"]
            isOneToOne: false
            referencedRelation: "client_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          app_id: string
          client_id: string
          created_at: string
          email: string
          id: string
          notes: string | null
          password_encrypted: string
          username: string | null
        }
        Insert: {
          app_id: string
          client_id: string
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          password_encrypted: string
          username?: string | null
        }
        Update: {
          app_id?: string
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          password_encrypted?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_debts: {
        Row: {
          amount: number
          client_app_id: string
          client_id: string
          created_at: string
          deposit_source: string | null
          description: string | null
          id: string
          paid_back_at: string | null
          status: string
        }
        Insert: {
          amount: number
          client_app_id: string
          client_id: string
          created_at?: string
          deposit_source?: string | null
          description?: string | null
          id?: string
          paid_back_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          client_app_id?: string
          client_id?: string
          created_at?: string
          deposit_source?: string | null
          description?: string | null
          id?: string
          paid_back_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_debts_client_app_id_fkey"
            columns: ["client_app_id"]
            isOneToOne: true
            referencedRelation: "client_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_debts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          app_id: string | null
          content: string
          id: string
          language: string | null
          name: string
          notes: string | null
          step: string | null
          step_order: number | null
        }
        Insert: {
          app_id?: string | null
          content: string
          id?: string
          language?: string | null
          name: string
          notes?: string | null
          step?: string | null
          step_order?: number | null
        }
        Update: {
          app_id?: string | null
          content?: string
          id?: string
          language?: string | null
          name?: string
          notes?: string | null
          step?: string | null
          step_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payments: {
        Row: {
          amount: number
          id: string
          note: string | null
          paid_at: string
          partner_id: string
        }
        Insert: {
          amount: number
          id?: string
          note?: string | null
          paid_at?: string
          partner_id: string
        }
        Update: {
          amount?: number
          id?: string
          note?: string | null
          paid_at?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_payments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "client_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payments_by_client_app: {
        Row: {
          amount: number | null
          client_app_id: string
          client_id: string
          created_at: string
          id: string
          note: string | null
          paid_at: string
          partner_id: string
        }
        Insert: {
          amount?: number | null
          client_app_id: string
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          partner_id: string
        }
        Update: {
          amount?: number | null
          client_app_id?: string
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_payments_by_client_app_client_app_id_fkey"
            columns: ["client_app_id"]
            isOneToOne: false
            referencedRelation: "client_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payments_by_client_app_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payments_by_client_app_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "client_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number | null
          app_id: string | null
          client_id: string | null
          created_at: string
          id: string
          provider: string
          purpose: string | null
          url: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          amount?: number | null
          app_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          provider: string
          purpose?: string | null
          url: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          amount?: number | null
          app_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          provider?: string
          purpose?: string | null
          url?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          app_id: string
          client_reward: number
          deposit_required: number
          end_date: string | null
          expense: number | null
          freeze_days: number | null
          id: string
          is_active: boolean
          max_invites: number | null
          name: string
          notes: string | null
          our_reward: number
          profit_type: string | null
          start_date: string | null
          terms_conditions: string | null
          time_to_get_bonus: string | null
        }
        Insert: {
          app_id: string
          client_reward?: number
          deposit_required?: number
          end_date?: string | null
          expense?: number | null
          freeze_days?: number | null
          id?: string
          is_active?: boolean
          max_invites?: number | null
          name: string
          notes?: string | null
          our_reward?: number
          profit_type?: string | null
          start_date?: string | null
          terms_conditions?: string | null
          time_to_get_bonus?: string | null
        }
        Update: {
          app_id?: string
          client_reward?: number
          deposit_required?: number
          end_date?: string | null
          expense?: number | null
          freeze_days?: number | null
          id?: string
          is_active?: boolean
          max_invites?: number | null
          name?: string
          notes?: string | null
          our_reward?: number
          profit_type?: string | null
          start_date?: string | null
          terms_conditions?: string | null
          time_to_get_bonus?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_link_debts: {
        Row: {
          amount: number
          created_at: string
          creditor_client_id: string
          debtor_client_id: string | null
          description: string | null
          id: string
          referral_link_id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["referral_link_debt_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          creditor_client_id: string
          debtor_client_id?: string | null
          description?: string | null
          id?: string
          referral_link_id: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["referral_link_debt_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          creditor_client_id?: string
          debtor_client_id?: string | null
          description?: string | null
          id?: string
          referral_link_id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["referral_link_debt_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referral_link_debts_creditor_client_id_fkey"
            columns: ["creditor_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_link_debts_debtor_client_id_fkey"
            columns: ["debtor_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_link_debts_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_link_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_link_debts_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_link_usages: {
        Row: {
          client_app_id: string | null
          client_id: string | null
          created_at: string
          id: string
          notes: string | null
          redeemed: boolean
          redeemed_at: string | null
          referral_link_id: string
          used_at: string
          used_by: string | null
        }
        Insert: {
          client_app_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          redeemed?: boolean
          redeemed_at?: string | null
          referral_link_id: string
          used_at?: string
          used_by?: string | null
        }
        Update: {
          client_app_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          redeemed?: boolean
          redeemed_at?: string | null
          referral_link_id?: string
          used_at?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_link_usages_client_app_id_fkey"
            columns: ["client_app_id"]
            isOneToOne: false
            referencedRelation: "client_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_link_usages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_link_usages_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_link_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_link_usages_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          account_name: string | null
          app_id: string
          code: string | null
          current_uses: number
          id: string
          is_active: boolean
          last_used_at: string | null
          max_uses: number | null
          normalized_url: string | null
          notes: string | null
          owner_client_id: string | null
          status: Database["public"]["Enums"]["referral_link_status"]
          url: string
          url_validation_status: Database["public"]["Enums"]["url_validation_status"]
        }
        Insert: {
          account_name?: string | null
          app_id: string
          code?: string | null
          current_uses?: number
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          max_uses?: number | null
          normalized_url?: string | null
          notes?: string | null
          owner_client_id?: string | null
          status?: Database["public"]["Enums"]["referral_link_status"]
          url: string
          url_validation_status?: Database["public"]["Enums"]["url_validation_status"]
        }
        Update: {
          account_name?: string | null
          app_id?: string
          code?: string | null
          current_uses?: number
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          max_uses?: number | null
          normalized_url?: string | null
          notes?: string | null
          owner_client_id?: string | null
          status?: Database["public"]["Enums"]["referral_link_status"]
          url?: string
          url_validation_status?: Database["public"]["Enums"]["url_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_links_owner_client_id_fkey"
            columns: ["owner_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          client_id: string | null
          contact: string | null
          created_at: string
          email: string | null
          external_form_id: string | null
          id: string
          name: string
          notes: string | null
          processed_at: string | null
          request_type: string | null
          requested_apps_raw: string | null
          status: Database["public"]["Enums"]["request_status"]
          webhook_payload: Json | null
          webhook_source: string | null
        }
        Insert: {
          client_id?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          external_form_id?: string | null
          id?: string
          name: string
          notes?: string | null
          processed_at?: string | null
          request_type?: string | null
          requested_apps_raw?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          webhook_payload?: Json | null
          webhook_source?: string | null
        }
        Update: {
          client_id?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          external_form_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          processed_at?: string | null
          request_type?: string | null
          requested_apps_raw?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          webhook_payload?: Json | null
          webhook_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          id: string
          name: string
          notes: string | null
          provider: string | null
          rtp_percentage: number
        }
        Insert: {
          id?: string
          name: string
          notes?: string | null
          provider?: string | null
          rtp_percentage: number
        }
        Update: {
          id?: string
          name?: string
          notes?: string | null
          provider?: string | null
          rtp_percentage?: number
        }
        Relationships: []
      }
      tiers: {
        Row: {
          id: string
          name: string
          notes: string | null
          priority: number
        }
        Insert: {
          id?: string
          name: string
          notes?: string | null
          priority: number
        }
        Update: {
          id?: string
          name?: string
          notes?: string | null
          priority?: number
        }
        Relationships: []
      }
    }
    Views: {
      referral_link_stats: {
        Row: {
          account_name: string | null
          app_id: string | null
          app_name: string | null
          code: string | null
          current_uses: number | null
          id: string | null
          is_active: boolean | null
          last_used_at: string | null
          max_uses: number | null
          normalized_url: string | null
          redeemed_count: number | null
          status: Database["public"]["Enums"]["referral_link_status"] | null
          unique_clients: number | null
          unredeemed_count: number | null
          url: string | null
          url_validation_status:
            | Database["public"]["Enums"]["url_validation_status"]
            | null
          uses_last_30_days: number | null
          uses_last_7_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_client_app_deadline: {
        Args: { p_client_app_id: string }
        Returns: string
      }
      check_and_assign_partners: {
        Args: never
        Returns: {
          assigned: boolean
          client_id: string
          client_name: string
          partner_id: string
          partner_name: string
        }[]
      }
      compute_partner_split_for_client: {
        Args: { in_partner_id: string }
        Returns: {
          client_id: string
          client_name: string
          owner_share: number
          partner_share: number
          total_profit_us: number
        }[]
      }
      detect_all_client_errors: { Args: never; Returns: number }
      detect_client_errors: { Args: { p_client_id: string }; Returns: number }
      extract_referral_code: { Args: { p_url: string }; Returns: string }
      find_client_by_name: { Args: { customer_name: string }; Returns: string }
      get_app_to_keep: { Args: { normalized_name: string }; Returns: string }
      get_clients_by_partner: {
        Args: {
          in_limit?: number
          in_offset?: number
          in_order_by?: string
          in_order_dir?: string
          in_partner_id?: string
          in_partner_name_search?: string
          in_search?: string
        }
        Returns: {
          contact: string
          created_at: string
          email: string
          id: string
          invited_by_client_id: string
          invited_by_partner_id: string
          name: string
          notes: string
          partner_id: string
          partner_name: string
          surname: string
          tier_id: string
          total_apps: number
          total_profit_us: number
          trusted: boolean
        }[]
      }
      normalize_referral_url: { Args: { p_url: string }; Returns: string }
      parse_dd_mm_date: {
        Args: { date_str: string; default_year?: number }
        Returns: string
      }
      update_all_deadlines: { Args: never; Returns: number }
      update_referral_link_stats: {
        Args: { p_referral_link_id: string }
        Returns: undefined
      }
      validate_referral_url: {
        Args: { p_url: string }
        Returns: Database["public"]["Enums"]["url_validation_status"]
      }
    }
    Enums: {
      client_app_status:
        | "requested"
        | "registered"
        | "deposited"
        | "waiting_bonus"
        | "completed"
        | "paid"
        | "cancelled"
      error_type:
        | "document_rejected"
        | "deadline_missed"
        | "referral_incoherent"
        | "missing_steps"
        | "note_error"
        | "csv_import_incoherent"
        | "missing_deposit"
        | "stale_update"
        | "status_mismatch"
      referral_link_debt_status: "open" | "partial" | "settled"
      referral_link_status: "active" | "inactive" | "redeemed" | "expired"
      request_status:
        | "new"
        | "contacted"
        | "converted"
        | "rejected"
        | "scheduled"
      url_validation_status: "valid" | "invalid" | "needs_review" | "pending"
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
      client_app_status: [
        "requested",
        "registered",
        "deposited",
        "waiting_bonus",
        "completed",
        "paid",
        "cancelled",
      ],
      error_type: [
        "document_rejected",
        "deadline_missed",
        "referral_incoherent",
        "missing_steps",
        "note_error",
        "csv_import_incoherent",
        "missing_deposit",
        "stale_update",
        "status_mismatch",
      ],
      referral_link_debt_status: ["open", "partial", "settled"],
      referral_link_status: ["active", "inactive", "redeemed", "expired"],
      request_status: [
        "new",
        "contacted",
        "converted",
        "rejected",
        "scheduled",
      ],
      url_validation_status: ["valid", "invalid", "needs_review", "pending"],
    },
  },
} as const
