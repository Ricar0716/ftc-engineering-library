export type TeamSummary = {
  id: string;
  slug: string;
  teamNumber: string;
  name: string;
  country?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  resourceCount?: number | null;
  memberCount?: number | null;
};

export type TeamDetail = TeamSummary & {
  websiteUrl: string | null;
};
