import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Users,
  Calendar,
  Pill,
  CreditCard,
  Microscope,
  BedDouble,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DashboardWorkspace } from '../dashboard/DashboardWorkspace';

export const DashboardResolver: React.FC = () => {
  const { userRole, currentUser, token, activeBranchId, apiBaseUrl } = useAuth();
  const navigate = useNavigate();

  // 1. Admin Persona: Full Unified Operational Executive Dashboard
  if (userRole === 'Admin') {
    return (
      <DashboardWorkspace
        token={token}
        userRole={userRole}
        activeBranchId={activeBranchId}
        apiBaseUrl={apiBaseUrl}
        onNavigateToModule={(mod) => navigate(`/${mod}`)}
      />
    );
  }

  // 2. Doctor Persona: Clinical Dashboard
  if (userRole === 'Doctor') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stethoscope size={22} style={{ color: '#0284c7' }} />
              Doctor Clinical Workbench
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Welcome back, <strong>{currentUser?.name || 'Dr. Consultant'}</strong>. Review your outpatient queue, consultations, and prescriptions.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/consultations')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <span>Open Consultations</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Active Queue</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>Consultation Workbench</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>Conduct patient examinations, vitals recording, and diagnoses</p>
            <button onClick={() => navigate('/consultations')} className="btn btn-secondary" style={{ width: '100%', fontSize: 12 }}>
              Go to Consultations
            </button>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Prescriptions</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Pill size={18} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>Rx Prescriptions</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>Issue digital e-prescriptions with dosage and duration</p>
            <button onClick={() => navigate('/prescriptions')} className="btn btn-secondary" style={{ width: '100%', fontSize: 12 }}>
              Manage Prescriptions
            </button>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Appointments</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={18} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>Schedule & Visits</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>Review registered patients booked for OPD consultations</p>
            <button onClick={() => navigate('/appointments')} className="btn btn-secondary" style={{ width: '100%', fontSize: 12 }}>
              View Schedule
            </button>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Inpatients</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BedDouble size={18} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>IPD Rounds</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>Monitor admitted patients, bed status, and daily clinical progress</p>
            <button onClick={() => navigate('/inpatient')} className="btn btn-secondary" style={{ width: '100%', fontSize: 12 }}>
              Inspect Ward Beds
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Receptionist Persona: Front Desk Dashboard
  if (userRole === 'Receptionist') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} style={{ color: '#0284c7' }} />
            Front Desk & Patient Intake Dashboard
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Welcome, <strong>{currentUser?.name || 'Receptionist'}</strong>. Manage patient registrations, appointment bookings, and waiting queue.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Patient Central Registry</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Register new walk-in patients, update demographics, and view medical history.</p>
            <button onClick={() => navigate('/patients')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Open Patient Registry <ArrowRight size={16} />
            </button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Appointments & Visits</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Book clinic appointments, check consultant doctor slot availability, and handle check-ins.</p>
            <button onClick={() => navigate('/appointments')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Open Appointment Schedule <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Accountant Persona: Financial Dashboard
  if (userRole === 'Accountant') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={22} style={{ color: '#0284c7' }} />
            Hospital Financial & Billing Management
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Welcome, <strong>{currentUser?.name || 'Accountant'}</strong>. Review hospital billing, invoices, payments, and cashier reconciliations.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Invoices & Billing</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Manage patient billing folios, issue itemized invoices, record settlement payments.</p>
            <button onClick={() => navigate('/billing')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Open Billing & Invoices <ArrowRight size={16} />
            </button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Cashier & POS Shifts</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Inspect cash drawer shifts, approve supervisor reconciliations, and record treasury payouts.</p>
            <button onClick={() => navigate('/cashier')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Open Cashier Shifts <ArrowRight size={16} />
            </button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>General Ledger & COA</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Manage double-entry journal vouchers, chart of accounts, and financial statement reports.</p>
            <button onClick={() => navigate('/accounting')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Open General Accounting <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Pharmacist Persona: Pharmacy Dashboard
  if (userRole === 'Pharmacist') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pill size={22} style={{ color: '#0284c7' }} />
            Pharmacy & Formulary Inventory Dashboard
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Welcome, <strong>{currentUser?.name || 'Pharmacist'}</strong>. Manage pharmaceutical dispensing, medicine batches, and stock reorders.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Pharmacy & Dispensing</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Process prescription dispensing orders, manage batch stocks, and track purchase invoices.</p>
            <button onClick={() => navigate('/pharmacy')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Open Pharmacy Workspace <ArrowRight size={16} />
            </button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Medicine Catalogue</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Maintain master medicine formulary, generic names, dosage forms, and price lists.</p>
            <button onClick={() => navigate('/medicines')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Open Medicine Catalogue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. Laboratorist Persona: Diagnostics Dashboard
  if (userRole === 'Laboratorist') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Microscope size={22} style={{ color: '#0284c7' }} />
            Laboratory Information System (LIS) Dashboard
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Welcome, <strong>{currentUser?.name || 'Laboratorist'}</strong>. Process specimen intake, enter test results, and release validated reports.
          </p>
        </div>

        <div className="card" style={{ maxWidth: 480, padding: 20 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>Laboratory Diagnostics</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Receive specimen samples, record parameters, and publish verified test results for clinicians.</p>
          <button onClick={() => navigate('/laboratory')} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Open Laboratory Workspace <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
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
