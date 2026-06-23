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
      agency_settings: {
        Row: {
          created_at: string
          last_round_robin_member_id: string | null
          lead_routing_strategy: string
          manager_user_id: string
          org_slug: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          last_round_robin_member_id?: string | null
          lead_routing_strategy?: string
          manager_user_id: string
          org_slug?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          last_round_robin_member_id?: string | null
          lead_routing_strategy?: string
          manager_user_id?: string
          org_slug?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_settings_last_round_robin_member_id_fkey"
            columns: ["last_round_robin_member_id"]
            isOneToOne: false
            referencedRelation: "manager_members"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_accounts: {
        Row: {
          api_key: string | null
          asaas_account_id: string | null
          auto_transfer_enabled: boolean
          bank_account: string | null
          bank_account_digit: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_code: string | null
          created_at: string
          id: string
          kyc_reference_id: string | null
          kyc_status: string
          onboarding_url: string | null
          status: string
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          api_key?: string | null
          asaas_account_id?: string | null
          auto_transfer_enabled?: boolean
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          created_at?: string
          id?: string
          kyc_reference_id?: string | null
          kyc_status?: string
          onboarding_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          api_key?: string | null
          asaas_account_id?: string | null
          auto_transfer_enabled?: boolean
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          created_at?: string
          id?: string
          kyc_reference_id?: string | null
          kyc_status?: string
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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          active: boolean
          contract_pdf_path: string | null
          created_at: string
          daily_interest_percent: number
          due_day: number
          end_date: string
          id: string
          late_fee_percent: number
          notes: string | null
          payout_wallet_id: string | null
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
          contract_pdf_path?: string | null
          created_at?: string
          daily_interest_percent?: number
          due_day: number
          end_date: string
          id?: string
          late_fee_percent?: number
          notes?: string | null
          payout_wallet_id?: string | null
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
          contract_pdf_path?: string | null
          created_at?: string
          daily_interest_percent?: number
          due_day?: number
          end_date?: string
          id?: string
          late_fee_percent?: number
          notes?: string | null
          payout_wallet_id?: string | null
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
          portal_origin: string | null
          routed_member_id: string | null
          routing_criteria_used: string | null
          source: string
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
          portal_origin?: string | null
          routed_member_id?: string | null
          routing_criteria_used?: string | null
          source?: string
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
          portal_origin?: string | null
          routed_member_id?: string | null
          routing_criteria_used?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_routed_member_id_fkey"
            columns: ["routed_member_id"]
            isOneToOne: false
            referencedRelation: "manager_members"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_agreements: {
        Row: {
          contract_id: string
          created_at: string
          first_due_date: string
          id: string
          installments_count: number
          interest_percent: number
          late_fee_percent: number
          notes: string | null
          original_total: number
          status: string
          tenant_id: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          first_due_date: string
          id?: string
          installments_count: number
          interest_percent?: number
          late_fee_percent?: number
          notes?: string | null
          original_total: number
          status?: string
          tenant_id: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          first_due_date?: string
          id?: string
          installments_count?: number
          interest_percent?: number
          late_fee_percent?: number
          notes?: string | null
          original_total?: number
          status?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_agreements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      installment_notifications: {
        Row: {
          channel: string
          contract_id: string
          created_at: string
          error: string | null
          id: string
          installment_id: string
          sent_at: string
          stage: string
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          contract_id: string
          created_at?: string
          error?: string | null
          id?: string
          installment_id: string
          sent_at?: string
          stage: string
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          contract_id?: string
          created_at?: string
          error?: string | null
          id?: string
          installment_id?: string
          sent_at?: string
          stage?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_notifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_notifications_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          barcode: string | null
          boleto_url: string | null
          contract_id: string
          created_at: string
          debt_agreement_id: string | null
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
          debt_agreement_id?: string | null
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
          debt_agreement_id?: string | null
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
          {
            foreignKeyName: "installments_debt_agreement_id_fkey"
            columns: ["debt_agreement_id"]
            isOneToOne: false
            referencedRelation: "debt_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          document: string | null
          email: string
          full_name: string | null
          id: string
          invite_token: string
          manager_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          document?: string | null
          email: string
          full_name?: string | null
          id?: string
          invite_token?: string
          manager_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          document?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invite_token?: string
          manager_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      landlord_withdrawals: {
        Row: {
          amount: number
          asaas_transfer_id: string | null
          created_at: string
          id: string
          landlord_user_id: string
          manager_user_id: string | null
          notes: string | null
          pix_key: string
          pix_key_type: string
          processed_at: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_transfer_id?: string | null
          created_at?: string
          id?: string
          landlord_user_id: string
          manager_user_id?: string | null
          notes?: string | null
          pix_key: string
          pix_key_type: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_transfer_id?: string | null
          created_at?: string
          id?: string
          landlord_user_id?: string
          manager_user_id?: string | null
          notes?: string | null
          pix_key?: string
          pix_key_type?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_messages: {
        Row: {
          attachment_urls: string[]
          content: string
          created_at: string
          id: string
          maintenance_id: string
          sender_user_id: string
        }
        Insert: {
          attachment_urls?: string[]
          content: string
          created_at?: string
          id?: string
          maintenance_id: string
          sender_user_id: string
        }
        Update: {
          attachment_urls?: string[]
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
      maintenance_response_notifications: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          last_tenant_message_id: string
          maintenance_id: string
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          last_tenant_message_id: string
          maintenance_id: string
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          last_tenant_message_id?: string
          maintenance_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_response_notifications_last_tenant_message_id_fkey"
            columns: ["last_tenant_message_id"]
            isOneToOne: false
            referencedRelation: "maintenance_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_response_notifications_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenances"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenances: {
        Row: {
          budget_amount: number
          budget_applied_installment_id: string | null
          budget_decided_at: string | null
          budget_notes: string | null
          budget_rent_deduction: boolean
          budget_status: string
          completed_date: string | null
          cost: number
          created_at: string
          description: string | null
          evidence_urls: string[]
          id: string
          property_id: string
          provider_name: string | null
          responsible: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_amount?: number
          budget_applied_installment_id?: string | null
          budget_decided_at?: string | null
          budget_notes?: string | null
          budget_rent_deduction?: boolean
          budget_status?: string
          completed_date?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          evidence_urls?: string[]
          id?: string
          property_id: string
          provider_name?: string | null
          responsible?: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_amount?: number
          budget_applied_installment_id?: string | null
          budget_decided_at?: string | null
          budget_notes?: string | null
          budget_rent_deduction?: boolean
          budget_status?: string
          completed_date?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          evidence_urls?: string[]
          id?: string
          property_id?: string
          provider_name?: string | null
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
          hire_date: string
          id: string
          invite_token: string | null
          is_active: boolean
          manager_user_id: string
          member_user_id: string | null
          name: string
          phone: string | null
          role_label: string
          status: string
          total_sales_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          hire_date?: string
          id?: string
          invite_token?: string | null
          is_active?: boolean
          manager_user_id: string
          member_user_id?: string | null
          name: string
          phone?: string | null
          role_label?: string
          status?: string
          total_sales_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          hire_date?: string
          id?: string
          invite_token?: string | null
          is_active?: boolean
          manager_user_id?: string
          member_user_id?: string | null
          name?: string
          phone?: string | null
          role_label?: string
          status?: string
          total_sales_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          integration_imovelweb_connected: boolean
          integration_token: string
          integration_zap_connected: boolean
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          integration_imovelweb_connected?: boolean
          integration_token?: string
          integration_zap_connected?: boolean
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          integration_imovelweb_connected?: boolean
          integration_token?: string
          integration_zap_connected?: boolean
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          area_total: number | null
          assigned_member_id: string | null
          bathrooms: number
          bedrooms: number
          city: string | null
          code: string | null
          condo_fee: number
          created_at: string
          default_management_fee_percent: number
          description: string | null
          garages: number
          id: string
          iptu: number
          landlord_id: string | null
          manager_id: string | null
          neighborhood: string | null
          nickname: string
          notes: string | null
          owner_commission_percent: number
          owner_name: string | null
          publish_imovelweb: boolean
          publish_zap: boolean
          rent_price: number
          responsible_member_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["property_status"]
          tipo_transacao: Database["public"]["Enums"]["transaction_type"]
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          user_id: string
          valor_aluguel: number | null
          valor_venda: number | null
          zip_code: string | null
        }
        Insert: {
          address: string
          area_total?: number | null
          assigned_member_id?: string | null
          bathrooms?: number
          bedrooms?: number
          city?: string | null
          code?: string | null
          condo_fee?: number
          created_at?: string
          default_management_fee_percent?: number
          description?: string | null
          garages?: number
          id?: string
          iptu?: number
          landlord_id?: string | null
          manager_id?: string | null
          neighborhood?: string | null
          nickname: string
          notes?: string | null
          owner_commission_percent?: number
          owner_name?: string | null
          publish_imovelweb?: boolean
          publish_zap?: boolean
          rent_price?: number
          responsible_member_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          tipo_transacao?: Database["public"]["Enums"]["transaction_type"]
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id: string
          valor_aluguel?: number | null
          valor_venda?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          area_total?: number | null
          assigned_member_id?: string | null
          bathrooms?: number
          bedrooms?: number
          city?: string | null
          code?: string | null
          condo_fee?: number
          created_at?: string
          default_management_fee_percent?: number
          description?: string | null
          garages?: number
          id?: string
          iptu?: number
          landlord_id?: string | null
          manager_id?: string | null
          neighborhood?: string | null
          nickname?: string
          notes?: string | null
          owner_commission_percent?: number
          owner_name?: string | null
          publish_imovelweb?: boolean
          publish_zap?: boolean
          rent_price?: number
          responsible_member_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          tipo_transacao?: Database["public"]["Enums"]["transaction_type"]
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id?: string
          valor_aluguel?: number | null
          valor_venda?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_responsible_member_id_fkey"
            columns: ["responsible_member_id"]
            isOneToOne: false
            referencedRelation: "manager_members"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          property_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          property_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          property_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      accept_landlord_invite: { Args: { _token: string }; Returns: string }
      accept_manager_invite: { Args: { _token: string }; Returns: string }
      current_landlord_id: { Args: never; Returns: string }
      current_manager_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      generate_org_slug: { Args: { _manager_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sync_cron_secret: { Args: { _secret: string }; Returns: undefined }
      verify_security_invariants: {
        Args: never
        Returns: {
          check_name: string
          details: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "tenant" | "manager" | "landlord"
      inspection_condition: "otimo" | "bom" | "regular" | "ruim"
      inspection_kind: "entrada" | "saida"
      inspection_status: "rascunho" | "assinada"
      installment_status:
        | "pendente"
        | "pago"
        | "atrasado"
        | "acordo_fechado"
        | "agendado"
        | "em_aberto"
      maintenance_responsible: "proprietario" | "inquilino"
      maintenance_status: "pendente" | "em_andamento" | "concluido"
      property_status: "disponivel" | "alugado" | "manutencao"
      property_type: "casa" | "apartamento" | "comercial" | "terreno" | "outro"
      readjustment_index: "IGP-M" | "IPCA" | "INCC" | "nenhum"
      transaction_type: "Aluguel" | "Venda"
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
      app_role: ["owner", "tenant", "manager", "landlord"],
      inspection_condition: ["otimo", "bom", "regular", "ruim"],
      inspection_kind: ["entrada", "saida"],
      inspection_status: ["rascunho", "assinada"],
      installment_status: [
        "pendente",
        "pago",
        "atrasado",
        "acordo_fechado",
        "agendado",
        "em_aberto",
      ],
      maintenance_responsible: ["proprietario", "inquilino"],
      maintenance_status: ["pendente", "em_andamento", "concluido"],
      property_status: ["disponivel", "alugado", "manutencao"],
      property_type: ["casa", "apartamento", "comercial", "terreno", "outro"],
      readjustment_index: ["IGP-M", "IPCA", "INCC", "nenhum"],
      transaction_type: ["Aluguel", "Venda"],
    },
  },
} as const
