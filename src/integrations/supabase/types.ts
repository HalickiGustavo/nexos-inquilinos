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
          agency_document: string | null
          agency_pix_key: string | null
          agency_pix_key_type: string | null
          created_at: string
          last_round_robin_member_id: string | null
          lead_routing_strategy: string
          manager_user_id: string
          org_slug: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          agency_document?: string | null
          agency_pix_key?: string | null
          agency_pix_key_type?: string | null
          created_at?: string
          last_round_robin_member_id?: string | null
          lead_routing_strategy?: string
          manager_user_id: string
          org_slug?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          agency_document?: string | null
          agency_pix_key?: string | null
          agency_pix_key_type?: string | null
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
      chat_conversations: {
        Row: {
          contract_id: string | null
          created_at: string
          id: string
          kind: string
          last_message_at: string | null
          last_message_preview: string | null
          property_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          id?: string
          kind: string
          last_message_at?: string | null
          last_message_preview?: string | null
          property_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          property_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_system: boolean
          maintenance_id: string | null
          sender_user_id: string | null
        }
        Insert: {
          attachments?: Json
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          maintenance_id?: string | null
          sender_user_id?: string | null
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          maintenance_id?: string | null
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenances"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          role_label: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          role_label?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          role_label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          active: boolean
          agency_admin_fee_percentage: number
          contract_pdf_path: string | null
          created_at: string
          daily_interest_percent: number
          deleted_at: string | null
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
          agency_admin_fee_percentage?: number
          contract_pdf_path?: string | null
          created_at?: string
          daily_interest_percent?: number
          deleted_at?: string | null
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
          agency_admin_fee_percentage?: number
          contract_pdf_path?: string | null
          created_at?: string
          daily_interest_percent?: number
          deleted_at?: string | null
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
      document_events: {
        Row: {
          action: string
          created_at: string
          document_id: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          contract_id: string | null
          created_at: string
          custom_category: string | null
          deleted_at: string | null
          description: string | null
          document_date: string | null
          expires_at: string | null
          file_ext: string | null
          id: string
          inspection_id: string | null
          is_favorite: boolean
          maintenance_id: string | null
          mime_type: string | null
          name: string
          property_id: string | null
          size_bytes: number | null
          storage_path: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          contract_id?: string | null
          created_at?: string
          custom_category?: string | null
          deleted_at?: string | null
          description?: string | null
          document_date?: string | null
          expires_at?: string | null
          file_ext?: string | null
          id?: string
          inspection_id?: string | null
          is_favorite?: boolean
          maintenance_id?: string | null
          mime_type?: string | null
          name: string
          property_id?: string | null
          size_bytes?: number | null
          storage_path: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          contract_id?: string | null
          created_at?: string
          custom_category?: string | null
          deleted_at?: string | null
          description?: string | null
          document_date?: string | null
          expires_at?: string | null
          file_ext?: string | null
          id?: string
          inspection_id?: string | null
          is_favorite?: boolean
          maintenance_id?: string | null
          mime_type?: string | null
          name?: string
          property_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      efi_charges: {
        Row: {
          amount: number
          brcode: string | null
          created_at: string
          id: string
          installment_id: string | null
          kind: string
          loc_id: number | null
          manager_user_id: string | null
          paid_at: string | null
          qrcode_image_base64: string | null
          raw: Json | null
          status: string
          txid: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          brcode?: string | null
          created_at?: string
          id?: string
          installment_id?: string | null
          kind?: string
          loc_id?: number | null
          manager_user_id?: string | null
          paid_at?: string | null
          qrcode_image_base64?: string | null
          raw?: Json | null
          status?: string
          txid?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          brcode?: string | null
          created_at?: string
          id?: string
          installment_id?: string | null
          kind?: string
          loc_id?: number | null
          manager_user_id?: string | null
          paid_at?: string | null
          qrcode_image_base64?: string | null
          raw?: Json | null
          status?: string
          txid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "efi_charges_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      efi_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
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
        Relationships: [
          {
            foreignKeyName: "inspections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
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
          boleto_barcode: string | null
          boleto_url: string | null
          charge_provider: string
          contract_id: string
          created_at: string
          debt_agreement_id: string | null
          due_date: string
          extra_fees: number
          id: string
          landlord_payout_amount: number | null
          landlord_payout_asaas_id: string | null
          landlord_payout_date: string | null
          landlord_payout_error: string | null
          landlord_payout_status: string
          late_charges: number
          management_fee_percent: number
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payout_date: string | null
          payout_status: string
          pix_payload: string | null
          pix_qrcode: string | null
          stark_charge_id: string | null
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
          user_id: string
          variable_expenses: Json
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          barcode?: string | null
          boleto_barcode?: string | null
          boleto_url?: string | null
          charge_provider?: string
          contract_id: string
          created_at?: string
          debt_agreement_id?: string | null
          due_date: string
          extra_fees?: number
          id?: string
          landlord_payout_amount?: number | null
          landlord_payout_asaas_id?: string | null
          landlord_payout_date?: string | null
          landlord_payout_error?: string | null
          landlord_payout_status?: string
          late_charges?: number
          management_fee_percent?: number
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payout_date?: string | null
          payout_status?: string
          pix_payload?: string | null
          pix_qrcode?: string | null
          stark_charge_id?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
          user_id: string
          variable_expenses?: Json
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          barcode?: string | null
          boleto_barcode?: string | null
          boleto_url?: string | null
          charge_provider?: string
          contract_id?: string
          created_at?: string
          debt_agreement_id?: string | null
          due_date?: string
          extra_fees?: number
          id?: string
          landlord_payout_amount?: number | null
          landlord_payout_asaas_id?: string | null
          landlord_payout_date?: string | null
          landlord_payout_error?: string | null
          landlord_payout_status?: string
          late_charges?: number
          management_fee_percent?: number
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payout_date?: string | null
          payout_status?: string
          pix_payload?: string | null
          pix_qrcode?: string | null
          stark_charge_id?: string | null
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
          {
            foreignKeyName: "installments_stark_charge_id_fkey"
            columns: ["stark_charge_id"]
            isOneToOne: false
            referencedRelation: "stark_charges"
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
      maintenance_events: {
        Row: {
          action: string
          actor_role: string | null
          created_at: string
          description: string | null
          id: string
          maintenance_id: string
          metadata: Json
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_role?: string | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_id: string
          metadata?: Json
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_id?: string
          metadata?: Json
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_events_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenances"
            referencedColumns: ["id"]
          },
        ]
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
          category: string
          completed_date: string | null
          completion_photo_urls: string[]
          contract_id: string | null
          cost: number
          created_at: string
          description: string | null
          evidence_urls: string[]
          execution_responsible: Database["public"]["Enums"]["maintenance_responsible"]
          final_notes: string | null
          id: string
          invoice_urls: string[]
          payment_applied_installment_id: string | null
          payment_approved_amount: number | null
          payment_date: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_paid_amount: number | null
          payment_receipt_urls: string[]
          priority: string
          property_id: string
          provider_name: string | null
          provider_phone: string | null
          responsible: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
          workflow_stage: string | null
        }
        Insert: {
          budget_amount?: number
          budget_applied_installment_id?: string | null
          budget_decided_at?: string | null
          budget_notes?: string | null
          budget_rent_deduction?: boolean
          budget_status?: string
          category?: string
          completed_date?: string | null
          completion_photo_urls?: string[]
          contract_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          evidence_urls?: string[]
          execution_responsible?: Database["public"]["Enums"]["maintenance_responsible"]
          final_notes?: string | null
          id?: string
          invoice_urls?: string[]
          payment_applied_installment_id?: string | null
          payment_approved_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_paid_amount?: number | null
          payment_receipt_urls?: string[]
          priority?: string
          property_id: string
          provider_name?: string | null
          provider_phone?: string | null
          responsible?: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          workflow_stage?: string | null
        }
        Update: {
          budget_amount?: number
          budget_applied_installment_id?: string | null
          budget_decided_at?: string | null
          budget_notes?: string | null
          budget_rent_deduction?: boolean
          budget_status?: string
          category?: string
          completed_date?: string | null
          completion_photo_urls?: string[]
          contract_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          evidence_urls?: string[]
          execution_responsible?: Database["public"]["Enums"]["maintenance_responsible"]
          final_notes?: string | null
          id?: string
          invoice_urls?: string[]
          payment_applied_installment_id?: string | null
          payment_approved_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_paid_amount?: number | null
          payment_receipt_urls?: string[]
          priority?: string
          property_id?: string
          provider_name?: string | null
          provider_phone?: string | null
          responsible?: Database["public"]["Enums"]["maintenance_responsible"]
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workflow_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenances_payment_applied_installment_id_fkey"
            columns: ["payment_applied_installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
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
      payment_transfers: {
        Row: {
          amount: number
          attempts: number
          contract_id: string
          created_at: string
          description: string | null
          efi_e2e_id: string | null
          efi_id_envio: string | null
          efi_last_consult_at: string | null
          efi_response: Json | null
          efi_status: string | null
          efi_status_updated_at: string | null
          error_message: string | null
          external_id: string | null
          finished_at: string | null
          id: string
          installment_id: string
          manager_user_id: string
          next_retry_at: string | null
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          provider_transfer_id: string | null
          recipient_type: Database["public"]["Enums"]["payment_recipient_type"]
          recipient_user_id: string | null
          status: Database["public"]["Enums"]["payment_transfer_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          attempts?: number
          contract_id: string
          created_at?: string
          description?: string | null
          efi_e2e_id?: string | null
          efi_id_envio?: string | null
          efi_last_consult_at?: string | null
          efi_response?: Json | null
          efi_status?: string | null
          efi_status_updated_at?: string | null
          error_message?: string | null
          external_id?: string | null
          finished_at?: string | null
          id?: string
          installment_id: string
          manager_user_id: string
          next_retry_at?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          provider_transfer_id?: string | null
          recipient_type: Database["public"]["Enums"]["payment_recipient_type"]
          recipient_user_id?: string | null
          status?: Database["public"]["Enums"]["payment_transfer_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          attempts?: number
          contract_id?: string
          created_at?: string
          description?: string | null
          efi_e2e_id?: string | null
          efi_id_envio?: string | null
          efi_last_consult_at?: string | null
          efi_response?: Json | null
          efi_status?: string | null
          efi_status_updated_at?: string | null
          error_message?: string | null
          external_id?: string | null
          finished_at?: string | null
          id?: string
          installment_id?: string
          manager_user_id?: string
          next_retry_at?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          provider_transfer_id?: string | null
          recipient_type?: Database["public"]["Enums"]["payment_recipient_type"]
          recipient_user_id?: string | null
          status?: Database["public"]["Enums"]["payment_transfer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transfers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transfers_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_splits: {
        Row: {
          agency_amount: number
          agency_pix_key: string | null
          boleto_barcode: string | null
          boleto_url: string | null
          charge_type: string
          created_at: string
          id: string
          installment_id: string
          nexo_amount: number
          nexo_pix_key: string | null
          owner_amount: number
          owner_pix_key: string | null
          paid_at: string | null
          payout_error: string | null
          payout_scheduled_for: string | null
          payout_status: string
          provider: string
          psp_pix_payload: string | null
          psp_qrcode_base64: string | null
          psp_txid: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_amount?: number
          agency_pix_key?: string | null
          boleto_barcode?: string | null
          boleto_url?: string | null
          charge_type?: string
          created_at?: string
          id?: string
          installment_id: string
          nexo_amount?: number
          nexo_pix_key?: string | null
          owner_amount?: number
          owner_pix_key?: string | null
          paid_at?: string | null
          payout_error?: string | null
          payout_scheduled_for?: string | null
          payout_status?: string
          provider?: string
          psp_pix_payload?: string | null
          psp_qrcode_base64?: string | null
          psp_txid?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_amount?: number
          agency_pix_key?: string | null
          boleto_barcode?: string | null
          boleto_url?: string | null
          charge_type?: string
          created_at?: string
          id?: string
          installment_id?: string
          nexo_amount?: number
          nexo_pix_key?: string | null
          owner_amount?: number
          owner_pix_key?: string | null
          paid_at?: string | null
          payout_error?: string | null
          payout_scheduled_for?: string | null
          payout_status?: string
          provider?: string
          psp_pix_payload?: string | null
          psp_qrcode_base64?: string | null
          psp_txid?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_splits_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
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
          address: string | null
          address_complement: string | null
          address_number: string | null
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          document: string | null
          document_type: string | null
          efi_account_number: string | null
          email: string | null
          full_name: string | null
          id: string
          income_value: number | null
          integration_imovelweb_connected: boolean
          integration_token: string
          integration_zap_connected: boolean
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          postal_code: string | null
          province: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          efi_account_number?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          income_value?: number | null
          integration_imovelweb_connected?: boolean
          integration_token?: string
          integration_zap_connected?: boolean
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          postal_code?: string | null
          province?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          efi_account_number?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          income_value?: number | null
          integration_imovelweb_connected?: boolean
          integration_token?: string
          integration_zap_connected?: boolean
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          postal_code?: string | null
          province?: string | null
          state?: string | null
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
          owner_pix_key: string | null
          owner_pix_key_type: string | null
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
          owner_pix_key?: string | null
          owner_pix_key_type?: string | null
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
          owner_pix_key?: string | null
          owner_pix_key_type?: string | null
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
      stark_charges: {
        Row: {
          amount: number
          boleto_barcode: string | null
          boleto_line: string | null
          boleto_pdf_url: string | null
          brcode: string | null
          created_at: string
          due_date: string | null
          external_id: string | null
          id: string
          installment_id: string
          kind: Database["public"]["Enums"]["stark_charge_kind"]
          manager_user_id: string
          paid_at: string | null
          qrcode_image_url: string | null
          stark_boleto_id: string | null
          stark_id: string | null
          status: Database["public"]["Enums"]["stark_charge_status"]
          txid: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          boleto_barcode?: string | null
          boleto_line?: string | null
          boleto_pdf_url?: string | null
          brcode?: string | null
          created_at?: string
          due_date?: string | null
          external_id?: string | null
          id?: string
          installment_id: string
          kind?: Database["public"]["Enums"]["stark_charge_kind"]
          manager_user_id: string
          paid_at?: string | null
          qrcode_image_url?: string | null
          stark_boleto_id?: string | null
          stark_id?: string | null
          status?: Database["public"]["Enums"]["stark_charge_status"]
          txid?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          boleto_barcode?: string | null
          boleto_line?: string | null
          boleto_pdf_url?: string | null
          brcode?: string | null
          created_at?: string
          due_date?: string | null
          external_id?: string | null
          id?: string
          installment_id?: string
          kind?: Database["public"]["Enums"]["stark_charge_kind"]
          manager_user_id?: string
          paid_at?: string | null
          qrcode_image_url?: string | null
          stark_boleto_id?: string | null
          stark_id?: string | null
          status?: Database["public"]["Enums"]["stark_charge_status"]
          txid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stark_charges_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      stark_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          id: string
          log_type: string | null
          processed_at: string | null
          raw: Json
          subscription: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          id?: string
          log_type?: string | null
          processed_at?: string | null
          raw: Json
          subscription: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          id?: string
          log_type?: string | null
          processed_at?: string | null
          raw?: Json
          subscription?: string
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
      tenants: {
        Row: {
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      claim_pending_transfers: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          attempts: number
          contract_id: string
          created_at: string
          description: string | null
          efi_e2e_id: string | null
          efi_id_envio: string | null
          efi_last_consult_at: string | null
          efi_response: Json | null
          efi_status: string | null
          efi_status_updated_at: string | null
          error_message: string | null
          external_id: string | null
          finished_at: string | null
          id: string
          installment_id: string
          manager_user_id: string
          next_retry_at: string | null
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          provider_transfer_id: string | null
          recipient_type: Database["public"]["Enums"]["payment_recipient_type"]
          recipient_user_id: string | null
          status: Database["public"]["Enums"]["payment_transfer_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_transfers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      current_landlord_id: { Args: never; Returns: string }
      current_manager_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_chat_conversations: { Args: never; Returns: undefined }
      generate_org_slug: { Args: { _manager_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_current_tenant_property: {
        Args: { _property_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      run_security_invariants_check: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_cron_secret: { Args: { _secret: string }; Returns: undefined }
      verify_payout_integrity: {
        Args: { p_installment_id: string }
        Returns: boolean
      }
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
      app_role: "owner" | "tenant" | "manager" | "landlord" | "platform_admin"
      inspection_condition: "otimo" | "bom" | "regular" | "ruim"
      inspection_kind: "entrada" | "saida" | "preventiva" | "extraordinaria"
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
      payment_recipient_type: "nexo" | "agency" | "owner"
      payment_transfer_status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
      property_status: "disponivel" | "alugado" | "manutencao"
      property_type: "casa" | "apartamento" | "comercial" | "terreno" | "outro"
      readjustment_index: "IGP-M" | "IPCA" | "INCC" | "nenhum"
      stark_charge_kind: "pix" | "boleto" | "pix_boleto"
      stark_charge_status:
        | "created"
        | "paid"
        | "expired"
        | "canceled"
        | "failed"
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
      app_role: ["owner", "tenant", "manager", "landlord", "platform_admin"],
      inspection_condition: ["otimo", "bom", "regular", "ruim"],
      inspection_kind: ["entrada", "saida", "preventiva", "extraordinaria"],
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
      payment_recipient_type: ["nexo", "agency", "owner"],
      payment_transfer_status: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      property_status: ["disponivel", "alugado", "manutencao"],
      property_type: ["casa", "apartamento", "comercial", "terreno", "outro"],
      readjustment_index: ["IGP-M", "IPCA", "INCC", "nenhum"],
      stark_charge_kind: ["pix", "boleto", "pix_boleto"],
      stark_charge_status: ["created", "paid", "expired", "canceled", "failed"],
      transaction_type: ["Aluguel", "Venda"],
    },
  },
} as const
