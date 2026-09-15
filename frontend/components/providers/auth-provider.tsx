"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { UserProfileResponse, RoleName } from "@/types/auth";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfileResponse | null;
  role: RoleName | null;
  effectivePermissions: string[];
  isLoading: boolean;
  login: () => Promise<void>;
  signup: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (allowedRoles: RoleName[]) => boolean;
  hasPermission: (permission: string) => boolean;
  hasProjectAccess: (projectId: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultUser: AuthUser = {
  id: "open-source-user",
  email: "admin@aria.local",
  name: "ARIA User",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfileResponse>("/api/v1/auth/me");
      setProfile(data);
    } catch (err) {
      console.warn("Failed to fetch user profile from backend:", err);
    }
  }, []);

  const refreshProfile = async () => {
    await fetchUserProfile();
  };

  useEffect(() => {
    fetchUserProfile().finally(() => setIsLoading(false));
  }, [fetchUserProfile]);

  const role: RoleName | null = (profile?.role?.name as RoleName) || "SUPER_ADMIN";
  const effectivePermissions = profile?.effective_permissions || ["*"];

  return (
    <AuthContext.Provider
      value={{
        user: defaultUser,
        profile,
        role,
        effectivePermissions,
        isLoading,
        login: async () => {},
        signup: async () => {},
        logout: async () => {},
        hasRole: () => true,
        hasPermission: () => true,
        hasProjectAccess: () => true,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
