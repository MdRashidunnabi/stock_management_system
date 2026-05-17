export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          after: Json | null;
          before: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          ip: unknown;
          tenant_id: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: number;
          ip?: unknown;
          tenant_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: number;
          ip?: unknown;
          tenant_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      batches: {
        Row: {
          created_at: string;
          expiry_date: string | null;
          id: string;
          lot_no: string;
          manufacture_date: string | null;
          notes: string | null;
          product_id: string;
          tenant_id: string;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          lot_no: string;
          manufacture_date?: string | null;
          notes?: string | null;
          product_id: string;
          tenant_id: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          lot_no?: string;
          manufacture_date?: string | null;
          notes?: string | null;
          product_id?: string;
          tenant_id?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batches_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batches_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          code: string;
          country: string;
          county: string | null;
          created_at: string;
          created_by: string | null;
          eircode: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          is_warehouse: boolean;
          name: string;
          opening_hours: Json | null;
          phone: string | null;
          tenant_id: string;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          code: string;
          country?: string;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          eircode?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          is_warehouse?: boolean;
          name: string;
          opening_hours?: Json | null;
          phone?: string | null;
          tenant_id: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          code?: string;
          country?: string;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          eircode?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          is_warehouse?: boolean;
          name?: string;
          opening_hours?: Json | null;
          phone?: string | null;
          tenant_id?: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          slug: string;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name: string;
          slug: string;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brands_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_drawer_movements: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          pos_session_id: string;
          reason: string | null;
          reference_id: string | null;
          reference_type: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["cash_movement_type"];
          user_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          pos_session_id: string;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["cash_movement_type"];
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          pos_session_id?: string;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["cash_movement_type"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cash_drawer_movements_pos_session_id_fkey";
            columns: ["pos_session_id"];
            isOneToOne: false;
            referencedRelation: "pos_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_drawer_movements_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          parent_id: string | null;
          position: number;
          slug: string;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          parent_id?: string | null;
          position?: number;
          slug: string;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          parent_id?: string | null;
          position?: number;
          slug?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          code: string | null;
          country: string;
          county: string | null;
          created_at: string;
          created_by: string | null;
          credit_balance: number;
          credit_limit: number;
          eircode: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          is_b2b: boolean;
          loyalty_balance: number;
          marketing_optin: boolean;
          notes: string | null;
          phone: string | null;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
          vat_number: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          code?: string | null;
          country?: string;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_balance?: number;
          credit_limit?: number;
          eircode?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          is_active?: boolean;
          is_b2b?: boolean;
          loyalty_balance?: number;
          marketing_optin?: boolean;
          notes?: string | null;
          phone?: string | null;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
          vat_number?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          code?: string | null;
          country?: string;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_balance?: number;
          credit_limit?: number;
          eircode?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          is_b2b?: boolean;
          loyalty_balance?: number;
          marketing_optin?: boolean;
          notes?: string | null;
          phone?: string | null;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          vat_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      discounts: {
        Row: {
          code: string | null;
          created_at: string;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          name: string;
          starts_at: string | null;
          tenant_id: string;
          type: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          starts_at?: string | null;
          tenant_id: string;
          type: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          starts_at?: string | null;
          tenant_id?: string;
          type?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "discounts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      goods_receipt_items: {
        Row: {
          batch_id: string | null;
          created_at: string;
          expiry_date: string | null;
          goods_receipt_id: string;
          id: string;
          lot_no: string | null;
          notes: string | null;
          position: number;
          product_id: string;
          quantity: number;
          tenant_id: string;
          unit_cost: number;
          updated_at: string;
          variant_id: string | null;
          vat_code: Database["public"]["Enums"]["vat_code"];
        };
        Insert: {
          batch_id?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          goods_receipt_id: string;
          id?: string;
          lot_no?: string | null;
          notes?: string | null;
          position?: number;
          product_id: string;
          quantity: number;
          tenant_id: string;
          unit_cost: number;
          updated_at?: string;
          variant_id?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
        };
        Update: {
          batch_id?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          goods_receipt_id?: string;
          id?: string;
          lot_no?: string | null;
          notes?: string | null;
          position?: number;
          product_id?: string;
          quantity?: number;
          tenant_id?: string;
          unit_cost?: number;
          updated_at?: string;
          variant_id?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
        };
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey";
            columns: ["goods_receipt_id"];
            isOneToOne: false;
            referencedRelation: "goods_receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      goods_receipts: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          finalised_at: string | null;
          finalised_by: string | null;
          gr_number: string;
          id: string;
          invoice_number: string | null;
          invoice_total: number | null;
          invoice_url: string | null;
          notes: string | null;
          purchase_order_id: string | null;
          received_at: string;
          status: Database["public"]["Enums"]["goods_receipt_status"];
          supplier_id: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          finalised_at?: string | null;
          finalised_by?: string | null;
          gr_number: string;
          id?: string;
          invoice_number?: string | null;
          invoice_total?: number | null;
          invoice_url?: string | null;
          notes?: string | null;
          purchase_order_id?: string | null;
          received_at?: string;
          status?: Database["public"]["Enums"]["goods_receipt_status"];
          supplier_id: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          finalised_at?: string | null;
          finalised_by?: string | null;
          gr_number?: string;
          id?: string;
          invoice_number?: string | null;
          invoice_total?: number | null;
          invoice_url?: string | null;
          notes?: string | null;
          purchase_order_id?: string | null;
          received_at?: string;
          status?: Database["public"]["Enums"]["goods_receipt_status"];
          supplier_id?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          expires_at: string;
          key: string;
          request_hash: string | null;
          response_body: Json | null;
          status_code: number | null;
          tenant_id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          key: string;
          request_hash?: string | null;
          response_body?: Json | null;
          status_code?: number | null;
          tenant_id: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          key?: string;
          request_hash?: string | null;
          response_body?: Json | null;
          status_code?: number | null;
          tenant_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          data: Json | null;
          id: string;
          is_read: boolean;
          read_at: string | null;
          tenant_id: string;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          is_read?: boolean;
          read_at?: string | null;
          tenant_id: string;
          title: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          is_read?: boolean;
          read_at?: string | null;
          tenant_id?: string;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      outbox: {
        Row: {
          attempts: number;
          created_at: string;
          id: number;
          last_error: string | null;
          next_attempt_at: string;
          payload: Json;
          sent_at: string | null;
          status: string;
          tenant_id: string | null;
          topic: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: number;
          last_error?: string | null;
          next_attempt_at?: string;
          payload: Json;
          sent_at?: string | null;
          status?: string;
          tenant_id?: string | null;
          topic: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: number;
          last_error?: string | null;
          next_attempt_at?: string;
          payload?: Json;
          sent_at?: string | null;
          status?: string;
          tenant_id?: string | null;
          topic?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outbox_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          captured_at: string | null;
          card_brand: string | null;
          card_last4: string | null;
          created_at: string;
          created_by: string | null;
          external_ref: string | null;
          fee: number | null;
          id: string;
          metadata: Json | null;
          method: Database["public"]["Enums"]["payment_method"];
          online_order_id: string | null;
          refunded_amount: number;
          refunded_at: string | null;
          sale_id: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          captured_at?: string | null;
          card_brand?: string | null;
          card_last4?: string | null;
          created_at?: string;
          created_by?: string | null;
          external_ref?: string | null;
          fee?: number | null;
          id?: string;
          metadata?: Json | null;
          method: Database["public"]["Enums"]["payment_method"];
          online_order_id?: string | null;
          refunded_amount?: number;
          refunded_at?: string | null;
          sale_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          captured_at?: string | null;
          card_brand?: string | null;
          card_last4?: string | null;
          created_at?: string;
          created_by?: string | null;
          external_ref?: string | null;
          fee?: number | null;
          id?: string;
          metadata?: Json | null;
          method?: Database["public"]["Enums"]["payment_method"];
          online_order_id?: string | null;
          refunded_amount?: number;
          refunded_at?: string | null;
          sale_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_sessions: {
        Row: {
          branch_id: string;
          cash_difference: number | null;
          cashier_id: string;
          closed_at: string | null;
          closed_by: string | null;
          closing_note: string | null;
          counted_cash: number | null;
          created_at: string;
          expected_cash: number | null;
          id: string;
          manager_pin_used: boolean;
          opened_at: string;
          opening_cash: number;
          status: Database["public"]["Enums"]["pos_session_status"];
          tenant_id: string;
          terminal_id: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          cash_difference?: number | null;
          cashier_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          closing_note?: string | null;
          counted_cash?: number | null;
          created_at?: string;
          expected_cash?: number | null;
          id?: string;
          manager_pin_used?: boolean;
          opened_at?: string;
          opening_cash?: number;
          status?: Database["public"]["Enums"]["pos_session_status"];
          tenant_id: string;
          terminal_id?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          cash_difference?: number | null;
          cashier_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          closing_note?: string | null;
          counted_cash?: number | null;
          created_at?: string;
          expected_cash?: number | null;
          id?: string;
          manager_pin_used?: boolean;
          opened_at?: string;
          opening_cash?: number;
          status?: Database["public"]["Enums"]["pos_session_status"];
          tenant_id?: string;
          terminal_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pos_sessions_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_sessions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_sessions_terminal_id_fkey";
            columns: ["terminal_id"];
            isOneToOne: false;
            referencedRelation: "pos_terminals";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_terminals: {
        Row: {
          branch_id: string;
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          printer_config: Json | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          printer_config?: Json | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          printer_config?: Json | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pos_terminals_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_terminals_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_branch_settings: {
        Row: {
          branch_id: string;
          branch_price: number | null;
          created_at: string;
          id: string;
          is_active: boolean;
          lead_time_days: number | null;
          max_stock: number | null;
          min_stock: number;
          product_id: string;
          reorder_qty: number | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          branch_price?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lead_time_days?: number | null;
          max_stock?: number | null;
          min_stock?: number;
          product_id: string;
          reorder_qty?: number | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          branch_price?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lead_time_days?: number | null;
          max_stock?: number | null;
          min_stock?: number;
          product_id?: string;
          reorder_qty?: number | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_branch_settings_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_branch_settings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_branch_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_price_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          field: string;
          id: number;
          new_value: number | null;
          old_value: number | null;
          product_id: string;
          tenant_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          field: string;
          id?: number;
          new_value?: number | null;
          old_value?: number | null;
          product_id: string;
          tenant_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          field?: string;
          id?: number;
          new_value?: number | null;
          old_value?: number | null;
          product_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_price_history_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          attributes: Json;
          barcode: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          price_override: number | null;
          product_id: string;
          purchase_price_override: number | null;
          sku: string | null;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          attributes?: Json;
          barcode?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          price_override?: number | null;
          product_id: string;
          purchase_price_override?: number | null;
          sku?: string | null;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          attributes?: Json;
          barcode?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          price_override?: number | null;
          product_id?: string;
          purchase_price_override?: number | null;
          sku?: string | null;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          archived_at: string | null;
          barcode: string | null;
          base_unit: string;
          batch_tracking: boolean;
          brand_id: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          decimal_qty_allowed: boolean;
          default_shelf_life_days: number | null;
          default_supplier_id: string | null;
          description_long: string | null;
          description_short: string | null;
          extra_barcodes: string[] | null;
          has_variants: boolean;
          hazmat: boolean;
          id: string;
          images: string[] | null;
          internal_code: string | null;
          is_active: boolean;
          margin_target_pct: number | null;
          name: string;
          online_description: string | null;
          online_title: string | null;
          online_visible: boolean;
          primary_image_url: string | null;
          purchase_price: number;
          requires_age_check: boolean;
          selling_price: number;
          seo_slug: string | null;
          serial_tracking: boolean;
          short_name_for_receipt: string | null;
          sku: string | null;
          tenant_id: string;
          unit_conversions: Json | null;
          updated_at: string;
          updated_by: string | null;
          vat_code: Database["public"]["Enums"]["vat_code"];
          vat_included: boolean;
          weighable: boolean;
        };
        Insert: {
          archived_at?: string | null;
          barcode?: string | null;
          base_unit?: string;
          batch_tracking?: boolean;
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          decimal_qty_allowed?: boolean;
          default_shelf_life_days?: number | null;
          default_supplier_id?: string | null;
          description_long?: string | null;
          description_short?: string | null;
          extra_barcodes?: string[] | null;
          has_variants?: boolean;
          hazmat?: boolean;
          id?: string;
          images?: string[] | null;
          internal_code?: string | null;
          is_active?: boolean;
          margin_target_pct?: number | null;
          name: string;
          online_description?: string | null;
          online_title?: string | null;
          online_visible?: boolean;
          primary_image_url?: string | null;
          purchase_price?: number;
          requires_age_check?: boolean;
          selling_price?: number;
          seo_slug?: string | null;
          serial_tracking?: boolean;
          short_name_for_receipt?: string | null;
          sku?: string | null;
          tenant_id: string;
          unit_conversions?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
          vat_included?: boolean;
          weighable?: boolean;
        };
        Update: {
          archived_at?: string | null;
          barcode?: string | null;
          base_unit?: string;
          batch_tracking?: boolean;
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          decimal_qty_allowed?: boolean;
          default_shelf_life_days?: number | null;
          default_supplier_id?: string | null;
          description_long?: string | null;
          description_short?: string | null;
          extra_barcodes?: string[] | null;
          has_variants?: boolean;
          hazmat?: boolean;
          id?: string;
          images?: string[] | null;
          internal_code?: string | null;
          is_active?: boolean;
          margin_target_pct?: number | null;
          name?: string;
          online_description?: string | null;
          online_title?: string | null;
          online_visible?: boolean;
          primary_image_url?: string | null;
          purchase_price?: number;
          requires_age_check?: boolean;
          selling_price?: number;
          seo_slug?: string | null;
          serial_tracking?: boolean;
          short_name_for_receipt?: string | null;
          sku?: string | null;
          tenant_id?: string;
          unit_conversions?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
          vat_included?: boolean;
          weighable?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_default_supplier_fk";
            columns: ["default_supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          is_platform_staff: boolean;
          locale: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          is_platform_staff?: boolean;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_platform_staff?: boolean;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          created_at: string;
          id: string;
          line_subtotal: number | null;
          notes: string | null;
          position: number;
          product_id: string;
          purchase_order_id: string;
          qty_outstanding: number | null;
          qty_received: number;
          quantity: number;
          tenant_id: string;
          unit_cost: number;
          updated_at: string;
          variant_id: string | null;
          vat_code: Database["public"]["Enums"]["vat_code"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          line_subtotal?: number | null;
          notes?: string | null;
          position?: number;
          product_id: string;
          purchase_order_id: string;
          qty_outstanding?: number | null;
          qty_received?: number;
          quantity: number;
          tenant_id: string;
          unit_cost: number;
          updated_at?: string;
          variant_id?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
        };
        Update: {
          created_at?: string;
          id?: string;
          line_subtotal?: number | null;
          notes?: string | null;
          position?: number;
          product_id?: string;
          purchase_order_id?: string;
          qty_outstanding?: number | null;
          qty_received?: number;
          quantity?: number;
          tenant_id?: string;
          unit_cost?: number;
          updated_at?: string;
          variant_id?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          branch_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          expected_at: string | null;
          id: string;
          notes: string | null;
          ordered_at: string | null;
          po_number: string;
          status: Database["public"]["Enums"]["purchase_order_status"];
          subtotal: number;
          supplier_id: string;
          tenant_id: string;
          total: number;
          updated_at: string;
          updated_by: string | null;
          vat_total: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          expected_at?: string | null;
          id?: string;
          notes?: string | null;
          ordered_at?: string | null;
          po_number: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          subtotal?: number;
          supplier_id: string;
          tenant_id: string;
          total?: number;
          updated_at?: string;
          updated_by?: string | null;
          vat_total?: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          expected_at?: string | null;
          id?: string;
          notes?: string | null;
          ordered_at?: string | null;
          po_number?: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          subtotal?: number;
          supplier_id?: string;
          tenant_id?: string;
          total?: number;
          updated_at?: string;
          updated_by?: string | null;
          vat_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      receipt_counters: {
        Row: {
          branch_id: string;
          last_seq: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          last_seq?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          last_seq?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_counters_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_counters_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_items: {
        Row: {
          batch_id: string | null;
          created_at: string;
          discount: number;
          id: string;
          line_total_gross: number;
          line_total_net: number;
          line_vat: number;
          name_snapshot: string;
          notes: string | null;
          position: number;
          product_id: string;
          quantity: number;
          sale_id: string;
          sku_snapshot: string | null;
          tenant_id: string;
          unit_cost: number | null;
          unit_price: number;
          variant_id: string | null;
          vat_code: Database["public"]["Enums"]["vat_code"];
          vat_rate: number;
        };
        Insert: {
          batch_id?: string | null;
          created_at?: string;
          discount?: number;
          id?: string;
          line_total_gross: number;
          line_total_net: number;
          line_vat: number;
          name_snapshot: string;
          notes?: string | null;
          position?: number;
          product_id: string;
          quantity: number;
          sale_id: string;
          sku_snapshot?: string | null;
          tenant_id: string;
          unit_cost?: number | null;
          unit_price: number;
          variant_id?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
          vat_rate?: number;
        };
        Update: {
          batch_id?: string | null;
          created_at?: string;
          discount?: number;
          id?: string;
          line_total_gross?: number;
          line_total_net?: number;
          line_vat?: number;
          name_snapshot?: string;
          notes?: string | null;
          position?: number;
          product_id?: string;
          quantity?: number;
          sale_id?: string;
          sku_snapshot?: string | null;
          tenant_id?: string;
          unit_cost?: number | null;
          unit_price?: number;
          variant_id?: string | null;
          vat_code?: Database["public"]["Enums"]["vat_code"];
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          branch_id: string;
          cashier_id: string | null;
          channel: Database["public"]["Enums"]["sale_channel"];
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          discount_total: number;
          id: string;
          notes: string | null;
          pos_session_id: string | null;
          receipt_number: string;
          rounding: number;
          status: Database["public"]["Enums"]["sale_status"];
          subtotal: number;
          tenant_id: string;
          terminal_id: string | null;
          total: number;
          updated_at: string;
          vat_breakdown: Json;
          vat_total: number;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          branch_id: string;
          cashier_id?: string | null;
          channel?: Database["public"]["Enums"]["sale_channel"];
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          discount_total?: number;
          id?: string;
          notes?: string | null;
          pos_session_id?: string | null;
          receipt_number: string;
          rounding?: number;
          status?: Database["public"]["Enums"]["sale_status"];
          subtotal?: number;
          tenant_id: string;
          terminal_id?: string | null;
          total?: number;
          updated_at?: string;
          vat_breakdown?: Json;
          vat_total?: number;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          branch_id?: string;
          cashier_id?: string | null;
          channel?: Database["public"]["Enums"]["sale_channel"];
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          discount_total?: number;
          id?: string;
          notes?: string | null;
          pos_session_id?: string | null;
          receipt_number?: string;
          rounding?: number;
          status?: Database["public"]["Enums"]["sale_status"];
          subtotal?: number;
          tenant_id?: string;
          terminal_id?: string | null;
          total?: number;
          updated_at?: string;
          vat_breakdown?: Json;
          vat_total?: number;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_fk";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_pos_session_id_fkey";
            columns: ["pos_session_id"];
            isOneToOne: false;
            referencedRelation: "pos_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_terminal_id_fkey";
            columns: ["terminal_id"];
            isOneToOne: false;
            referencedRelation: "pos_terminals";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_adjustments: {
        Row: {
          applied_ledger_id: number | null;
          approved_at: string | null;
          approved_by: string | null;
          branch_id: string;
          created_at: string;
          delta: number;
          id: string;
          product_id: string;
          reason: string;
          requested_by: string | null;
          state: Database["public"]["Enums"]["stock_state"];
          status: string;
          tenant_id: string;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          applied_ledger_id?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id: string;
          created_at?: string;
          delta: number;
          id?: string;
          product_id: string;
          reason: string;
          requested_by?: string | null;
          state?: Database["public"]["Enums"]["stock_state"];
          status?: string;
          tenant_id: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          applied_ledger_id?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string;
          created_at?: string;
          delta?: number;
          id?: string;
          product_id?: string;
          reason?: string;
          requested_by?: string | null;
          state?: Database["public"]["Enums"]["stock_state"];
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_applied_ledger_id_fkey";
            columns: ["applied_ledger_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_adjustments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_adjustments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_adjustments_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_balances: {
        Row: {
          branch_id: string;
          id: string;
          product_id: string;
          quantity: number;
          state: Database["public"]["Enums"]["stock_state"];
          tenant_id: string;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          branch_id: string;
          id?: string;
          product_id: string;
          quantity?: number;
          state: Database["public"]["Enums"]["stock_state"];
          tenant_id: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          branch_id?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          state?: Database["public"]["Enums"]["stock_state"];
          tenant_id?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_balances_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_balances_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_balances_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_ledger: {
        Row: {
          batch_id: string | null;
          branch_id: string;
          created_at: string;
          from_state: Database["public"]["Enums"]["stock_state"] | null;
          id: number;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          note: string | null;
          product_id: string;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          related_movement_id: number | null;
          tenant_id: string;
          to_state: Database["public"]["Enums"]["stock_state"] | null;
          unit_cost: number | null;
          user_id: string | null;
          variant_id: string | null;
        };
        Insert: {
          batch_id?: string | null;
          branch_id: string;
          created_at?: string;
          from_state?: Database["public"]["Enums"]["stock_state"] | null;
          id?: number;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          note?: string | null;
          product_id: string;
          quantity: number;
          reference_id?: string | null;
          reference_type?: string | null;
          related_movement_id?: number | null;
          tenant_id: string;
          to_state?: Database["public"]["Enums"]["stock_state"] | null;
          unit_cost?: number | null;
          user_id?: string | null;
          variant_id?: string | null;
        };
        Update: {
          batch_id?: string | null;
          branch_id?: string;
          created_at?: string;
          from_state?: Database["public"]["Enums"]["stock_state"] | null;
          id?: number;
          movement_type?: Database["public"]["Enums"]["stock_movement_type"];
          note?: string | null;
          product_id?: string;
          quantity?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          related_movement_id?: number | null;
          tenant_id?: string;
          to_state?: Database["public"]["Enums"]["stock_state"] | null;
          unit_cost?: number | null;
          user_id?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_ledger_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_related_movement_id_fkey";
            columns: ["related_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          code: string | null;
          contact_name: string | null;
          country: string;
          county: string | null;
          created_at: string;
          created_by: string | null;
          default_currency: string;
          default_lead_time_days: number | null;
          eircode: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          legal_name: string | null;
          name: string;
          notes: string | null;
          payment_terms: string | null;
          phone: string | null;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
          vat_number: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          code?: string | null;
          contact_name?: string | null;
          country?: string;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_currency?: string;
          default_lead_time_days?: number | null;
          eircode?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          legal_name?: string | null;
          name: string;
          notes?: string | null;
          payment_terms?: string | null;
          phone?: string | null;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
          vat_number?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          code?: string | null;
          contact_name?: string | null;
          country?: string;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_currency?: string;
          default_lead_time_days?: number | null;
          eircode?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          legal_name?: string | null;
          name?: string;
          notes?: string | null;
          payment_terms?: string | null;
          phone?: string | null;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          vat_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          country: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          default_locale: string;
          display_name: string;
          id: string;
          legal_name: string;
          notes: string | null;
          slug: string;
          status: Database["public"]["Enums"]["tenant_status"];
          timezone: string;
          trial_ends_at: string | null;
          updated_at: string;
          updated_by: string | null;
          vat_number: string | null;
        };
        Insert: {
          country?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          default_locale?: string;
          display_name: string;
          id?: string;
          legal_name: string;
          notes?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          timezone?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_number?: string | null;
        };
        Update: {
          country?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          default_locale?: string;
          display_name?: string;
          id?: string;
          legal_name?: string;
          notes?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          timezone?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vat_number?: string | null;
        };
        Relationships: [];
      };
      user_tenants: {
        Row: {
          accepted_at: string | null;
          branch_id: string | null;
          created_at: string;
          id: string;
          invited_at: string | null;
          invited_by: string | null;
          is_active: boolean;
          role: Database["public"]["Enums"]["user_role"];
          tenant_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          invited_at?: string | null;
          invited_by?: string | null;
          is_active?: boolean;
          role: Database["public"]["Enums"]["user_role"];
          tenant_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          invited_at?: string | null;
          invited_by?: string | null;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_tenants_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_tenants_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      close_pos_session: {
        Args: {
          p_closing_note?: string;
          p_counted_cash: number;
          p_session_id: string;
        };
        Returns: {
          cash_difference: number;
          counted_cash: number;
          expected_cash: number;
          session_id: string;
          status: Database["public"]["Enums"]["pos_session_status"];
        }[];
      };
      open_pos_session: {
        Args: {
          p_branch_id: string;
          p_note?: string;
          p_opening_cash?: number;
          p_terminal_id?: string;
        };
        Returns: string;
      };
      record_cash_movement: {
        Args: {
          p_amount: number;
          p_reason?: string;
          p_session_id: string;
          p_type: Database["public"]["Enums"]["cash_movement_type"];
        };
        Returns: string;
      };
      commit_pos_sale: {
        Args: {
          p_branch_id: string;
          p_channel?: Database["public"]["Enums"]["sale_channel"];
          p_customer_id?: string;
          p_items: Json;
          p_notes?: string;
          p_payments: Json;
          p_rounding?: number;
          p_session_id?: string;
          p_terminal_id?: string;
        };
        Returns: {
          pos_session_id: string;
          receipt_number: string;
          sale_id: string;
          total: number;
          vat_total: number;
        }[];
      };
      create_tenant_with_owner: {
        Args: {
          p_branch_address_line1?: string;
          p_branch_city?: string;
          p_branch_code?: string;
          p_branch_county?: string;
          p_branch_eircode?: string;
          p_branch_name?: string;
          p_country?: string;
          p_currency?: string;
          p_display_name: string;
          p_legal_name: string;
          p_locale?: string;
          p_slug: string;
          p_timezone?: string;
          p_vat_number?: string;
        };
        Returns: {
          branch_id: string;
          slug: string;
          tenant_id: string;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      unaccent: { Args: { "": string }; Returns: string };
    };
    Enums: {
      cash_movement_type:
        | "opening"
        | "sale"
        | "refund_out"
        | "cash_drop"
        | "expense"
        | "pay_in"
        | "pay_out"
        | "closing";
      goods_receipt_status: "draft" | "finalised" | "cancelled";
      payment_method:
        | "cash"
        | "card"
        | "contactless"
        | "apple_pay"
        | "google_pay"
        | "revolut"
        | "bank_transfer"
        | "store_credit"
        | "customer_account"
        | "voucher";
      payment_status:
        | "pending"
        | "authorised"
        | "captured"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "voided";
      pos_session_status: "open" | "closed" | "force_closed";
      purchase_order_status:
        | "draft"
        | "submitted"
        | "partially_received"
        | "received"
        | "cancelled"
        | "closed";
      sale_channel: "pos" | "online" | "b2b" | "phone";
      sale_status: "completed" | "voided" | "refunded" | "partially_refunded";
      stock_movement_type:
        | "goods_receipt"
        | "pos_sale"
        | "online_reserve"
        | "online_release"
        | "online_ship"
        | "damaged"
        | "expired"
        | "transfer_out"
        | "transfer_in"
        | "return"
        | "adjustment"
        | "opening_balance"
        | "count_correction";
      stock_state:
        | "available"
        | "reserved"
        | "sold"
        | "damaged"
        | "expired"
        | "in_transit"
        | "returned"
        | "quarantine";
      tenant_status: "pending" | "trial" | "active" | "past_due" | "suspended" | "cancelled";
      user_role:
        | "super_admin"
        | "support_admin"
        | "owner"
        | "manager"
        | "cashier"
        | "warehouse"
        | "accountant"
        | "delivery";
      vat_code: "STD" | "RED" | "SEC" | "LIV" | "ZER" | "EXE";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      cash_movement_type: [
        "opening",
        "sale",
        "refund_out",
        "cash_drop",
        "expense",
        "pay_in",
        "pay_out",
        "closing",
      ],
      goods_receipt_status: ["draft", "finalised", "cancelled"],
      payment_method: [
        "cash",
        "card",
        "contactless",
        "apple_pay",
        "google_pay",
        "revolut",
        "bank_transfer",
        "store_credit",
        "customer_account",
        "voucher",
      ],
      payment_status: [
        "pending",
        "authorised",
        "captured",
        "failed",
        "refunded",
        "partially_refunded",
        "voided",
      ],
      pos_session_status: ["open", "closed", "force_closed"],
      purchase_order_status: [
        "draft",
        "submitted",
        "partially_received",
        "received",
        "cancelled",
        "closed",
      ],
      sale_channel: ["pos", "online", "b2b", "phone"],
      sale_status: ["completed", "voided", "refunded", "partially_refunded"],
      stock_movement_type: [
        "goods_receipt",
        "pos_sale",
        "online_reserve",
        "online_release",
        "online_ship",
        "damaged",
        "expired",
        "transfer_out",
        "transfer_in",
        "return",
        "adjustment",
        "opening_balance",
        "count_correction",
      ],
      stock_state: [
        "available",
        "reserved",
        "sold",
        "damaged",
        "expired",
        "in_transit",
        "returned",
        "quarantine",
      ],
      tenant_status: ["pending", "trial", "active", "past_due", "suspended", "cancelled"],
      user_role: [
        "super_admin",
        "support_admin",
        "owner",
        "manager",
        "cashier",
        "warehouse",
        "accountant",
        "delivery",
      ],
      vat_code: ["STD", "RED", "SEC", "LIV", "ZER", "EXE"],
    },
  },
} as const;
