import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentAccess } from "@/lib/auth/session";
import { asSingleRelation, getConfiguredServerClient } from "@/lib/db/client";
import { DISCUSSION_PAGE_SIZE } from "@/lib/discussion/validation";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

export type DiscussionStatus = "VISIBLE" | "HIDDEN" | "DELETED";

export type DiscussionAuthor = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type DiscussionPost = {
  id: string;
  resourceId: string;
  parentId: string | null;
  body: string;
  status: DiscussionStatus;
  createdAt: string;
  updatedAt: string;
  author: DiscussionAuthor;
};

export type DiscussionThread = DiscussionPost & {
  replies: DiscussionPost[];
};

export type DiscussionList = {
  items: DiscussionThread[];
  total: number;
  page: number;
  pageSize: number;
  teamOwnerId: string | null;
};

type CommentRow = {
  id: string;
  resource_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  status: DiscussionStatus;
  created_at: string;
  updated_at: string;
  author:
    | {
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      }
    | {
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      }[]
    | null;
};

const COMMENT_SELECT = `
  id,
  resource_id,
  user_id,
  parent_id,
  body,
  status,
  created_at,
  updated_at,
  author:profiles!user_id ( username, display_name, avatar_url )
`;

function emptyList(page: number, pageSize: number): DiscussionList {
  return { items: [], total: 0, page, pageSize, teamOwnerId: null };
}

function mapPost(row: CommentRow): DiscussionPost {
  const profile = asSingleRelation(row.author);
  const displayName = profile?.display_name?.trim() || profile?.username || "Unknown";

  return {
    id: row.id,
    resourceId: row.resource_id,
    parentId: row.parent_id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.user_id,
      username: profile?.username ?? null,
      displayName,
      avatarUrl: profile?.avatar_url ?? null,
    },
  };
}

async function publishedPublicResource(
  supabase: NonNullable<Awaited<ReturnType<typeof getConfiguredServerClient>>>,
  resourceId: string,
): Promise<{ slug: string; teamId: string | null } | null> {
  const { data, error } = await supabase
    .from("resources")
    .select("slug, status, visibility, team_id")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) {
    logger.warn("discussion.query", "Failed to load resource for discussion", {
      message: error.message,
    });
    return null;
  }
  if (!data || data.status !== "PUBLISHED" || data.visibility !== "PUBLIC") {
    return null;
  }
  return { slug: data.slug, teamId: data.team_id };
}

async function loadTeamOwnerId(
  supabase: NonNullable<Awaited<ReturnType<typeof getConfiguredServerClient>>>,
  teamId: string | null,
): Promise<string | null> {
  if (!teamId) {
    return null;
  }

  const { data, error } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "OWNER")
    .maybeSingle();

  if (error) {
    logger.warn("discussion.query", "Failed to load team owner", { message: error.message });
    return null;
  }

  return data?.user_id ?? null;
}

export async function listResourceDiscussions(
  resourceId: string,
  page = 1,
): Promise<DiscussionList> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const pageSize = DISCUSSION_PAGE_SIZE;

  if (!isUuid(resourceId)) {
    return emptyList(safePage, pageSize);
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyList(safePage, pageSize);
  }

  const resource = await publishedPublicResource(supabase, resourceId);
  if (!resource) {
    return emptyList(safePage, pageSize);
  }

  const access = await getCurrentAccess();
  const isAdmin = canAccessAdmin(access);
  const offset = (safePage - 1) * pageSize;

  let rootsQuery = supabase
    .from("comments")
    .select(COMMENT_SELECT, { count: "exact" })
    .eq("resource_id", resourceId)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (!isAdmin) {
    rootsQuery = rootsQuery.or(
      access.userId ? `status.eq.VISIBLE,user_id.eq.${access.userId}` : "status.eq.VISIBLE",
    );
  }

  const roots = await rootsQuery;
  if (roots.error) {
    logger.error("discussion.query", "Failed to list discussion threads", {
      message: roots.error.message,
    });
    throw new Error("Something went wrong while loading discussion.");
  }

  const rootRows = (roots.data ?? []) as CommentRow[];
  const rootIds = rootRows.map((row) => row.id);
  const teamOwnerId = await loadTeamOwnerId(supabase, resource.teamId);

  if (rootIds.length === 0) {
    return {
      items: [],
      total: roots.count ?? 0,
      page: safePage,
      pageSize,
      teamOwnerId,
    };
  }

  let repliesQuery = supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("resource_id", resourceId)
    .in("parent_id", rootIds)
    .order("created_at", { ascending: true });

  if (!isAdmin) {
    repliesQuery = repliesQuery.or(
      access.userId ? `status.eq.VISIBLE,user_id.eq.${access.userId}` : "status.eq.VISIBLE",
    );
  }

  const replies = await repliesQuery;
  if (replies.error) {
    logger.error("discussion.query", "Failed to list discussion replies", {
      message: replies.error.message,
    });
    throw new Error("Something went wrong while loading discussion.");
  }

  const repliesByParent = new Map<string, DiscussionPost[]>();
  for (const row of (replies.data ?? []) as CommentRow[]) {
    const post = mapPost(row);
    const parentId = post.parentId;
    if (!parentId) {
      continue;
    }
    const list = repliesByParent.get(parentId) ?? [];
    list.push(post);
    repliesByParent.set(parentId, list);
  }

  return {
    items: rootRows.map((row) => {
      const post = mapPost(row);
      return { ...post, replies: repliesByParent.get(post.id) ?? [] };
    }),
    total: roots.count ?? 0,
    page: safePage,
    pageSize,
    teamOwnerId,
  };
}
