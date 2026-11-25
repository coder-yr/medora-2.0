import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stethoscope,
  Save,
  CheckCircle2,
  Printer,
  AlertTriangle,
  Plus,
  Trash2,
  Pill,
  CreditCard,
  FileText,
  Activity,
  ClipboardList,
  ShieldAlert,
  Edit3,
  History,
  Lock,
  User,
  ExternalLink,
  ChevronRight,
  Eye,
  Check,
  FlaskConical,
} from 'lucide-react';
import type {
  VisitConsultationContext,
  SaveConsultationDto,
  ConsultTemplate,
  StructuredDiagnosis,
  ConsultationAmendmentItem,
  PatientClinicalChart,
} from '../../types/consultation';
import type { Appointment } from '../../types/appointment';
import type { MedicineItem } from '../../types/prescription';
import type { LabOrder, LabCategory } from '../../types/laboratory';

interface ConsultationWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  activeAppointment?: Appointment | null;
  onNavigateToBilling?: (patientId: string, doctorId?: string) => void;
}

export const ConsultationWorkspace: React.FC<ConsultationWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeAppointment,
  onNavigateToBilling,
}) => {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(
    activeAppointment ? String(activeAppointment.id) : ''
  );
  const [waitingAppointments, setWaitingAppointments] = useState<Appointment[]>([]);
  const [context, setContext] = useState<VisitConsultationContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active SOAP Tab
  const [activeTab, setActiveTab] = useState<'soap' | 'chart' | 'rx' | 'lab' | 'history'>('soap');

  // Laboratory State
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [labCatalogue, setLabCatalogue] = useState<LabCategory[]>([]);
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<number[]>([]);
  const [labPriority, setLabPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT'>('ROUTINE');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');
  const [labSearchQuery, setLabSearchQuery] = useState('');
  const [labLoading, setLabLoading] = useState(false);

  // Vitals State
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Live BMI calculation
  const liveBmi = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      const heightM = h / 100;
      return (w / (heightM * heightM)).toFixed(1);
    }
    return null;
  }, [weight, height]);

  const bmiCategory = useMemo(() => {
    if (!liveBmi) return null;
    const bmiNum = parseFloat(liveBmi);
    if (bmiNum < 18.5) return { label: 'Underweight', color: '#f59e0b' };
    if (bmiNum < 25.0) return { label: 'Normal Weight', color: '#16a34a' };
    if (bmiNum < 30.0) return { label: 'Overweight', color: '#ea580c' };
    return { label: 'Obese', color: '#dc2626' };
  }, [liveBmi]);

  // Allergies & NKDA
  const [allergyStatus, setAllergyStatus] = useState<'NKDA' | 'ALLERGIES_RECORDED' | 'UNKNOWN'>('UNKNOWN');
  const [allergies, setAllergies] = useState('');

  // S - Subjective State
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [chiefComplaintDetails, setChiefComplaintDetails] = useState({
    onset: '',
    duration: '',
    severity: 'Moderate',
    location: '',
  });
  const [historyNotes, setHistoryNotes] = useState('');
  const [hpiProgression, setHpiProgression] = useState('');
  const [hpiFactors, setHpiFactors] = useState('');
  const [soapSubjective, setSoapSubjective] = useState('');

  // O - Objective State
  const [physicalExam, setPhysicalExam] = useState<Record<string, { status: string; note: string }>>({
    general: { status: 'normal', note: 'Conscious, oriented, no distress' },
    respiratory: { status: 'normal', note: 'Vesicular breath sounds, no crackles/wheeze' },
    cardiovascular: { status: 'normal', note: 'S1 S2 normal, no murmurs' },
    abdomen: { status: 'normal', note: 'Soft, non-tender, no organomegaly' },
    cns: { status: 'normal', note: 'Grossly intact, pupils equal and reactive' },
    extremities: { status: 'normal', note: 'No pedal edema, peripheral pulses palpable' },
  });
  const [soapObjective, setSoapObjective] = useState('');

  // A - Assessment State
  const [diagnoses, setDiagnoses] = useState<StructuredDiagnosis[]>([]);
  const [newDiagType, setNewDiagType] = useState<'PRIMARY' | 'SECONDARY' | 'DIFFERENTIAL'>('PRIMARY');
  const [newDiagDesc, setNewDiagDesc] = useState('');
  const [newDiagCode, setNewDiagCode] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [soapAssessment, setSoapAssessment] = useState('');

  // P - Plan State
  const [plan, setPlan] = useState('');
  const [patientEducation, setPatientEducation] = useState('');
  const [soapPlan, setSoapPlan] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Prescription Items
  const [rxItems, setRxItems] = useState<MedicineItem[]>([
    { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' },
  ]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [activeCatalogRow, setActiveCatalogRow] = useState<number | null>(null);

  // Modals & Panels
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [amendSection, setAmendSection] = useState('GENERAL');
  const [amendNotes, setAmendNotes] = useState('');
  const [submittingAmend, setSubmittingAmend] = useState(false);

  // Clinical Chart Data
  const [clinicalChart, setClinicalChart] = useState<PatientClinicalChart | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  const isSigned = context?.consultation?.status === 'signed' || context?.consultation?.status === 'completed';

  // Fetch waiting appointments
  const fetchWaitingAppointments = useCallback(async () => {
    if (!token) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const url = new URL(`${apiBaseUrl}/api/v1/appointments`);
      url.searchParams.set('date', today);
      url.searchParams.set('limit', '50');
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data?.data)) {
        const waiting = data.data.data.filter(
          (a: Appointment) =>
            a.status === 'in consultation' ||
            a.status === 'arrived' ||
            a.status === 'waiting' ||
            a.status === 'scheduled' ||
            a.status === 'completed'
        );
        setWaitingAppointments(waiting);
        if (!selectedAppointmentId && waiting.length > 0) {
          setSelectedAppointmentId(String(waiting[0].id));
        }
      }
    } catch {
      // background
    }
  }, [token, apiBaseUrl, selectedAppointmentId]);

  useEffect(() => {
    fetchWaitingAppointments();
  }, [fetchWaitingAppointments]);

  useEffect(() => {
    if (activeAppointment) {
      setSelectedAppointmentId(String(activeAppointment.id));
    }
  }, [activeAppointment]);

  // Load visit context
  const fetchVisitContext = useCallback(async (aptId: string) => {
    if (!token || !aptId) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/consultations/visit/${aptId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const ctx: VisitConsultationContext = data.data;
        setContext(ctx);

        // Vitals
        const v = ctx.consultation.vitals || {};
        setBp(String(v.bp || ctx.visit.bp || ''));
        setPulse(String(v.pulse || ctx.visit.pulse || ''));
        setTemperature(String(v.temperature || ctx.visit.temperature || ''));
        setWeight(String(v.weight || ctx.visit.weight || ''));
        setHeight(String(v.height || ''));
        setRespiratoryRate(String(v.respiratoryRate || ''));
        setOxygenSaturation(String(v.oxygenSaturation || ''));

        // Allergy
        setAllergies(ctx.consultation.allergies || '');
        setAllergyStatus(ctx.consultation.allergyStatus || (ctx.consultation.allergies ? 'ALLERGIES_RECORDED' : 'UNKNOWN'));

        // S
        setPresentingComplaint(ctx.consultation.presentingComplaint || '');
        if (ctx.consultation.chiefComplaintDetails) {
          setChiefComplaintDetails({
            onset: ctx.consultation.chiefComplaintDetails.onset || '',
            duration: ctx.consultation.chiefComplaintDetails.duration || '',
            severity: ctx.consultation.chiefComplaintDetails.severity || 'Moderate',
            location: ctx.consultation.chiefComplaintDetails.location || '',
          });
        }
        setHistoryNotes(ctx.consultation.history || '');
        if (ctx.consultation.hpiDetails) {
          setHpiProgression(ctx.consultation.hpiDetails.progression || '');
          setHpiFactors(ctx.consultation.hpiDetails.factors || '');
        }
        setSoapSubjective(ctx.consultation.soapSubjective || '');

        // O
        if (ctx.consultation.examination && typeof ctx.consultation.examination === 'object') {
          setPhysicalExam((prev) => ({ ...prev, ...(ctx.consultation.examination as any) }));
        }
        setSoapObjective(ctx.consultation.soapObjective || '');

        // A
        setProvisionalDiagnosis(ctx.consultation.provisionalDiagnosis || '');
        setDiagnosis(ctx.consultation.diagnosis || '');
        if (Array.isArray(ctx.consultation.diagnoses)) {
          setDiagnoses(ctx.consultation.diagnoses);
        } else if (ctx.consultation.diagnosis) {
          setDiagnoses([{ type: 'PRIMARY', description: ctx.consultation.diagnosis }]);
        }
        setSoapAssessment(ctx.consultation.soapAssessment || '');

        // P
        setPlan(ctx.consultation.plan || '');
        if (ctx.consultation.treatmentPlan) {
          setPatientEducation(ctx.consultation.treatmentPlan.patientEducation || '');
        }
        setSoapPlan(ctx.consultation.soapPlan || '');
        setFollowUpDate(ctx.consultation.followUpDate || '');
        setFollowUpNotes(ctx.consultation.followUpNotes || '');
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Unable to load clinical encounter context.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error connecting to consultation service.' });
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    if (selectedAppointmentId) {
      fetchVisitContext(selectedAppointmentId);
    }
  }, [selectedAppointmentId, fetchVisitContext]);

  // Load Patient Clinical Chart
  const fetchPatientChart = useCallback(async (patientId: string) => {
    if (!token || !patientId) return;
    setChartLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/consultations/patient/${patientId}/chart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setClinicalChart(data.data);
      }
    } catch {
      // background
    } finally {
      setChartLoading(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    if (context?.patient?.id && activeTab === 'chart') {
      fetchPatientChart(context.patient.id);
    }
  }, [context?.patient?.id, activeTab, fetchPatientChart]);

  // Laboratory Fetcher
  const fetchLabData = useCallback(async (patientId: string | number) => {
    try {
      setLabLoading(true);
      const [ordersRes, catRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/lab/orders?patientId=${patientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/v1/lab/catalogue?isActive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setLabOrders(Array.isArray(oData.items) ? oData.items : Array.isArray(oData.data) ? oData.data : []);
      }
      if (catRes.ok) {
        const cData = await catRes.json();
        setLabCatalogue(Array.isArray(cData) ? cData : Array.isArray(cData.data) ? cData.data : []);
      }
    } catch (err) {
      console.error('Error fetching lab data in consultation:', err);
    } finally {
      setLabLoading(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    if (context?.patient?.id && activeTab === 'lab') {
      fetchLabData(context.patient.id);
    }
  }, [context?.patient?.id, activeTab, fetchLabData]);

  const handleCreateLabOrder = async () => {
    if (!selectedLabTestIds.length) {
      setNotification({ type: 'error', message: 'Please select at least one laboratory test.' });
      return;
    }
    try {
      setLabLoading(true);
      const res = await fetch(`${apiBaseUrl}/api/v1/lab/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: Number(context?.patient?.id),
          doctorId: context?.doctor?.id ? Number(context.doctor.id) : undefined,
          appointmentId: context?.appointment?.id ? Number(context.appointment.id) : undefined,
          consultationId: context?.consultation?.id ? Number(context.consultation.id) : undefined,
          priority: labPriority,
          clinicalNotes: labClinicalNotes.trim() || undefined,
          testIds: selectedLabTestIds,
          generateInvoice: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ type: 'success', message: `Lab order ${data.orderNumber || ''} created successfully!` });
        setSelectedLabTestIds([]);
        setLabClinicalNotes('');
        if (context?.patient?.id) {
          fetchLabData(context.patient.id);
        }
      } else {
        setNotification({ type: 'error', message: data.message || 'Failed to create lab order' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error creating lab order' });
    } finally {
      setLabLoading(false);
    }
  };

  // Medicine Search with Debounce
  useEffect(() => {
    if (!token || !catalogQuery.trim() || activeCatalogRow === null) {
      setCatalogResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/prescriptions/medicines/search?q=${encodeURIComponent(catalogQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setCatalogResults(data.data);
        }
      } catch {
        setCatalogResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [catalogQuery, token, activeCatalogRow, apiBaseUrl]);

  const addRxItem = () => {
    setRxItems([...rxItems, { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' }]);
  };

  const removeRxItem = (idx: number) => {
    if (rxItems.length > 1) {
      setRxItems(rxItems.filter((_, i) => i !== idx));
    }
  };

  const updateRxItem = (idx: number, field: keyof MedicineItem, val: any) => {
    const next = [...rxItems];
    next[idx] = { ...next[idx], [field]: val };
    setRxItems(next);
  };

  const selectMedicine = (idx: number, med: { id: string | number; name: string }) => {
    updateRxItem(idx, 'medicineId', Number(med.id));
    updateRxItem(idx, 'name', med.name);
    setCatalogQuery('');
    setCatalogResults([]);
    setActiveCatalogRow(null);
  };

  // Structured Diagnosis handling
  const handleAddDiagnosis = () => {
    if (!newDiagDesc.trim()) return;
    setDiagnoses([
      ...diagnoses,
      {
        type: newDiagType,
        description: newDiagDesc.trim(),
        code: newDiagCode.trim() || undefined,
        status: 'CONFIRMED',
      },
    ]);
    if (newDiagType === 'PRIMARY' && !diagnosis) {
      setDiagnosis(newDiagDesc.trim());
    }
    setNewDiagDesc('');
    setNewDiagCode('');
  };

  const handleRemoveDiagnosis = (idx: number) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== idx));
  };

  const handleApplyTemplate = (tpl: ConsultTemplate) => {
    if (tpl.fields.presenting_complaint) setPresentingComplaint(tpl.fields.presenting_complaint);
    if (tpl.fields.history) setHistoryNotes(tpl.fields.history);
    if (tpl.fields.provisional_diagnosis) setProvisionalDiagnosis(tpl.fields.provisional_diagnosis);
    if (tpl.fields.diagnosis) setDiagnosis(tpl.fields.diagnosis);
    if (tpl.fields.plan) setPlan(tpl.fields.plan);
  };

  // Handle Save / Sign
  const handleSave = async (action: 'draft' | 'sign') => {
    if (!selectedAppointmentId) return;
    setSaving(true);
    setNotification(null);

    try {
      const payload: SaveConsultationDto = {
        action,
        b_p: bp.trim() || undefined,
        pulse: pulse.trim() || undefined,
        temprature: temperature.trim() || undefined,
        weight: weight.trim() || undefined,
        presenting_complaint: presentingComplaint.trim() || undefined,
        history: historyNotes.trim() || undefined,
        provisional_diagnosis: provisionalDiagnosis.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        plan: plan.trim() || undefined,
        allergies: allergyStatus === 'NKDA' ? 'NKDA' : allergies.trim() || undefined,
        allergy_status: allergyStatus,
        follow_up_date: followUpDate || undefined,
        follow_up_notes: followUpNotes.trim() || undefined,

        soap_subjective: soapSubjective.trim() || undefined,
        soap_objective: soapObjective.trim() || undefined,
        soap_assessment: soapAssessment.trim() || undefined,
        soap_plan: soapPlan.trim() || undefined,
        chief_complaint_details: chiefComplaintDetails,
        hpi_details: { progression: hpiProgression, factors: hpiFactors },
        vitals: {
          bp: bp.trim() || undefined,
          pulse: pulse.trim() || undefined,
          temperature: temperature.trim() || undefined,
          respiratoryRate: respiratoryRate.trim() || undefined,
          oxygenSaturation: oxygenSaturation.trim() || undefined,
          height: height.trim() || undefined,
          weight: weight.trim() || undefined,
          bmi: liveBmi || undefined,
        },
        exam: physicalExam,
        diagnoses: diagnoses.length > 0 ? diagnoses : undefined,
        treatment_plan: {
          planNotes: plan.trim() || undefined,
          patientEducation: patientEducation.trim() || undefined,
        },
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/consultations/visit/${selectedAppointmentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Save Rx items if present
        const validRxItems = rxItems.filter((i) => i.name.trim().length > 0);
        if (validRxItems.length > 0 && context) {
          try {
            await fetch(`${apiBaseUrl}/api/v1/prescriptions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                patientId: Number(context.patient.id),
                doctorId: context.doctor?.id ? Number(context.doctor.id) : 1,
                consultationId: Number(data.data.id),
                status: signImmediately ? 'SIGNED' : 'DRAFT',
                signImmediately: Boolean(signImmediately),
                date: new Date().toISOString().split('T')[0],
                symptom: presentingComplaint,
                advice: plan,
                items: validRxItems.map((i) => ({
                  medicineId: i.medicineId ? Number(i.medicineId) : undefined,
                  name: i.name.trim(),
                  dosage: i.dosage,
                  duration: i.duration,
                  instructions: i.instructions,
                  quantityPrescribed: Number(i.quantityPrescribed) || 1,
                  unit: i.unit || 'tablets',
                  route: i.route || 'Oral',
                  frequency: i.frequency || 'BD',
                  timing: i.timing || 'After food',
                  refills: Number(i.refills) || 0,
                })),
              }),
            });
          } catch {
            // background
          }
        }

        setNotification({
          type: 'success',
          message:
            action === 'sign'
              ? 'Consultation note digitally signed & locked. Encounter completed.'
              : 'Consultation draft saved successfully.',
        });
        fetchVisitContext(selectedAppointmentId);
      } else {
        const msg = data.error?.message || data.message || 'Failed to save consultation.';
        setNotification({ type: 'error', message: Array.isArray(msg) ? msg.join(', ') : msg });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network communication error.' });
    } finally {
      setSaving(false);
    }
  };

  // Submit Amendment
  const handleAmendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!context?.consultation?.id || !amendReason.trim() || !amendNotes.trim()) return;
    setSubmittingAmend(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/consultations/${context.consultation.id}/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: amendReason.trim(),
          amendedSection: amendSection,
          newNotes: amendNotes.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: 'Clinical amendment recorded into permanent audit trail.',
        });
        setShowAmendModal(false);
        setAmendReason('');
        setAmendNotes('');
        fetchVisitContext(selectedAppointmentId);
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Failed to record amendment.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error saving amendment.' });
    } finally {
      setSubmittingAmend(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top Header & Patient Queue Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={22} style={{ color: '#0284c7' }} />
            Doctor Clinical Workspace & SOAP EHR
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Outpatient Clinical Encounters, Structured SOAP Documentation, Vitals BMI, & Digital Sign-off
          </p>
        </div>

        {/* Visit Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Active Encounter:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px', fontWeight: 600 }}
            value={selectedAppointmentId}
            onChange={(e) => setSelectedAppointmentId(e.target.value)}
          >
            {waitingAppointments.length === 0 ? (
              <option value="">No waiting patients today</option>
            ) : (
              waitingAppointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.timeSlot || 'Visit'} — {a.patient?.name || `Patient #${a.patientId}`} [{a.status}]
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {notification && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 8,
            background: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: notification.type === 'success' ? '#166534' : '#b91c1c',
            fontSize: 13,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading clinical encounter context...
        </div>
      ) : !context ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Please select a waiting patient encounter from the dropdown above to begin clinical documentation.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Patient Header Banner with Prominent Allergy Alert */}
          <div className="card" style={{ background: '#f8fafc', borderLeft: '4px solid #0284c7', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                  {context.patient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{context.patient.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span className="badge badge-success">MRN #{context.patient.patientId || context.patient.id}</span>
                    <span>{context.patient.age ? `${context.patient.age} yrs` : ''} {context.patient.sex || ''}</span>
                    {context.patient.phone && <span>• Phone: {context.patient.phone}</span>}
                  </div>
                </div>
              </div>

              {/* Prominent Allergy Status Badge & Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {allergyStatus === 'NKDA' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#dcfce7', color: '#166534', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
                    <Check size={16} />
                    <span>NKDA: No Known Drug Allergies</span>
                  </div>
                ) : allergyStatus === 'ALLERGIES_RECORDED' || allergies ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13, fontWeight: 700, border: '1px solid #f87171' }}>
                    <ShieldAlert size={16} />
                    <span>ALLERGY ALERT: {allergies || 'Active Allergies Documented'}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                    <AlertTriangle size={16} />
                    <span>Allergy Status Unconfirmed</span>
                  </div>
                )}

                {/* Signed Status Badge */}
                {isSigned && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    <Lock size={14} />
                    <span>Digitally Signed ({context.consultation.signedAt ? new Date(context.consultation.signedAt).toLocaleDateString() : 'Signed'})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Locked Status Notice if Signed */}
          {isSigned && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 13, color: '#0369a1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={16} />
                <span>
                  <strong>Clinical Record Immutable:</strong> This consultation was finalized and signed by{' '}
                  {context.consultation.signedBy?.name || 'Attending Physician'}. Addenda can only be recorded via auditable amendments.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px', background: '#fff' }}
                onClick={() => setShowAmendModal(true)}
              >
                <Edit3 size={14} /> Add Amendment / Addendum
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: 12 }}>
            <button
              type="button"
              onClick={() => setActiveTab('soap')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'soap' ? '3px solid #0284c7' : '3px solid transparent',
                color: activeTab === 'soap' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ClipboardList size={16} /> SOAP Clinical Note
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rx')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'rx' ? '3px solid #0284c7' : '3px solid transparent',
                color: activeTab === 'rx' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Pill size={16} /> Prescriptions (Rx)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lab')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'lab' ? '3px solid #0284c7' : '3px solid transparent',
                color: activeTab === 'lab' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FlaskConical size={16} /> Lab Investigations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'chart' ? '3px solid #0284c7' : '3px solid transparent',
                color: activeTab === 'chart' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FileText size={16} /> Consolidated Patient Chart
            </button>
            {context.consultation.amendments && context.consultation.amendments.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'history' ? '3px solid #0284c7' : '3px solid transparent',
                  color: activeTab === 'history' ? '#0284c7' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <History size={16} /> Amendments Audit ({context.consultation.amendments.length})
              </button>
            )}
          </div>

          {/* TAB 1: SOAP CLINICAL NOTE */}
          {activeTab === 'soap' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Vitals Intake Card with Live BMI */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={16} style={{ color: '#0284c7' }} />
                    Objective Vitals & Triage (Auto-Calculated BMI)
                  </h4>
                  {liveBmi && bmiCategory && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                      <span>BMI: {liveBmi} kg/m²</span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: `${bmiCategory.color}22`, color: bmiCategory.color }}>
                        {bmiCategory.label}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Blood Pressure</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="120/80"
                      disabled={isSigned}
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Pulse (bpm)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="72"
                      disabled={isSigned}
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Resp. Rate (/min)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="16"
                      disabled={isSigned}
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Temperature (°F)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="98.6"
                      disabled={isSigned}
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>SpO2 (%)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="98"
                      disabled={isSigned}
                      value={oxygenSaturation}
                      onChange={(e) => setOxygenSaturation(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Height (cm)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="175"
                      disabled={isSigned}
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Weight (kg)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="70"
                      disabled={isSigned}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* S: SUBJECTIVE PANEL */}
              <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#1e40af' }}>
                  S — Subjective (Symptoms, Chief Complaint & HPI)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Primary Chief Complaint *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dry cough and fever"
                      disabled={isSigned}
                      value={presentingComplaint}
                      onChange={(e) => setPresentingComplaint(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Symptom Onset</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 3 days ago"
                      disabled={isSigned}
                      value={chiefComplaintDetails.onset}
                      onChange={(e) => setChiefComplaintDetails({ ...chiefComplaintDetails, onset: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Duration</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Continuous"
                      disabled={isSigned}
                      value={chiefComplaintDetails.duration}
                      onChange={(e) => setChiefComplaintDetails({ ...chiefComplaintDetails, duration: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Severity</label>
                    <select
                      className="form-select"
                      disabled={isSigned}
                      value={chiefComplaintDetails.severity}
                      onChange={(e) => setChiefComplaintDetails({ ...chiefComplaintDetails, severity: e.target.value })}
                    >
                      <option value="Mild">Mild</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Severe">Severe</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Allergy Confirmation Selector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Allergy Status</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={isSigned}
                        className={`btn ${allergyStatus === 'NKDA' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => {
                          setAllergyStatus('NKDA');
                          setAllergies('NKDA');
                        }}
                      >
                        ✓ NKDA
                      </button>
                      <button
                        type="button"
                        disabled={isSigned}
                        className={`btn ${allergyStatus === 'ALLERGIES_RECORDED' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11, padding: '4px 8px', color: allergyStatus === 'ALLERGIES_RECORDED' ? '#fff' : '#b91c1c' }}
                        onClick={() => setAllergyStatus('ALLERGIES_RECORDED')}
                      >
                        ⚠ Allergies
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>Specific Drug / Food Allergies</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Penicillin (rash), Aspirin (dyspnea)"
                      disabled={isSigned || allergyStatus === 'NKDA'}
                      value={allergies}
                      onChange={(e) => {
                        setAllergies(e.target.value);
                        if (e.target.value.trim() && allergyStatus !== 'ALLERGIES_RECORDED') {
                          setAllergyStatus('ALLERGIES_RECORDED');
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>SOAP Subjective Clinical Narrative</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Comprehensive patient narrative: symptom progression, aggravating/relieving factors, previous self-treatment..."
                    disabled={isSigned}
                    value={soapSubjective || historyNotes}
                    onChange={(e) => {
                      setSoapSubjective(e.target.value);
                      setHistoryNotes(e.target.value);
                    }}
                  />
                </div>
              </div>

              {/* O: OBJECTIVE PANEL */}
              <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#047857' }}>
                  O — Objective (Physical Examination & System Findings)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  {Object.entries(physicalExam).map(([systemKey, val]) => (
                    <div key={systemKey} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{systemKey}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            disabled={isSigned}
                            style={{
                              padding: '2px 6px',
                              fontSize: 10,
                              borderRadius: 4,
                              background: val.status === 'normal' ? '#dcfce7' : '#f1f5f9',
                              color: val.status === 'normal' ? '#166534' : '#64748b',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setPhysicalExam({
                                ...physicalExam,
                                [systemKey]: { ...val, status: 'normal' },
                              })
                            }
                          >
                            Normal
                          </button>
                          <button
                            type="button"
                            disabled={isSigned}
                            style={{
                              padding: '2px 6px',
                              fontSize: 10,
                              borderRadius: 4,
                              background: val.status === 'abnormal' ? '#fee2e2' : '#f1f5f9',
                              color: val.status === 'abnormal' ? '#991b1b' : '#64748b',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setPhysicalExam({
                                ...physicalExam,
                                [systemKey]: { ...val, status: 'abnormal' },
                              })
                            }
                          >
                            Abnormal
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        disabled={isSigned}
                        value={val.note}
                        onChange={(e) =>
                          setPhysicalExam({
                            ...physicalExam,
                            [systemKey]: { ...val, note: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>SOAP Objective Narrative & Additional Observations</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Additional clinical findings, local examination, auscultation notes..."
                    disabled={isSigned}
                    value={soapObjective}
                    onChange={(e) => setSoapObjective(e.target.value)}
                  />
                </div>
              </div>

              {/* A: ASSESSMENT PANEL */}
              <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#b45309' }}>
                  A — Assessment & Structured Diagnoses
                </h4>

                {/* Add Diagnosis Bar */}
                {!isSigned && (
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px auto', gap: 10, marginBottom: 14 }}>
                    <select
                      className="form-select"
                      style={{ fontSize: 12 }}
                      value={newDiagType}
                      onChange={(e) => setNewDiagType(e.target.value as any)}
                    >
                      <option value="PRIMARY">PRIMARY</option>
                      <option value="SECONDARY">SECONDARY</option>
                      <option value="DIFFERENTIAL">DIFFERENTIAL</option>
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Diagnosis description (e.g. Acute Bronchitis)..."
                      style={{ fontSize: 12 }}
                      value={newDiagDesc}
                      onChange={(e) => setNewDiagDesc(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDiagnosis();
                        }
                      }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ICD-10 (e.g. J20.9)"
                      style={{ fontSize: 12 }}
                      value={newDiagCode}
                      onChange={(e) => setNewDiagCode(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={handleAddDiagnosis}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                )}

                {/* Diagnoses List */}
                {diagnoses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {diagnoses.map((d, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: 'var(--bg-subtle)',
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: d.type === 'PRIMARY' ? '#dbeafe' : d.type === 'SECONDARY' ? '#f3e8ff' : '#fef3c7',
                              color: d.type === 'PRIMARY' ? '#1e40af' : d.type === 'SECONDARY' ? '#6b21a8' : '#92400e',
                            }}
                          >
                            {d.type}
                          </span>
                          <strong>{d.description}</strong>
                          {d.code && <span style={{ color: 'var(--text-muted)' }}>[{d.code}]</span>}
                        </div>
                        {!isSigned && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDiagnosis(idx)}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 12px 0' }}>
                    No structured diagnoses recorded yet. Add primary, secondary, or differential diagnoses above.
                  </p>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>SOAP Assessment & Clinical Reasoning</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Diagnostic rationale, differential reasoning, response to prior therapy..."
                    disabled={isSigned}
                    value={soapAssessment || provisionalDiagnosis}
                    onChange={(e) => {
                      setSoapAssessment(e.target.value);
                      setProvisionalDiagnosis(e.target.value);
                    }}
                  />
                </div>
              </div>

              {/* P: PLAN PANEL */}
              <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#6d28d9' }}>
                  P — Plan & Patient Education
                </h4>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Clinical Management & Investigation Plan *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Investigations ordered (CBC, X-ray), diet instructions, hydration, rest..."
                    disabled={isSigned}
                    value={plan}
                    onChange={(e) => {
                      setPlan(e.target.value);
                      setSoapPlan(e.target.value);
                    }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Patient Education & Red Flag Warnings</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Safety netting instructions: return immediately if chest pain, high fever > 48h, breathlessness..."
                    disabled={isSigned}
                    value={patientEducation}
                    onChange={(e) => setPatientEducation(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRESCRIPTIONS (Rx) */}
          {activeTab === 'rx' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pill size={16} style={{ color: '#0284c7' }} />
                  Prescribed Medications (Rx)
                </h4>
                {!isSigned && (
                  <button type="button" className="btn btn-secondary" onClick={addRxItem} style={{ fontSize: 12 }}>
                    <Plus size={14} /> Add Medicine
                  </button>
                )}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Medicine Name</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: 140 }}>Dosage</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: 120 }}>Duration</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Instructions</th>
                    <th style={{ padding: '8px 12px', width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rxItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', position: 'relative' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search medicine catalog..."
                          disabled={isSigned}
                          value={item.name}
                          onChange={(e) => {
                            updateRxItem(idx, 'name', e.target.value);
                            setCatalogQuery(e.target.value);
                            setActiveCatalogRow(idx);
                          }}
                        />
                        {activeCatalogRow === idx && catalogResults.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 12,
                            right: 12,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 20,
                            maxHeight: 160,
                            overflowY: 'auto'
                          }}>
                            {catalogResults.map((med) => (
                              <div
                                key={med.id}
                                onClick={() => selectMedicine(idx, med)}
                                style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 12 }}
                              >
                                <strong>{med.name}</strong> <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{med.genericName || ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={item.dosage}
                          placeholder="1+0+1"
                          disabled={isSigned}
                          onChange={(e) => updateRxItem(idx, 'dosage', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={item.duration}
                          placeholder="5 days"
                          disabled={isSigned}
                          onChange={(e) => updateRxItem(idx, 'duration', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={item.instructions}
                          placeholder="After meals"
                          disabled={isSigned}
                          onChange={(e) => updateRxItem(idx, 'instructions', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {!isSigned && rxItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRxItem(idx)}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: LABORATORY & INVESTIGATIONS */}
          {activeTab === 'lab' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Card 1: Order New Diagnostic Tests */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FlaskConical size={16} style={{ color: '#0284c7' }} />
                    Order Laboratory Diagnostic Tests
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Priority:</span>
                    {(['ROUTINE', 'URGENT', 'STAT'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLabPriority(p)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: labPriority === p
                            ? p === 'STAT' ? '#dc2626' : p === 'URGENT' ? '#ea580c' : '#0284c7'
                            : 'var(--bg-subtle)',
                          color: labPriority === p ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {!isSigned ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search test catalogue by name, code, or department (e.g. CBC, Liver, Serum)..."
                        value={labSearchQuery}
                        onChange={(e) => setLabSearchQuery(e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                    </div>

                    <div style={{
                      maxHeight: 220,
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: 8,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: 8,
                    }}>
                      {labCatalogue
                        .filter((t) => {
                          if (!labSearchQuery.trim()) return true;
                          const q = labSearchQuery.toLowerCase();
                          return (
                            t.category.toLowerCase().includes(q) ||
                            (t.code && t.code.toLowerCase().includes(q)) ||
                            (t.department && t.department.toLowerCase().includes(q))
                          );
                        })
                        .map((test) => {
                          const isSelected = selectedLabTestIds.includes(Number(test.id));
                          return (
                            <div
                              key={test.id}
                              onClick={() => {
                                setSelectedLabTestIds((prev) =>
                                  prev.includes(Number(test.id))
                                    ? prev.filter((id) => id !== Number(test.id))
                                    : [...prev, Number(test.id)]
                                );
                              }}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: isSelected ? '2px solid #0284c7' : '1px solid var(--border-color)',
                                background: isSelected ? '#f0f9ff' : 'var(--bg-card)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                                  {test.category}
                                  {test.code && (
                                    <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                                      {test.code}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {test.sampleType || 'Specimen'} {test.department ? `• ${test.department}` : ''}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>
                                  {test.price ? `₹${Number(test.price).toFixed(0)}` : 'Included'}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }} // Controlled by parent div
                                  style={{ marginTop: 4 }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Clinical indication / provisional diagnosis notes for laboratory..."
                          value={labClinicalNotes}
                          onChange={(e) => setLabClinicalNotes(e.target.value)}
                          style={{ fontSize: 13 }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={labLoading || selectedLabTestIds.length === 0}
                        onClick={handleCreateLabOrder}
                        style={{ fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <FlaskConical size={14} /> Place Lab Requisition ({selectedLabTestIds.length})
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                    This clinical encounter note is digitally signed. New laboratory requisitions can be raised through the main Laboratory workspace.
                  </div>
                )}
              </div>

              {/* Card 2: Requisitioned Lab Orders for this Patient */}
              <div className="card">
                <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={16} style={{ color: '#16a34a' }} />
                  Requisitioned Diagnostic Tests & Results
                </h4>

                {labOrders.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No laboratory investigations requisitioned for this patient.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {labOrders.map((order) => (
                      <div
                        key={order.id}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: 14,
                          background: 'var(--bg-card)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{order.orderNumber}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.date}</span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: 10,
                                fontWeight: 700,
                                background: order.priority === 'STAT' ? '#fef2f2' : order.priority === 'URGENT' ? '#fff7ed' : '#f0f9ff',
                                color: order.priority === 'STAT' ? '#dc2626' : order.priority === 'URGENT' ? '#ea580c' : '#0284c7',
                              }}
                            >
                              {order.priority}
                            </span>
                          </div>
                          <div>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background:
                                  order.status === 'COMPLETED' || order.status === 'reported' ? '#dcfce7'
                                    : order.status === 'VERIFIED' ? '#f3e8ff'
                                      : order.status === 'RESULT_ENTERED' ? '#dbeafe'
                                        : order.status === 'CANCELLED' ? '#f1f5f9'
                                          : '#fef3c7',
                                color:
                                  order.status === 'COMPLETED' || order.status === 'reported' ? '#166534'
                                    : order.status === 'VERIFIED' ? '#6b21a8'
                                      : order.status === 'RESULT_ENTERED' ? '#1e40af'
                                        : order.status === 'CANCELLED' ? '#475569'
                                          : '#92400e',
                              }}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {order.tests && order.tests.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {order.tests.map((test) => (
                              <div key={test.id} style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                                  {test.name}
                                  {test.status && (
                                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                                      ({test.status})
                                    </span>
                                  )}
                                </div>
                                {test.resultParameters && test.resultParameters.length > 0 && (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
                                    <thead>
                                      <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Parameter</th>
                                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Reading</th>
                                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Unit</th>
                                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Reference Range</th>
                                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Evaluation</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {test.resultParameters.map((param) => {
                                        const isAbnormal = ['HIGH', 'LOW', 'CRITICAL', 'CRITICAL_LOW', 'CRITICAL_HIGH', 'REACTIVE'].includes(param.abnormalFlag);
                                        return (
                                          <tr key={param.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '4px 8px', fontWeight: 500 }}>{param.parameterName}</td>
                                            <td style={{ padding: '4px 8px', fontWeight: 700, color: isAbnormal ? '#dc2626' : 'var(--text-main)' }}>
                                              {param.value || 'Pending'}
                                            </td>
                                            <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{param.unitSnapshot || '-'}</td>
                                            <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{param.referenceRangeSnapshot || '-'}</td>
                                            <td style={{ padding: '4px 8px' }}>
                                              <span
                                                style={{
                                                  padding: '1px 6px',
                                                  borderRadius: 4,
                                                  fontSize: 10,
                                                  fontWeight: 700,
                                                  background:
                                                    param.abnormalFlag === 'NORMAL' ? '#dcfce7'
                                                      : param.abnormalFlag.includes('CRITICAL') ? '#fee2e2'
                                                        : '#fef3c7',
                                                  color:
                                                    param.abnormalFlag === 'NORMAL' ? '#166534'
                                                      : param.abnormalFlag.includes('CRITICAL') ? '#991b1b'
                                                        : '#92400e',
                                                }}
                                              >
                                                {param.abnormalFlag}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONSOLIDATED PATIENT CLINICAL CHART */}
          {activeTab === 'chart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {chartLoading ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading consolidated patient clinical chart...
                </div>
              ) : !clinicalChart ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No historical clinical chart data available.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Left Column: Demographics & History */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card">
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                        DEMOGRAPHIC OVERVIEW
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                        <div><strong>MRN:</strong> #{clinicalChart.patient.patientId || clinicalChart.patient.id}</div>
                        <div><strong>Blood Group:</strong> {clinicalChart.patient.bloodGroup || 'Not recorded'}</div>
                        <div><strong>Age / Sex:</strong> {clinicalChart.patient.age || '--'} yrs / {clinicalChart.patient.sex || '--'}</div>
                        <div><strong>Phone:</strong> {clinicalChart.patient.phone || '--'}</div>
                        {clinicalChart.patient.emergencyContactName && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <strong>Emergency Contact:</strong> {clinicalChart.patient.emergencyContactName} ({clinicalChart.patient.emergencyContactPhone || ''})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="card">
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                        MEDICAL & SURGICAL HISTORY
                      </h4>
                      <div style={{ fontSize: 13 }}>
                        <p style={{ margin: '0 0 6px 0' }}>
                          <strong>Medical Conditions:</strong>{' '}
                          {clinicalChart.history.medicalConditions
                            ? JSON.stringify(clinicalChart.history.medicalConditions)
                            : 'None reported'}
                        </p>
                        <p style={{ margin: '0 0 6px 0' }}>
                          <strong>Surgical History:</strong>{' '}
                          {clinicalChart.history.surgicalHistory
                            ? JSON.stringify(clinicalChart.history.surgicalHistory)
                            : 'None reported'}
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Family History:</strong>{' '}
                          {clinicalChart.history.familyHistory
                            ? JSON.stringify(clinicalChart.history.familyHistory)
                            : 'Non-contributory'}
                        </p>
                      </div>
                    </div>

                    <div className="card">
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                        HISTORICAL DIAGNOSES
                      </h4>
                      {clinicalChart.diagnoses.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                          {clinicalChart.diagnoses.map((d, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>
                              <strong>{d.description}</strong> {d.code && `(${d.code})`}{' '}
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                — {d.diagnosedDate || 'Past visit'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No previous diagnoses recorded.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Encounters & Investigations */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card">
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                        PAST CONSULTATIONS & NOTES
                      </h4>
                      {clinicalChart.consultations.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {clinicalChart.consultations.slice(0, 5).map((c) => (
                            <div key={c.id} style={{ padding: 8, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span>{c.date} — {c.doctor?.name || 'Doctor'}</span>
                                <span className={`badge ${c.status === 'signed' ? 'badge-success' : 'badge-warning'}`}>
                                  {c.status}
                                </span>
                              </div>
                              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
                                {c.diagnosis || c.presentingComplaint || 'General follow-up'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No previous consultations found.</p>
                      )}
                    </div>

                    <div className="card">
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                        LABORATORY & RADIOLOGY ORDERS
                      </h4>
                      <div style={{ fontSize: 13 }}>
                        <p style={{ margin: '0 0 6px 0' }}>
                          <strong>Lab Tests:</strong> {clinicalChart.labResults.length} orders on file
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Radiology:</strong> {clinicalChart.radiologyReports.length} imaging reports on file
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDITABLE AMENDMENTS AUDIT */}
          {activeTab === 'history' && context.consultation.amendments && (
            <div className="card">
              <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={16} style={{ color: '#0284c7' }} />
                Permanent Clinical Amendments Audit Log
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {context.consultation.amendments.map((a) => (
                  <div key={a.id} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span>
                        <strong>Amended Section:</strong> <span className="badge badge-info">{a.amendedSection}</span>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(a.createdAt).toLocaleString()} by {a.amendedByName || `User #${a.amendedBy}`}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      <strong>Reason for Amendment:</strong> {a.reason}
                    </div>
                    <div style={{ fontSize: 13, background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                      <strong>Addendum Note:</strong> {a.newNotes}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar & Follow-up */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Follow-up Date:</span>
                <input
                  type="date"
                  className="form-input"
                  disabled={isSigned}
                  style={{ width: 'auto', padding: '6px 10px' }}
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Follow-up instructions..."
                disabled={isSigned}
                style={{ width: 240 }}
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPrintModal(true)}
              >
                <Printer size={16} /> Print Note
              </button>

              {onNavigateToBilling && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: '#16a34a' }}
                  onClick={() => onNavigateToBilling(context.patient.id, context.doctor?.id)}
                >
                  <CreditCard size={16} /> Bill Patient
                </button>
              )}

              {!isSigned ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSave('draft')}
                    disabled={saving}
                  >
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (window.confirm('Digitally sign and lock this consultation note? Once signed, changes require an auditable amendment.')) {
                        handleSave('sign');
                      }
                    }}
                    disabled={saving}
                  >
                    <CheckCircle2 size={16} /> {saving ? 'Signing...' : 'Sign & Complete'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowAmendModal(true)}
                >
                  <Edit3 size={16} /> Amend Consultation
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AMENDMENT MODAL */}
      {showAmendModal && context?.consultation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 540, width: '100%', background: '#fff', color: '#000', padding: 24 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit3 size={20} style={{ color: '#0284c7' }} />
              Amend Signed Clinical Note
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
              In accordance with medical record standards, signed clinical notes cannot be overwritten. Addenda are permanently appended to the auditable chart history.
            </p>

            <form onSubmit={handleAmendSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Amended Section *</label>
                <select
                  className="form-select"
                  value={amendSection}
                  onChange={(e) => setAmendSection(e.target.value)}
                >
                  <option value="GENERAL">General Addendum</option>
                  <option value="SUBJECTIVE">Subjective / History</option>
                  <option value="OBJECTIVE">Objective / Examination / Vitals</option>
                  <option value="ASSESSMENT">Assessment / Diagnosis</option>
                  <option value="PLAN">Management Plan / Rx</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Reason for Amendment *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Received lab test results, corrected dosage instruction"
                  required
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Addendum / Corrected Notes *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Detail the clinical correction or supplemental notes..."
                  required
                  value={amendNotes}
                  onChange={(e) => setAmendNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAmendModal(false)}
                  disabled={submittingAmend}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingAmend}
                >
                  {submittingAmend ? 'Recording...' : 'Record Amendment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE CLINICAL SUMMARY MODAL */}
      {showPrintModal && context && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 660, width: '100%', background: '#fff', color: '#000', padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0284c7' }}>MEDORA CLINIC</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>Outpatient Clinical Consultation Summary</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>CLINICAL NOTE</h3>
                <p style={{ margin: 0, fontSize: 12 }}>Date: {new Date().toISOString().split('T')[0]}</p>
                <p style={{ margin: 0, fontSize: 12 }}>Visit ID: #{selectedAppointmentId}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              <div>
                <strong>Patient:</strong> {context.patient.name} ({context.patient.age ? `${context.patient.age}y` : ''} {context.patient.sex || ''})<br />
                <strong>MRN:</strong> #{context.patient.patientId || context.patient.id}<br />
                <strong>Allergies:</strong> {allergyStatus === 'NKDA' ? 'NKDA (Confirmed)' : allergies || 'None Recorded'}
              </div>
              <div>
                <strong>Attending Doctor:</strong> {context.doctor?.name || 'Consultant'}<br />
                <strong>Specialty:</strong> {context.doctor?.department || 'General Practice'}<br />
                <strong>Status:</strong> {context.consultation.status.toUpperCase()}
              </div>
            </div>

            {(bp || pulse || temperature || weight || height || liveBmi) && (
              <div style={{ marginBottom: 14, fontSize: 13, background: '#f1f5f9', padding: 8, borderRadius: 4 }}>
                <strong>Vitals: </strong>
                {bp && <span>BP: {bp} | </span>}
                {pulse && <span>Pulse: {pulse} bpm | </span>}
                {temperature && <span>Temp: {temperature}°F | </span>}
                {respiratoryRate && <span>RR: {respiratoryRate}/min | </span>}
                {oxygenSaturation && <span>SpO2: {oxygenSaturation}% | </span>}
                {weight && <span>Weight: {weight} kg | </span>}
                {liveBmi && <span>BMI: {liveBmi} kg/m²</span>}
              </div>
            )}

            {presentingComplaint && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Chief Complaint:</strong> {presentingComplaint}
                {chiefComplaintDetails.onset && ` (Onset: ${chiefComplaintDetails.onset}, Severity: ${chiefComplaintDetails.severity})`}
              </div>
            )}

            {(historyNotes || soapSubjective) && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Subjective / Clinical History:</strong> {soapSubjective || historyNotes}
              </div>
            )}

            {diagnoses.length > 0 ? (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Diagnoses:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                  {diagnoses.map((d, i) => (
                    <li key={i}>
                      [{d.type}] <strong>{d.description}</strong> {d.code && `(${d.code})`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : diagnosis ? (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Diagnosis:</strong> <u>{diagnosis}</u>
              </div>
            ) : null}

            {plan && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Management Plan:</strong> {plan}
              </div>
            )}

            {rxItems.some((i) => i.name.trim()) && (
              <div style={{ marginBottom: 16, marginTop: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'serif' }}>℞ Prescribed Medications</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 6 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                      <th style={{ padding: '4px 0' }}>Medicine</th>
                      <th style={{ padding: '4px 0' }}>Dosage</th>
                      <th style={{ padding: '4px 0' }}>Duration</th>
                      <th style={{ padding: '4px 0' }}>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rxItems.filter((i) => i.name.trim()).map((i, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 0', fontWeight: 600 }}>{i.name}</td>
                        <td style={{ padding: '6px 0' }}>{i.dosage}</td>
                        <td style={{ padding: '6px 0' }}>{i.duration}</td>
                        <td style={{ padding: '6px 0' }}>{i.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {followUpDate && (
              <div style={{ fontSize: 13, marginTop: 12 }}>
                <strong>Next Review Date:</strong> {followUpDate} {followUpNotes ? `(${followUpNotes})` : ''}
              </div>
            )}

            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 12 }}>
              <div style={{ color: '#64748b' }}>Digitally sealed & verified by Medora 2.0</div>
              <div style={{ textAlign: 'center', borderTop: '1px solid #000', width: 180, paddingTop: 4 }}>
                {context.consultation.signedBy?.name || 'Attending Physician Signature'}
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }} className="no-print">
              <button className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Clinical Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
