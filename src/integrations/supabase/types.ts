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
  public: {
    Tables: {
      asaas_accounts: {
        Row: {
          api_key: string | null
          asaas_account_id: string | null
          created_at: string
          id: string
          onboarding_url: string | null
          status: string
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          api_key?: string | null
          asaas_account_id?: string | null
          created_at?: string
          id?: string
          onboarding_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          api_key?: string | null
          asaas_account_id?: string | null
          created_at?: string
          id?: string
          onboarding_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: []
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          active: boolean
          created_at: string
          daily_interest_percent: number
          due_day: number
          end_date: string
          id: string
          late_fee_percent: number
          notes: string | null
          property_id: string
          readjustment_index: Database["public"]["Enums"]["readjustment_index"]
          rent_amount: number
          security_deposit: number
          start_date: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_interest_percent?: number
          due_day: number
          end_date: string
          id?: string
          late_fee_percent?: number
          notes?: string | null
          property_id: string
          readjustment_index?: Database["public"]["Enums"]["readjustment_index"]
          rent_amount: number
          security_deposit?: number
          start_date: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_interest_percent?: number
          due_day?: number
          end_date?: string
          id?: string
          late_fee_percent?: number
          notes?: string | null
          property_id?: string
          readjustment_index?: Database["public"]["Enums"]["readjustment_index"]
          rent_amount?: number
          security_deposit?: number
          start_date?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_notes: {
        Row: {
          author_user_id: string
          content: string
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          author_user_id: string
          content: string
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          budget: number
          created_at: string
          email: string | null
          id: string
          interested_code: string | null
          interested_property_id: string | null
          manager_user_id: string
          name: string
          notes: string | null
          phone: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          budget?: number
          created_at?: string
          email?: string | null
          id?: string
          interested_code?: string | null
          interested_property_id?: string | null
          manager_user_id: string
          name: string
          notes?: string | null
          phone?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          budget?: number
          created_at?: string
          email?: string | null
          id?: string
          interested_code?: string | null
          interested_property_id?: string | null
          manager_user_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          contract_id: string
          created_at: string
          general_condition: Database["public"]["Enums"]["inspection_condition"]
          id: string
          inspection_date: string
          inspector_name: string | null
          kind: Database["public"]["Enums"]["inspection_kind"]
          observations: string | null
          pdf_path: string | null
          rooms: Json
          status: Database["public"]["Enums"]["inspection_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          general_condition?: Database["public"]["Enums"]["inspection_condition"]
          id?: string
          inspection_date?: string
          inspector_name?: string | null
          kind: Database["public"]["Enums"]["inspection_kind"]
          observations?: string | null
          pdf_path?: string | null
          rooms?: Json
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          general_condition?: Database["public"]["Enums"]["inspection_condition"]
          id?: string
          inspection_date?: string
          inspector_name?: string | null
          kind?: Database["public"]["Enums"]["inspection_kind"]
          observations?: string | null
          pdf_path?: string | null
          rooms?: Json
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          barcode: string | null
          boleto_url: string | null
          contract_id: string
          created_at: string
          due_date: string
          extra_fees: number
          id: string
          late_charges: number
          management_fee_percent: number
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payout_date: string | null
          payout_status: string
          pix_payload: string | null
          pix_qrcode: string | null
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
          user_id: string
          variable_expenses: Json
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          barcode?: string | null
          boleto_url?: string | null
          contract_id: string
          created_at?: string
          due_date: string
          extra_fees?: number
          id?: string
          late_charges?: number
          management_fee_percent?: number
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payout_date?: string | null
          payout_status?: string
          pix_payload?: string | null
          pix_qrcode?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
          user_id: string
          variable_expenses?: Json
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          barcode?: string | null
          boleto_url?: string | null
          contract_id?: string
          created_at?: string
          due_date?: string
          extra_fees?: number
          id?: string
          late_charges?: number
          management_fee_percent?: number
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payout_date?: string | null
          payout_status?: string
          pix_payload?: string | null
          pix_qrcode?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
          user_id?: string
          variable_expenses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          maintenance_id: string
          sender_user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          maintenance_id: string
          sender_user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          maintenance_id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_messages_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenances"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenances: {
        Row: {
          completed_date: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          property_id: string
          responsible: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_date?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          property_id: string
          responsible?: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_date?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          property_id?: string
          responsible?: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenances_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invite_token: string | null
          manager_user_id: string
          member_user_id: string | null
          name: string
          role_label: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invite_token?: string | null
          manager_user_id: string
          member_user_id?: string | null
          name: string
          role_label?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invite_token?: string | null
          manager_user_id?: string
          member_user_id?: string | null
          name?: string
          role_label?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          assigned_member_id: string | null
          city: string | null
          code: string | null
          condo_fee: number
          created_at: string
          default_management_fee_percent: number
          id: string
          iptu: number
          manager_id: string | null
          neighborhood: string | null
          nickname: string
          notes: string | null
          owner_commission_percent: number
          owner_name: string | null
          rent_price: number
          state: string | null
          status: Database["public"]["Enums"]["property_status"]
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address: string
          assigned_member_id?: string | null
          city?: string | null
          code?: string | null
          condo_fee?: number
          created_at?: string
          default_management_fee_percent?: number
          id?: string
          iptu?: number
          manager_id?: string | null
          neighborhood?: string | null
          nickname: string
          notes?: string | null
          owner_commission_percent?: number
          owner_name?: string | null
          rent_price?: number
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string
          assigned_member_id?: string | null
          city?: string | null
          code?: string | null
          condo_fee?: number
          created_at?: string
          default_management_fee_percent?: number
          id?: string
          iptu?: number
          manager_id?: string | null
          neighborhood?: string | null
          nickname?: string
          notes?: string | null
          owner_commission_percent?: number
          owner_name?: string | null
          rent_price?: number
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          emergency_contact: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
          user_id_link: string | null
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          emergency_contact?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          user_id_link?: string | null
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          emergency_contact?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          user_id_link?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_manager_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "tenant" | "manager"
      inspection_condition: "otimo" | "bom" | "regular" | "ruim"
      inspection_kind: "entrada" | "saida"
      inspection_status: "rascunho" | "assinada"
      installment_status: "pendente" | "pago" | "atrasado"
      maintenance_responsible: "proprietario" | "inquilino"
      maintenance_status: "pendente" | "em_andamento" | "concluido"
      property_status: "disponivel" | "alugado" | "manutencao"
      property_type: "casa" | "apartamento" | "comercial" | "terreno" | "outro"
      readjustment_index: "IGP-M" | "IPCA" | "INCC" | "nenhum"
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
      app_role: ["owner", "tenant", "manager"],
      inspection_condition: ["otimo", "bom", "regular", "ruim"],
      inspection_kind: ["entrada", "saida"],
      inspection_status: ["rascunho", "assinada"],
      installment_status: ["pendente", "pago", "atrasado"],
      maintenance_responsible: ["proprietario", "inquilino"],
      maintenance_status: ["pendente", "em_andamento", "concluido"],
      property_status: ["disponivel", "alugado", "manutencao"],
      property_type: ["casa", "apartamento", "comercial", "terreno", "outro"],
      readjustment_index: ["IGP-M", "IPCA", "INCC", "nenhum"],
    },
  },
} as const
