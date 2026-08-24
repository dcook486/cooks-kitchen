export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      grocery_items: {
        Row: { category: string | null; created_at: string; created_by: string; household_id: string; id: string; is_checked: boolean; meal_plan_id: string | null; name: string; quantity: string | null; source_recipe_id: string | null; updated_at: string }
        Insert: { category?: string | null; created_at?: string; created_by: string; household_id: string; id?: string; is_checked?: boolean; meal_plan_id?: string | null; name: string; quantity?: string | null; source_recipe_id?: string | null; updated_at?: string }
        Update: { category?: string | null; created_at?: string; created_by?: string; household_id?: string; id?: string; is_checked?: boolean; meal_plan_id?: string | null; name?: string; quantity?: string | null; source_recipe_id?: string | null; updated_at?: string }
        Relationships: [
          { foreignKeyName: "grocery_items_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] },
          { foreignKeyName: "grocery_items_meal_plan_id_fkey"; columns: ["meal_plan_id"]; isOneToOne: false; referencedRelation: "meal_plans"; referencedColumns: ["id"] },
          { foreignKeyName: "grocery_items_source_recipe_id_fkey"; columns: ["source_recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] },
        ]
      }
      household_members: {
        Row: { created_at: string; household_id: string; role: string; user_id: string }
        Insert: { created_at?: string; household_id: string; role?: string; user_id: string }
        Update: { created_at?: string; household_id?: string; role?: string; user_id?: string }
        Relationships: [{ foreignKeyName: "household_members_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] }]
      }
      households: {
        Row: { created_at: string; created_by: string; id: string; name: string; timezone: string; updated_at: string }
        Insert: { created_at?: string; created_by: string; id?: string; name: string; timezone?: string; updated_at?: string }
        Update: { created_at?: string; created_by?: string; id?: string; name?: string; timezone?: string; updated_at?: string }
        Relationships: []
      }
      meal_plan_items: {
        Row: { created_at: string; custom_label: string | null; id: string; meal_date: string; meal_plan_id: string; meal_type: string; notes: string | null; recipe_id: string | null; status: string; updated_at: string }
        Insert: { created_at?: string; custom_label?: string | null; id?: string; meal_date: string; meal_plan_id: string; meal_type?: string; notes?: string | null; recipe_id?: string | null; status?: string; updated_at?: string }
        Update: { created_at?: string; custom_label?: string | null; id?: string; meal_date?: string; meal_plan_id?: string; meal_type?: string; notes?: string | null; recipe_id?: string | null; status?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "meal_plan_items_meal_plan_id_fkey"; columns: ["meal_plan_id"]; isOneToOne: false; referencedRelation: "meal_plans"; referencedColumns: ["id"] },
          { foreignKeyName: "meal_plan_items_recipe_id_fkey"; columns: ["recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] },
        ]
      }
      meal_plans: {
        Row: { created_at: string; created_by: string; household_id: string; id: string; updated_at: string; week_start: string }
        Insert: { created_at?: string; created_by: string; household_id: string; id?: string; updated_at?: string; week_start: string }
        Update: { created_at?: string; created_by?: string; household_id?: string; id?: string; updated_at?: string; week_start?: string }
        Relationships: [{ foreignKeyName: "meal_plans_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] }]
      }
      profiles: {
        Row: { created_at: string; display_name: string | null; id: string; updated_at: string }
        Insert: { created_at?: string; display_name?: string | null; id: string; updated_at?: string }
        Update: { created_at?: string; display_name?: string | null; id?: string; updated_at?: string }
        Relationships: []
      }
      recipes: {
        Row: { cook_minutes: number | null; created_at: string; created_by: string; description: string | null; dietary_tags: string[]; household_id: string; id: string; image_url: string | null; ingredients: Json; instructions: Json; is_favorite: boolean; name: string; prep_minutes: number | null; servings: number | null; source_url: string | null; tags: string[]; updated_at: string }
        Insert: { cook_minutes?: number | null; created_at?: string; created_by: string; description?: string | null; dietary_tags?: string[]; household_id: string; id?: string; image_url?: string | null; ingredients?: Json; instructions?: Json; is_favorite?: boolean; name: string; prep_minutes?: number | null; servings?: number | null; source_url?: string | null; tags?: string[]; updated_at?: string }
        Update: { cook_minutes?: number | null; created_at?: string; created_by?: string; description?: string | null; dietary_tags?: string[]; household_id?: string; id?: string; image_url?: string | null; ingredients?: Json; instructions?: Json; is_favorite?: boolean; name?: string; prep_minutes?: number | null; servings?: number | null; source_url?: string | null; tags?: string[]; updated_at?: string }
        Relationships: [{ foreignKeyName: "recipes_household_id_fkey"; columns: ["household_id"]; isOneToOne: false; referencedRelation: "households"; referencedColumns: ["id"] }]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never
