import type { NavigationItem, NavigationCategory } from './NavigationConfig';

/**
 * Checks if a user has sufficient permissions for a navigation item.
 * An Admin has full access to all navigation items.
 * Non-admins require all permissions in `requiredPermissions` OR any permission in `requiredAnyPermissions`.
 */
export function canAccessItem(
  item: NavigationItem,
  userPermissions: string[] = [],
  userRole = 'Admin',
): boolean {
  if (userRole === 'Admin') return true;

  const permissionsSet = new Set(userPermissions.map((p) => p.toLowerCase()));

  // Check required permissions (all must match if specified)
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    const hasAll = item.requiredPermissions.every((p) =>
      permissionsSet.has(p.toLowerCase()),
    );
    if (!hasAll) return false;
  }

  // Check requiredAnyPermissions (at least one must match if specified)
  if (item.requiredAnyPermissions && item.requiredAnyPermissions.length > 0) {
    const hasAny = item.requiredAnyPermissions.some((p) =>
      permissionsSet.has(p.toLowerCase()),
    );
    if (!hasAny) return false;
  }

  return true;
}

/**
 * Filter list of navigation items based on user role and permissions.
 */
export function filterNavItems(
  items: NavigationItem[],
  userPermissions: string[] = [],
  userRole = 'Admin',
): NavigationItem[] {
  return items.filter((item) => canAccessItem(item, userPermissions, userRole));
}

/**
 * Group filtered navigation items by category preserving defined category order.
 */
export function groupNavItemsByCategory(
  items: NavigationItem[],
): Record<NavigationCategory, NavigationItem[]> {
  const grouped: Record<NavigationCategory, NavigationItem[]> = {
    'Clinical Operations': [],
    'Diagnostics & Pharmacy': [],
    'Inpatient & Billing': [],
    'Hospital Administration': [],
  };

  for (const item of items) {
    if (grouped[item.category]) {
      grouped[item.category].push(item);
    }
  }

  return grouped;
}

/**
 * Resolves the primary workspace route for each hospital persona.
 */
export function getDefaultRouteForRole(role: string): string {
  switch (role) {
    case 'Doctor':
      return '/consultations';
    case 'Pharmacist':
      return '/pharmacy';
    case 'Laboratorist':
      return '/laboratory';
    case 'Accountant':
      return '/billing';
    case 'Receptionist':
      return '/appointments';
    case 'Nurse':
      return '/inpatient';
    case 'Admin':
    default:
      return '/dashboard';
  }
}
