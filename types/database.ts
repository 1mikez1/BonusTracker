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
          id: string
          is_active: boolean
          name: string
          notes: string | null
        }
        Insert: {
          app_type?: string | null
          country?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
        }
        Update: {
          app_type?: string | null
          country?: string | null
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
          deposit_amount: number | null
          deposited: boolean
          finished: boolean
          id: string
          invited_by_client_id: string | null
          notes: string | null
          profit_client: number | null
          profit_us: number | null
          promotion_id: string | null
          referral_link_id: string | null
          status: Database["public"]["Enums"]["client_app_status"]
        }
        Insert: {
          app_id: string
          client_id: string
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          deposit_amount?: number | null
          deposited?: boolean
          finished?: boolean
          id?: string
          invited_by_client_id?: string | null
          notes?: string | null
          profit_client?: number | null
          profit_us?: number | null
          promotion_id?: string | null
          referral_link_id?: string | null
          status?: Database["public"]["Enums"]["client_app_status"]
        }
        Update: {
          app_id?: string
          client_id?: string
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          deposit_amount?: number | null
          deposited?: boolean
          finished?: boolean
          id?: string
          invited_by_client_id?: string | null
          notes?: string | null
          profit_client?: number | null
          profit_us?: number | null
          promotion_id?: string | null
          referral_link_id?: string | null
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
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          app_id: string
          current_uses: number
          id: string
          is_active: boolean
          max_uses: number | null
          notes: string | null
          owner_client_id: string | null
          url: string
        }
        Insert: {
          app_id: string
          current_uses?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          notes?: string | null
          owner_client_id?: string | null
          url: string
        }
        Update: {
          app_id?: string
          current_uses?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          notes?: string | null
          owner_client_id?: string | null
          url?: string
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
          external_form_id: string | null
          id: string
          name: string
          notes: string | null
          processed_at: string | null
          requested_apps_raw: string | null
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          client_id?: string | null
          contact?: string | null
          created_at?: string
          external_form_id?: string | null
          id?: string
          name: string
          notes?: string | null
          processed_at?: string | null
          requested_apps_raw?: string | null
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          client_id?: string | null
          contact?: string | null
          created_at?: string
          external_form_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          processed_at?: string | null
          requested_apps_raw?: string | null
          status?: Database["public"]["Enums"]["request_status"]
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
      referral_link_debt_status: "open" | "partial" | "settled"
      request_status: "new" | "contacted" | "converted" | "rejected"
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
      referral_link_debt_status: ["open", "partial", "settled"],
      request_status: ["new", "contacted", "converted", "rejected"],
    },
  },
} as const
