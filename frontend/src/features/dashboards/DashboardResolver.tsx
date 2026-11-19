import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { SuperAdminDashboard } from './superadmin/SuperAdminDashboard';
import { HospitalAdminDashboard } from './admin/HospitalAdminDashboard';
import { DoctorDashboard } from './doctor/DoctorDashboard';
import { ReceptionistDashboard } from './receptionist/ReceptionistDashboard';
import { NurseDashboard } from './nurse/NurseDashboard';
import { PharmacistDashboard } from './pharmacist/PharmacistDashboard';
import { LaboratoristDashboard } from './laboratorist/LaboratoristDashboard';
import { RadiologistDashboard } from './radiologist/RadiologistDashboard';
import { CashierDashboard } from './cashier/CashierDashboard';
import { AccountantDashboard } from './accountant/AccountantDashboard';
import { HRDashboard } from './hr/HRDashboard';
import { UnconfiguredRoleView } from './components/UnconfiguredRoleView';

export const DashboardResolver: React.FC = () => {
  const { userRole } = useAuth();

  // 1. Super Admin: Global Multi-Branch Governance Cockpit
  if (userRole === 'Super Admin') {
    return <SuperAdminDashboard />;
  }

  // 2. Hospital Admin: Branch Operations Administration
  if (userRole === 'Hospital Admin') {
    return <HospitalAdminDashboard />;
  }

  // 3. Doctor Persona: Clinical Workbench & OPD Queue
  if (userRole === 'Doctor') {
    return <DoctorDashboard />;
  }

  // 4. Receptionist Persona: Front Desk & Outpatient Reception
  if (userRole === 'Receptionist') {
    return <ReceptionistDashboard />;
  }

  // 5. Nurse Persona: Nursing Station & Inpatient Bedside Care
  if (userRole === 'Nurse') {
    return <NurseDashboard />;
  }

  // 6. Pharmacist Persona: Pharmacy Dispensary & Formulary Inventory
  if (userRole === 'Pharmacist') {
    return <PharmacistDashboard />;
  }

  // 7. Laboratorist Persona: Laboratory Information System (LIS) & Specimen Processing
  if (userRole === 'Laboratorist') {
    return <LaboratoristDashboard />;
  }

  // 8. Radiologist Persona: Medical Imaging, PACS Worklist & Modality Diagnostic Reports
  if (userRole === 'Radiologist') {
    return <RadiologistDashboard />;
  }

  // 9. Cashier Persona: POS Counter, Shift Cashier Till & Patient Settlements
  if (userRole === 'Cashier') {
    return <CashierDashboard />;
  }

  // 10. Accountant Persona: Financial Management, GL & Hospital Invoicing
  if (userRole === 'Accountant') {
    return <AccountantDashboard />;
  }

  // 11. HR Persona: Human Resources, Staff Onboarding & Department Rosters
  if (userRole === 'HR') {
    return <HRDashboard />;
  }

  // Fallback for unconfigured role, unassigned persona, or missing permissions
  return <UnconfiguredRoleView />;
};
