import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Shield,
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  User,
  Globe,
  Award,
  AlertCircle,
  Stethoscope,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { getApiBaseUrl } from '../../config/api';

const API_BASE_URL = getApiBaseUrl();

type OrganizationType = 'CLINIC' | 'POLYCLINIC' | 'DIAGNOSTIC_CENTER' | 'HOSPITAL' | 'HOSPITAL_NETWORK';
type OrganizationEdition = 'CLINIC' | 'PROFESSIONAL' | 'HOSPITAL' | 'ENTERPRISE';

interface RegistrationForm {
  organizationName: string;
  organizationType: OrganizationType;
  requestedEdition: OrganizationEdition;
  healthcareSpecialization: string;
  licenseNumber: string;
  organizationEmail: string;
  contactPhone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  postalCode: string;
  website: string;
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
  adminDesignation: string;
}

const DRAFT_STORAGE_KEY = 'medora_org_registration_draft_v1';
const STEP_STORAGE_KEY = 'medora_org_registration_step_v1';

const DEFAULT_FORM: RegistrationForm = {
  organizationName: '',
  organizationType: 'HOSPITAL',
  requestedEdition: 'HOSPITAL',
  healthcareSpecialization: 'General Medicine & Surgery',
  licenseNumber: '',
  organizationEmail: '',
  contactPhone: '',
  country: 'India',
  state: '',
  city: '',
  address: '',
  postalCode: '',
  website: '',
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  adminDesignation: 'Medical Director / Hospital Administrator',
};

export const OrganizationRegistrationView: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(() => {
    try {
      const savedStep = localStorage.getItem(STEP_STORAGE_KEY);
      if (savedStep) {
        const parsed = parseInt(savedStep, 10);
        if (parsed >= 1 && parsed <= 5) return parsed;
      }
    } catch {}
    return 1;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredReference, setRegisteredReference] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const [form, setForm] = useState<RegistrationForm>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_FORM, ...parsed };
      }
    } catch {}
    return DEFAULT_FORM;
  });

  // Automatically persist form draft and current step to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

  useEffect(() => {
    try {
      localStorage.setItem(STEP_STORAGE_KEY, step.toString());
    } catch {}
  }, [step]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(STEP_STORAGE_KEY);
    } catch {}
    setForm(DEFAULT_FORM);
    setStep(1);
    setError(null);
  };

  const updateField = (field: keyof RegistrationForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateStep = (currentStep: number): boolean => {
    setError(null);
    if (currentStep === 1) {
      if (!form.organizationName.trim()) {
        setError('Organization legal name is required.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!form.organizationEmail.trim() || !form.organizationEmail.includes('@')) {
        setError('A valid organization email address is required.');
        return false;
      }
      if (!form.contactPhone.trim()) {
        setError('Primary contact phone is required.');
        return false;
      }
      if (!form.city.trim()) {
        setError('City is required.');
        return false;
      }
      return true;
    }
    if (currentStep === 4) {
      if (!form.adminFullName.trim()) {
        setError('Administrator full name is required.');
        return false;
      }
      if (!form.adminEmail.trim() || !form.adminEmail.includes('@')) {
        setError('A valid work email is required for the administrator.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/organization-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg =
          json.message ||
          (typeof json.error === 'string' ? json.error : 'Failed to submit registration request.');
        throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
      }

      const payload = json.data || json;
      clearDraft();
      setRegisteredReference(payload.reference);
      if (payload.verificationToken) {
        setDevToken(payload.verificationToken);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const editions: {
    id: OrganizationEdition;
    title: string;
    badge: string;
    desc: string;
    modules: string[];
  }[] = [
    {
      id: 'CLINIC',
      title: 'Clinic Edition',
      badge: 'Single Specialty',
      desc: 'Optimized for private clinics, single-doctor consulting rooms, and outpatient centers.',
      modules: ['Patient Directory', 'OPD Appointments', 'Consultation Notes', 'Prescriptions', 'Billing'],
    },
    {
      id: 'PROFESSIONAL',
      title: 'Professional Edition',
      badge: 'Group Practice',
      desc: 'Ideal for multi-doctor polyclinics and diagnostic centers requiring integrated dispensary management.',
      modules: ['All Clinic Features', 'Pharmacy Inventory', 'Medicine Dispensing', 'Cashier Shift Ledgers'],
    },
    {
      id: 'HOSPITAL',
      title: 'Hospital Edition',
      badge: 'Full Inpatient',
      desc: 'Comprehensive clinical operating system for 20-250 bed hospitals and surgical centers.',
      modules: [
        'Outpatient + Inpatient',
        'Ward & Bed Management',
        'Laboratory Pathology',
        'Radiology Modalities',
        'Staff Rosters & RBAC',
      ],
    },
    {
      id: 'ENTERPRISE',
      title: 'Enterprise Health',
      badge: 'Hospital Network',
      desc: 'Multi-branch healthcare systems, university hospitals, and regional diagnostic networks.',
      modules: [
        'All Hospital Modules',
        'Multi-Branch Architecture',
        'Double-Entry Accounting',
        'Telemedicine Integration',
        'Unlimited Facilities',
      ],
    },
  ];

  if (registeredReference) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 640, width: '100%', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', padding: 40, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Registration Submitted Successfully!
          </h2>
          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 24 }}>
            Your healthcare facility registration has been registered and is pending verification.
          </p>

          <div style={{ background: '#f1f5f9', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Tracking Reference</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>{registeredReference}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Organization Name</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{form.organizationName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Applicant Work Email</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{form.adminEmail}</span>
            </div>
          </div>

          <div style={{ textAlign: 'left', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Mail size={20} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1e40af' }}>Next Step: Verify Your Email</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#3b82f6' }}>
                  A verification link has been dispatched to <strong>{form.adminEmail}</strong>. Please check your inbox and confirm your email to advance your application to Super Admin approval.
                </p>
              </div>
            </div>
          </div>

          {devToken && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>
                LOCAL VERIFICATION TOKEN (Dev Sandbox Mode)
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  readOnly
                  value={devToken}
                  style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', padding: '6px 8px', borderRadius: 6, border: '1px solid #fcd34d', background: '#fff' }}
                />
                <button
                  onClick={() => navigate(`/verify-email?token=${devToken}`)}
                  style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Verify Now
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => navigate(`/registration-status/${registeredReference}`)}
              style={{ flex: 1, padding: '12px 20px', borderRadius: 8, background: '#0284c7', color: '#ffffff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Track Status
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{ flex: 1, padding: '12px 20px', borderRadius: 8, background: '#e2e8f0', color: '#334155', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Stethoscope size={26} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>MEDORA 2.0</h1>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Healthcare Platform Registration</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
            {(form.organizationName || form.organizationEmail || step > 1) && (
              <>
                <button
                  type="button"
                  onClick={clearDraft}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 4,
                  }}
                  title="Wipe saved draft and start fresh"
                >
                  <RotateCcw size={13} /> Reset Form
                </button>
                <span style={{ color: '#cbd5e1' }}>•</span>
              </>
            )}
            <Link to="/registration-status" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}>
              Track Application
            </Link>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <Link to="/login" style={{ color: '#64748b', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>

        {/* Stepper Wizard Indicator */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            {[
              { num: 1, label: 'Facility Info' },
              { num: 2, label: 'Location & Contact' },
              { num: 3, label: 'Product Edition' },
              { num: 4, label: 'Initial Admin' },
              { num: 5, label: 'Review & Submit' },
            ].map((s) => {
              const isPast = step > s.num;
              const isCurrent = step === s.num;
              const isClickable = s.num < step;
              return (
                <div
                  key={s.num}
                  onClick={() => {
                    if (isClickable) setStep(s.num);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 1,
                    flex: 1,
                    cursor: isClickable ? 'pointer' : 'default',
                  }}
                  title={isClickable ? `Jump back to Step ${s.num}: ${s.label}` : undefined}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isPast ? '#10b981' : isCurrent ? '#0284c7' : '#f1f5f9',
                      color: isPast || isCurrent ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: 13,
                      marginBottom: 6,
                      transition: 'all 0.2s',
                    }}
                  >
                    {isPast ? <CheckCircle2 size={18} /> : s.num}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#0f172a' : '#64748b' }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8, color: '#991b1b', fontSize: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{error}</span>
            </div>
            {error.includes('Ref:') && (
              <div style={{ marginTop: 4 }}>
                {(() => {
                  const match = error.match(/Ref:\s*([A-Za-z0-9\-]+)/);
                  const ref = match ? match[1] : '';
                  if (!ref) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => navigate(`/registration-status/${ref}`)}
                      style={{
                        background: '#991b1b',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Track Existing Application Status ({ref}) →
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Wizard Form Container */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 32 }}>
          {/* STEP 1: Facility Info */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Healthcare Facility Profile
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                Enter the official operational identification for your medical facility.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Organization / Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al-Shifa Specialist Hospital & Research Institute"
                    value={form.organizationName}
                    onChange={(e) => updateField('organizationName', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Organization Type *
                  </label>
                  <select
                    value={form.organizationType}
                    onChange={(e) => updateField('organizationType', e.target.value as OrganizationType)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  >
                    <option value="CLINIC">Single Doctor Clinic / Day Center</option>
                    <option value="POLYCLINIC">Polyclinic / Multi-Specialty Clinic</option>
                    <option value="DIAGNOSTIC_CENTER">Diagnostic & Pathology Imaging Center</option>
                    <option value="HOSPITAL">General Hospital / Medical Center</option>
                    <option value="HOSPITAL_NETWORK">Multi-Branch Hospital Network</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Clinical Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cardiology, Orthopedics, General Surgery"
                    value={form.healthcareSpecialization}
                    onChange={(e) => updateField('healthcareSpecialization', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Healthcare License / Registration Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PHC-REG-2026-9912"
                    value={form.licenseNumber}
                    onChange={(e) => updateField('licenseNumber', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Official Website (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://alshifahospital.org"
                    value={form.website}
                    onChange={(e) => updateField('website', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Location & Contact */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Contact & Facility Location
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                Provide verified contact information for system notifications and primary facility geography.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Organization Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="info@alshifa.hospital"
                    value={form.organizationEmail}
                    onChange={(e) => updateField('organizationEmail', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Primary Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+92 51 9283741"
                    value={form.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Province / State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Punjab / Federal Capital"
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Islamabad / Lahore"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Postal Code
                  </label>
                  <input
                    type="text"
                    placeholder="44000"
                    value={form.postalCode}
                    onChange={(e) => updateField('postalCode', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Physical Address
                  </label>
                  <input
                    type="text"
                    placeholder="Plot 42, Sector G-8/3, Medical Enclave"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Product Edition Selection */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Requested Product Edition
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                Select the SaaS edition tailored to your healthcare clinical scope. (Super Admin confirms entitlements upon review).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {editions.map((ed) => {
                  const isSelected = form.requestedEdition === ed.id;
                  return (
                    <div
                      key={ed.id}
                      onClick={() => updateField('requestedEdition', ed.id)}
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        background: isSelected ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isSelected ? '#0369a1' : '#0f172a' }}>
                          {ed.title}
                        </h3>
                        <span style={{ fontSize: 11, fontWeight: 600, background: isSelected ? '#0284c7' : '#f1f5f9', color: isSelected ? '#ffffff' : '#64748b', padding: '3px 8px', borderRadius: 12 }}>
                          {ed.badge}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                        {ed.desc}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ed.modules.map((m) => (
                          <span key={m} style={{ fontSize: 11, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', color: '#334155' }}>
                            ✓ {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Initial Organization Administrator */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Initial Organization Administrator
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                Designate the platform administrator who will receive the invitation token to set up clinical teams.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Administrator Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ayesha Siddiqui"
                    value={form.adminFullName}
                    onChange={(e) => updateField('adminFullName', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Work Email (Receives Invitation) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ayesha.siddiqui@alshifa.hospital"
                    value={form.adminEmail}
                    onChange={(e) => updateField('adminEmail', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Direct Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+92 300 1234567"
                    value={form.adminPhone}
                    onChange={(e) => updateField('adminPhone', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chief Executive Officer / Medical Superintendent"
                    value={form.adminDesignation}
                    onChange={(e) => updateField('adminDesignation', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Review & Confirmation */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Review Application Details
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                Please verify all entered parameters before submitting to the Super Admin review queue.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Facility</h4>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{form.organizationName}</p>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#334155' }}>Type: {form.organizationType}</p>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#334155' }}>Specialization: {form.healthcareSpecialization || 'General'}</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>License: {form.licenseNumber || 'Pending verification'}</p>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Subscription & Location</h4>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0284c7' }}>{form.requestedEdition} Edition</p>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#334155' }}>City: {form.city}, {form.country}</p>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#334155' }}>Email: {form.organizationEmail}</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>Phone: {form.contactPhone}</p>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Initial Administrator Contact</h4>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{form.adminFullName}</p>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#334155' }}>Title: {form.adminDesignation}</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>Work Email: <strong>{form.adminEmail}</strong></p>
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, fontSize: 13, color: '#166534', marginBottom: 24 }}>
                ✓ By submitting this application, you declare that all organizational credentials and licenses provided are authentic.
              </div>

              {/* Step 5 Bottom Error Alert */}
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8, color: '#991b1b', fontSize: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <AlertCircle size={20} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{error}</span>
                  </div>
                  {error.includes('Ref:') && (
                    <div style={{ marginTop: 4 }}>
                      {(() => {
                        const match = error.match(/Ref:\s*([A-Za-z0-9\-]+)/);
                        const ref = match ? match[1] : '';
                        if (!ref) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => navigate(`/registration-status/${ref}`)}
                            style={{
                              background: '#991b1b',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 14px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Track Existing Application Status ({ref}) →
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stepper Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : <div />}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 28px',
                  borderRadius: 8,
                  border: 'none',
                  background: loading ? '#94a3b8' : '#10b981',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Submitting...' : 'Submit Application'} <CheckCircle2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
