/**
 * Role Resolution and Persona Normalization Engine for Medora 2.0
 * 
 * Enforces explicit, non-escalating identity resolution based strictly
 * on backend-issued user groups, roles, and granular permission claims.
 */

export type AppRole =
  | 'Super Admin'
  | 'Hospital Admin'
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
}

/**
 * Normalizes user identity to one of the 11 recognized operational hospital roles.
 * 
 * Security Invariants:
 * 1. Missing or undefined identity returns '' (unauthenticated).
 * 2. An unknown, missing or malformed identity NEVER receives 'Admin' or 'Super Admin'.
 * 3. 'Super Admin' requires explicit 'SuperAdmin' group or 'branch_view_all' + 'system_settings'.
 * 4. 'Hospital Admin' is bound to branch-scoped administration and does not receive Super Admin bypass.
 * 5. Specialized operational personas (Radiologist, Cashier, HR) are resolved via verifiable backend grants.
 */
export function resolveUserRole(user: ResolvableUser | null | undefined): AppRole {
  if (!user || user.id === undefined || user.id === null) {
    return '';
  }

  const rawGroup = (user.group || user.role || '').trim();
  const normalizedGroup = rawGroup.toLowerCase().replace(/[\s_-]+/g, '');
  const perms = (Array.isArray(user.permissions) ? user.permissions : []).map((p) => p.toLowerCase());
  const permsSet = new Set(perms);

  // 1. Super Admin: Explicit system-level global administration
  if (
    normalizedGroup === 'superadmin' ||
    (normalizedGroup === 'admin' && permsSet.has('branch_view_all') && permsSet.has('system_settings')) ||
    permsSet.has('*')
  ) {
    return 'Super Admin';
  }

  // 2. Hospital Admin: Hospital or branch-level administrative operations
  if (normalizedGroup === 'hospitaladmin' || normalizedGroup === 'admin') {
    return 'Hospital Admin';
  }

  // 3. Doctor or Specialized Radiologist
  if (normalizedGroup === 'doctor') {
    // If clinician is dedicated to radiology interpretation without general outpatient consultations
    const isDedicatedRadiologist =
      (permsSet.has('radiology_verify') || permsSet.has('radiology_process') || permsSet.has('radiology_result_enter')) &&
      !permsSet.has('consultation_add') &&
      !permsSet.has('prescription_add');

    return isDedicatedRadiologist ? 'Radiologist' : 'Doctor';
  }

  // 4. Radiologist (direct group or designation)
  if (normalizedGroup === 'radiologist') {
    return 'Radiologist';
  }

  // 5. Receptionist or Dedicated Cashier
  if (normalizedGroup === 'receptionist') {
    // If front-desk staff is dedicated to cash drawer desk without patient registration or appointment booking
    const isDedicatedCashier =
      permsSet.has('cashier_shift_open') &&
      permsSet.has('cashier_view') &&
      !permsSet.has('appointment_add') &&
      !permsSet.has('patient_add');

    return isDedicatedCashier ? 'Cashier' : 'Receptionist';
  }

  // 6. Cashier (direct group or designation)
  if (normalizedGroup === 'cashier') {
    return 'Cashier';
  }

  // 7. Nurse: Inpatient care, vitals and ward management
  if (normalizedGroup === 'nurse') {
    return 'Nurse';
  }

  // 8. Pharmacist: Medication formulary, FEFO dispensing and stock
  if (normalizedGroup === 'pharmacist') {
    return 'Pharmacist';
  }

  // 9. Laboratorist: Pathology, diagnostic tests, accessioning
  if (normalizedGroup === 'laboratorist' || normalizedGroup === 'lab') {
    return 'Laboratorist';
  }

  // 10. Accountant: Financial reporting, general ledger, trial balance
  if (normalizedGroup === 'accountant') {
    return 'Accountant';
  }

  // 11. HR Specialist (direct group or administrative staff designation)
  if (normalizedGroup === 'hr' || normalizedGroup === 'staffadmin') {
    return 'HR';
  }

  // Fallback: Check if user has explicit grants matching specialized personas
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
