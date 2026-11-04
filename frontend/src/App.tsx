import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Pill,
  CreditCard,
  Boxes,
  Microscope,
  Radio,
  BedDouble,
  DollarSign,
  Building2,
  Shield,
  Bell,
  Key,
  LogOut,
  Menu,
  X,
  FileText,
  UserCheck,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// Feature Workspaces
import { LoginView } from './features/auth/LoginView';
import { ChangePasswordModal } from './features/auth/ChangePasswordModal';
import { DashboardWorkspace } from './features/dashboard/DashboardWorkspace';
import { PatientWorkspace } from './features/patients/PatientWorkspace';
import { AppointmentWorkspace } from './features/appointments/AppointmentWorkspace';
import { ConsultationWorkspace } from './features/consultations/ConsultationWorkspace';
import { PrescriptionWorkspace } from './features/prescriptions/PrescriptionWorkspace';
import { BillingWorkspace } from './features/billing/BillingWorkspace';
import { DoctorWorkspace } from './features/doctors/DoctorWorkspace';
import { DepartmentWorkspace } from './features/departments/DepartmentWorkspace';
import { PharmacyWorkspace } from './components/PharmacyWorkspace';
import { MedicineCatalogue } from './components/MedicineCatalogue';
import { LaboratoryWorkspace } from './components/LaboratoryWorkspace';
import { RadiologyWorkspace } from './features/radiology/RadiologyWorkspace';
import { InpatientWorkspace } from './components/InpatientWorkspace';
import { CashierWorkspace } from './components/CashierWorkspace';
import { StaffWorkspace } from './components/StaffWorkspace';
import { AccountingWorkspace } from './components/AccountingWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { NotificationAdminWorkspace } from './features/notifications/NotificationAdminWorkspace';
import { NotificationCenter } from './features/notifications/NotificationCenter';

// Types
import type { AuthResponse, AuthUser } from './types/auth';
import type { Patient } from './types/patient';
import type { Doctor } from './types/doctor';
import type { Appointment } from './types/appointment';

export type AppWorkspaceModule =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'consultations'
  | 'prescriptions'
  | 'billing'
  | 'medicines'
  | 'pharmacy'
  | 'laboratory'
  | 'radiology'
  | 'inpatient'
  | 'cashier'
  | 'doctors'
  | 'departments'
  | 'staff'
  | 'accounting'
  | 'settings'
  | 'notifications';

const isDev = import.meta.env.DEV;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:3000' : '');

export function App() {
  const [activeModule, setActiveModule] = useState<AppWorkspaceModule>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Authentication State
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('medora_access_token') || '');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const raw = sessionStorage.getItem('medora_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [userRole, setUserRole] = useState<string>(() => {
    const raw = sessionStorage.getItem('medora_user');
    if (raw) {
      try {
        return JSON.parse(raw).role || 'Admin';
      } catch {
        return 'Admin';
      }
    }
    return 'Admin';
  });
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Multi-branch state
  const [userBranches, setUserBranches] = useState<Array<{ id: string; name: string; code: string; active?: boolean }>>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>(() => localStorage.getItem('medora_active_branch') || '1');

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cross-module state passing
  const [navState, setNavState] = useState<{
    patient?: Patient | null;
    doctor?: Doctor | null;
    appointment?: Appointment | null;
    invoicePatientId?: string | null;
    invoiceDoctorId?: string | null;
  }>({});

  // Auto-login for development convenience when no token is present
  useEffect(() => {
    if (!token && isDev) {
      loginAsPersona('Admin');
    }
  }, []);

  // Fetch branches when token changes
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/branches/my-branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        const branches = json.data || json;
        if (Array.isArray(branches)) {
          setUserBranches(branches);
          if (branches.length > 0 && !branches.some((b) => String(b.id) === String(activeBranchId))) {
            setActiveBranchId(String(branches[0].id));
            localStorage.setItem('medora_active_branch', String(branches[0].id));
          } else if (branches.length === 0) {
            setActiveBranchId('');
            localStorage.removeItem('medora_active_branch');
          }
        }
      })
      .catch((err) => console.error('Failed to fetch user branches:', err));
  }, [token]);

  const handleBranchSelect = (newBranchId: string) => {
    if (userBranches.length > 0 && !userBranches.some((b) => String(b.id) === String(newBranchId))) {
      console.warn(`Access denied: User does not belong to branch ${newBranchId}`);
      return;
    }
    setActiveBranchId(newBranchId);
    localStorage.setItem('medora_active_branch', newBranchId);
  };

  const handleLoginSuccess = (auth: AuthResponse) => {
    setToken(auth.accessToken);
    sessionStorage.setItem('medora_access_token', auth.accessToken);
    if (auth.user) {
      setCurrentUser(auth.user);
      setUserRole(auth.user.role || 'Admin');
      sessionStorage.setItem('medora_user', JSON.stringify(auth.user));
      if (auth.user.branches && auth.user.branches.length > 0) {
        setUserBranches(auth.user.branches);
        setActiveBranchId(auth.user.branches[0].id);
        localStorage.setItem('medora_active_branch', auth.user.branches[0].id);
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('medora_access_token');
    sessionStorage.removeItem('medora_user');
    setToken('');
    setCurrentUser(null);
  };

  const loginAsPersona = async (roleName: string) => {
    try {
      let email = 'admin.test@medora.hospital';
      if (roleName === 'Accountant') email = 'accountant.test@medora.hospital';
      if (roleName === 'Doctor') email = 'doctor.test@medora.hospital';
      if (roleName === 'Pharmacist') email = 'pharmacist.test@medora.hospital';
      if (roleName === 'Laboratorist') email = 'laboratorist.test@medora.hospital';
      if (roleName === 'Receptionist') email = 'receptionist.test@medora.hospital';

      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'ValidPassword123!' }),
      });
      const data = await res.json();
      if (data.success && data.data?.accessToken) {
        handleLoginSuccess(data.data);
      }
    } catch {
      // Backend may be booting
    }
  };

  // Cross-Module Navigation Handlers
  const handleBookAppointment = (patient: Patient) => {
    setNavState((prev) => ({ ...prev, patient }));
    setActiveModule('appointments');
  };

  const handleRaiseInvoice = (patient: Patient) => {
    setNavState((prev) => ({ ...prev, invoicePatientId: patient.id }));
    setActiveModule('billing');
  };

  const handleStartConsultation = (appointment: Appointment) => {
    setNavState((prev) => ({ ...prev, appointment }));
    setActiveModule('consultations');
  };

  const handleDoctorSchedule = (doctor: Doctor) => {
    setNavState((prev) => ({ ...prev, doctor }));
    setActiveModule('appointments');
  };

  const handleNavigateToBillingFromConsultation = (patientId: string, doctorId?: string) => {
    setNavState((prev) => ({ ...prev, invoicePatientId: patientId, invoiceDoctorId: doctorId }));
    setActiveModule('billing');
  };

  // If unauthenticated, render production LoginView
  if (!token) {
    return <LoginView apiBaseUrl={API_BASE_URL} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="medora-layout">
      {/* Sidebar Navigation */}
      <aside className={`medora-sidebar ${sidebarOpen ? 'open' : 'closed'} no-print`}>
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-icon">
            <Stethoscope size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h1 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                MEDORA 2.0
              </h1>
              <span style={{
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Pro
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Hospital Clinical Core
            </p>
          </div>
        </div>

        {/* Navigation Categories */}
        <div className="sidebar-content">
          {/* Section 1: Clinical Operations */}
          <div>
            <div className="sidebar-group-title">Clinical Operations</div>
            <div className="sidebar-group-items">
              <button
                className={`sidebar-link ${activeModule === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveModule('dashboard')}
              >
                <LayoutDashboard size={17} />
                <span>Executive Dashboard</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'patients' ? 'active' : ''}`}
                onClick={() => setActiveModule('patients')}
              >
                <Users size={17} />
                <span>Patient Central Registry</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'appointments' ? 'active' : ''}`}
                onClick={() => setActiveModule('appointments')}
              >
                <Calendar size={17} />
                <span>Appointments & Visits</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'consultations' ? 'active' : ''}`}
                onClick={() => setActiveModule('consultations')}
              >
                <Stethoscope size={17} />
                <span>Doctor Consultation</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'prescriptions' ? 'active' : ''}`}
                onClick={() => setActiveModule('prescriptions')}
              >
                <Pill size={17} />
                <span>Prescriptions (Rx)</span>
              </button>
            </div>
          </div>

          {/* Section 2: Diagnostics & Pharmacy */}
          <div>
            <div className="sidebar-group-title">Diagnostics & Pharmacy</div>
            <div className="sidebar-group-items">
              <button
                className={`sidebar-link ${activeModule === 'pharmacy' ? 'active' : ''}`}
                onClick={() => setActiveModule('pharmacy')}
              >
                <Boxes size={17} />
                <span>Pharmacy & Inventory</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'medicines' ? 'active' : ''}`}
                onClick={() => setActiveModule('medicines')}
              >
                <Pill size={17} />
                <span>Medicine Catalogue</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'laboratory' ? 'active' : ''}`}
                onClick={() => setActiveModule('laboratory')}
              >
                <Microscope size={17} />
                <span>Laboratory (LIS)</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'radiology' ? 'active' : ''}`}
                onClick={() => setActiveModule('radiology')}
              >
                <Radio size={17} />
                <span>Radiology & PACS (RIS)</span>
              </button>
            </div>
          </div>

          {/* Section 3: Inpatient & Billing */}
          <div>
            <div className="sidebar-group-title">Inpatient & Billing</div>
            <div className="sidebar-group-items">
              <button
                className={`sidebar-link ${activeModule === 'inpatient' ? 'active' : ''}`}
                onClick={() => setActiveModule('inpatient')}
              >
                <BedDouble size={17} />
                <span>Inpatient & Beds (IPD)</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'cashier' ? 'active' : ''}`}
                onClick={() => setActiveModule('cashier')}
              >
                <DollarSign size={17} />
                <span>Cashier & Shifts (POS)</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveModule('billing')}
              >
                <CreditCard size={17} />
                <span>Invoices & Billing</span>
              </button>
            </div>
          </div>

          {/* Section 4: Administration & Settings */}
          <div>
            <div className="sidebar-group-title">Hospital Administration</div>
            <div className="sidebar-group-items">
              <button
                className={`sidebar-link ${activeModule === 'doctors' ? 'active' : ''}`}
                onClick={() => setActiveModule('doctors')}
              >
                <Stethoscope size={17} />
                <span>Medical Consultants</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'departments' ? 'active' : ''}`}
                onClick={() => setActiveModule('departments')}
              >
                <Building2 size={17} />
                <span>Departments & Specialties</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'staff' ? 'active' : ''}`}
                onClick={() => setActiveModule('staff')}
              >
                <UserCheck size={17} />
                <span>Staff & HR Directory</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'accounting' ? 'active' : ''}`}
                onClick={() => setActiveModule('accounting')}
              >
                <FileText size={17} />
                <span>General Accounting & COA</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveModule('settings')}
              >
                <Building2 size={17} />
                <span>Hospital Settings & Branches</span>
              </button>
              <button
                className={`sidebar-link ${activeModule === 'notifications' ? 'active' : ''}`}
                onClick={() => setActiveModule('notifications')}
              >
                <Bell size={17} />
                <span>Notifications & Outbox</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
              boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)'
            }}>
              {(currentUser?.name || userRole || 'A').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {currentUser?.name || 'Administrator'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'var(--primary-light)',
                  padding: '1px 6px',
                  borderRadius: 4
                }}>
                  {userRole}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} title="Online & Authorized" />
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out from Medora"
            className="btn btn-secondary"
            style={{ color: '#dc2626', padding: '6px 8px', borderRadius: 6, borderColor: '#fecdd3', background: '#fff1f2' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="medora-main">
        {/* Top Header Bar */}
        <header className="medora-topbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn btn-secondary"
              style={{ padding: '7px 9px', borderRadius: 8, display: 'flex', alignItems: 'center', color: '#475569' }}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <Menu size={18} />
            </button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
                <span>{activeModule.replace('-', ' ').toUpperCase()}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 9999 }}>
                  Workspace
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Active Branch Switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '5px 12px',
              borderRadius: 9999,
              boxShadow: 'var(--shadow-xs)'
            }}>
              <Building2 size={15} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Branch:</span>
              <select
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: 12.5,
                  color: '#0f172a',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                value={activeBranchId}
                onChange={(e) => handleBranchSelect(e.target.value)}
              >
                {userBranches.length > 0 ? (
                  userBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} [{b.code}]
                    </option>
                  ))
                ) : (
                  <option value="1">Main Campus [MAIN]</option>
                )}
              </select>
            </div>

            {/* Notification Center Bell */}
            <NotificationCenter token={token} apiBaseUrl={API_BASE_URL} />

            {/* Dev Persona Switcher */}
            {isDev && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '5px 12px',
                borderRadius: 9999,
                boxShadow: 'var(--shadow-xs)'
              }}>
                <Shield size={14} style={{ color: '#059669' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Role:</span>
                <select
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  value={userRole}
                  onChange={(e) => {
                    setUserRole(e.target.value);
                    loginAsPersona(e.target.value);
                  }}
                >
                  <option value="Admin">Administrator</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Laboratorist">Laboratorist</option>
                  <option value="Receptionist">Receptionist</option>
                </select>
              </div>
            )}

            {/* Change Password Button */}
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 8 }}
              onClick={() => setShowChangePassword(true)}
              title="Change Account Password"
            >
              <Key size={14} style={{ color: '#0284c7' }} /> Password
            </button>
          </div>
        </header>

        {/* Global Toast Notification */}
        {notification && (
          <div
            style={{
              margin: '16px 28px 0 28px',
              padding: '12px 18px',
              borderRadius: 10,
              background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: notification.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecdd3'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13.5,
              fontWeight: 500,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {notification.type === 'success' ? (
                <CheckCircle size={18} style={{ color: '#059669' }} />
              ) : (
                <AlertCircle size={18} style={{ color: '#dc2626' }} />
              )}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} style={{ color: 'inherit', padding: 2 }} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Workspace Body */}
        <main className="medora-content-area">
          {/* Executive Dashboard */}
          {activeModule === 'dashboard' && (
            <DashboardWorkspace
              token={token}
              userRole={userRole}
              activeBranchId={activeBranchId}
              apiBaseUrl={API_BASE_URL}
              onNavigateToModule={(mod) => setActiveModule(mod as any)}
            />
          )}

          {/* Patient Registry */}
          {activeModule === 'patients' && (
            <PatientWorkspace
              token={token}
              apiBaseUrl={API_BASE_URL}
              activeBranchId={activeBranchId}
              onBookAppointment={handleBookAppointment}
              onRaiseInvoice={handleRaiseInvoice}
            />
          )}

          {/* Appointments & Visits */}
          {activeModule === 'appointments' && (
            <AppointmentWorkspace
              token={token}
              apiBaseUrl={API_BASE_URL}
              activeBranchId={activeBranchId}
              initialPatient={navState.patient}
              initialDoctor={navState.doctor}
              onStartConsultation={handleStartConsultation}
            />
          )}

          {/* Doctor Consultations */}
          {activeModule === 'consultations' && (
            <ConsultationWorkspace
              token={token}
              apiBaseUrl={API_BASE_URL}
              activeAppointment={navState.appointment}
              onNavigateToBilling={handleNavigateToBillingFromConsultation}
            />
          )}

          {/* Prescriptions (Rx) */}
          {activeModule === 'prescriptions' && (
            <PrescriptionWorkspace
              token={token}
              apiBaseUrl={API_BASE_URL}
              userRole={userRole}
              initialPatientId={navState.patient ? navState.patient.id : null}
              initialDoctorId={navState.doctor ? navState.doctor.id : null}
            />
          )}

          {/* Invoices & Billing */}
          {activeModule === 'billing' && (
            <BillingWorkspace
              token={token}
              apiBaseUrl={API_BASE_URL}
              activeBranchId={activeBranchId}
              initialPatientId={navState.invoicePatientId || (navState.patient ? navState.patient.id : null)}
              initialDoctorId={navState.invoiceDoctorId || (navState.doctor ? navState.doctor.id : null)}
            />
          )}

          {/* Doctors Directory */}
          {activeModule === 'doctors' && (
            <DoctorWorkspace
              token={token}
              apiBaseUrl={API_BASE_URL}
              activeBranchId={activeBranchId}
              onBookAppointmentWithDoctor={handleDoctorSchedule}
            />
          )}

          {/* Departments Catalogue */}
          {activeModule === 'departments' && (
            <DepartmentWorkspace
              token={token}
              apiBaseUrl={API_BASE_URL}
            />
          )}

          {/* Pharmacy & Stock Inventory */}
          {activeModule === 'pharmacy' && (
            <PharmacyWorkspace
              apiBaseUrl={API_BASE_URL}
              token={token}
              userRole={userRole as any}
              onNotification={(type, message) => setNotification({ type, message })}
            />
          )}

          {/* Medicine Catalogue */}
          {activeModule === 'medicines' && (
            <MedicineCatalogue
              apiBaseUrl={API_BASE_URL}
              token={token}
              userRole={userRole as any}
              onNotification={(type, message) => setNotification({ type, message })}
            />
          )}

          {/* Laboratory (LIS) */}
          {activeModule === 'laboratory' && (
            <LaboratoryWorkspace
              token={token}
              userRole={userRole}
            />
          )}

          {/* Radiology (RIS) */}
          {activeModule === 'radiology' && (
            <RadiologyWorkspace
              token={token}
              userRole={userRole}
            />
          )}

          {/* Inpatient (IPD) */}
          {activeModule === 'inpatient' && (
            <InpatientWorkspace
              apiBaseUrl={API_BASE_URL}
              token={token}
              userRole={userRole}
              onNotification={(type, message) => setNotification({ type, message })}
            />
          )}

          {/* Cashier & POS Shifts */}
          {activeModule === 'cashier' && (
            <CashierWorkspace
              token={token}
              userRole={userRole}
            />
          )}

          {/* Staff & HR Directory */}
          {activeModule === 'staff' && (
            <StaffWorkspace
              token={token}
              userRole={userRole}
            />
          )}

          {/* Accounting & General Ledger */}
          {activeModule === 'accounting' && (
            <AccountingWorkspace
              token={token}
            />
          )}

          {/* Hospital Settings & Multi-Branch Management */}
          {activeModule === 'settings' && (
            <SettingsWorkspace
              token={token}
              activeBranchId={activeBranchId}
              onBranchChange={handleBranchSelect}
            />
          )}

          {/* Notification Admin Workspace */}
          {activeModule === 'notifications' && (
            <NotificationAdminWorkspace
              token={token}
              activeBranchId={activeBranchId}
              apiBaseUrl={API_BASE_URL}
            />
          )}
        </main>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          token={token}
          apiBaseUrl={API_BASE_URL}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </div>
  );
}

export default App;
