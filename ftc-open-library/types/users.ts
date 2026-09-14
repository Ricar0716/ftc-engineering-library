export type PublicUserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  joinedAt?: string | null;
};

export type TeamMemberRole = "OWNER" | "ADMIN" | "MEMBER";
