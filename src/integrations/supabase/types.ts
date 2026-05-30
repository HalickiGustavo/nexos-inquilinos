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
      contracts: {
        Row: {
          active: boolean
          created_at: string
          due_day: number
          end_date: string
          id: string
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
          due_day: number
          end_date: string
          id?: string
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
          due_day?: number
          end_date?: string
          id?: string
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
      installments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          extra_fees: number
          id: string
          notes: string | null
          paid_amount: number
          payment_date: string | null
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          extra_fees?: number
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          extra_fees?: number
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
          user_id?: string
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
          city: string | null
          condo_fee: number
          created_at: string
          id: string
          iptu: number
          nickname: string
          notes: string | null
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
          city?: string | null
          condo_fee?: number
          created_at?: string
          id?: string
          iptu?: number
          nickname: string
          notes?: string | null
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
          city?: string | null
          condo_fee?: number
          created_at?: string
          id?: string
          iptu?: number
          nickname?: string
          notes?: string | null
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
      installment_status: ["pendente", "pago", "atrasado"],
      maintenance_responsible: ["proprietario", "inquilino"],
      maintenance_status: ["pendente", "em_andamento", "concluido"],
      property_status: ["disponivel", "alugado", "manutencao"],
      property_type: ["casa", "apartamento", "comercial", "terreno", "outro"],
      readjustment_index: ["IGP-M", "IPCA", "INCC", "nenhum"],
    },
  },
} as const
