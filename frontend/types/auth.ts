export type RoleScope = "system" | "organization" | "project";

export type RoleName =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "ANNOTATOR"
  | "QC"
  | "VALIDATOR"
  | "VIEWER";

export interface RoleInfo {
  id: string;
  name: string;
  scope: RoleScope;
  permissions: string[];
  description?: string;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  website?: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ProjectAccessInfo {
  project_id: string;
  project_name: string;
  project_role?: string;
  status: string;
  joined_at?: string;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  status: string;
  last_seen_at?: string;
  organization: OrganizationInfo;
  role?: RoleInfo;
  teams: TeamInfo[];
  projects: ProjectAccessInfo[];
  effective_permissions: string[];
}

export interface UpdateProfileRequest {
  name?: string;
  avatar_url?: string;
}
