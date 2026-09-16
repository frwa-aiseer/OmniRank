export type AppView =
  | "home"
  | "opportunities"
  | "content"
  | "calendar"
  | "growth"
  | "brand-brain"
  | "settings";

export type OrgRole = "owner" | "admin" | "member";
export type BrandRole = "strategist" | "writer" | "reviewer" | "viewer";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  primaryDomain: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  orgRole: OrgRole;
  brandRole: BrandRole;
}
