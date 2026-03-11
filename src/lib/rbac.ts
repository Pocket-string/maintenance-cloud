import type { UserRole } from '@/types/database'

/**
 * Role hierarchy: owner > admin > ops > tech
 * Higher roles have all permissions of lower roles.
 */
const ROLE_LEVEL: Record<UserRole, number> = {
  tech: 0,
  ops: 1,
  admin: 2,
  owner: 3,
}

/** Check if the user's role has at least the minimum required level */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole]
}

/** Permission checks for specific actions */
export const can = {
  /** View sites catalog */
  viewSites: (role: UserRole) => hasMinRole(role, 'ops'),
  /** Create/edit sites */
  manageSites: (role: UserRole) => hasMinRole(role, 'admin'),
  /** View assets */
  viewAssets: (role: UserRole) => hasMinRole(role, 'ops'),
  /** Create/edit assets */
  manageAssets: (role: UserRole) => hasMinRole(role, 'admin'),
  /** Create maintenance records */
  createRecords: (role: UserRole) => hasMinRole(role, 'tech'),
  /** Change record status (approve, review, close) */
  reviewRecords: (role: UserRole) => hasMinRole(role, 'ops'),
  /** Manage users */
  manageUsers: (role: UserRole) => hasMinRole(role, 'admin'),
  /** View dashboard */
  viewDashboard: (role: UserRole) => hasMinRole(role, 'tech'),
  /** Export data */
  exportData: (role: UserRole) => hasMinRole(role, 'ops'),
} as const
