import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  Search,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  FileText,
  UserCheck,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  X,
} from 'lucide-react';
import type {
  CashierShift,
  CashTransaction,
  CashDrawer,
  DayBookReport,
  PatientSettlementPreview,
  SettlePatientResult,
} from '../../types/cashier';

interface Props {
  token: string;
  userRole?: string;
}

const isDev = import.meta.env.DEV;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:3000' : '');

export function CashierWorkspace({ token, userRole: _userRole }: Props) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'transactions' | 'payouts' | 'closing' | 'supervisor' | 'daybook' | 'settlement'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Active shift & Drawers state
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);

  // Open Shift Modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [selectedDrawerId, setSelectedDrawerId] = useState<string>('');
  const [openingNotes, setOpeningNotes] = useState<string>('');

  // Payout / Adjustment Form
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutReason, setPayoutReason] = useState<string>('');
  const [payoutRecipient, setPayoutRecipient] = useState<string>('');
  const [payoutReference, setPayoutReference] = useState<string>('');

  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustDirection, setAdjustDirection] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW');

  // Shift Close & Denominations
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [denominations, setDenominations] = useState<Record<number, number>>({
    5000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });

  // Supervisor Workspace state
  const [pendingShifts, setPendingShifts] = useState<CashierShift[]>([]);
  const [selectedPendingShift, setSelectedPendingShift] = useState<CashierShift | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [supervisorNotes, setSupervisorNotes] = useState<string>('');

  // Day Book state
  const [dayBookFrom, setDayBookFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dayBookTo, setDayBookTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dayBookKind, setDayBookKind] = useState<string>('');
  const [dayBookReport, setDayBookReport] = useState<DayBookReport | null>(null);

  // Settlement state
  const [settlePatientSearch, setSettlePatientSearch] = useState<string>('');
  const [settlePreview, setSettlePreview] = useState<PatientSettlementPreview | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<string>('Cash');
  const [settleReference, setSettleReference] = useState<string>('');
  const [settleWriteOff, setSettleWriteOff] = useState<string>('0');
  const [settleWriteOffReason, setSettleWriteOffReason] = useState<string>('');
  const [settleResult, setSettleResult] = useState<SettlePatientResult | null>(null);

  // Slip Modal
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [slipShift, setSlipShift] = useState<CashierShift | null>(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Denominations sum calculation
  const totalDenominationCount = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [denomStr, count]) => {
      const denom = Number(denomStr);
      const cnt = Number(count) || 0;
      return sum + denom * cnt;
    }, 0);
  }, [denominations]);

  // Fetch active shift & live totals
  const fetchActiveShift = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveShift(data.data);
      } else {
        setActiveShift(null);
      }
    } catch {
      // Offline fallback
    }
  }, [token]);

  // Fetch drawers
  const fetchDrawers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/drawers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDrawers(data.data);
      }
    } catch {
      // Offline fallback
    }
  }, [token]);

  // Fetch shift transactions
  const fetchTransactions = useCallback(async (sId: string) => {
    if (!token || !sId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/${sId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTransactions(data.data);
      }
    } catch {
      // Offline fallback
    }
  }, [token]);

  // Fetch pending supervisor shifts
  const fetchPendingShifts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts?status=PENDING_APPROVAL`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPendingShifts(data.data);
      }
    } catch {
      // Offline fallback
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchActiveShift();
    fetchDrawers();
    fetchPendingShifts();
  }, [fetchActiveShift, fetchDrawers, fetchPendingShifts]);

  // When active shift changes, load its transactions
  useEffect(() => {
    if (activeShift?.id) {
      fetchTransactions(activeShift.id);
    }
  }, [activeShift?.id, fetchTransactions]);

  // Handle open shift
  const handleOpenShift = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          openingCash: Number(openingFloat) || 0,
          cashDrawerId: selectedDrawerId || undefined,
          notes: openingNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Shift ${data.data.shiftNumber} opened successfully!` });
        setShowOpenModal(false);
        setOpeningFloat(0);
        setOpeningNotes('');
        await fetchActiveShift();
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Failed to open shift.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error opening shift.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle record petty cash payout
  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) {
      setNotification({ type: 'error', message: 'Please enter a valid payout amount.' });
      return;
    }
    if (!payoutReason.trim()) {
      setNotification({ type: 'error', message: 'Payout reason is mandatory.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/${activeShift.id}/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          reason: payoutReason.trim(),
          recipient: payoutRecipient.trim() || undefined,
          reference: payoutReference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Payout of ${amount} PKR recorded successfully.` });
        setPayoutAmount('');
        setPayoutReason('');
        setPayoutRecipient('');
        setPayoutReference('');
        await fetchActiveShift();
        await fetchTransactions(activeShift.id);
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Failed to record payout.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error recording payout.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle record cash adjustment
  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) {
      setNotification({ type: 'error', message: 'Please enter a valid adjustment amount.' });
      return;
    }
    if (!adjustReason.trim()) {
      setNotification({ type: 'error', message: 'Adjustment reason is mandatory.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/${activeShift.id}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          reason: adjustReason.trim(),
          direction: adjustDirection,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: `Adjustment of ${amount} PKR (${adjustDirection}) recorded.`,
        });
        setAdjustAmount('');
        setAdjustReason('');
        await fetchActiveShift();
        await fetchTransactions(activeShift.id);
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Failed to record adjustment.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error recording adjustment.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle submit shift for close
  const handleSubmitClose = async () => {
    if (!activeShift) return;
    const counted = totalDenominationCount;
    const expected = activeShift.liveTotals?.expectedCash ?? Number(activeShift.expectedCash ?? 0);
    const variance = counted - expected;

    if (variance !== 0 && !closingNotes.trim()) {
      setNotification({
        type: 'error',
        message: `Discrepancy detected (${variance > 0 ? '+' : ''}${variance} PKR). You must provide an explanation in Closing Notes.`,
      });
      return;
    }

    setLoading(true);
    try {
      const denomArray = Object.entries(denominations)
        .filter(([, count]) => count > 0)
        .map(([denom, count]) => ({
          denomination: Number(denom),
          count: Number(count),
        }));

      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/${activeShift.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          countedCash: counted,
          closingNotes: closingNotes.trim() || undefined,
          denominations: denomArray,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: `Shift close submitted for supervisor sign-off (Variance: ${variance} PKR).`,
        });
        await fetchActiveShift();
        await fetchPendingShifts();
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Failed to submit shift close.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error submitting shift close.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Supervisor Approve
  const handleSupervisorApprove = async (sId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/${sId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notes: supervisorNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Shift approved and finalized successfully.' });
        setSelectedPendingShift(null);
        setSupervisorNotes('');
        await fetchPendingShifts();
        await fetchActiveShift();
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Failed to approve shift.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error approving shift.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Supervisor Reject
  const handleSupervisorReject = async () => {
    if (!selectedPendingShift) return;
    if (!rejectionReason.trim()) {
      setNotification({ type: 'error', message: 'A rejection reason is strictly mandatory.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/shifts/${selectedPendingShift.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'info', message: 'Shift close request rejected. Cashier has been notified to recount.' });
        setShowRejectModal(false);
        setSelectedPendingShift(null);
        setRejectionReason('');
        await fetchPendingShifts();
        await fetchActiveShift();
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Failed to reject shift.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error rejecting shift.' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Day Book
  const fetchDayBook = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: dayBookFrom,
        to: dayBookTo,
      });
      if (dayBookKind) params.set('kind', dayBookKind);

      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/day-book?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDayBookReport(data.data);
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to generate Day Book.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error generating Day Book.' });
    } finally {
      setLoading(false);
    }
  };

  // Export Day Book CSV
  const handleExportCsv = () => {
    const params = new URLSearchParams({
      from: dayBookFrom,
      to: dayBookTo,
      export: 'csv',
    });
    if (dayBookKind) params.set('kind', dayBookKind);
    window.open(`${API_BASE_URL}/api/v1/cashier/day-book?${params.toString()}&token=${token}`, '_blank');
  };

  // Search Patient Debt for Settlement
  const handleSearchPatientSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = settlePatientSearch.trim();
    if (!pid) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/settlement/${pid}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSettlePreview(data.data);
        setSettleAmount(String(data.data.totalReceivable));
        setSettleResult(null);
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Patient has no outstanding debt.' });
        setSettlePreview(null);
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error fetching patient debt.' });
    } finally {
      setLoading(false);
    }
  };

  // Execute Patient Settlement
  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlePreview) return;
    const amount = Number(settleAmount) || 0;
    const writeOff = Number(settleWriteOff) || 0;

    if (amount <= 0 && writeOff <= 0) {
      setNotification({ type: 'error', message: 'Specify either payment amount or write-off amount.' });
      return;
    }

    if (writeOff > 0 && !settleWriteOffReason.trim()) {
      setNotification({ type: 'error', message: 'A justification is mandatory for write-offs.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cashier/settlement/${settlePreview.patient.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          method: settleMethod,
          reference: settleReference.trim() || undefined,
          writeOff,
          writeOffReason: settleWriteOffReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: `Settled ${amount} PKR across ${data.data.invoicesSettledCount} invoice(s)!`,
        });
        setSettleResult(data.data);
        setSettlePreview(null);
        setSettleAmount('');
        setSettleWriteOff('0');
        setSettleWriteOffReason('');
        await fetchActiveShift();
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Settlement rejected.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error executing settlement.' });
    } finally {
      setLoading(false);
    }
  };

  // Format currency helper
  const fmt = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Status badge helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 9999, background: '#ecfdf5', color: '#047857', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Unlock size={14} /> ACTIVE SHIFT
          </span>
        );
      case 'CLOSING':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 9999, background: '#fffbeb', color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} /> COUNTING CASH
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 9999, background: '#e0e7ff', color: '#4338ca', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} /> PENDING SUPERVISOR
          </span>
        );
      case 'CLOSED':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 9999, background: '#f1f5f9', color: '#475569', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Lock size={14} /> CLOSED & RECONCILED
          </span>
        );
      case 'REJECTED':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 9999, background: '#fef2f2', color: '#b91c1c', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={14} /> RECOUNT REQUIRED
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="cashier-workspace" style={{ padding: '20px 0' }}>
      {/* Notifications Banner */}
      {notification && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 20,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background:
              notification.type === 'success'
                ? '#ecfdf5'
                : notification.type === 'error'
                ? '#fef2f2'
                : '#eff6ff',
            color:
              notification.type === 'success'
                ? '#047857'
                : notification.type === 'error'
                ? '#b91c1c'
                : '#1d4ed8',
            border: `1px solid ${
              notification.type === 'success'
                ? '#a7f3d0'
                : notification.type === 'error'
                ? '#fecaca'
                : '#bfdbfe'
            }`,
          }}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : notification.type === 'error' ? (
            <AlertCircle size={18} />
          ) : (
            <Clock size={18} />
          )}
          <span style={{ flex: 1, fontSize: 14 }}>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          background: 'var(--card-bg, #ffffff)',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          marginBottom: 20,
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={24} color="#059669" /> Cashier, Shift Close & Treasury
            </h1>
            {activeShift && renderStatusBadge(activeShift.status)}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
            Dual-control cash drawer reconciliation, denomination audits, and legacy financial settlement
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {activeShift ? (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSlipShift(activeShift);
                  setShowSlipModal(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={16} /> Shift Slip
              </button>
              {activeShift.status === 'OPEN' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveTab('closing')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#059669', borderColor: '#059669' }}
                >
                  <Lock size={16} /> Close Shift
                </button>
              )}
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowOpenModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#059669', borderColor: '#059669' }}
            >
              <Unlock size={16} /> Open New Shift
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => {
              fetchActiveShift();
              fetchPendingShifts();
            }}
            title="Refresh shift data"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (if active shift exists) */}
      {activeShift && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Shift & Drawer</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{activeShift.shiftNumber}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
              {activeShift.cashDrawer?.name || 'Logical Drawer'} ({activeShift.cashier?.login || 'Cashier'})
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Opening Float</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#334155', marginTop: 4 }}>
              PKR {fmt(activeShift.liveTotals?.openingFloat ?? activeShift.openingCash)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Cash in drawer at start</div>
          </div>

          <div style={{ background: '#ffffff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowDownRight size={14} /> Cash Inflow
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#059669', marginTop: 4 }}>
              + PKR {fmt(activeShift.liveTotals?.cashInflow)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Cash payments received</div>
          </div>

          <div style={{ background: '#ffffff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowUpRight size={14} /> Payouts & Outflow
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
              - PKR {fmt(activeShift.liveTotals?.cashOutflow)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Petty cash / expenses</div>
          </div>

          <div
            style={{
              background: '#ecfdf5',
              padding: 16,
              borderRadius: 10,
              border: '2px solid #10b981',
              boxShadow: '0 2px 4px rgba(16,185,129,0.1)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
              Expected Physical Cash
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#065f46', marginTop: 4 }}>
              PKR {fmt(activeShift.liveTotals?.expectedCash ?? activeShift.expectedCash)}
            </div>
            <div style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>Float + Inflow - Outflow</div>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CreditCard size={14} /> Non-Cash Collected
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
              PKR {fmt(activeShift.liveTotals?.nonCashTotal)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Card, Bank, Cheque & Online</div>
          </div>
        </div>
      )}

      {/* Workspace Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        <button
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}
        >
          <Layers size={16} /> Overview
        </button>

        <button
          className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('transactions')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}
        >
          <FileText size={16} /> Shift Ledger ({transactions.length})
        </button>

        <button
          className={`btn ${activeTab === 'payouts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('payouts')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}
        >
          <MinusCircle size={16} /> Petty Cash Payouts
        </button>

        <button
          className={`btn ${activeTab === 'closing' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('closing')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}
        >
          <Lock size={16} /> Shift Close & Denominations
        </button>

        <button
          className={`btn ${activeTab === 'supervisor' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('supervisor');
            fetchPendingShifts();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}
        >
          <UserCheck size={16} /> Supervisor Approvals
          {pendingShifts.length > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 9999, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {pendingShifts.length}
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'daybook' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('daybook');
            if (!dayBookReport) fetchDayBook();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}
        >
          <Calendar size={16} /> Financial Day Book
        </button>

        <button
          className={`btn ${activeTab === 'settlement' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('settlement')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}
        >
          <Building2 size={16} /> Multi-Invoice Settlement
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Unlock size={18} color="#059669" /> Shift Operational Status
            </h3>

            {activeShift ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Shift Number:</span>
                  <span style={{ fontWeight: 600 }}>{activeShift.shiftNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Status:</span>
                  <span>{renderStatusBadge(activeShift.status)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Cashier:</span>
                  <span style={{ fontWeight: 600 }}>{activeShift.cashier?.login}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Opened At:</span>
                  <span>{new Date(activeShift.openedAt).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Opening Float:</span>
                  <span style={{ fontWeight: 600 }}>PKR {fmt(activeShift.openingCash)}</span>
                </div>
                {activeShift.closingNotes && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 13, color: '#475569' }}>
                    <strong>Notes:</strong> {activeShift.closingNotes}
                  </div>
                )}
                {activeShift.rejectionReason && (
                  <div style={{ marginTop: 8, padding: 10, background: '#fef2f2', borderRadius: 6, fontSize: 13, color: '#b91c1c' }}>
                    <strong>Supervisor Rejection:</strong> {activeShift.rejectionReason}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <Lock size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>No Active Shift Found</p>
                <p style={{ margin: '4px 0 16px 0', fontSize: 13 }}>You must open a shift to collect payments or payouts.</p>
                <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>
                  Open Cashier Shift
                </button>
              </div>
            )}
          </div>

          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={18} color="#0284c7" /> Payment Breakdown
            </h3>

            {activeShift?.liveTotals ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Cash Inflow (Drawer):</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>PKR {fmt(activeShift.liveTotals.cashInflow)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Card / POS Payments:</span>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>PKR {fmt(activeShift.liveTotals.cardTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Bank Transfers:</span>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>PKR {fmt(activeShift.liveTotals.bankTransferTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Cheques:</span>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>PKR {fmt(activeShift.liveTotals.chequeTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Write-offs / Concessions:</span>
                  <span style={{ fontWeight: 600, color: '#64748b' }}>PKR {fmt(activeShift.liveTotals.writeOffTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0 0', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                  <span>Total Gross Collections:</span>
                  <span style={{ color: '#0f172a' }}>PKR {fmt(activeShift.liveTotals.totalCollected)}</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                Open a shift to view live financial collection totals.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SHIFT LEDGER / TRANSACTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'transactions' && (
        <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Immutable Cash & Payment Ledger for Shift {activeShift?.shiftNumber}
            </h3>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Showing {transactions.length} verified transactions
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Tx Number</th>
                  <th style={{ padding: '10px 12px' }}>Type</th>
                  <th style={{ padding: '10px 12px' }}>Source / Patient</th>
                  <th style={{ padding: '10px 12px' }}>Method</th>
                  <th style={{ padding: '10px 12px' }}>Physical Cash?</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount (PKR)</th>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No transactions recorded in this shift yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.transactionNumber}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              t.transactionType === 'PAYMENT_RECEIVED'
                                ? '#ecfdf5'
                                : t.transactionType === 'OPENING_FLOAT'
                                ? '#eff6ff'
                                : t.transactionType === 'CASH_PAYOUT'
                                ? '#fef2f2'
                                : '#f8fafc',
                            color:
                              t.transactionType === 'PAYMENT_RECEIVED'
                                ? '#047857'
                                : t.transactionType === 'OPENING_FLOAT'
                                ? '#1d4ed8'
                                : t.transactionType === 'CASH_PAYOUT'
                                ? '#b91c1c'
                                : '#475569',
                          }}
                        >
                          {t.transactionType}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {t.payment?.patient ? (
                          <span>
                            {t.payment.patient.name} ({t.payment.patient.patientId})
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>{t.sourceReference || t.notes || 'Direct'}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 500 }}>{t.paymentMethod}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {t.isCash ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>Yes (Drawer)</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>No (Non-cash)</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: t.direction === 'INFLOW' ? '#059669' : '#dc2626',
                        }}
                      >
                        {t.direction === 'INFLOW' ? '+' : '-'} {fmt(t.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                        {new Date(t.occurredAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PETTY CASH PAYOUTS & ADJUSTMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'payouts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Payout Form */}
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MinusCircle size={18} /> Record Authorized Petty Cash Payout
            </h3>

            <form onSubmit={handleRecordPayout}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Payout Amount (PKR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="e.g. 250.00"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Mandatory Reason / Purpose *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Emergency fuel for Ambulance #3"
                  value={payoutReason}
                  onChange={(e) => setPayoutReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Recipient Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Driver Aslam"
                  value={payoutRecipient}
                  onChange={(e) => setPayoutRecipient(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Voucher / Receipt Reference #
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. VOUCHER-0889"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !activeShift || activeShift.status !== 'OPEN'}
                style={{ width: '100%', background: '#dc2626', borderColor: '#dc2626' }}
              >
                Disburse Payout from Drawer
              </button>
            </form>
          </div>

          {/* Adjustment Form */}
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlusCircle size={18} /> Drawer Cash Float Adjustment
            </h3>

            <form onSubmit={handleRecordAdjustment}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Adjustment Direction
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <input
                      type="radio"
                      checked={adjustDirection === 'INFLOW'}
                      onChange={() => setAdjustDirection('INFLOW')}
                    />
                    Inflow (Top-up Float)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <input
                      type="radio"
                      checked={adjustDirection === 'OUTFLOW'}
                      onChange={() => setAdjustDirection('OUTFLOW')}
                    />
                    Outflow (Remove Excess Float)
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Amount (PKR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="e.g. 500.00"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Mandatory Reason *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Added small change coin roll from safe"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !activeShift || activeShift.status !== 'OPEN'}
                style={{ width: '100%', background: '#0284c7', borderColor: '#0284c7' }}
              >
                Record Float Adjustment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SHIFT CLOSE & DENOMINATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'closing' && (
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>
            Physical Cash Reconciliation & Shift Close
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#64748b' }}>
            Count physical bank notes and coins in the cash drawer. Discrepancies require mandatory explanation.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {/* Denomination Counter */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Note & Coin Denominations</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.keys(denominations)
                  .map(Number)
                  .sort((a, b) => b - a)
                  .map((denom) => (
                    <div
                      key={denom}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '6px 12px',
                        background: '#f8fafc',
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600, width: 80 }}>PKR {denom}</span>
                      <span style={{ color: '#64748b' }}>×</span>
                      <input
                        type="number"
                        min="0"
                        style={{ width: 90, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                        value={denominations[denom] || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setDenominations((prev) => ({ ...prev, [denom]: val }));
                        }}
                      />
                      <span style={{ fontWeight: 700, width: 110, textAlign: 'right' }}>
                        = PKR {fmt(denom * (denominations[denom] || 0))}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Reconciliation Summary & Sign-off */}
            <div>
              <div
                style={{
                  background: '#f8fafc',
                  padding: 20,
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  marginBottom: 20,
                }}
              >
                <h4 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700 }}>Reconciliation Summary</h4>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Expected Physical Cash:</span>
                  <span style={{ fontWeight: 700 }}>
                    PKR {fmt(activeShift?.liveTotals?.expectedCash ?? activeShift?.expectedCash)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Total Counted Cash:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>PKR {fmt(totalDenominationCount)}</span>
                </div>

                {activeShift && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: 10,
                      borderTop: '2px solid #cbd5e1',
                      fontWeight: 800,
                      fontSize: 16,
                      color:
                        totalDenominationCount -
                          Number(activeShift.liveTotals?.expectedCash ?? activeShift.expectedCash ?? 0) ===
                        0
                          ? '#059669'
                          : '#dc2626',
                    }}
                  >
                    <span>Cash Variance:</span>
                    <span>
                      {totalDenominationCount -
                        Number(activeShift.liveTotals?.expectedCash ?? activeShift.expectedCash ?? 0) >
                      0
                        ? '+'
                        : ''}
                      PKR{' '}
                      {fmt(
                        totalDenominationCount -
                          Number(activeShift.liveTotals?.expectedCash ?? activeShift.expectedCash ?? 0),
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Closing Notes & Discrepancy Explanation {totalDenominationCount - Number(activeShift?.liveTotals?.expectedCash ?? 0) !== 0 && '*'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Explain any variance or drawer handover notes..."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSubmitClose}
                disabled={loading || !activeShift || (activeShift.status !== 'OPEN' && activeShift.status !== 'REJECTED')}
                style={{ width: '100%', padding: '12px', fontSize: 15, background: '#059669', borderColor: '#059669' }}
              >
                Submit Shift for Supervisor Sign-off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SUPERVISOR APPROVALS */}
      {/* ========================================================================= */}
      {activeTab === 'supervisor' && (
        <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Supervisor Shift Reconciliation Queue</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Separation of duties: Review physical cash counts, verify variances, and sign off shift closures.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={fetchPendingShifts}>
              <RefreshCw size={14} /> Refresh Queue
            </button>
          </div>

          {pendingShifts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 12px auto', color: '#059669' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>All shifts reconciled</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>No pending shift close requests awaiting approval.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Shift #</th>
                    <th style={{ padding: '10px 12px' }}>Cashier</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Expected (PKR)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Counted (PKR)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Variance (PKR)</th>
                    <th style={{ padding: '10px 12px' }}>Notes</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingShifts.map((s) => {
                    const variance = Number(s.cashVariance ?? 0);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.shiftNumber}</td>
                        <td style={{ padding: '10px 12px' }}>{s.cashier?.login}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(s.expectedCash)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(s.countedCash)}</td>
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: variance === 0 ? '#059669' : '#dc2626',
                          }}
                        >
                          {variance > 0 ? '+' : ''}
                          {fmt(variance)}
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: 200, color: '#475569' }}>
                          {s.closingNotes || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSupervisorApprove(s.id)}
                              style={{ padding: '4px 10px', fontSize: 12, background: '#059669', borderColor: '#059669' }}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setSelectedPendingShift(s);
                                setShowRejectModal(true);
                              }}
                              style={{ padding: '4px 10px', fontSize: 12, color: '#dc2626' }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: FINANCIAL DAY BOOK */}
      {/* ========================================================================= */}
      {activeTab === 'daybook' && (
        <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Hospital Financial Day Book</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Itemized OPD/IPD billings, doctor vs hospital split, and treasury collection breakdown
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="date"
                value={dayBookFrom}
                onChange={(e) => setDayBookFrom(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <span style={{ color: '#64748b' }}>to</span>
              <input
                type="date"
                value={dayBookTo}
                onChange={(e) => setDayBookTo(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <select
                value={dayBookKind}
                onChange={(e) => setDayBookKind(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="">All Services</option>
                <option value="opd">OPD</option>
                <option value="ipd">IPD</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="laboratory">Laboratory</option>
                <option value="radiology">Radiology</option>
              </select>
              <button className="btn btn-primary" onClick={fetchDayBook} style={{ padding: '6px 14px' }}>
                Filter
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleExportCsv}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          {/* Collections by payment mode */}
          {dayBookReport?.collections && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CASH</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                  PKR {fmt(dayBookReport.collections.cash)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CARD / POS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>
                  PKR {fmt(dayBookReport.collections.card)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>BANK TRANSFER</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>
                  PKR {fmt(dayBookReport.collections.bank_transfer)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CHEQUE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginTop: 2 }}>
                  PKR {fmt(dayBookReport.collections.cheque)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>WRITE-OFFS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>
                  PKR {fmt(dayBookReport.collections.write_off)}
                </div>
              </div>
              <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 8, border: '1px solid #10b981' }}>
                <div style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>TOTAL COLLECTED</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#065f46', marginTop: 2 }}>
                  PKR {fmt(dayBookReport.collections.total)}
                </div>
              </div>
            </div>
          )}

          {/* Lines Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Date</th>
                  <th style={{ padding: '8px 10px' }}>Invoice</th>
                  <th style={{ padding: '8px 10px' }}>Patient</th>
                  <th style={{ padding: '8px 10px' }}>Department</th>
                  <th style={{ padding: '8px 10px' }}>Service</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Gross</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Disc</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Doctor Share</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Hospital Share</th>
                </tr>
              </thead>
              <tbody>
                {!dayBookReport || dayBookReport.lines.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No billing lines for this date range.
                    </td>
                  </tr>
                ) : (
                  dayBookReport.lines.map((l, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{l.date}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{l.invoice}</td>
                      <td style={{ padding: '8px 10px' }}>{l.patient}</td>
                      <td style={{ padding: '8px 10px' }}>{l.department}</td>
                      <td style={{ padding: '8px 10px' }}>{l.service}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(l.gross)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(l.discount)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{fmt(l.net)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0284c7' }}>{fmt(l.doctorShare)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669' }}>{fmt(l.hospitalShare)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: PATIENT MULTI-INVOICE SETTLEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'settlement' && (
        <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700 }}>
            Patient Multi-Invoice Treasury Settlement (Oldest-First)
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#64748b' }}>
            Collect unified lump-sum payments across multiple pending invoices and apply approved concessions / write-offs.
          </p>

          <form onSubmit={handleSearchPatientSettlement} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter Patient ID (e.g. 101, MR-0004)..."
              value={settlePatientSearch}
              onChange={(e) => setSettlePatientSearch(e.target.value)}
              style={{ maxWidth: 360 }}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Search size={16} /> Lookup Balance
            </button>
          </form>

          {settlePreview && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {settlePreview.patient.name} ({settlePreview.patient.patientId})
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748b' }}>
                    Phone: {settlePreview.patient.phone || 'N/A'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Total Outstanding Debt:</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>
                    PKR {fmt(settlePreview.totalReceivable)}
                  </div>
                </div>
              </div>

              {/* Unpaid invoices table */}
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>Unpaid Invoices Queue (Oldest First)</h5>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Invoice ID</th>
                      <th style={{ padding: '6px 8px' }}>Date</th>
                      <th style={{ padding: '6px 8px' }}>Setting</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Paid</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlePreview.unpaidInvoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>#{inv.id}</td>
                        <td style={{ padding: '6px 8px' }}>{inv.date}</td>
                        <td style={{ padding: '6px 8px', textTransform: 'uppercase' }}>{inv.careSetting || 'OPD'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(inv.grossTotal)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(inv.amountReceived)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                          {fmt(inv.balanceDue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Settlement Execution Form */}
              <form onSubmit={handleExecuteSettlement}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Payment Amount (PKR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Payment Method
                    </label>
                    <select
                      className="form-control"
                      value={settleMethod}
                      onChange={(e) => setSettleMethod(e.target.value)}
                    >
                      <option value="Cash">Cash (Drawer)</option>
                      <option value="Card">Credit/Debit Card (POS)</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Online">Online Payment</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Reference #
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. POS-9871, CHQ-445"
                      value={settleReference}
                      onChange={(e) => setSettleReference(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Write-off / Concession Amount (PKR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={settleWriteOff}
                      onChange={(e) => setSettleWriteOff(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Mandatory Write-Off Reason
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Zakat committee concession, MS discount"
                      value={settleWriteOffReason}
                      onChange={(e) => setSettleWriteOffReason(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ background: '#059669', borderColor: '#059669', width: '100%', padding: '10px' }}
                >
                  Execute Treasury Settlement
                </button>
              </form>
            </div>
          )}

          {settleResult && (
            <div style={{ marginTop: 20, padding: 16, background: '#ecfdf5', borderRadius: 8, border: '1px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#047857', fontWeight: 700, marginBottom: 8 }}>
                <CheckCircle2 size={18} /> Settlement Executed Successfully!
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#065f46' }}>
                Paid <strong>PKR {fmt(settleResult.amountSettled)}</strong> across{' '}
                <strong>{settleResult.invoicesSettledCount}</strong> invoice(s).
                {settleResult.amountWrittenOff > 0 && (
                  <span> Concession applied: <strong>PKR {fmt(settleResult.amountWrittenOff)}</strong>.</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OPEN SHIFT */}
      {/* ========================================================================= */}
      {showOpenModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Open New Cashier Shift</h3>
              <button
                onClick={() => setShowOpenModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Physical Cash Drawer
              </label>
              <select
                className="form-control"
                value={selectedDrawerId}
                onChange={(e) => setSelectedDrawerId(e.target.value)}
              >
                <option value="">Default / Logical Drawer</option>
                {drawers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Opening Cash Float (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                placeholder="0.00"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
              />
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Initial physical cash verified in drawer before taking transactions.
              </span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Shift Opening Notes
              </label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Morning shift / Counter handover notes..."
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowOpenModal(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleOpenShift}
                disabled={loading}
                style={{ flex: 1, background: '#059669', borderColor: '#059669' }}
              >
                Open Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPERVISOR REJECT */}
      {/* ========================================================================= */}
      {showRejectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#dc2626' }}>
              Reject Shift Close Request
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
              Shift <strong>{selectedPendingShift?.shiftNumber}</strong> will be returned to the cashier with instructions to recount.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Mandatory Rejection Reason *
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Discrepancy in 1000 PKR notes. Please re-count change tin."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSupervisorReject}
                disabled={loading || !rejectionReason.trim()}
                style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
              >
                Reject & Request Recount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINTABLE SHIFT CLOSE SLIP */}
      {/* ========================================================================= */}
      {showSlipModal && slipShift && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} className="no-print">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Shift Handover & Reconciliation Slip</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setShowSlipModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Slip Printable Content */}
            <div
              id="printable-shift-slip"
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.5,
                border: '1px dashed #cbd5e1',
                padding: 16,
                background: '#fafafa',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>MEDORA 2.0 HOSPITAL</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>CASHIER SHIFT RECONCILIATION SLIP</div>
                <div style={{ fontSize: 11 }}>================================</div>
              </div>

              <div><strong>Shift #:</strong> {slipShift.shiftNumber}</div>
              <div><strong>Cashier:</strong> {slipShift.cashier?.login}</div>
              <div><strong>Opened:</strong> {new Date(slipShift.openedAt).toLocaleString()}</div>
              <div><strong>Closed:</strong> {slipShift.closedAt ? new Date(slipShift.closedAt).toLocaleString() : 'IN PROGRESS'}</div>
              <div><strong>Status:</strong> {slipShift.status}</div>
              <div style={{ margin: '8px 0', borderBottom: '1px dashed #94a3b8' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Opening Float:</span>
                <span>PKR {fmt(slipShift.openingCash)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cash Inflow:</span>
                <span>+ PKR {fmt(slipShift.liveTotals?.cashInflow)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cash Payouts:</span>
                <span>- PKR {fmt(slipShift.liveTotals?.cashOutflow)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, margin: '4px 0' }}>
                <span>Expected Drawer Cash:</span>
                <span>PKR {fmt(slipShift.liveTotals?.expectedCash ?? slipShift.expectedCash)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Physical Counted Cash:</span>
                <span>PKR {fmt(slipShift.countedCash ?? totalDenominationCount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 4 }}>
                <span>Variance:</span>
                <span>
                  {Number(slipShift.cashVariance ?? 0) > 0 ? '+' : ''}
                  PKR {fmt(slipShift.cashVariance ?? 0)}
                </span>
              </div>
              <div style={{ margin: '8px 0', borderBottom: '1px dashed #94a3b8' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Card Total:</span>
                <span>PKR {fmt(slipShift.liveTotals?.cardTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bank Transfer:</span>
                <span>PKR {fmt(slipShift.liveTotals?.bankTransferTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Gross Collections:</span>
                <span>PKR {fmt(slipShift.liveTotals?.totalCollected)}</span>
              </div>

              {slipShift.closingNotes && (
                <div style={{ marginTop: 10, fontSize: 11 }}>
                  <strong>Notes:</strong> {slipShift.closingNotes}
                </div>
              )}

              <div style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', width: '45%', borderTop: '1px solid #475569', paddingTop: 4 }}>
                  Cashier Signature
                </div>
                <div style={{ textAlign: 'center', width: '45%', borderTop: '1px solid #475569', paddingTop: 4 }}>
                  Supervisor Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
