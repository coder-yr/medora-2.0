import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Authentication & Core Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, RequirePermission } from './app/RouteGuard';
import { AppShell } from './app/AppShell';
import { getDefaultRouteForRole } from './app/navigation-utils';
import { resolveUserRole } from './app/role-resolution';

// Features & Workspaces
import { LoginView } from './features/auth/LoginView';
import { DashboardResolver } from './features/dashboards/DashboardResolver';
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
import { CashierDashboard } from './features/dashboards/cashier/CashierDashboard';
import { RadiologistDashboard } from './features/dashboards/radiologist/RadiologistDashboard';
import { HRDashboard } from './features/dashboards/hr/HRDashboard';
import { StaffWorkspace } from './components/StaffWorkspace';
import { AccountingWorkspace } from './components/AccountingWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { NotificationAdminWorkspace } from './features/notifications/NotificationAdminWorkspace';

// Types
import type { Patient } from './types/patient';
import type { Doctor } from './types/doctor';
import type { Appointment } from './types/appointment';

// Root Redirect Component
const RootRedirect: React.FC = () => {
  const { userRole, token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getDefaultRouteForRole(userRole)} replace />;
};

// Login Route Wrapper
const LoginRoute: React.FC = () => {
  const { token, userRole, apiBaseUrl, handleLoginSuccess } = useAuth();
  const navigate = useNavigate();

  if (token) {
    return <Navigate to={getDefaultRouteForRole(userRole)} replace />;
  }

  return (
    <LoginView
      apiBaseUrl={apiBaseUrl}
      onLoginSuccess={(auth) => {
        handleLoginSuccess(auth);
        const resolvedRole = resolveUserRole(auth.user);
        navigate(getDefaultRouteForRole(resolvedRole), { replace: true });
      }}
    />
  );
};

// Workspace Route Adapters
const PatientRoute: React.FC = () => {
  const { token, apiBaseUrl, activeBranchId } = useAuth();
  const navigate = useNavigate();

  return (
    <PatientWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      activeBranchId={activeBranchId}
      onBookAppointment={(patient: Patient) => {
        navigate('/appointments', { state: { patient } });
      }}
      onRaiseInvoice={(patient: Patient) => {
        navigate('/billing', { state: { invoicePatientId: patient.id } });
      }}
    />
  );
};

const AppointmentRoute: React.FC = () => {
  const { token, apiBaseUrl, activeBranchId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { patient?: Patient; doctor?: Doctor; initialAction?: 'book' }) || {};

  return (
    <AppointmentWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      activeBranchId={activeBranchId}
      initialPatient={state.patient}
      initialDoctor={state.doctor}
      initialAction={state.initialAction}
      onStartConsultation={(appointment: Appointment) => {
        navigate('/consultations', { state: { appointment } });
      }}
    />
  );
};

const ConsultationRoute: React.FC = () => {
  const { token, apiBaseUrl } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { appointment?: Appointment }) || {};

  return (
    <ConsultationWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      activeAppointment={state.appointment}
      onNavigateToBilling={(patientId: string, doctorId?: string) => {
        navigate('/billing', { state: { invoicePatientId: patientId, invoiceDoctorId: doctorId } });
      }}
    />
  );
};

const PrescriptionRoute: React.FC = () => {
  const { token, apiBaseUrl, userRole } = useAuth();
  return <PrescriptionWorkspace token={token} apiBaseUrl={apiBaseUrl} userRole={userRole} />;
};

const PharmacyRoute: React.FC = () => {
  const { token, apiBaseUrl, userRole } = useAuth();
  return (
    <PharmacyWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      userRole={userRole as any}
      onNotification={() => {}}
    />
  );
};

const MedicineRoute: React.FC = () => {
  const { token, apiBaseUrl, userRole } = useAuth();
  return (
    <MedicineCatalogue
      token={token}
      apiBaseUrl={apiBaseUrl}
      userRole={userRole as any}
      onNotification={() => {}}
    />
  );
};

const LaboratoryRoute: React.FC = () => {
  const { token, userRole } = useAuth();
  return <LaboratoryWorkspace token={token} userRole={userRole} />;
};

const RadiologyRoute: React.FC = () => {
  const { token, userRole } = useAuth();
  const [viewMode, setViewMode] = React.useState<'dashboard' | 'workspace'>('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={() => setViewMode(viewMode === 'dashboard' ? 'workspace' : 'dashboard')}
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          {viewMode === 'dashboard' ? 'Switch to Full Examination Workspace' : 'Switch to Radiologist Cockpit'}
        </button>
      </div>

      {viewMode === 'dashboard' ? (
        <RadiologistDashboard />
      ) : (
        <RadiologyWorkspace token={token} userRole={userRole} />
      )}
    </div>
  );
};

const InpatientRoute: React.FC = () => {
  const { token, apiBaseUrl, userRole, activeBranchId } = useAuth();
  return (
    <InpatientWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      userRole={userRole}
      activeBranchId={activeBranchId}
    />
  );
};

const CashierRoute: React.FC = () => {
  const { token, userRole } = useAuth();
  const [viewMode, setViewMode] = React.useState<'dashboard' | 'register'>('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={() => setViewMode(viewMode === 'dashboard' ? 'register' : 'dashboard')}
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          {viewMode === 'dashboard' ? 'Switch to Detailed Register Mode' : 'Switch to Cashier Cockpit'}
        </button>
      </div>

      {viewMode === 'dashboard' ? (
        <CashierDashboard />
      ) : (
        <CashierWorkspace token={token} userRole={userRole} />
      )}
    </div>
  );
};

const BillingRoute: React.FC = () => {
  const { token, apiBaseUrl, activeBranchId } = useAuth();
  const location = useLocation();
  const state = (location.state as { invoicePatientId?: string; invoiceDoctorId?: string }) || {};

  return (
    <BillingWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      activeBranchId={activeBranchId}
      initialPatientId={state.invoicePatientId || null}
      initialDoctorId={state.invoiceDoctorId || null}
    />
  );
};

const DoctorRoute: React.FC = () => {
  const { token, apiBaseUrl, activeBranchId } = useAuth();
  const navigate = useNavigate();

  return (
    <DoctorWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      activeBranchId={activeBranchId}
      onBookAppointmentWithDoctor={(doctor: Doctor) => {
        navigate('/appointments', { state: { doctor } });
      }}
      onNavigateToDepartments={() => {
        navigate('/departments');
      }}
    />
  );
};

const DepartmentRoute: React.FC = () => {
  const { token, apiBaseUrl } = useAuth();
  const navigate = useNavigate();

  return (
    <DepartmentWorkspace
      token={token}
      apiBaseUrl={apiBaseUrl}
      onViewDepartmentDoctors={() => navigate('/doctors')}
      onNavigateToDoctors={() => navigate('/doctors')}
    />
  );
};

const StaffRoute: React.FC = () => {
  const { token, userRole } = useAuth();
  const [viewMode, setViewMode] = React.useState<'dashboard' | 'workspace'>('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={() => setViewMode(viewMode === 'dashboard' ? 'workspace' : 'dashboard')}
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          {viewMode === 'dashboard' ? 'Switch to Detailed Staff Roster' : 'Switch to HR Analytics Cockpit'}
        </button>
      </div>

      {viewMode === 'dashboard' ? (
        <HRDashboard />
      ) : (
        <StaffWorkspace token={token} userRole={userRole} />
      )}
    </div>
  );
};

const AccountingRoute: React.FC = () => {
  const { token } = useAuth();
  return <AccountingWorkspace token={token} />;
};

const SettingsRoute: React.FC = () => {
  const { token, activeBranchId, setActiveBranchId } = useAuth();
  return (
    <SettingsWorkspace
      token={token}
      activeBranchId={activeBranchId}
      onBranchChange={setActiveBranchId}
    />
  );
};

const NotificationRoute: React.FC = () => {
  const { token, activeBranchId, apiBaseUrl } = useAuth();
  return (
    <NotificationAdminWorkspace
      token={token}
      activeBranchId={activeBranchId}
      apiBaseUrl={apiBaseUrl}
    />
  );
};

// Main App Component with React Router Declarative Routes
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<LoginRoute />} />

          {/* Protected Application Shell */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {/* Role-Aware Dynamic Dashboard */}
            <Route path="/dashboard" element={<DashboardResolver />} />

            {/* Clinical Operations */}
            <Route
              path="/patients"
              element={
                <RequirePermission permission="patient_view">
                  <PatientRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/appointments"
              element={
                <RequirePermission permission="appointment_view">
                  <AppointmentRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/consultations"
              element={
                <RequirePermission permission="consultation_view">
                  <ConsultationRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/prescriptions"
              element={
                <RequirePermission permission="prescription_view">
                  <PrescriptionRoute />
                </RequirePermission>
              }
            />

            {/* Diagnostics & Pharmacy */}
            <Route
              path="/pharmacy"
              element={
                <RequirePermission permission="pharmacy_view">
                  <PharmacyRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/medicines"
              element={
                <RequirePermission permission="medicine_view">
                  <MedicineRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/laboratory"
              element={
                <RequirePermission permission="lab_view">
                  <LaboratoryRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/radiology"
              element={
                <RequirePermission permission="radiology_view">
                  <RadiologyRoute />
                </RequirePermission>
              }
            />

            {/* Inpatient & Billing */}
            <Route
              path="/inpatient"
              element={
                <RequirePermission permission="inpatient_view">
                  <InpatientRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/cashier"
              element={
                <RequirePermission permission="cashier_view">
                  <CashierRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/billing"
              element={
                <RequirePermission permission="invoice_view">
                  <BillingRoute />
                </RequirePermission>
              }
            />

            {/* Hospital Administration */}
            <Route
              path="/doctors"
              element={
                <RequirePermission permission="doctor_view">
                  <DoctorRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/departments"
              element={
                <RequirePermission permission="department_view">
                  <DepartmentRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/staff"
              element={
                <RequirePermission permission="staff_view">
                  <StaffRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/accounting"
              element={
                <RequirePermission permission="accounting_view">
                  <AccountingRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/settings"
              element={
                <RequirePermission permission="hospital_settings_view">
                  <SettingsRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/notifications"
              element={
                <RequirePermission permission="notification_view">
                  <NotificationRoute />
                </RequirePermission>
              }
            />

            {/* Root & Fallback Redirects */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
