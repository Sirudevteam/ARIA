"use client";

import React from "react";

interface RoleGuardProps {
  allowedRoles: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ children }: RoleGuardProps) {
  return <>{children}</>;
}
