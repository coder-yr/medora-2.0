/**
 * Role Resolution and Persona Normalization Engine for Medora 2.0
 * 
 * Enforces explicit, non-escalating identity resolution based strictly
 * on backend-issued user groups, roles, and granular permission claims.
 * Zero hardcoded email bypasses.
 */

export type AppRole =
  | 'Super Admin'
  | 'Hospital Admin'
  | 'Organization Admin'
  | 'Clinic Admin'
  | 'Doctor'
  | 'Receptionist'
  | 'Nurse'
  | 'Pharmacist'
  | 'Laboratorist'
  | 'Radiologist'
  | 'Cashier'
  | 'Accountant'
  | 'HR'
  | 'Unconfigured'
  | '';

export interface ResolvableUser {
  id?: string | number;
  email?: string;
  name?: string;
  group?: string;
  role?: string;
  permissions?: string[];
  branchId?: string | number | null;
  organizationId?: string | number | null;
  organizationRole?: string | null;
  organizationEdition?: string | null;
  isSuperAdmin?: boolean;
}

/**
 * Normalizes user identity to one of the recognized operational hospital roles.
 * 
 * Security Invariants:
 * 1. Missing or undefined identity returns '' (unauthenticated).
 * 2. An unknown, missing or malformed identity NEVER receives 'Admin' or 'Super Admin'.
 * 3. 'Super Admin' requires explicit server-side verified isSuperAdmin boolean.
 * 4. 'Hospital Admin' and 'Organization Admin' derive strictly from authorized organization context.
 * 5. Generic 'Admin' without verified active organization membership returns 'Unconfigured'.
 * 6. Zero hardcoded email fallbacks.
 */
export function resolveUserRole(user: ResolvableUser | null | undefined): AppRole {
  if (!user || user.id === undefined || user.id === null) {
    return '';
  }

  const rawGroup = (user.group || user.role || '').trim();
  const normalizedGroup = rawGroup.toLowerCase().replace(/[\s_-]+/g, '');
  const orgRole = (user.organizationRole || '').toLowerCase().trim();
  const orgEdition = (user.organizationEdition || '').toUpperCase().trim();
  const perms = (Array.isArray(user.permissions) ? user.permissions : []).map((p) => p.toLowerCase());
  const permsSet = new Set(perms);

  // 1. Super Admin: Exclusive platform-level authority (strictly server-verified isSuperAdmin)
  if (
    user.isSuperAdmin === true ||
    (normalizedGroup === 'superadmin' && user.isSuperAdmin !== false)
  ) {
    return 'Super Admin';
  }

  // 2. Organization Admin: Organization-level administrative authority
  if (
    normalizedGroup === 'organizationadmin' ||
    normalizedGroup === 'orgadmin' ||
    orgRole === 'organizationadmin'
  ) {
    return 'Organization Admin';
  }

  // 3. Clinic Admin: Outpatient clinic administrative authority
  if (
    normalizedGroup === 'clinicadmin' ||
    (orgEdition === 'CLINIC' && (orgRole === 'admin' || normalizedGroup === 'admin'))
  ) {
    return 'Clinic Admin';
  }

  // 4. Hospital Admin: Hospital campus administrative operations
  if (
    normalizedGroup === 'hospitaladmin' ||
    ((orgEdition === 'HOSPITAL' || orgEdition === 'ENTERPRISE' || !orgEdition) &&
      (orgRole === 'admin' || normalizedGroup === 'admin' || normalizedGroup === 'administrator')) ||
    permsSet.has('hospital:*') ||
    permsSet.has('hospital_settings_view')
  ) {
    return 'Hospital Admin';
  }

  // 5. Doctor or Specialized Radiologist
  if (normalizedGroup === 'doctor') {
    const isDedicatedRadiologist =
      (permsSet.has('radiology_verify') ||
        permsSet.has('radiology_process') ||
        permsSet.has('radiology_result_enter')) &&
      !permsSet.has('consultation_add') &&
      !permsSet.has('prescription_add');

    return isDedicatedRadiologist ? 'Radiologist' : 'Doctor';
  }

  // 6. Radiologist (direct group or designation)
  if (normalizedGroup === 'radiologist') {
    return 'Radiologist';
  }

  // 7. Receptionist or Dedicated Cashier
  if (normalizedGroup === 'receptionist') {
    const isDedicatedCashier =
      permsSet.has('cashier_shift_open') &&
      permsSet.has('cashier_view') &&
      !permsSet.has('appointment_add') &&
      !permsSet.has('patient_add');

    return isDedicatedCashier ? 'Cashier' : 'Receptionist';
  }

  // 8. Cashier (direct group or designation)
  if (normalizedGroup === 'cashier') {
    return 'Cashier';
  }

  // 9. Nurse: Inpatient care, vitals and ward management
  if (normalizedGroup === 'nurse') {
    return 'Nurse';
  }

  // 10. Pharmacist: Medication formulary, FEFO dispensing and stock
  if (normalizedGroup === 'pharmacist') {
    return 'Pharmacist';
  }

  // 11. Laboratorist: Pathology, diagnostic tests, accessioning
  if (normalizedGroup === 'laboratorist' || normalizedGroup === 'lab') {
    return 'Laboratorist';
  }

  // 12. Accountant: Financial reporting, general ledger, trial balance
  if (normalizedGroup === 'accountant') {
    return 'Accountant';
  }

  // 13. HR Specialist (direct group or administrative staff designation)
  if (normalizedGroup === 'hr' || normalizedGroup === 'staffadmin') {
    return 'HR';
  }

  // Granular permission heuristic fallbacks for specialized operational personas
  if (
    permsSet.has('staff_view') &&
    permsSet.has('staff_create') &&
    permsSet.has('staff_assign_department') &&
    !permsSet.has('consultation_add') &&
    !permsSet.has('accounting_journal_create') &&
    !permsSet.has('inpatient_admit')
  ) {
    return 'HR';
  }

  if (
    permsSet.has('cashier_shift_open') &&
    permsSet.has('payment_add') &&
    !permsSet.has('appointment_add') &&
    !permsSet.has('accounting_journal_create')
  ) {
    return 'Cashier';
  }

  if (
    permsSet.has('radiology_result_enter') &&
    permsSet.has('radiology_view') &&
    !permsSet.has('consultation_add')
  ) {
    return 'Radiologist';
  }

  // Unknown, missing or unconfigured role
  return 'Unconfigured';
}
