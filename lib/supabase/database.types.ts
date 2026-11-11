
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "card_templates": {
                  Row: {
                    "id": string,"image_path": string,"influencer_id": string,"style": Database["public"]['Enums']["card_style"]
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"image_path": string,"influencer_id": string,"style": Database["public"]['Enums']["card_style"]
                  }
                  Update: {
                    "id"?: string,"image_path"?: string,"influencer_id"?: string,"style"?: Database["public"]['Enums']["card_style"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_templates_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_templates_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "room_catalog"
      referencedColumns: ["influencer_id"]
    }
                  ]
                },"chat_rooms": {
                  Row: {
                    "created_at": string,"id": string,"influencer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"influencer_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"influencer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_rooms_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: true
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_rooms_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: true
      referencedRelation: "room_catalog"
      referencedColumns: ["influencer_id"]
    }
                  ]
                },"draws": {
                  Row: {
                    "created_at": string,"forced": boolean,"grade": Database["public"]['Enums']["card_grade"],"id": string,"is_new": boolean,"round_id": string,"template_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"forced"?: boolean,"grade": Database["public"]['Enums']["card_grade"],"id"?: string,"is_new": boolean,"round_id": string,"template_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"forced"?: boolean,"grade"?: Database["public"]['Enums']["card_grade"],"id"?: string,"is_new"?: boolean,"round_id"?: string,"template_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "draws_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "card_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "draws_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "collection_view"
      referencedColumns: ["template_id"]
    },{
      foreignKeyName: "draws_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "inventory_view"
      referencedColumns: ["template_id"]
    },{
      foreignKeyName: "draws_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "draws_user_id_round_id_fkey"
      columns: ["user_id","round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"game_config": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>,"version"?: number
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [

                  ]
                },"influencers": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"profile_image_path": string | null,"type": Database["public"]['Enums']["influencer_type"],"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"profile_image_path"?: string | null,"type": Database["public"]['Enums']["influencer_type"],"verified_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"profile_image_path"?: string | null,"type"?: Database["public"]['Enums']["influencer_type"],"verified_at"?: string | null
                  }
                  Relationships: [

                  ]
                },"message_clusters": {
                  Row: {
                    "created_at": string,"id": string,"representative": string,"room_id": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"representative": string,"room_id": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"representative"?: string,"room_id"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_clusters_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "chat_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_clusters_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "room_catalog"
      referencedColumns: ["room_id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string | null,"cluster_id": string | null,"created_at": string,"deleted_at": string | null,"id": number,"id_text": string,"message_kind": string,"own_score": number | null,"passes_all_filters": boolean | null,"priority": number | null,"quality_score": number | null,"recipient_user_id": string | null,"reply_context": string | null,"reply_to": number | null,"reply_to_text": string | null,"room_id": string,"sender_id": string,"sender_name": string,"sender_type": string,"support_badge": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"cluster_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: never,"id_text": string,"message_kind": string,"own_score"?: number | null,"passes_all_filters"?: boolean | null,"priority"?: number | null,"quality_score"?: number | null,"recipient_user_id"?: string | null,"reply_context"?: string | null,"reply_to"?: number | null,"reply_to_text"?: string | null,"room_id": string,"sender_id": string,"sender_name": string,"sender_type": string,"support_badge"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"cluster_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: never,"id_text"?: string,"message_kind"?: string,"own_score"?: number | null,"passes_all_filters"?: boolean | null,"priority"?: number | null,"quality_score"?: number | null,"recipient_user_id"?: string | null,"reply_context"?: string | null,"reply_to"?: number | null,"reply_to_text"?: string | null,"room_id"?: string,"sender_id"?: string,"sender_name"?: string,"sender_type"?: string,"support_badge"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_recipient_user_id_fkey"
      columns: ["recipient_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_room_id_cluster_id_fkey"
      columns: ["room_id","cluster_id"]
isOneToOne: false
      referencedRelation: "message_clusters"
      referencedColumns: ["room_id","id"]
    },{
      foreignKeyName: "messages_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "chat_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "room_catalog"
      referencedColumns: ["room_id"]
    },{
      foreignKeyName: "messages_room_id_reply_to_fkey"
      columns: ["room_id","reply_to"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["room_id","id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"nickname": string,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"nickname"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"nickname"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"room_members": {
                  Row: {
                    "gauge": number,"joined_at": string,"joined_month": string,"left_at": string | null,"left_month": string | null,"room_id": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gauge": number,"joined_at": string,"joined_month": string,"left_at"?: string | null,"left_month"?: string | null,"room_id": string,"status": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "gauge"?: number,"joined_at"?: string,"joined_month"?: string,"left_at"?: string | null,"left_month"?: string | null,"room_id"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_members_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "chat_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_members_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "room_catalog"
      referencedColumns: ["room_id"]
    },{
      foreignKeyName: "room_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rounds": {
                  Row: {
                    "clock_kind": string,"id": string,"period_month": string,"played_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clock_kind": string,"id"?: string,"period_month": string,"played_at"?: string,"user_id": string
                  }
                  Update: {
                    "clock_kind"?: string,"id"?: string,"period_month"?: string,"played_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rounds_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_cards": {
                  Row: {
                    "count": number,"grade": Database["public"]['Enums']["card_grade"],"template_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"grade": Database["public"]['Enums']["card_grade"],"template_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "count"?: number,"grade"?: Database["public"]['Enums']["card_grade"],"template_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_cards_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "card_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_cards_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "collection_view"
      referencedColumns: ["template_id"]
    },{
      foreignKeyName: "user_cards_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "inventory_view"
      referencedColumns: ["template_id"]
    },{
      foreignKeyName: "user_cards_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verifications": {
                  Row: {
                    "created_at": string,"evidence_url": string,"id": string,"influencer_id": string,"rejection_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"type": Database["public"]['Enums']["influencer_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"evidence_url": string,"id"?: string,"influencer_id": string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status": string,"type": Database["public"]['Enums']["influencer_type"]
                  }
                  Update: {
                    "created_at"?: string,"evidence_url"?: string,"id"?: string,"influencer_id"?: string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"type"?: Database["public"]['Enums']["influencer_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "verifications_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifications_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "room_catalog"
      referencedColumns: ["influencer_id"]
    },{
      foreignKeyName: "verifications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "collection_view": {
                  Row: {
                    "common_count": number | null,"epic_count": number | null,"highest_grade": Database["public"]['Enums']["card_grade"] | null,"image_path": string,"influencer_id": string,"influencer_name": string,"influencer_type": Database["public"]['Enums']["influencer_type"],"rare_count": number | null,"special_count": number | null,"style": Database["public"]['Enums']["card_style"],"template_id": string,"total_cards": number | null,"verified_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "card_templates_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_templates_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "room_catalog"
      referencedColumns: ["influencer_id"]
    }
                  ]
                },"inventory_view": {
                  Row: {
                    "count": number,"grade": Database["public"]['Enums']["card_grade"],"image_path": string,"influencer_id": string,"influencer_name": string,"influencer_type": Database["public"]['Enums']["influencer_type"],"style": Database["public"]['Enums']["card_style"],"template_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "card_templates_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_templates_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "room_catalog"
      referencedColumns: ["influencer_id"]
    }
                  ]
                },"room_catalog": {
                  Row: {
                    "can_join": boolean | null,"card_status": string | null,"current_month": string | null,"current_month_round_count": number | null,"earned_cards": number | null,"fallback_image_path": string | null,"has_card_templates": boolean | null,"has_entry_cards": boolean | null,"influencer_id": string,"influencer_name": string,"influencer_type": Database["public"]['Enums']["influencer_type"],"is_active": boolean | null,"join_reason": string | null,"left_month": string | null,"membership": Json | null,"missing_cards": number | null,"profile_image_path": string | null,"required_cards": number | null,"required_rounds_to_rejoin": number | null,"room_id": string,"support_badge": string | null,"verified_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [

                  ]
                }
          }
          Functions: {
            "advance_demo_month":
{ Args: { "p_request_id": string,"p_target_month": string }; Returns: Json
                           },
"approve_verification":
{ Args: { "p_decision": string,"p_reason"?: string,"p_request_id": string,"p_verification_id": string }; Returns: Json
                           },
"begin_influencer_message_submission":
{ Args: { "p_actor_id": string,"p_kind": string,"p_payload_hash": string,"p_request_id": string,"p_room_id": string }; Returns: Json
                           },
"begin_message_submission":
{ Args: { "p_actor_id": string,"p_payload_hash": string,"p_request_id": string,"p_room_id": string }; Returns: Json
                           },
"begin_room_ai_operation":
{ Args: { "p_actor_id": string,"p_operation": string,"p_payload_hash": string,"p_request_id": string,"p_room_id": string }; Returns: Json
                           },
"cleanup_backend_metadata":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"complete_round":
{ Args: { "p_force_grade"?: Database["public"]['Enums']["card_grade"],"p_request_id": string }; Returns: Json
                           },
"delete_influencer_message":
{ Args: { "p_message_id": number,"p_request_id": string,"p_room_id": string }; Returns: Json
                           },
"fail_message_submission":
{ Args: { "p_actor_id": string,"p_error_code": string,"p_lease_token": string,"p_operation"?: string,"p_request_id": string }; Returns: Json
                           },
"fail_room_ai_operation":
{ Args: { "p_actor_id": string,"p_error_code": string,"p_lease_token": string,"p_operation": string,"p_request_id": string,"p_room_id": string }; Returns: Json
                           },
"finish_room_ai_operation":
{ Args: { "p_actor_id": string,"p_lease_token": string,"p_operation": string,"p_payload_hash": string,"p_request_id": string,"p_result": Json,"p_room_id": string,"p_source_message_ids": (number)[] }; Returns: Json
                           },
"get_message_changes":
{ Args: { "p_checkpoint_id": string,"p_checkpoint_updated_at": string,"p_cursor_id"?: string,"p_cursor_updated_at"?: string,"p_limit"?: number,"p_room_id": string,"p_through_id": string,"p_through_updated_at": string }; Returns: Json
                           },
"get_messages":
{ Args: { "p_after_id"?: string,"p_before_id"?: string,"p_limit"?: number,"p_room_id": string }; Returns: Json
                           },
"get_my_answer_links":
{ Args: { "p_answer_ids": (number)[],"p_room_id": string }; Returns: Json
                           },
"get_my_influencer_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_round_gauge_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_room_ai_source":
{ Args: { "p_actor_id": string,"p_operation": string,"p_room_id": string }; Returns: Json
                           },
"get_room_daily_block_count":
{ Args: { "p_room_id": string }; Returns: Json
                           },
"get_room_filters":
{ Args: { "p_room_id": string }; Returns: Json
                           },
"get_room_greeting":
{ Args: { "p_room_id": string }; Returns: Json
                           },
"get_room_inbox":
{ Args: { "p_cursor"?: Json,"p_include_answered"?: boolean,"p_limit"?: number,"p_room_id": string }; Returns: Json
                           },
"get_room_message_checkpoint":
{ Args: { "p_room_id": string }; Returns: Json
                           },
"internal_hash_payload":
{ Args: { "p_payload": Json }; Returns: string
                           },
"join_room":
{ Args: { "p_request_id": string,"p_room_id": string }; Returns: Json
                           },
"request_verification":
{ Args: { "p_evidence_url": string,"p_request_id": string,"p_type": Database["public"]['Enums']["influencer_type"] }; Returns: Json
                           },
"set_influencer_profile_photo":
{ Args: { "p_content_sha256": string,"p_profile_image_path": string,"p_request_id": string }; Returns: Json
                           },
"submit_influencer_message":
{ Args: { "p_actor_id": string,"p_body": string,"p_category"?: string,"p_expected_cluster_id": string,"p_expected_cluster_version": number,"p_kind": string,"p_lease_token": string,"p_payload_hash": string,"p_reply_to": number,"p_request_id": string,"p_room_id": string,"p_verdict": string }; Returns: Json
                           },
"submit_moderated_message":
{ Args: { "p_actor_id": string,"p_body": string,"p_category"?: string,"p_filter_version": number,"p_lease_token": string,"p_passes_all_filters"?: boolean,"p_payload_hash": string,"p_quality"?: number,"p_request_id": string,"p_rewrite"?: string,"p_rewrite_quality"?: number,"p_room_id": string,"p_suggestion_token"?: string,"p_verdict"?: string }; Returns: Json
                           },
"update_game_config":
{ Args: { "p_expected_version": number,"p_key": string,"p_request_id": string,"p_value": Json }; Returns: Json
                           },
"update_room_filters":
{ Args: { "p_disabled_filters": (string)[],"p_expected_version": number,"p_request_id": string,"p_room_id": string }; Returns: Json
                           },
"update_room_greeting":
{ Args: { "p_actor_id": string,"p_body": string,"p_category"?: string,"p_expected_version": number,"p_lease_token": string,"p_payload_hash": string,"p_request_id": string,"p_room_id": string,"p_verdict": string }; Returns: Json
                           },
"upgrade_card":
{ Args: { "p_grade": Database["public"]['Enums']["card_grade"],"p_request_id": string,"p_template_id": string }; Returns: Json
                           }
          }
          Enums: {
            "card_grade": "common"|"rare"|"epic"|"special","card_style": "illust"|"retro"|"holo","influencer_type": "youtuber"|"media_pro"|"tour","user_role": "user"|"influencer"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "card_grade": ["common", "rare", "epic", "special"],"card_style": ["illust", "retro", "holo"],"influencer_type": ["youtuber", "media_pro", "tour"],"user_role": ["user", "influencer", "admin"]
          }
        }
} as const
