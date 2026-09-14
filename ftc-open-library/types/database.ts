/**
 * Hand-written Supabase schema types for Phase 1.
 *
 * Row shapes match `supabase/migrations/`. Constraints and RLS live in SQL
 * only (including `20260902100007_phase1_hardening.sql`).
 *
 * Regenerate from a running project when the CLI is available:
 *
 * npx supabase gen types typescript --local > types/database.ts
 *
 * or, for a hosted project:
 *
 * npx supabase gen types typescript --project-id <project-ref> > types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ResourceStatusValue =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "CHANGES_REQUESTED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";

type ReviewDecisionValue = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";

type ResourceTypeValue = "CAD" | "CODE" | "TUTORIAL" | "MODEL";

type UploadIntentStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          team_number: string;
          name: string;
          country: string | null;
          description: string | null;
          logo_url: string | null;
          website_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_number: string;
          name: string;
          country?: string | null;
          description?: string | null;
          logo_url?: string | null;
          website_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_number?: string;
          name?: string;
          country?: string | null;
          description?: string | null;
          logo_url?: string | null;
          website_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          team_id: string;
          user_id: string;
          role: "OWNER" | "ADMIN" | "MEMBER";
          created_at: string;
        };
        Insert: {
          team_id: string;
          user_id: string;
          role: "OWNER" | "ADMIN" | "MEMBER";
          created_at?: string;
        };
        Update: {
          team_id?: string;
          user_id?: string;
          role?: "OWNER" | "ADMIN" | "MEMBER";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          id: string;
          label: string;
          start_year: number | null;
          end_year: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          start_year?: number | null;
          end_year?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          start_year?: number | null;
          end_year?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          resource_type: "CAD" | "CODE" | "TUTORIAL" | "MODEL";
          parent_id: string | null;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          resource_type: "CAD" | "CODE" | "TUTORIAL" | "MODEL";
          parent_id?: string | null;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          resource_type?: "CAD" | "CODE" | "TUTORIAL" | "MODEL";
          parent_id?: string | null;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      hardware: {
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      licenses: {
        Row: {
          id: string;
          name: string;
          spdx_id: string | null;
          url: string | null;
          description: string | null;
          is_custom: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          spdx_id?: string | null;
          url?: string | null;
          description?: string | null;
          is_custom?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          spdx_id?: string | null;
          url?: string | null;
          description?: string | null;
          is_custom?: boolean;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          title: string;
          slug: string;
          resource_type: "CAD" | "CODE" | "TUTORIAL" | "MODEL";
          description: string;
          author_id: string | null;
          team_id: string | null;
          category_id: string | null;
          season_id: string | null;
          license_id: string | null;
          thumbnail_url: string | null;
          preview_url: string | null;
          parent_resource_id: string | null;
          status: ResourceStatusValue;
          visibility: "PUBLIC" | "UNLISTED";
          created_at: string;
          updated_at: string;
          published_at: string | null;
          submitted_at: string | null;
          reviewed_at: string | null;
          rights_acknowledged_at: string | null;
          search_vector: unknown;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          resource_type: "CAD" | "CODE" | "TUTORIAL" | "MODEL";
          description: string;
          author_id?: string | null;
          team_id?: string | null;
          category_id?: string | null;
          season_id?: string | null;
          license_id?: string | null;
          thumbnail_url?: string | null;
          preview_url?: string | null;
          parent_resource_id?: string | null;
          status?: ResourceStatusValue;
          visibility?: "PUBLIC" | "UNLISTED";
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          rights_acknowledged_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          resource_type?: "CAD" | "CODE" | "TUTORIAL" | "MODEL";
          description?: string;
          author_id?: string | null;
          team_id?: string | null;
          category_id?: string | null;
          season_id?: string | null;
          license_id?: string | null;
          thumbnail_url?: string | null;
          preview_url?: string | null;
          parent_resource_id?: string | null;
          status?: ResourceStatusValue;
          visibility?: "PUBLIC" | "UNLISTED";
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          rights_acknowledged_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "resources_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_license_id_fkey";
            columns: ["license_id"];
            isOneToOne: false;
            referencedRelation: "licenses";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_versions: {
        Row: {
          id: string;
          resource_id: string;
          version_number: number;
          version_label: string | null;
          changelog: string | null;
          status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
          released_at: string | null;
          submitted_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          version_number: number;
          version_label?: string | null;
          changelog?: string | null;
          status?: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
          released_at?: string | null;
          submitted_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          version_number?: number;
          version_label?: string | null;
          changelog?: string | null;
          status?: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
          released_at?: string | null;
          submitted_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_versions_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_files: {
        Row: {
          id: string;
          resource_id: string;
          version_id: string;
          filename: string;
          file_type: "CAD" | "SOURCE" | "DOCUMENT" | "VIDEO_LINK" | "VIDEO" | "IMAGE" | "OTHER" | null;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          storage_bucket: "resource-files" | "tutorial-videos";
          is_previewable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          version_id: string;
          filename: string;
          file_type?: "CAD" | "SOURCE" | "DOCUMENT" | "VIDEO_LINK" | "VIDEO" | "IMAGE" | "OTHER" | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          storage_bucket?: "resource-files" | "tutorial-videos";
          is_previewable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          version_id?: string;
          filename?: string;
          file_type?: "CAD" | "SOURCE" | "DOCUMENT" | "VIDEO_LINK" | "VIDEO" | "IMAGE" | "OTHER" | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          storage_bucket?: "resource-files" | "tutorial-videos";
          is_previewable?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_files_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_files_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "resource_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_reviews: {
        Row: {
          id: string;
          resource_id: string;
          version_id: string | null;
          reviewer_id: string | null;
          decision: ReviewDecisionValue;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          version_id?: string | null;
          reviewer_id?: string | null;
          decision: ReviewDecisionValue;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          version_id?: string | null;
          reviewer_id?: string | null;
          decision?: ReviewDecisionValue;
          message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_reviews_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_reviews_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "resource_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_upload_intents: {
        Row: {
          id: string;
          user_id: string;
          resource_id: string;
          version_id: string;
          storage_bucket: "resource-files" | "tutorial-videos";
          storage_path: string;
          original_filename: string;
          expected_size_bytes: number;
          status: UploadIntentStatus;
          expires_at: string;
          created_at: string;
          completed_at: string | null;
        };
        // Rows are written only by the SECURITY DEFINER upload functions; there
        // is no client-facing INSERT/UPDATE grant.
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "resource_upload_intents_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      upload_blocked_extension: {
        Row: { extension: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      upload_allowed_extension: {
        Row: { resource_type: ResourceTypeValue; extension: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      resource_tags: {
        Row: {
          resource_id: string;
          tag_id: string;
        };
        Insert: {
          resource_id: string;
          tag_id: string;
        };
        Update: {
          resource_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_tags_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_hardware: {
        Row: {
          resource_id: string;
          hardware_id: string;
        };
        Insert: {
          resource_id: string;
          hardware_id: string;
        };
        Update: {
          resource_id?: string;
          hardware_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_hardware_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_hardware_hardware_id_fkey";
            columns: ["hardware_id"];
            isOneToOne: false;
            referencedRelation: "hardware";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_relations: {
        Row: {
          source_resource_id: string;
          target_resource_id: string;
          relation_type: "RELATED" | "USES" | "BASED_ON";
          created_at: string;
        };
        Insert: {
          source_resource_id: string;
          target_resource_id: string;
          relation_type: "RELATED" | "USES" | "BASED_ON";
          created_at?: string;
        };
        Update: {
          source_resource_id?: string;
          target_resource_id?: string;
          relation_type?: "RELATED" | "USES" | "BASED_ON";
          created_at?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          user_id: string;
          resource_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          resource_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          resource_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          user_id: string;
          resource_id: string;
          rating: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          resource_id: string;
          rating: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          resource_id?: string;
          rating?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          resource_id: string;
          user_id: string;
          parent_id: string | null;
          body: string;
          status: "VISIBLE" | "HIDDEN" | "DELETED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          user_id: string;
          parent_id?: string | null;
          body: string;
          status?: "VISIBLE" | "HIDDEN" | "DELETED";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          user_id?: string;
          parent_id?: string | null;
          body?: string;
          status?: "VISIBLE" | "HIDDEN" | "DELETED";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      downloads: {
        Row: {
          id: string;
          resource_id: string;
          file_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          file_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          file_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      resource_stats: {
        Row: {
          resource_id: string | null;
          rating_average: number | null;
          rating_count: number | null;
          favorite_count: number | null;
          download_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_team_admin: { Args: { p_team_id: string }; Returns: boolean };
      is_team_member: { Args: { p_team_id: string }; Returns: boolean };
      is_team_owner: { Args: { p_team_id: string }; Returns: boolean };
      is_verified_user: { Args: Record<string, never>; Returns: boolean };
      is_site_admin: { Args: Record<string, never>; Returns: boolean };
      resource_is_draft: { Args: { p_resource_id: string }; Returns: boolean };
      can_edit_resource: { Args: { p_resource_id: string }; Returns: boolean };
      resource_is_published_public: {
        Args: { p_resource_id: string };
        Returns: boolean;
      };
      can_manage_resource: { Args: { p_resource_id: string }; Returns: boolean };
      category_resource_count: { Args: { p_category_id: string }; Returns: number };
      resource_is_editable: { Args: { p_resource_id: string }; Returns: boolean };
      has_open_upload_intent: { Args: { p_bucket: string; p_object_name: string }; Returns: boolean };
      upload_limit: { Args: { p_key: string }; Returns: number };
      create_upload_intent: {
        Args: {
          p_resource_id: string;
          p_filename: string;
          p_size_bytes: number;
          p_mime_type?: string | null;
        };
        Returns: { storagePath: string; expiresAt: string; bucket: string };
      };
      complete_upload_intent: {
        Args: { p_storage_path: string; p_file_type?: string | null; p_mime_type?: string | null };
        Returns: { fileId: string; alreadyRegistered: boolean };
      };
      cancel_upload_intent: {
        Args: { p_storage_path: string };
        Returns: { cancelled: boolean; bucket: string; storagePath: string };
      };
      expire_stale_upload_intents: { Args: Record<string, never>; Returns: undefined };
      touch_upload_intent: { Args: { p_storage_path: string }; Returns: string };
      orphan_upload_objects: {
        Args: { p_limit?: number };
        Returns: {
          storage_bucket: string;
          storage_path: string;
          size_bytes: number | null;
          created_at: string;
        }[];
      };
      upload_hygiene_summary: {
        Args: Record<string, never>;
        Returns: {
          orphanCandidates: number;
          openIntents: number;
          abandonedIntents: number;
          leftoverObjects: number;
        } | null;
      };
      resource_submission_error: {
        Args: {
          p_resource_id: string;
          p_title: string;
          p_description: string;
          p_resource_type: string;
          p_category_id: string | null;
          p_license_id: string | null;
          p_rights_acknowledged_at: string | null;
        };
        Returns: string | null;
      };
      submit_resource_for_review: {
        Args: { p_resource_id: string; p_rights_acknowledged: boolean };
        Returns: undefined;
      };
      withdraw_resource_submission: { Args: { p_resource_id: string }; Returns: undefined };
      review_resource: {
        Args: { p_resource_id: string; p_decision: string; p_message: string | null };
        Returns: undefined;
      };
      start_resource_revision: {
        Args: { p_resource_id: string; p_version_label: string | null; p_changelog: string | null };
        Returns: string;
      };
      submit_resource_revision: { Args: { p_version_id: string }; Returns: undefined };
      withdraw_resource_revision: { Args: { p_version_id: string }; Returns: undefined };
      review_resource_revision: {
        Args: { p_version_id: string; p_decision: string; p_message: string | null };
        Returns: undefined;
      };
      can_edit_version: { Args: { p_version_id: string }; Returns: boolean };
      can_upload_to_resource: { Args: { p_resource_id: string }; Returns: boolean };
      can_write_storage_object: { Args: { object_name: string }; Returns: boolean };
      upload_target_version_id: { Args: { p_resource_id: string }; Returns: string | null };
      version_is_published_public: { Args: { p_version_id: string }; Returns: boolean };
      set_resource_archived: {
        Args: { p_resource_id: string; p_archived: boolean };
        Returns: undefined;
      };
      list_own_published_favorites: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: { resource_id: string; created_at: string }[];
      };
      count_own_published_favorites: { Args: Record<string, never>; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PublicTableName = keyof Database["public"]["Tables"];

export type TableRow<T extends PublicTableName> = Database["public"]["Tables"][T]["Row"];

export type TableInsert<T extends PublicTableName> = Database["public"]["Tables"][T]["Insert"];

export type ResourceRow = TableRow<"resources">;
export type ProfileRow = TableRow<"profiles">;
export type TeamRow = TableRow<"teams">;
export type ResourceStatsRow = Database["public"]["Views"]["resource_stats"]["Row"];
