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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      appointment_notes: {
        Row: {
          appointment_id: string
          body: string
          clinic_id: string | null
          created_at: string
          id: string
          patient_id: string | null
          updated_at: string
          updated_by: string | null
          updated_by_label: string | null
        }
        Insert: {
          appointment_id: string
          body?: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_label?: string | null
        }
        Update: {
          appointment_id?: string
          body?: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          catalogue_id: string | null
          clinic_id: string | null
          consent_document_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string | null
          patient_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          practitioner_id: string | null
          price: number | null
          stage: Database["public"]["Enums"]["visit_stage"]
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          treatment_name: string
          treatment_number: number
          updated_at: string
        }
        Insert: {
          catalogue_id?: string | null
          clinic_id?: string | null
          consent_document_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          patient_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          practitioner_id?: string | null
          price?: number | null
          stage?: Database["public"]["Enums"]["visit_stage"]
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_name: string
          treatment_number?: number
          updated_at?: string
        }
        Update: {
          catalogue_id?: string | null
          clinic_id?: string | null
          consent_document_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          practitioner_id?: string | null
          price?: number | null
          stage?: Database["public"]["Enums"]["visit_stage"]
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_name?: string
          treatment_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "treatment_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_consent_document_id_fkey"
            columns: ["consent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          clinic_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json | null
          patient_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          clinic_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          patient_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          clinic_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          patient_id?: string | null
        }
        Relationships: []
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          access_token: string
          body: string | null
          clinic_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          fields: Json
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          patient_id: string
          responses: Json | null
          sent_at: string | null
          signature_data: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_name: string | null
          status: Database["public"]["Enums"]["document_status"]
          title: string
          treatment_id: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          access_token?: string
          body?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fields?: Json
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          patient_id: string
          responses?: Json | null
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title: string
          treatment_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          body?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fields?: Json
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          patient_id?: string
          responses?: Json | null
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title?: string
          treatment_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_history_versions: {
        Row: {
          changed_by: string | null
          clinic_id: string | null
          created_at: string
          data: Json
          id: string
          patient_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["message_author"]
          summary: string | null
        }
        Insert: {
          changed_by?: string | null
          clinic_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          patient_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["message_author"]
          summary?: string | null
        }
        Update: {
          changed_by?: string | null
          clinic_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          patient_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["message_author"]
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_history_versions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_history_versions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          clinic_id: string | null
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          author: Database["public"]["Enums"]["message_author"]
          author_id: string | null
          body: string
          clinic_id: string | null
          created_at: string
          id: string
          patient_id: string
          read_at: string | null
        }
        Insert: {
          attachments?: Json
          author: Database["public"]["Enums"]["message_author"]
          author_id?: string | null
          body: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          patient_id: string
          read_at?: string | null
        }
        Update: {
          attachments?: Json
          author?: Database["public"]["Enums"]["message_author"]
          author_id?: string | null
          body?: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          allergies: string | null
          avatar_url: string | null
          clinic_id: string | null
          conditions: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          last_visit_at: string | null
          medications: string | null
          notes: string | null
          phone: string | null
          reference: string | null
          status: Database["public"]["Enums"]["patient_status"]
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          allergies?: string | null
          avatar_url?: string | null
          clinic_id?: string | null
          conditions?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          last_visit_at?: string | null
          medications?: string | null
          notes?: string | null
          phone?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          allergies?: string | null
          avatar_url?: string | null
          clinic_id?: string | null
          conditions?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          last_visit_at?: string | null
          medications?: string | null
          notes?: string | null
          phone?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_requests: {
        Row: {
          clinic_id: string | null
          created_at: string
          full_name: string | null
          id: string
          job_title: string | null
          note: string | null
          registration_body: string | null
          registration_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          note?: string | null
          registration_body?: string | null
          registration_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          note?: string | null
          registration_body?: string | null
          registration_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_change_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clinic_id: string | null
          commission_rate: number
          created_at: string
          full_name: string
          id: string
          job_title: string | null
          registration_body: string | null
          registration_number: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clinic_id?: string | null
          commission_rate?: number
          created_at?: string
          full_name?: string
          id: string
          job_title?: string | null
          registration_body?: string | null
          registration_number?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string | null
          commission_rate?: number
          created_at?: string
          full_name?: string
          id?: string
          job_title?: string | null
          registration_body?: string | null
          registration_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      recall_tasks: {
        Row: {
          assigned_label: string | null
          assigned_to: string | null
          clinic_id: string | null
          completed_at: string | null
          completed_by: string | null
          contacted_at: string | null
          contacted_by: string | null
          created_at: string
          created_by: string | null
          group_id: string | null
          id: string
          note: string | null
          patient_id: string
          status: Database["public"]["Enums"]["recall_task_status"]
          status_by_label: string | null
          updated_at: string
        }
        Insert: {
          assigned_label?: string | null
          assigned_to?: string | null
          clinic_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          note?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["recall_task_status"]
          status_by_label?: string | null
          updated_at?: string
        }
        Update: {
          assigned_label?: string | null
          assigned_to?: string | null
          clinic_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          note?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["recall_task_status"]
          status_by_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_outreach: {
        Row: {
          channel: string
          clinic_id: string | null
          contacted_by: string | null
          created_at: string
          id: string
          note: string | null
          patient_id: string
        }
        Insert: {
          channel?: string
          clinic_id?: string | null
          contacted_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          patient_id: string
        }
        Update: {
          channel?: string
          clinic_id?: string | null
          contacted_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_outreach_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_outreach_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      staff_documents: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          path: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          path: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          path?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_notifications: {
        Row: {
          appointment_id: string | null
          body: string | null
          clinic_id: string
          created_at: string
          id: string
          kind: string
          patient_id: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string | null
          title: string
          urgent: boolean
        }
        Insert: {
          appointment_id?: string | null
          body?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          kind?: string
          patient_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id?: string | null
          title: string
          urgent?: boolean
        }
        Update: {
          appointment_id?: string | null
          body?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: string
          patient_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string | null
          title?: string
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "staff_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_catalogue: {
        Row: {
          active: boolean
          category: string | null
          clinic_id: string | null
          cooling_off_hours: number
          created_at: string
          description: string | null
          id: string
          interval_days: number | null
          name: string
          price: number | null
          requires_consent: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          clinic_id?: string | null
          cooling_off_hours?: number
          created_at?: string
          description?: string | null
          id?: string
          interval_days?: number | null
          name: string
          price?: number | null
          requires_consent?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          clinic_id?: string | null
          cooling_off_hours?: number
          created_at?: string
          description?: string | null
          id?: string
          interval_days?: number | null
          name?: string
          price?: number | null
          requires_consent?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_catalogue_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_colour_themes: {
        Row: {
          colours: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          colours?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          colours?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      treatment_colours: {
        Row: {
          hex: string | null
          lane: number
          treatment_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hex?: string | null
          lane: number
          treatment_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hex?: string | null
          lane?: number
          treatment_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      treatment_photos: {
        Row: {
          caption: string | null
          clinic_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          marketing_consent: boolean
          patient_id: string
          storage_path: string
          taken_at: string
          treatment_id: string | null
          visible_to_patient: boolean
        }
        Insert: {
          caption?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["photo_kind"]
          marketing_consent?: boolean
          patient_id: string
          storage_path: string
          taken_at?: string
          treatment_id?: string | null
          visible_to_patient?: boolean
        }
        Update: {
          caption?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["photo_kind"]
          marketing_consent?: boolean
          patient_id?: string
          storage_path?: string
          taken_at?: string
          treatment_id?: string | null
          visible_to_patient?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "treatment_photos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_photos_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          area: string | null
          catalogue_id: string | null
          clinic_id: string | null
          commission_rate_snapshot: number | null
          consent_document_id: string | null
          created_at: string
          dose: string | null
          id: string
          name: string
          next_due_at: string | null
          notes: string | null
          patient_id: string
          performed_at: string
          practitioner_id: string | null
          price: number | null
          product: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          catalogue_id?: string | null
          clinic_id?: string | null
          commission_rate_snapshot?: number | null
          consent_document_id?: string | null
          created_at?: string
          dose?: string | null
          id?: string
          name: string
          next_due_at?: string | null
          notes?: string | null
          patient_id: string
          performed_at?: string
          practitioner_id?: string | null
          price?: number | null
          product?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          catalogue_id?: string | null
          clinic_id?: string | null
          commission_rate_snapshot?: number | null
          consent_document_id?: string | null
          created_at?: string
          dose?: string | null
          id?: string
          name?: string
          next_due_at?: string | null
          notes?: string | null
          patient_id?: string
          performed_at?: string
          practitioner_id?: string | null
          price?: number | null
          product?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "treatment_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
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
      current_patient_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "practitioner" | "front_desk" | "patient"
      appointment_status: "booked" | "attended" | "cancelled" | "no_show"
      change_request_status: "pending" | "approved" | "declined"
      document_kind:
        | "consent"
        | "treatment_plan"
        | "consultation"
        | "aftercare"
        | "other"
      document_status: "draft" | "sent" | "viewed" | "signed" | "expired"
      message_author: "staff" | "patient"
      patient_status: "active" | "inactive" | "archived"
      payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded"
      photo_kind: "before" | "after"
      recall_task_status: "sent" | "contacted" | "completed"
      visit_stage:
        | "booked"
        | "arrived"
        | "waiting"
        | "in_treatment"
        | "aftercare"
        | "complete"
        | "no_show"
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
      app_role: ["owner", "practitioner", "front_desk", "patient"],
      appointment_status: ["booked", "attended", "cancelled", "no_show"],
      change_request_status: ["pending", "approved", "declined"],
      document_kind: [
        "consent",
        "treatment_plan",
        "consultation",
        "aftercare",
        "other",
      ],
      document_status: ["draft", "sent", "viewed", "signed", "expired"],
      message_author: ["staff", "patient"],
      patient_status: ["active", "inactive", "archived"],
      payment_status: ["unpaid", "deposit_paid", "paid", "refunded"],
      photo_kind: ["before", "after"],
      recall_task_status: ["sent", "contacted", "completed"],
      visit_stage: [
        "booked",
        "arrived",
        "waiting",
        "in_treatment",
        "aftercare",
        "complete",
        "no_show",
      ],
    },
  },
} as const
