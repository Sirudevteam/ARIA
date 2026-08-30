"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser, useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";
import { api, APIError, setAuthToken } from "@/lib/api";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: isClerkUserLoaded } = useUser();
  const { getToken, signOut: clerkSignOut } = useClerkAuth();
  const clerk = useClerk();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfileResponse>("/api/v1/auth/me");
      setProfile(data);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) {
        setProfile(null);
        setAuthToken(null);
      } else {
        console.warn("Failed to fetch user profile from backend:", err);
      }
    }
  }, []);

  const refreshProfile = async () => {
    await fetchUserProfile();
  };

  useEffect(() => {
    let isMounted = true;

    async function syncClerkSession() {
      try {
        if (!isClerkUserLoaded) return;

        if (clerkUser) {
          const token = await getToken();
          setAuthToken(token);
          if (isMounted) {
            await fetchUserProfile();
          }
        } else {
          setAuthToken(null);
          if (isMounted) {
            setProfile(null);
          }
        }
      } catch (e) {
        console.error("Clerk auth sync error:", e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    syncClerkSession();

    return () => {
      isMounted = false;
    };
  }, [clerkUser, isClerkUserLoaded, getToken, fetchUserProfile]);

  const login = async () => {
    clerk.openSignIn();
  };

  const signup = async () => {
    clerk.openSignUp();
  };

  const logout = async () => {
    setIsLoading(true);
    setAuthToken(null);
    setProfile(null);
    try {
      await clerkSignOut();
    } catch (e) {
      console.warn("Clerk sign out error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const user: AuthUser | null = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || clerkUser.username || "User",
        avatar_url: clerkUser.imageUrl,
      }
    : null;

  const role: RoleName | null = (profile?.role?.name as RoleName) || null;
  const effectivePermissions = profile?.effective_permissions || [];

  const hasRole = useCallback((allowedRoles: RoleName[]): boolean => {
    if (!role) return false;
    if (role === "SUPER_ADMIN") return true;
    return allowedRoles.includes(role);
  }, [role]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (effectivePermissions.includes("*")) return true;
    if (effectivePermissions.includes(permission)) return true;
    const [domain] = permission.split(".");
    return effectivePermissions.includes(`${domain}.*`);
  }, [effectivePermissions]);

  const hasProjectAccess = useCallback((projectId: string): boolean => {
    if (!profile) return false;
    if (profile.role?.name === "SUPER_ADMIN" || profile.role?.name === "ADMIN") return true;
    return profile.projects.some((p) => p.project_id === projectId);
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        effectivePermissions,
        isLoading: !isClerkUserLoaded || isLoading,
        login,
        signup,
        logout,
        hasRole,
        hasPermission,
        hasProjectAccess,
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
