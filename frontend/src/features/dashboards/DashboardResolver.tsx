import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboard } from './admin/AdminDashboard';
import { DoctorDashboard } from './doctor/DoctorDashboard';
import { ReceptionistDashboard } from './receptionist/ReceptionistDashboard';
import { AccountantDashboard } from './accountant/AccountantDashboard';
import { PharmacistDashboard } from './pharmacist/PharmacistDashboard';
import { LaboratoristDashboard } from './laboratorist/LaboratoristDashboard';
import { NurseDashboard } from './nurse/NurseDashboard';

export const DashboardResolver: React.FC = () => {
  const { userRole, currentUser } = useAuth();

  // 1. Admin Persona: Dedicated Executive Governance Dashboard
  if (userRole === 'Admin') {
    return <AdminDashboard />;
  }

  // 2. Doctor Persona: Dedicated Clinical Workbench & OPD Queue
  if (userRole === 'Doctor') {
    return <DoctorDashboard />;
  }

  // 3. Receptionist Persona: Dedicated Front Desk & Outpatient Reception
  if (userRole === 'Receptionist') {
    return <ReceptionistDashboard />;
  }

  // 4. Accountant Persona: Dedicated Financial Management & General Ledger Cockpit
  if (userRole === 'Accountant') {
    return <AccountantDashboard />;
  }

  // 5. Pharmacist Persona: Dedicated Pharmacy & Formulary Inventory Dashboard
  if (userRole === 'Pharmacist') {
    return <PharmacistDashboard />;
  }

  // 6. Laboratorist Persona: Dedicated Laboratory Information System (LIS) Dashboard
  if (userRole === 'Laboratorist') {
    return <LaboratoristDashboard />;
  }

  // 7. Nurse Persona: Dedicated Nursing & Inpatient Care Cockpit
  if (userRole === 'Nurse') {
    return <NurseDashboard />;
  }

  // Fallback for unknown or unconfigured persona
  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 24, textAlign: 'center' }} className="card">
      <h3 style={{ margin: '0 0 8px 0' }}>Welcome to Medora 2.0</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
        Signed in as <strong>{currentUser?.name}</strong> ({userRole}).
      </p>
    </div>
  );
};
