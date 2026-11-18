import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboard } from './admin/AdminDashboard';
import { DoctorDashboard } from './doctor/DoctorDashboard';
import { ReceptionistDashboard } from './receptionist/ReceptionistDashboard';
import { AccountantDashboard } from './accountant/AccountantDashboard';
import { PharmacistDashboard } from './pharmacist/PharmacistDashboard';
import { LaboratoristDashboard } from './laboratorist/LaboratoristDashboard';

export const DashboardResolver: React.FC = () => {
  const { userRole, currentUser } = useAuth();
  const navigate = useNavigate();

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

  // 7. Nurse Persona: Nursing & Inpatient Dashboard
  if (userRole === 'Nurse') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BedDouble size={22} style={{ color: '#0284c7' }} />
            Inpatient Nursing & Bed Management Dashboard
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Welcome, <strong>{currentUser?.name || 'Nurse'}</strong>. Monitor ward occupancy, manage bed sanitization, and record patient admission notes.
          </p>
        </div>

        <div className="card" style={{ maxWidth: 480, padding: 20 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Inpatient & Bed Allocation</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Track ward capacity, update bed statuses (Occupied, Cleaning, Available), and handle patient transfers.</p>
          <button onClick={() => navigate('/inpatient')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Open Inpatient Workspace <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
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
