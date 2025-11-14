export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      apps: {
        Row: {
          id: string;
          name: string;
          app_type: string | null;
          country: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          app_type?: string | null;
          country?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          app_type?: string | null;
          country?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string | null;
        };
      };
      clients: {
        Row: {
          id: string;
          name: string;
          surname: string | null;
          contact: string | null;
          email: string | null;
          trusted: boolean;
          tier_id: string | null;
          invited_by_client_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          surname?: string | null;
          contact?: string | null;
          email?: string | null;
          trusted?: boolean;
          tier_id?: string | null;
          invited_by_client_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          surname?: string | null;
          contact?: string | null;
          email?: string | null;
          trusted?: boolean;
          tier_id?: string | null;
          invited_by_client_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      tiers: {
        Row: {
          id: string;
          name: string;
          priority: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          priority: number;
          notes?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          priority?: number;
          notes?: string | null;
        };
      };
      promotions: {
        Row: {
          id: string;
          app_id: string;
          name: string;
          client_reward: string;
          our_reward: string;
          deposit_required: string;
          freeze_days: number | null;
          time_to_get_bonus: string | null;
          start_date: string | null;
          end_date: string | null;
          terms_conditions: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          app_id: string;
          name: string;
          client_reward?: string;
          our_reward?: string;
          deposit_required?: string;
          freeze_days?: number | null;
          time_to_get_bonus?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          terms_conditions?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          app_id?: string;
          name?: string;
          client_reward?: string;
          our_reward?: string;
          deposit_required?: string;
          freeze_days?: number | null;
          time_to_get_bonus?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          terms_conditions?: string | null;
          notes?: string | null;
        };
      };
      referral_links: {
        Row: {
          id: string;
          app_id: string;
          url: string;
          owner_client_id: string | null;
          max_uses: number | null;
          current_uses: number;
          is_active: boolean;
          notes: string | null;
        };
        Insert: {
          id?: string;
          app_id: string;
          url: string;
          owner_client_id?: string | null;
          max_uses?: number | null;
          current_uses?: number;
          is_active?: boolean;
          notes?: string | null;
        };
        Update: {
          id?: string;
          app_id?: string;
          url?: string;
          owner_client_id?: string | null;
          max_uses?: number | null;
          current_uses?: number;
          is_active?: boolean;
          notes?: string | null;
        };
      };
      referral_link_debts: {
        Row: {
          id: string;
          referral_link_id: string;
          creditor_client_id: string;
          debtor_client_id: string | null;
          amount: string;
          status: string;
          description: string | null;
          created_at: string;
          settled_at: string | null;
        };
        Insert: {
          id?: string;
          referral_link_id: string;
          creditor_client_id: string;
          debtor_client_id?: string | null;
          amount: string;
          status: string;
          description?: string | null;
          created_at?: string;
          settled_at?: string | null;
        };
        Update: {
          id?: string;
          referral_link_id?: string;
          creditor_client_id?: string;
          debtor_client_id?: string | null;
          amount?: string;
          status?: string;
          description?: string | null;
          created_at?: string;
          settled_at?: string | null;
        };
      };
      client_apps: {
        Row: {
          id: string;
          client_id: string;
          app_id: string;
          promotion_id: string | null;
          referral_link_id: string | null;
          invited_by_client_id: string | null;
          status: string;
          deposited: boolean;
          finished: boolean;
          deposit_amount: string | null;
          profit_client: string | null;
          profit_us: string | null;
          created_at: string;
          completed_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          app_id: string;
          promotion_id?: string | null;
          referral_link_id?: string | null;
          invited_by_client_id?: string | null;
          status: string;
          deposited?: boolean;
          finished?: boolean;
          deposit_amount?: string | null;
          profit_client?: string | null;
          profit_us?: string | null;
          created_at?: string;
          completed_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          app_id?: string;
          promotion_id?: string | null;
          referral_link_id?: string | null;
          invited_by_client_id?: string | null;
          status?: string;
          deposited?: boolean;
          finished?: boolean;
          deposit_amount?: string | null;
          profit_client?: string | null;
          profit_us?: string | null;
          created_at?: string;
          completed_at?: string | null;
          notes?: string | null;
        };
      };
      requests: {
        Row: {
          id: string;
          external_form_id: string | null;
          client_id: string | null;
          name: string;
          contact: string | null;
          requested_apps_raw: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          external_form_id?: string | null;
          client_id?: string | null;
          name: string;
          contact?: string | null;
          requested_apps_raw?: string | null;
          notes?: string | null;
          status: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          external_form_id?: string | null;
          client_id?: string | null;
          name?: string;
          contact?: string | null;
          requested_apps_raw?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          processed_at?: string | null;
        };
      };
      credentials: {
        Row: {
          id: string;
          client_id: string;
          app_id: string;
          email: string;
          username: string | null;
          password_encrypted: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          app_id: string;
          email: string;
          username?: string | null;
          password_encrypted: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          app_id?: string;
          email?: string;
          username?: string | null;
          password_encrypted?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      payment_links: {
        Row: {
          id: string;
          provider: string;
          url: string;
          amount: string | null;
          purpose: string | null;
          client_id: string | null;
          app_id: string | null;
          used: boolean;
          created_at: string;
          used_at: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          url: string;
          amount?: string | null;
          purpose?: string | null;
          client_id?: string | null;
          app_id?: string | null;
          used?: boolean;
          created_at?: string;
          used_at?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          url?: string;
          amount?: string | null;
          purpose?: string | null;
          client_id?: string | null;
          app_id?: string | null;
          used?: boolean;
          created_at?: string;
          used_at?: string | null;
        };
      };
      slots: {
        Row: {
          id: string;
          name: string;
          provider: string | null;
          rtp_percentage: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          provider?: string | null;
          rtp_percentage: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          provider?: string | null;
          rtp_percentage?: string;
          notes?: string | null;
        };
      };
      message_templates: {
        Row: {
          id: string;
          name: string;
          app_id: string | null;
          step: string | null;
          language: string | null;
          content: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          app_id?: string | null;
          step?: string | null;
          language?: string | null;
          content: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          app_id?: string | null;
          step?: string | null;
          language?: string | null;
          content?: string;
          notes?: string | null;
        };
      };
    };
  };
}
