import { asRelationList, getConfiguredServerClient } from "@/lib/db/client";
import { mapTeamSummary } from "@/lib/db/mappers";
import { listPublishedResources, type PublishedResourceList } from "@/lib/db/resources";
import { logger } from "@/lib/utils/logger";
import type { TeamDetail, TeamSummary } from "@/types/teams";

const TEAM_ERROR = "Something went wrong while loading teams.";

/** Teams the signed-in user may attribute a resource to (OWNER or ADMIN). */
export async function listManageableTeams(
  userId: string,
): Promise<{ id: string; name: string; teamNumber: string }[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("team_members")
    .select("teams ( id, name, team_number )")
    .eq("user_id", userId)
    .in("role", ["OWNER", "ADMIN"]);

  if (error) {
    logger.warn("db.teams", "Failed to list manageable teams", { message: error.message });
    return [];
  }

  return (data ?? [])
    .flatMap((row) => asRelationList(row.teams))
    .map((team) => ({ id: team.id, name: team.name, teamNumber: team.team_number }))
    .sort((a, b) => a.teamNumber.localeCompare(b.teamNumber, "en", { numeric: true }));
}

export async function listPublicTeams(limit?: number): Promise<TeamSummary[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  let request = supabase
    .from("teams")
    .select("id, team_number, name, country, description, logo_url")
    .order("team_number", { ascending: true });

  if (limit) {
    request = request.limit(limit);
  }

  const { data, error } = await request;

  if (error) {
    logger.error("db.teams", "Failed to list teams", {
      message: error.message,
      code: error.code,
    });
    throw new Error(TEAM_ERROR);
  }

  const teams = data ?? [];
  const counts = await loadPublishedResourceCounts(teams.map((team) => team.id));

  return teams.map((row) => mapTeamSummary(row, { resourceCount: counts.get(row.id) ?? 0 }));
}

export async function getTeamBySlug(slug: string): Promise<TeamDetail | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("teams")
    .select("id, team_number, name, country, description, logo_url, website_url")
    .eq("team_number", slug)
    .maybeSingle();

  if (error) {
    logger.error("db.teams", "Failed to load team", {
      message: error.message,
      code: error.code,
    });
    throw new Error(TEAM_ERROR);
  }

  if (!data) {
    return null;
  }

  const counts = await loadPublishedResourceCounts([data.id]);
  const summary = mapTeamSummary(data, { resourceCount: counts.get(data.id) ?? 0 });

  return {
    ...summary,
    websiteUrl: data.website_url,
  };
}

export async function listTeamResources(
  teamId: string,
  page = 1,
): Promise<PublishedResourceList> {
  return listPublishedResources({
    teamId,
    sort: "latest",
    page,
  });
}

async function loadPublishedResourceCounts(teamIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (teamIds.length === 0) {
    return counts;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return counts;
  }

  const { data, error } = await supabase
    .from("resources")
    .select("team_id")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .in("team_id", teamIds);

  if (error) {
    logger.error("db.teams", "Failed to count team resources", {
      message: error.message,
      code: error.code,
    });
    throw new Error(TEAM_ERROR);
  }

  for (const row of asRelationList(data)) {
    if (!row.team_id) {
      continue;
    }
    counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
  }

  return counts;
}
