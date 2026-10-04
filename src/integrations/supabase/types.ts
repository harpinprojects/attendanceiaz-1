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
      absensi: {
        Row: {
          created_at: string
          id: string
          kelas_id: string
          mahasiswa_id: string
          mata_kuliah_id: string
          pertemuan: number
          status: string
          tanggal: string
        }
        Insert: {
          created_at?: string
          id?: string
          kelas_id: string
          mahasiswa_id: string
          mata_kuliah_id: string
          pertemuan: number
          status: string
          tanggal: string
        }
        Update: {
          created_at?: string
          id?: string
          kelas_id?: string
          mahasiswa_id?: string
          mata_kuliah_id?: string
          pertemuan?: number
          status?: string
          tanggal?: string
        }
        Relationships: [
          {
            foreignKeyName: "absensi_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absensi_mahasiswa_id_fkey"
            columns: ["mahasiswa_id"]
            isOneToOne: false
            referencedRelation: "mahasiswa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absensi_mata_kuliah_id_fkey"
            columns: ["mata_kuliah_id"]
            isOneToOne: false
            referencedRelation: "mata_kuliah"
            referencedColumns: ["id"]
          },
        ]
      }
      berita_acara: {
        Row: {
          created_at: string
          id: string
          kelas_id: string
          keterangan: string
          metode: string
          pertemuan: number
          pokok_bahasan: string
          tanggal: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kelas_id: string
          keterangan?: string
          metode?: string
          pertemuan: number
          pokok_bahasan?: string
          tanggal?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kelas_id?: string
          keterangan?: string
          metode?: string
          pertemuan?: number
          pokok_bahasan?: string
          tanggal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "berita_acara_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      kelas: {
        Row: {
          created_at: string
          dosen: string
          dosen_user_id: string | null
          hari: string | null
          id: string
          jam_mulai: string | null
          jam_selesai: string | null
          mata_kuliah_id: string
          nama: string
          ruangan: string | null
          semester: number
          tahun_akademik: string
        }
        Insert: {
          created_at?: string
          dosen: string
          dosen_user_id?: string | null
          hari?: string | null
          id?: string
          jam_mulai?: string | null
          jam_selesai?: string | null
          mata_kuliah_id: string
          nama: string
          ruangan?: string | null
          semester?: number
          tahun_akademik: string
        }
        Update: {
          created_at?: string
          dosen?: string
          dosen_user_id?: string | null
          hari?: string | null
          id?: string
          jam_mulai?: string | null
          jam_selesai?: string | null
          mata_kuliah_id?: string
          nama?: string
          ruangan?: string | null
          semester?: number
          tahun_akademik?: string
        }
        Relationships: [
          {
            foreignKeyName: "kelas_mata_kuliah_id_fkey"
            columns: ["mata_kuliah_id"]
            isOneToOne: false
            referencedRelation: "mata_kuliah"
            referencedColumns: ["id"]
          },
        ]
      }
      mahasiswa: {
        Row: {
          created_at: string
          id: string
          kelas: string
          nama: string
          npm: string
          program_studi: string
        }
        Insert: {
          created_at?: string
          id?: string
          kelas: string
          nama: string
          npm: string
          program_studi: string
        }
        Update: {
          created_at?: string
          id?: string
          kelas?: string
          nama?: string
          npm?: string
          program_studi?: string
        }
        Relationships: []
      }
      mata_kuliah: {
        Row: {
          created_at: string
          id: string
          kode: string
          nama: string
          semester: number
          sks: number
        }
        Insert: {
          created_at?: string
          id?: string
          kode: string
          nama: string
          semester?: number
          sks?: number
        }
        Update: {
          created_at?: string
          id?: string
          kode?: string
          nama?: string
          semester?: number
          sks?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nama_lengkap: string
          nuptk: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          nama_lengkap?: string
          nuptk?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nama_lengkap?: string
          nuptk?: string
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
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
