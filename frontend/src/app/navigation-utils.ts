import {
  type NavigationItem,
  type NavigationCategory,
  type RoleNavigationItem,
  type RoleNavigationSection,
  type RoleQuickAction,
  type RoleDepartmentMeta,
  ROLE_NAVIGATION_CONFIG,
  ROLE_QUICK_ACTIONS,
  ROLE_DEPARTMENT_META,
} from './NavigationConfig';

/**
 * Checks if a user has sufficient permissions for a navigation item.
 * Super Admin has full global access to all navigation items.
 * All other roles require all permissions in `requiredPermissions` OR any permission in `requiredAnyPermissions`.
 */
export function canAccessItem(
  item: NavigationItem | RoleNavigationItem,
  userPermissions: string[] = [],
  userRole = '',
): boolean {
  if (userRole === 'Super Admin') return true;

  // Unconfigured or empty roles have no access to protected navigation items
  if (!userRole || userRole === 'Unconfigured') return false;

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
  userRole = '',
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
 * Resolves the role-specific navigation sections and items tailored to the user's role.
 * Filters out items for which the user lacks backend-issued permissions.
 */
export function getRoleNavigation(
  userRole: string,
  userPermissions: string[] = [],
): RoleNavigationSection[] {
  const sections = ROLE_NAVIGATION_CONFIG[userRole] || ROLE_NAVIGATION_CONFIG['Hospital Admin'] || [];

  return sections
    .map((section) => ({
      title: section.title,
      items: section.items.filter((item) => canAccessItem(item, userPermissions, userRole)),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Resolves role-specific Quick Actions ("+ Add New" dropdown menu).
 */
export function getRoleQuickActions(
  userRole: string,
  userPermissions: string[] = [],
): RoleQuickAction[] {
  const actions = ROLE_QUICK_ACTIONS[userRole] || ROLE_QUICK_ACTIONS['Hospital Admin'] || [];
  if (userRole === 'Super Admin') return actions;

  const permsSet = new Set(userPermissions.map((p) => p.toLowerCase()));
  return actions.filter((action) => {
    if (!action.requiredPermission) return true;
    return permsSet.has(action.requiredPermission.toLowerCase());
  });
}

/**
 * Retrieves department title badge and subtitle description for the active persona.
 */
export function getRoleDepartmentMeta(userRole: string): RoleDepartmentMeta {
  return (
    ROLE_DEPARTMENT_META[userRole] || {
      badge: 'HEALTHCARE CORE',
      subtext: 'Hospital Clinical System',
    }
  );
}

/**
 * Resolves the primary landing route for each hospital persona.
 * In Medora 2.0, all authenticated personas land on `/dashboard`,
 * which renders their dedicated, role-specific operational dashboard.
 */
export function getDefaultRouteForRole(role?: string): string {
  if (!role || role === 'Unconfigured') {
    return '/dashboard';
  }
  return '/dashboard';
}
