import React, { useState, useEffect, useMemo } from 'react';
import {
  Bed as BedIcon,
  Activity,
  Users,
  CheckCircle2,
  ArrowRightLeft,
  LogOut,
  Receipt,
  Plus,
  Search,
  RefreshCw,
  X,
  Printer,
  Clock,
  Building2,
} from 'lucide-react';
import type {
  Ward,
  Bed,
  Admission,
  InpatientFolio,
  InpatientDashboardMetrics,
  BedStatus,
} from '../../types/inpatient';

interface InpatientWorkspaceProps {
  apiBaseUrl?: string;
  token?: string;
  userRole?: string;
  onNotification?: (type: 'success' | 'error', message: string) => void;
}

export function InpatientWorkspace({
  apiBaseUrl = 'https://medora-20-backend.vercel.app',
  token,
  userRole: _userRole = 'Doctor',
  onNotification,
}: InpatientWorkspaceProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'admissions' | 'wards'>('overview');

  // Core data states
  const [metrics, setMetrics] = useState<InpatientDashboardMetrics | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);

  // Filters
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [admissionSearch, setAdmissionSearch] = useState<string>('');
  const [admissionStatusFilter, setAdmissionStatusFilter] = useState<string>('all');

  // Modals & Drawers
  const [showAdmitModal, setShowAdmitModal] = useState<boolean>(false);
  const [showWardModal, setShowWardModal] = useState<boolean>(false);
  const [showBedModal, setShowBedModal] = useState<boolean>(false);
  const [selectedAdmissionForTransfer, setSelectedAdmissionForTransfer] = useState<Admission | null>(null);
  const [selectedAdmissionForDischarge, setSelectedAdmissionForDischarge] = useState<Admission | null>(null);
  const [selectedAdmissionForFolio, setSelectedAdmissionForFolio] = useState<Admission | null>(null);
  const [activeFolio, setActiveFolio] = useState<InpatientFolio | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<Admission | null>(null);

  // Form states: New Admission
  const [admitPatientId, setAdmitPatientId] = useState<string>('');
  const [admitBedId, setAdmitBedId] = useState<string>('');
  const [admitDoctorId, setAdmitDoctorId] = useState<string>('1');
  const [admitType, setAdmitType] = useState<string>('ELECTIVE');
  const [admitReason, setAdmitReason] = useState<string>('');
  const [admitDiagnosis, setAdmitDiagnosis] = useState<string>('');

  // Form states: Transfer
  const [transferTargetBedId, setTransferTargetBedId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');

  // Form states: Discharge
  const [dischargeCondition, setDischargeCondition] = useState<string>('IMPROVED');
  const [dischargeSummary, setDischargeSummary] = useState<string>('');

  // Form states: Manual Charge
  const [chargeModule, setChargeModule] = useState<string>('SERVICE');
  const [chargeCategory, setChargeCategory] = useState<string>('Nursing Care');
  const [chargeDescription, setChargeDescription] = useState<string>('');
  const [chargeUnitPrice, setChargeUnitPrice] = useState<number>(500);
  const [chargeQuantity, setChargeQuantity] = useState<number>(1);

  // Form states: Charge Reversal
  const [reversalItemId, setReversalItemId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  // Form states: Folio Settlement
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementMethod, setSettlementMethod] = useState<string>('CASH');

  // Form states: New Ward
  const [newWardName, setNewWardName] = useState<string>('');
  const [newWardCode, setNewWardCode] = useState<string>('');
  const [newWardRate, setNewWardRate] = useState<number>(2000);
  const [newWardDesc, setNewWardDesc] = useState<string>('');

  // Form states: New Bed
  const [newBedWardId, setNewBedWardId] = useState<string>('');
  const [newBedNumber, setNewBedNumber] = useState<string>('');
  const [newBedDesc, setNewBedDesc] = useState<string>('');

  const authHeaders = useMemo(() => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const notify = (type: 'success' | 'error', message: string) => {
    if (onNotification) {
      onNotification(type, message);
    }
  };

  // 1. Fetch Dashboard Metrics
  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/dashboard`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch {
      // non-blocking
    }
  };

  // 2. Fetch Wards
  const fetchWards = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/wards`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setWards(data.data || []);
      }
    } catch {
      // non-blocking
    }
  };

  // 3. Fetch Beds
  const fetchBeds = async () => {
    try {
      let url = `${apiBaseUrl}/api/v1/inpatient/beds`;
      if (selectedWardFilter !== 'all') {
        url += `?categoryId=${selectedWardFilter}`;
      }
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setBeds(data.data || []);
      }
    } catch {
      // non-blocking
    }
  };

  // 4. Fetch Admissions
  const fetchAdmissions = async () => {
    try {
      let url = `${apiBaseUrl}/api/v1/inpatient/admissions?limit=50`;
      if (admissionStatusFilter !== 'all') {
        url += `&status=${admissionStatusFilter}`;
      }
      if (admissionSearch) {
        url += `&search=${encodeURIComponent(admissionSearch)}`;
      }
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setAdmissions(data.data?.items || []);
      }
    } catch {
      // non-blocking
    }
  };

  // Reload everything
  const reloadAll = () => {
    fetchMetrics();
    fetchWards();
    fetchBeds();
    fetchAdmissions();
  };

  useEffect(() => {
    reloadAll();
  }, [token, selectedWardFilter, admissionStatusFilter]);

  // Fetch Folio for Admission
  const loadFolio = async (admissionId: number | string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/admissions/${admissionId}/folio`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        setActiveFolio(data.data);
        setSettlementAmount(Number(data.data.balance || 0));
      } else {
        notify('error', data.error?.message || 'Could not load folio.');
      }
    } catch {
      notify('error', 'Network error fetching admission folio.');
    }
  };

  // Handlers
  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitPatientId || !admitBedId) {
      notify('error', 'Please enter Patient ID and choose an available bed.');
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/admissions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          patientId: Number(admitPatientId),
          bedId: Number(admitBedId),
          attendingDoctorId: Number(admitDoctorId),
          admissionType: admitType,
          admissionReason: admitReason,
          diagnosis: admitDiagnosis,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', `Patient successfully admitted (#${data.data.admissionNumber}).`);
        setShowAdmitModal(false);
        setAdmitPatientId('');
        setAdmitBedId('');
        setAdmitReason('');
        setAdmitDiagnosis('');
        reloadAll();
      } else {
        notify('error', data.error?.message || 'Failed to admit patient.');
      }
    } catch {
      notify('error', 'Network error creating admission.');
    }
  };

  const handleBedStatusChange = async (bedId: number | string, newStatus: BedStatus) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/beds/${bedId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', `Bed #${bedId} status updated to ${newStatus}.`);
        reloadAll();
      } else {
        notify('error', data.error?.message || 'Unable to update bed status.');
      }
    } catch {
      notify('error', 'Network error updating bed status.');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionForTransfer || !transferTargetBedId) return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/inpatient/admissions/${selectedAdmissionForTransfer.id}/transfer`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            destinationBedId: Number(transferTargetBedId),
            transferReason: transferReason || 'Clinical ward transfer',
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        notify('success', 'Patient transferred successfully. Bed charge recorded.');
        setSelectedAdmissionForTransfer(null);
        setTransferTargetBedId('');
        setTransferReason('');
        reloadAll();
      } else {
        notify('error', data.error?.message || 'Transfer failed.');
      }
    } catch {
      notify('error', 'Network error during transfer.');
    }
  };

  const handleCompleteDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionForDischarge) return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/inpatient/admissions/${selectedAdmissionForDischarge.id}/discharge/complete`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            dischargeCondition,
            dischargeSummary: dischargeSummary || 'Patient discharged in stable clinical state.',
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        notify('success', 'Discharge completed. Bed released to cleaning.');
        setSelectedAdmissionForDischarge(null);
        setDischargeSummary('');
        reloadAll();
      } else {
        notify('error', data.error?.message || 'Discharge failed.');
      }
    } catch {
      notify('error', 'Network error during discharge.');
    }
  };

  const handlePostCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionForFolio) return;

    try {
      const idempotencyKey = `MANUAL-${Date.now()}`;
      const res = await fetch(
        `${apiBaseUrl}/api/v1/inpatient/admissions/${selectedAdmissionForFolio.id}/folio/charges`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            sourceModule: chargeModule,
            chargeCategory,
            description: chargeDescription || 'Manual clinical charge',
            unitPrice: Number(chargeUnitPrice),
            quantity: Number(chargeQuantity),
            idempotencyKey,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        notify('success', 'Charge posted to folio.');
        setChargeDescription('');
        loadFolio(selectedAdmissionForFolio.id);
      } else {
        notify('error', data.error?.message || 'Failed to post charge.');
      }
    } catch {
      notify('error', 'Network error posting charge.');
    }
  };

  const handleReverseCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalItemId || !selectedAdmissionForFolio) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/folio-items/${reversalItemId}/reverse`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          reversalReason: reversalReason || 'Cancelled by attending clinician',
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', 'Charge reversed and folio balance adjusted.');
        setReversalItemId(null);
        setReversalReason('');
        loadFolio(selectedAdmissionForFolio.id);
      } else {
        notify('error', data.error?.message || 'Reversal failed.');
      }
    } catch {
      notify('error', 'Network error reversing charge.');
    }
  };

  const handleSettleFolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionForFolio) return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/inpatient/admissions/${selectedAdmissionForFolio.id}/folio/settle`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            amountPaid: Number(settlementAmount),
            paymentMethod: settlementMethod,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        notify('success', 'Folio payment recorded successfully.');
        loadFolio(selectedAdmissionForFolio.id);
        reloadAll();
      } else {
        notify('error', data.error?.message || 'Settlement failed.');
      }
    } catch {
      notify('error', 'Network error settling folio.');
    }
  };

  const handleCreateWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWardName) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/wards`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          category: newWardName,
          code: newWardCode || undefined,
          baseRate: Number(newWardRate),
          description: newWardDesc,
          billingUnit: 'DAILY',
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', `Ward "${newWardName}" added.`);
        setShowWardModal(false);
        setNewWardName('');
        setNewWardCode('');
        reloadAll();
      } else {
        notify('error', data.error?.message || 'Failed to create ward.');
      }
    } catch {
      notify('error', 'Network error creating ward.');
    }
  };

  const handleCreateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBedWardId || !newBedNumber) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/beds`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          categoryId: Number(newBedWardId),
          number: newBedNumber,
          description: newBedDesc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', `Bed "${newBedNumber}" created.`);
        setShowBedModal(false);
        setNewBedNumber('');
        setNewBedDesc('');
        reloadAll();
      } else {
        notify('error', data.error?.message || 'Failed to create bed.');
      }
    } catch {
      notify('error', 'Network error creating bed.');
    }
  };

  // Available beds for selection
  const availableBeds = useMemo(() => {
    return beds.filter((b) => b.status === 'AVAILABLE' && b.isActive);
  }, [beds]);

  // Filtered beds for overview
  const displayedBeds = useMemo(() => {
    return beds.filter((b) => {
      const matchWard = selectedWardFilter === 'all' || String(b.categoryId) === selectedWardFilter;
      const matchStatus = selectedStatusFilter === 'all' || b.status === selectedStatusFilter;
      return matchWard && matchStatus;
    });
  }, [beds, selectedWardFilter, selectedStatusFilter]);

  return (
    <div className="inpatient-workspace-container" style={{ padding: '0 4px' }}>
      {/* 1. Header & KPI Metrics Banner */}
      <div
        className="kpi-banner no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Card: Occupancy Rate */}
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bed Occupancy</span>
            <Activity size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: '#0f172a' }}>
            {metrics ? `${metrics.occupancyPercentage}%` : '0%'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {metrics?.occupiedBeds || 0} of {metrics?.totalBeds || 0} active beds
          </div>
        </div>

        {/* Card: Available Beds */}
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ready for Admission</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: '#10b981' }}>
            {metrics?.availableBeds || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Immediate allocatable capacity</div>
        </div>

        {/* Card: Cleaning / Sanitizing */}
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sanitization / Cleaning</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: '#f59e0b' }}>
            {metrics?.cleaningBeds || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending nurse release</div>
        </div>

        {/* Card: Active Inpatients */}
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Active Inpatients</span>
            <Users size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: '#6366f1' }}>
            {metrics?.activeAdmissionsCount || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Currently admitted patients</div>
        </div>
      </div>

      {/* 2. Top Navigation & Action Controls */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <BedIcon size={16} /> Ward & Bed Grid
          </button>
          <button
            className={`btn ${activeTab === 'admissions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('admissions')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={16} /> Inpatient Registry ({admissions.length})
          </button>
          <button
            className={`btn ${activeTab === 'wards' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('wards')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Building2 size={16} /> Ward Configuration
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={reloadAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAdmitModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0284c7' }}
          >
            <Plus size={16} /> Admit Patient
          </button>
        </div>
      </div>

      {/* 3. Tab: Overview (Ward & Bed Grid) */}
      {activeTab === 'overview' && (
        <div className="tab-pane">
          {/* Filter Bar */}
          <div
            className="card no-print"
            style={{
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Filter Ward:</span>
              <select
                className="form-select"
                value={selectedWardFilter}
                onChange={(e) => setSelectedWardFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 160 }}
              >
                <option value="all">All Wards / Categories</option>
                {wards.map((w) => (
                  <option key={String(w.id)} value={String(w.id)}>
                    {w.category || w.name} (PKR {w.baseRate}/day)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Status:</span>
              <select
                className="form-select"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="all">All Bed States</option>
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="OCCUPIED">OCCUPIED</option>
                <option value="CLEANING">CLEANING</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '4px 8px' }}
                onClick={() => setShowBedModal(true)}
              >
                + Add Bed
              </button>
            </div>
          </div>

          {/* Bed Grid Visual Display */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            {displayedBeds.map((bed) => {
              const activeAdmission = bed.admissions?.[0];
              return (
                <div
                  key={String(bed.id)}
                  className="card"
                  style={{
                    padding: 16,
                    borderTop: `4px solid ${
                      bed.status === 'AVAILABLE'
                        ? '#10b981'
                        : bed.status === 'OCCUPIED'
                        ? '#6366f1'
                        : bed.status === 'CLEANING'
                        ? '#f59e0b'
                        : '#64748b'
                    }`,
                    background: '#ffffff',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{bed.number}</h4>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {bed.category?.category || 'Ward'}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          bed.status === 'AVAILABLE'
                            ? '#ecfdf5'
                            : bed.status === 'OCCUPIED'
                            ? '#eef2ff'
                            : bed.status === 'CLEANING'
                            ? '#fffbeb'
                            : '#f1f5f9',
                        color:
                          bed.status === 'AVAILABLE'
                            ? '#065f46'
                            : bed.status === 'OCCUPIED'
                            ? '#3730a3'
                            : bed.status === 'CLEANING'
                            ? '#92400e'
                            : '#475569',
                      }}
                    >
                      {bed.status}
                    </span>
                  </div>

                  {/* Bed Details / Active Patient */}
                  <div style={{ margin: '14px 0', minHeight: 48, fontSize: 13 }}>
                    {activeAdmission ? (
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {activeAdmission.patient?.name || 'Admitted Patient'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          MRN: {activeAdmission.patient?.patientId || 'N/A'} • {activeAdmission.admissionNumber}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                        {bed.description || 'Vacant bed ready for allocation.'}
                      </div>
                    )}
                  </div>

                  {/* Operational Action Footer */}
                  <div
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    {bed.status === 'CLEANING' && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '4px 10px', width: '100%', background: '#10b981' }}
                        onClick={() => handleBedStatusChange(bed.id, 'AVAILABLE')}
                      >
                        <CheckCircle2 size={13} style={{ marginRight: 4 }} /> Mark Clean & Ready
                      </button>
                    )}

                    {bed.status === 'OCCUPIED' && activeAdmission && (
                      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 6px', flex: 1 }}
                          onClick={() => {
                            setSelectedAdmissionForFolio(activeAdmission);
                            loadFolio(activeAdmission.id);
                          }}
                        >
                          <Receipt size={12} style={{ marginRight: 2 }} /> Folio
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 6px', flex: 1 }}
                          onClick={() => setSelectedAdmissionForTransfer(activeAdmission)}
                        >
                          <ArrowRightLeft size={12} style={{ marginRight: 2 }} /> Transfer
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 6px', flex: 1, color: '#dc2626' }}
                          onClick={() => setSelectedAdmissionForDischarge(activeAdmission)}
                        >
                          <LogOut size={12} style={{ marginRight: 2 }} /> Discharge
                        </button>
                      </div>
                    )}

                    {bed.status === 'AVAILABLE' && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 8px', width: '100%' }}
                        onClick={() => {
                          setAdmitBedId(String(bed.id));
                          setShowAdmitModal(true);
                        }}
                      >
                        + Admit to this Bed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Tab: Admissions Table */}
      {activeTab === 'admissions' && (
        <div className="tab-pane">
          {/* Search and Filters */}
          <div
            className="card no-print"
            style={{
              padding: 16,
              marginBottom: 16,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search patient MRN, Name, or Admission number..."
                value={admissionSearch}
                onChange={(e) => setAdmissionSearch(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>

            <select
              className="form-select"
              value={admissionStatusFilter}
              onChange={(e) => setAdmissionStatusFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="all">All Admissions</option>
              <option value="ADMITTED">Active (ADMITTED)</option>
              <option value="TRANSFERRED">TRANSFERRED</option>
              <option value="DISCHARGED">DISCHARGED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Admission #</th>
                  <th style={{ padding: '12px 16px' }}>Patient</th>
                  <th style={{ padding: '12px 16px' }}>Ward & Bed</th>
                  <th style={{ padding: '12px 16px' }}>Admit Date</th>
                  <th style={{ padding: '12px 16px' }}>Attending Doctor</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admissions.map((adm) => (
                  <tr key={String(adm.id)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{adm.admissionNumber}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{adm.patient?.name || `Patient #${adm.patientId}`}</div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        MRN: {adm.patient?.patientId || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500 }}>Bed {adm.bed?.number || `#${adm.bedId}`}</div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {adm.ward?.category || 'Ward'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {new Date(adm.admissionDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {adm.attendingDoctor?.name || 'Hospitalist'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            adm.status === 'ADMITTED'
                              ? '#ecfdf5'
                              : adm.status === 'DISCHARGED'
                              ? '#f1f5f9'
                              : '#fffbeb',
                          color:
                            adm.status === 'ADMITTED'
                              ? '#065f46'
                              : adm.status === 'DISCHARGED'
                              ? '#475569'
                              : '#92400e',
                        }}
                      >
                        {adm.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title="View Inpatient Folio"
                          onClick={() => {
                            setSelectedAdmissionForFolio(adm);
                            loadFolio(adm.id);
                          }}
                        >
                          <Receipt size={14} style={{ marginRight: 2 }} /> Folio
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title="Print Admission Sheet"
                          onClick={() => setShowPrintModal(adm)}
                        >
                          <Printer size={14} />
                        </button>
                        {adm.status !== 'DISCHARGED' && (
                          <>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              title="Transfer Bed"
                              onClick={() => setSelectedAdmissionForTransfer(adm)}
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '4px 8px', color: '#dc2626' }}
                              title="Discharge Patient"
                              onClick={() => setSelectedAdmissionForDischarge(adm)}
                            >
                              <LogOut size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab: Ward Configuration */}
      {activeTab === 'wards' && (
        <div className="tab-pane">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ward / Category Catalog</h3>
            <button className="btn btn-primary" onClick={() => setShowWardModal(true)}>
              + Add New Ward
            </button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Ward Name</th>
                  <th style={{ padding: '12px 16px' }}>Code</th>
                  <th style={{ padding: '12px 16px' }}>Base Daily Rate</th>
                  <th style={{ padding: '12px 16px' }}>Capacity (Total / Avail)</th>
                  <th style={{ padding: '12px 16px' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {wards.map((w) => (
                  <tr key={String(w.id)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{w.category || w.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {w.code || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0284c7' }}>
                      PKR {Number(w.baseRate).toLocaleString()} / {w.billingUnit}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 600 }}>{w.totalBeds || 0} beds</span>
                      <span style={{ fontSize: 12, color: '#10b981', marginLeft: 6 }}>
                        ({w.availableBeds || 0} vacant)
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {w.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Admit Patient */}
      {showAdmitModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 520, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Inpatient Admission</h3>
              <button
                onClick={() => setShowAdmitModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateAdmission}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Patient ID (Numeric)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1"
                  required
                  value={admitPatientId}
                  onChange={(e) => setAdmitPatientId(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Attending Doctor ID</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1"
                  required
                  value={admitDoctorId}
                  onChange={(e) => setAdmitDoctorId(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Target Available Bed</label>
                <select
                  className="form-select"
                  required
                  value={admitBedId}
                  onChange={(e) => setAdmitBedId(e.target.value)}
                >
                  <option value="">-- Choose Vacant Bed --</option>
                  {availableBeds.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>
                      {b.number} - {b.category?.category || 'Ward'} (PKR {b.category?.baseRate}/day)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Admission Type</label>
                <select
                  className="form-select"
                  value={admitType}
                  onChange={(e) => setAdmitType(e.target.value)}
                >
                  <option value="ELECTIVE">Elective / Scheduled</option>
                  <option value="EMERGENCY">Emergency Admission</option>
                  <option value="OBSERVATION">Day Care / Observation</option>
                  <option value="TRANSFER">Inter-Hospital Transfer</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Provisional Diagnosis</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acute Appendicitis, Uncontrolled Diabetes"
                  value={admitDiagnosis}
                  onChange={(e) => setAdmitDiagnosis(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Admission Reason & Clinical Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Clinical indication for inpatient stay..."
                  value={admitReason}
                  onChange={(e) => setAdmitReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdmitModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#0284c7' }}>
                  Confirm Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Transfer Bed */}
      {selectedAdmissionForTransfer && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 480, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Bed Transfer</h3>
              <button
                onClick={() => setSelectedAdmissionForTransfer(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleTransfer}>
              <div style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontWeight: 600 }}>
                  {selectedAdmissionForTransfer.patient?.name || 'Patient'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Current Bed: {selectedAdmissionForTransfer.bed?.number} ({selectedAdmissionForTransfer.ward?.category})
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Target Vacant Bed</label>
                <select
                  className="form-select"
                  required
                  value={transferTargetBedId}
                  onChange={(e) => setTransferTargetBedId(e.target.value)}
                >
                  <option value="">-- Choose New Bed --</option>
                  {availableBeds.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>
                      {b.number} - {b.category?.category || 'Ward'} (PKR {b.category?.baseRate}/day)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Transfer Reason / Clinical Justification</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Transferred to ICU due to dyspnea"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedAdmissionForTransfer(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#6366f1' }}>
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Discharge */}
      {selectedAdmissionForDischarge && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 500, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Discharge Patient</h3>
              <button
                onClick={() => setSelectedAdmissionForDischarge(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCompleteDischarge}>
              <div style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontWeight: 600 }}>
                  {selectedAdmissionForDischarge.patient?.name || 'Patient'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Admission: {selectedAdmissionForDischarge.admissionNumber} • Bed {selectedAdmissionForDischarge.bed?.number}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Condition at Discharge</label>
                <select
                  className="form-select"
                  value={dischargeCondition}
                  onChange={(e) => setDischargeCondition(e.target.value)}
                >
                  <option value="IMPROVED">Improved / Stable</option>
                  <option value="RECOVERED">Full Recovery</option>
                  <option value="UNCHANGED">Unchanged</option>
                  <option value="REFERRED">Referred to Tertiary Care</option>
                  <option value="LAMA">Left Against Medical Advice (LAMA)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Final Discharge Summary</label>
                <textarea
                  className="form-input"
                  rows={4}
                  required
                  placeholder="Summary of inpatient stay, medications on discharge, and follow-up plan..."
                  value={dischargeSummary}
                  onChange={(e) => setDischargeSummary(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedAdmissionForDischarge(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#dc2626' }}>
                  Complete Discharge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Inpatient Admission Folio */}
      {selectedAdmissionForFolio && activeFolio && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 840, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  Inpatient Folio ({activeFolio.folioNumber})
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Patient: {selectedAdmissionForFolio.patient?.name} • Status: {activeFolio.status}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedAdmissionForFolio(null);
                  setActiveFolio(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Financial Summary KPIs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Accrued Charges</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                  PKR {Number(activeFolio.totalCharges).toLocaleString()}
                </div>
              </div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Amount Paid</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                  PKR {Number(activeFolio.totalPaid).toLocaleString()}
                </div>
              </div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Outstanding Balance</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e11d48' }}>
                  PKR {Number(activeFolio.balance).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Category breakdown tags */}
            {activeFolio.categoryTotals && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {Object.entries(activeFolio.categoryTotals).map(([cat, amt]) => (
                  <span
                    key={cat}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 16,
                      fontSize: 12,
                      background: '#f1f5f9',
                      color: '#334155',
                      fontWeight: 500,
                    }}
                  >
                    {cat}: PKR {Number(amt).toLocaleString()}
                  </span>
                ))}
              </div>
            )}

            {/* Folio Items Table */}
            <h4 style={{ margin: '16px 0 8px', fontSize: 15 }}>Itemized Folio Transactions</h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflowX: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Module</th>
                    <th style={{ padding: 8 }}>Description</th>
                    <th style={{ padding: 8 }}>Qty</th>
                    <th style={{ padding: 8 }}>Rate</th>
                    <th style={{ padding: 8 }}>Amount</th>
                    <th style={{ padding: 8 }}>Status</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeFolio.items || []).map((item) => (
                    <tr
                      key={String(item.id)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        textDecoration: item.isReversed ? 'line-through' : 'none',
                        color: item.isReversed ? 'var(--text-muted)' : 'inherit',
                      }}
                    >
                      <td style={{ padding: 8, fontWeight: 600 }}>{item.sourceModule}</td>
                      <td style={{ padding: 8 }}>{item.description}</td>
                      <td style={{ padding: 8 }}>{item.quantity}</td>
                      <td style={{ padding: 8 }}>PKR {Number(item.unitPrice).toLocaleString()}</td>
                      <td style={{ padding: 8, fontWeight: 600 }}>PKR {Number(item.totalAmount).toLocaleString()}</td>
                      <td style={{ padding: 8 }}>
                        {item.isReversed ? (
                          <span style={{ color: '#e11d48', fontSize: 11, fontWeight: 600 }}>REVERSED</span>
                        ) : (
                          <span style={{ color: '#10b981', fontSize: 11 }}>POSTED</span>
                        )}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right' }}>
                        {!item.isReversed && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '2px 6px', color: '#e11d48' }}
                            onClick={() => setReversalItemId(String(item.id))}
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Post Manual Charge Section */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Post Clinical / Service Charge</h4>
              <form onSubmit={handlePostCharge} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  value={chargeModule}
                  onChange={(e) => setChargeModule(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="SERVICE">SERVICE</option>
                  <option value="PROCEDURE">PROCEDURE</option>
                  <option value="NURSING">NURSING</option>
                  <option value="BED">BED</option>
                </select>

                <input
                  type="text"
                  className="form-input"
                  placeholder="Category (e.g. Nursing)"
                  value={chargeCategory}
                  onChange={(e) => setChargeCategory(e.target.value)}
                  style={{ width: 140 }}
                />

                <input
                  type="text"
                  className="form-input"
                  placeholder="Charge Description (e.g. Oxygen Mask)"
                  required
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />

                <input
                  type="number"
                  className="form-input"
                  placeholder="Rate"
                  required
                  min={0}
                  value={chargeUnitPrice}
                  onChange={(e) => setChargeUnitPrice(Number(e.target.value))}
                  style={{ width: 100 }}
                />

                <input
                  type="number"
                  className="form-input"
                  placeholder="Qty"
                  required
                  min={1}
                  value={chargeQuantity}
                  onChange={(e) => setChargeQuantity(Number(e.target.value))}
                  style={{ width: 70 }}
                />

                <button type="submit" className="btn btn-secondary">
                  + Add Charge
                </button>
              </form>
            </div>

            {/* Folio Settlement Section */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Record Payment / Settle Folio</h4>
              <form onSubmit={handleSettleFolio} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Amount"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  style={{ width: 160 }}
                />
                <select
                  className="form-select"
                  value={settlementMethod}
                  onChange={(e) => setSettlementMethod(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="CASH">CASH</option>
                  <option value="CREDIT_CARD">CREDIT CARD</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="INSURANCE">INSURANCE CLAIM</option>
                </select>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }}>
                  Record Payment
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reversal Reason */}
      {reversalItemId && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Confirm Charge Reversal</h3>
            <form onSubmit={handleReverseCharge}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Mandatory Auditable Reversal Reason</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Erroneous charge or procedure cancelled"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReversalItemId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#e11d48' }}>
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Ward */}
      {showWardModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 450 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Add Ward / Bed Category</h3>
              <button onClick={() => setShowWardModal(false)} style={{ background: 'none', border: 'none' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateWard}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Ward Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Intensive Care Unit"
                  value={newWardName}
                  onChange={(e) => setNewWardName(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Ward Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ICU-01"
                  value={newWardCode}
                  onChange={(e) => setNewWardCode(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Daily Base Rate (PKR)</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  min={0}
                  value={newWardRate}
                  onChange={(e) => setNewWardRate(Number(e.target.value))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ward notes..."
                  value={newWardDesc}
                  onChange={(e) => setNewWardDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowWardModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Ward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Bed */}
      {showBedModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 450 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Register New Bed</h3>
              <button onClick={() => setShowBedModal(false)} style={{ background: 'none', border: 'none' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBed}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Ward / Category</label>
                <select
                  className="form-select"
                  required
                  value={newBedWardId}
                  onChange={(e) => setNewBedWardId(e.target.value)}
                >
                  <option value="">-- Choose Ward --</option>
                  {wards.map((w) => (
                    <option key={String(w.id)} value={String(w.id)}>
                      {w.category || w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Bed Number</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Bed-104"
                  value={newBedNumber}
                  onChange={(e) => setNewBedNumber(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Features / Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Window side motorized bed"
                  value={newBedDesc}
                  onChange={(e) => setNewBedDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBedModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Printable Admission Sheet */}
      {showPrintModal && (
        <div className="modal-backdrop">
          <div className="modal-card print-area" style={{ maxWidth: 640 }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 22, textTransform: 'uppercase' }}>Medora 2.0 Inpatient Admission Record</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Official Inpatient Medical Document</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 13 }}>
              <div>
                <strong>Admission #:</strong> {showPrintModal.admissionNumber}
              </div>
              <div>
                <strong>Admission Date:</strong> {new Date(showPrintModal.admissionDate).toLocaleString()}
              </div>
              <div>
                <strong>Patient:</strong> {showPrintModal.patient?.name} (MRN: {showPrintModal.patient?.patientId})
              </div>
              <div>
                <strong>Ward & Bed:</strong> {showPrintModal.ward?.category} - Bed {showPrintModal.bed?.number}
              </div>
              <div>
                <strong>Type:</strong> {showPrintModal.admissionType}
              </div>
              <div>
                <strong>Attending Doctor:</strong> {showPrintModal.attendingDoctor?.name || 'Hospitalist'}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginBottom: 16, fontSize: 13 }}>
              <div><strong>Provisional Diagnosis:</strong> {showPrintModal.diagnosis || 'None entered'}</div>
              <div style={{ marginTop: 8 }}><strong>Clinical Indication:</strong> {showPrintModal.admissionReason || 'None entered'}</div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowPrintModal(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={16} /> Print Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
