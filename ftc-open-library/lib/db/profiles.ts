import { mapPublicProfile } from "@/lib/db/mappers";
import { getConfiguredServerClient } from "@/lib/db/client";
import { logger } from "@/lib/utils/logger";
import type { PublicUserProfile } from "@/types/users";

const PROFILE_ERROR = "Something went wrong while loading this profile.";

export async function getPublicProfileByUsername(
  username: string,
): Promise<PublicUserProfile | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    logger.error("db.profiles", "Failed to load profile", {
      message: error.message,
      code: error.code,
    });
    throw new Error(PROFILE_ERROR);
  }

  if (!data) {
    return null;
  }

  return mapPublicProfile(data);
}

export async function getProfileById(id: string): Promise<PublicUserProfile | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error("db.profiles", "Failed to load profile by id", {
      message: error.message,
      code: error.code,
    });
    throw new Error(PROFILE_ERROR);
  }

  if (!data) {
    return null;
  }

  return mapPublicProfile(data);
}
