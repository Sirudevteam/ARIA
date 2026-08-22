"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { api, APIError } from "@/lib/api";
import { UserProfileResponse, RoleName } from "@/types/auth";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfileResponse | null;
  role: RoleName | null;
  effectivePermissions: string[];
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ error: string | null }>;
  signup: (email: string, password?: string, name?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  hasRole: (allowedRoles: RoleName[]) => boolean;
  hasPermission: (permission: string) => boolean;
  hasProjectAccess: (projectId: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

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

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          setSession(session);
          setUser(session.user);
          await fetchUserProfile();
        }
      } catch (e) {
        console.error("Auth initialization error:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession) {
          await fetchUserProfile();
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  const login = async (email: string, password?: string): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true);
      if (password) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return { error: error.message };
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/chat` },
        });
        if (error) return { error: error.message };
      }
      await fetchUserProfile();
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Failed to sign in" };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password?: string,
    name?: string
  ): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password: password || "tempPassword123!",
        options: {
          data: { name: name || email.split("@")[0] },
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Failed to create account" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsLoading(false);
  };

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
    // Check wildcard scope like "project.*"
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
        session,
        profile,
        role,
        effectivePermissions,
        isLoading,
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
