"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleName } from "@/types/auth";

interface RoleGuardProps {
  allowedRoles: RoleName[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children if the current user holds one of the specified roles.
 * SUPER_ADMIN is always granted access.
 */
export function RoleGuard({ allowedRoles, fallback = null, children }: RoleGuardProps) {
  const { hasRole } = useAuth();

  if (!hasRole(allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
