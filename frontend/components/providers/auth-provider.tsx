"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser, useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";
import { api, APIError, setAuthToken } from "@/lib/api";
import { UserProfileResponse, RoleName } from "@/types/auth";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfileResponse | null;
  role: RoleName | null;
  effectivePermissions: string[];
  isLoading: boolean;
  login: (email?: string, password?: string) => Promise<{ error: string | null }>;
  signup: (email?: string, password?: string, name?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  switchDemoRole: (role: RoleName, email?: string) => Promise<void>;
  hasRole: (allowedRoles: RoleName[]) => boolean;
  hasPermission: (permission: string) => boolean;
  hasProjectAccess: (projectId: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── 1. Local Auth Implementation (when Clerk keys not set or demo mode) ────
function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [demoUser, setDemoUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfileResponse>("/api/v1/auth/me");
      setProfile(data);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) {
        setProfile(null);
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

    async function initLocalAuth() {
      try {
        const localToken = typeof window !== "undefined" ? localStorage.getItem("aria_auth_token") : null;
        if (localToken) {
          setAuthToken(localToken);
          await fetchUserProfile();
        } else {
          // Default seeded user: deenadeena3726 for instant access
          const defaultToken = btoa(JSON.stringify({
            sub: "a4960c51-8cb2-4972-a3b8-2e3474539dbc",
            email: "deenadeena3726@gmail.com",
            role: "SUPER_ADMIN",
            alg: "HS256"
          }));
          setAuthToken(defaultToken);
          setDemoUser({
            id: "a4960c51-8cb2-4972-a3b8-2e3474539dbc",
            email: "deenadeena3726@gmail.com",
            name: "deenadeena3726",
          });
          await fetchUserProfile();
        }
      } catch (e) {
        console.error("Local auth init error:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initLocalAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchUserProfile]);

  const login = async (): Promise<{ error: string | null }> => {
    return { error: null };
  };

  const signup = async (): Promise<{ error: string | null }> => {
    return { error: null };
  };

  const switchDemoRole = async (roleName: RoleName, email?: string) => {
    try {
      setIsLoading(true);
      const demoEmail = email || `${roleName.toLowerCase()}@autocruise.ai`;
      const mockToken = btoa(JSON.stringify({
        sub: `demo_${roleName.toLowerCase()}`,
        email: demoEmail,
        role: roleName,
        alg: "HS256"
      }));
      setAuthToken(mockToken);
      setDemoUser({
        id: `demo_${roleName.toLowerCase()}`,
        email: demoEmail,
        name: `${roleName} User`,
      });
      await fetchUserProfile();
    } catch (e) {
      console.error("Demo role switch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setAuthToken(null);
    setDemoUser(null);
    setProfile(null);
    setIsLoading(false);
  };

  const user = demoUser;
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
        isLoading,
        login,
        signup,
        logout,
        switchDemoRole,
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

// ── 2. Clerk Auth Implementation (when real Clerk keys are provided) ───────
function ClerkAuthProviderInner({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: isClerkUserLoaded } = useUser();
  const { getToken, signOut: clerkSignOut } = useClerkAuth();
  const clerk = useClerk();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [demoUser, setDemoUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfileResponse>("/api/v1/auth/me");
      setProfile(data);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) {
        setProfile(null);
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

    async function syncClerkAuth() {
      try {
        if (!isClerkUserLoaded) return;

        if (clerkUser) {
          const token = await getToken();
          setAuthToken(token);
          if (isMounted) {
            setDemoUser(null);
            await fetchUserProfile();
          }
        } else {
          const localToken = typeof window !== "undefined" ? localStorage.getItem("aria_auth_token") : null;
          if (localToken) {
            setAuthToken(localToken);
            await fetchUserProfile();
          } else {
            setAuthToken(null);
            setProfile(null);
          }
        }
      } catch (e) {
        console.error("Clerk auth sync error:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    syncClerkAuth();

    return () => {
      isMounted = false;
    };
  }, [clerkUser, isClerkUserLoaded, getToken, fetchUserProfile]);

  const login = async (): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true);
      clerk.openSignIn();
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Failed to open sign in" };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true);
      clerk.openSignUp();
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Failed to open sign up" };
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoRole = async (roleName: RoleName, email?: string) => {
    try {
      setIsLoading(true);
      const demoEmail = email || `${roleName.toLowerCase()}@autocruise.ai`;
      const mockToken = btoa(JSON.stringify({
        sub: `demo_${roleName.toLowerCase()}`,
        email: demoEmail,
        role: roleName,
        alg: "HS256"
      }));
      setAuthToken(mockToken);
      setDemoUser({
        id: `demo_${roleName.toLowerCase()}`,
        email: demoEmail,
        name: `${roleName} User`,
      });
      await fetchUserProfile();
    } catch (e) {
      console.error("Demo role switch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setAuthToken(null);
    setDemoUser(null);
    setProfile(null);
    try {
      if (clerkUser) {
        await clerkSignOut();
      }
    } catch (e) {
      console.warn("Sign out warning:", e);
    }
    setIsLoading(false);
  };

  const user: AuthUser | null = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "Clerk User",
        avatar_url: clerkUser.imageUrl,
      }
    : demoUser;

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
        isLoading: isLoading || !isClerkUserLoaded,
        login,
        signup,
        logout,
        switchDemoRole,
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

// ── 3. Main Exported AuthProvider Component ────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasValidClerkKey = Boolean(publishableKey && !publishableKey.includes("mock"));

  if (hasValidClerkKey) {
    return <ClerkAuthProviderInner>{children}</ClerkAuthProviderInner>;
  }

  return <LocalAuthProvider>{children}</LocalAuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
