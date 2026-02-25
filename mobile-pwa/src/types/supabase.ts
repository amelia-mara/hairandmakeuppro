export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          tier: 'trainee' | 'artist' | 'supervisor' | 'designer'
          stripe_customer_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          tier?: 'trainee' | 'artist' | 'supervisor' | 'designer'
          stripe_customer_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          tier?: 'trainee' | 'artist' | 'supervisor' | 'designer'
          stripe_customer_id?: string | null
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          production_type: string
          status: 'prep' | 'shooting' | 'wrapped'
          invite_code: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          production_type: string
          status?: 'prep' | 'shooting' | 'wrapped'
          invite_code: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          production_type?: string
          status?: 'prep' | 'shooting' | 'wrapped'
          invite_code?: string
          created_by?: string
          created_at?: string
        }
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'designer' | 'hod' | 'supervisor' | 'key' | 'floor' | 'daily' | 'trainee'
          is_owner: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: 'designer' | 'hod' | 'supervisor' | 'key' | 'floor' | 'daily' | 'trainee'
          is_owner?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: 'designer' | 'hod' | 'supervisor' | 'key' | 'floor' | 'daily' | 'trainee'
          is_owner?: boolean
          joined_at?: string
        }
      }
      characters: {
        Row: {
          id: string
          project_id: string
          name: string
          actor_name: string | null
          initials: string
          avatar_colour: string
          base_look_description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          actor_name?: string | null
          initials: string
          avatar_colour: string
          base_look_description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          actor_name?: string | null
          initials?: string
          avatar_colour?: string
          base_look_description?: string | null
          created_at?: string
        }
      }
      scenes: {
        Row: {
          id: string
          project_id: string
          scene_number: string
          int_ext: string | null
          location: string | null
          time_of_day: string | null
          synopsis: string | null
          page_count: number | null
          story_day: number | null
          shooting_day: number | null
          filming_status: string | null
          filming_notes: string | null
          is_complete: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          scene_number: string
          int_ext?: string | null
          location?: string | null
          time_of_day?: string | null
          synopsis?: string | null
          page_count?: number | null
          story_day?: number | null
          shooting_day?: number | null
          filming_status?: string | null
          filming_notes?: string | null
          is_complete?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          scene_number?: string
          int_ext?: string | null
          location?: string | null
          time_of_day?: string | null
          synopsis?: string | null
          page_count?: number | null
          story_day?: number | null
          shooting_day?: number | null
          filming_status?: string | null
          filming_notes?: string | null
          is_complete?: boolean
          completed_at?: string | null
          created_at?: string
        }
      }
      scene_characters: {
        Row: {
          id: string
          scene_id: string
          character_id: string
        }
        Insert: {
          id?: string
          scene_id: string
          character_id: string
        }
        Update: {
          id?: string
          scene_id?: string
          character_id?: string
        }
      }
      looks: {
        Row: {
          id: string
          project_id: string
          character_id: string
          name: string
          description: string | null
          estimated_time: number
          makeup_details: Json | null
          hair_details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          character_id: string
          name: string
          description?: string | null
          estimated_time?: number
          makeup_details?: Json | null
          hair_details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          character_id?: string
          name?: string
          description?: string | null
          estimated_time?: number
          makeup_details?: Json | null
          hair_details?: Json | null
          created_at?: string
        }
      }
      look_scenes: {
        Row: {
          id: string
          look_id: string
          scene_number: string
        }
        Insert: {
          id?: string
          look_id: string
          scene_number: string
        }
        Update: {
          id?: string
          look_id?: string
          scene_number?: string
        }
      }
      continuity_events: {
        Row: {
          id: string
          scene_id: string
          character_id: string
          look_id: string | null
          shooting_day: number | null
          status: 'not_started' | 'in_progress' | 'checked'
          hair_notes: string | null
          makeup_notes: string | null
          prosthetics_notes: string | null
          wounds_blood_notes: string | null
          general_notes: string | null
          application_time: number | null
          continuity_flags: Json | null
          continuity_events_data: Json | null
          sfx_details: Json | null
          checked_by: string | null
          checked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          character_id: string
          look_id?: string | null
          shooting_day?: number | null
          status?: 'not_started' | 'in_progress' | 'checked'
          hair_notes?: string | null
          makeup_notes?: string | null
          prosthetics_notes?: string | null
          wounds_blood_notes?: string | null
          general_notes?: string | null
          application_time?: number | null
          continuity_flags?: Json | null
          continuity_events_data?: Json | null
          sfx_details?: Json | null
          checked_by?: string | null
          checked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          character_id?: string
          look_id?: string | null
          shooting_day?: number | null
          status?: 'not_started' | 'in_progress' | 'checked'
          hair_notes?: string | null
          makeup_notes?: string | null
          prosthetics_notes?: string | null
          wounds_blood_notes?: string | null
          general_notes?: string | null
          application_time?: number | null
          continuity_flags?: Json | null
          continuity_events_data?: Json | null
          sfx_details?: Json | null
          checked_by?: string | null
          checked_at?: string | null
          created_at?: string
        }
      }
      photos: {
        Row: {
          id: string
          continuity_event_id: string
          storage_path: string
          photo_type: 'reference' | 'on_set' | 'wrap'
          angle: 'front' | 'left' | 'right' | 'back' | 'detail' | 'additional'
          notes: string | null
          taken_by: string | null
          taken_at: string
        }
        Insert: {
          id?: string
          continuity_event_id: string
          storage_path: string
          photo_type?: 'reference' | 'on_set' | 'wrap'
          angle?: 'front' | 'left' | 'right' | 'back' | 'detail' | 'additional'
          notes?: string | null
          taken_by?: string | null
          taken_at?: string
        }
        Update: {
          id?: string
          continuity_event_id?: string
          storage_path?: string
          photo_type?: 'reference' | 'on_set' | 'wrap'
          angle?: 'front' | 'left' | 'right' | 'back' | 'detail' | 'additional'
          notes?: string | null
          taken_by?: string | null
          taken_at?: string
        }
      }
      schedule_data: {
        Row: {
          id: string
          project_id: string
          raw_pdf_text: string | null
          cast_list: Json | null
          days: Json | null
          status: 'pending' | 'processing' | 'complete' | 'partial'
          processing_progress: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          raw_pdf_text?: string | null
          cast_list?: Json | null
          days?: Json | null
          status?: 'pending' | 'processing' | 'complete' | 'partial'
          processing_progress?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          raw_pdf_text?: string | null
          cast_list?: Json | null
          days?: Json | null
          status?: 'pending' | 'processing' | 'complete' | 'partial'
          processing_progress?: Json | null
          created_at?: string
        }
      }
      timesheets: {
        Row: {
          id: string
          project_id: string
          user_id: string
          week_starting: string
          entries: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          week_starting: string
          entries: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          week_starting?: string
          entries?: Json
          created_at?: string
          updated_at?: string
        }
      }
      call_sheet_data: {
        Row: {
          id: string
          project_id: string
          shoot_date: string
          production_day: number
          storage_path: string | null
          raw_text: string | null
          parsed_data: Json
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          shoot_date: string
          production_day: number
          storage_path?: string | null
          raw_text?: string | null
          parsed_data: Json
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          shoot_date?: string
          production_day?: number
          storage_path?: string | null
          raw_text?: string | null
          parsed_data?: Json
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      script_uploads: {
        Row: {
          id: string
          project_id: string
          version_label: string | null
          version_number: number
          storage_path: string
          file_name: string
          file_size: number | null
          raw_text: string | null
          scene_count: number | null
          character_count: number | null
          parsed_data: Json | null
          is_active: boolean
          status: 'uploaded' | 'parsing' | 'parsed' | 'error'
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          version_label?: string | null
          version_number?: number
          storage_path: string
          file_name: string
          file_size?: number | null
          raw_text?: string | null
          scene_count?: number | null
          character_count?: number | null
          parsed_data?: Json | null
          is_active?: boolean
          status?: 'uploaded' | 'parsing' | 'parsed' | 'error'
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          version_label?: string | null
          version_number?: number
          storage_path?: string
          file_name?: string
          file_size?: number | null
          raw_text?: string | null
          scene_count?: number | null
          character_count?: number | null
          parsed_data?: Json | null
          is_active?: boolean
          status?: 'uploaded' | 'parsing' | 'parsed' | 'error'
          uploaded_by?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectMember = Database['public']['Tables']['project_members']['Row']
export type Character = Database['public']['Tables']['characters']['Row']
export type Scene = Database['public']['Tables']['scenes']['Row']
export type Look = Database['public']['Tables']['looks']['Row']
export type ContinuityEvent = Database['public']['Tables']['continuity_events']['Row']
export type Photo = Database['public']['Tables']['photos']['Row']
export type ScheduleData = Database['public']['Tables']['schedule_data']['Row']
export type Timesheet = Database['public']['Tables']['timesheets']['Row']
export type CallSheetData = Database['public']['Tables']['call_sheet_data']['Row']
export type ScriptUpload = Database['public']['Tables']['script_uploads']['Row']
