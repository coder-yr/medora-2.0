import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Lock,
  Unlock,
  Receipt,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  MinusCircle,
  CreditCard,
  Building2,
  Calendar,
  X,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { CashierShift, CashDrawer } from '../../../types/cashier';

interface InvoiceQueueItem {
  id: string;
  invoiceNumber: string;
  date: string;
  grossTotal: number;
  balance: number;
  paymentStatus: string;
  careSetting?: string;
  patient?: {
    id: string;
    patientId: string;
    name: string;
    phone?: string;
  } | null;
}

export const CashierDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<InvoiceQueueItem[]>([]);

  // Open Shift Modal State
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [openingFloat, setOpeningFloat] = useState<string>('0');
  const [selectedDrawerId, setSelectedDrawerId] = useState<string>('');
  const [openingNotes, setOpeningNotes] = useState<string>('');
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchCashierData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Active Cashier Shift for Current User
      const shiftRes = await fetch(`${apiBaseUrl}/api/v1/cashier/shifts/active`, { headers }).then((r) => r.json());
      if (shiftRes.success && shiftRes.data) {
        setActiveShift(shiftRes.data);

        // Fetch recent transactions for the active shift
        const txRes = await fetch(`${apiBaseUrl}/api/v1/cashier/shifts/${shiftRes.data.id}/totals`, { headers }).then((r) => r.json());
        if (txRes.success && txRes.data) {
          setActiveShift((prev) => (prev ? { ...prev, liveTotals: txRes.data } : null));
        }

        // Fetch shift transaction list
        const txListRes = await fetch(`${apiBaseUrl}/api/v1/cashier/shifts`, { headers }).then((r) => r.json());
        if (txListRes.success) {
          // Non-blocking
        }
      } else {
        setActiveShift(null);
      }

      // 2. Fetch Drawers (for opening new shift if none open)
      const drawersRes = await fetch(`${apiBaseUrl}/api/v1/cashier/drawers`, { headers }).then((r) => r.json());
      if (drawersRes.success) {
        const dList = Array.isArray(drawersRes.data) ? drawersRes.data : drawersRes.data?.items || [];
        setDrawers(dList);
        if (dList.length > 0 && !selectedDrawerId) {
          setSelectedDrawerId(String(dList[0].id));
        }
      }

      // 3. Fetch Outstanding Invoices Queue (Patient folios awaiting POS payment)
      const invRes = await fetch(`${apiBaseUrl}/api/v1/invoices?show=outstanding&limit=15`, { headers }).then((r) => r.json());
      if (invRes.success) {
        const list = Array.isArray(invRes.data)
          ? invRes.data
          : invRes.data?.data || invRes.data?.items || [];
        setUnpaidInvoices(list);
      }
    } catch {
      setError('Unable to reach cashier point-of-sale services.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl, selectedDrawerId]);

  useEffect(() => {
    fetchCashierData();
  }, [fetchCashierData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchCashierData();
  };

  // Open Shift handler
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setModalLoading(true);
    setModalError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/cashier/shifts/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          openingCash: Number(openingFloat) || 0,
          cashDrawerId: selectedDrawerId ? Number(selectedDrawerId) : undefined,
          notes: openingNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowOpenModal(false);
        setOpeningFloat('0');
        setOpeningNotes('');
        await fetchCashierData();
      } else {
        setModalError(data.error?.message || data.message || 'Failed to open cashier shift.');
      }
    } catch {
      setModalError('Network error attempting to open shift.');
    } finally {
      setModalLoading(false);
    }
  };

  const totalOutstandingBalance = useMemo(() => {
    return unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
  }, [unpaidInvoices]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header */}
      <DashboardHeader
        title="Cashier & Point-of-Sale (POS) Cockpit"
        subtitle="Manage POS cash drawers, collect outpatient & inpatient payments, issue digital receipts, and execute daily reconciliation."
        userName={currentUser?.name || 'Cashier'}
        userRole="Cashier POS"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={DollarSign}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {!activeShift ? (
              <button
                onClick={() => setShowOpenModal(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
              >
                <Unlock size={16} />
                Open Shift Drawer
              </button>
            ) : (
              <button
                onClick={() => navigate('/cashier')}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
              >
                <CreditCard size={16} />
                Open POS Terminal
              </button>
            )}
            <button
              onClick={() => navigate('/cashier')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <Calendar size={16} />
              Day Book Report
            </button>
          </div>
        }
      />

      {/* 2. Shift Status Alert */}
      {!activeShift ? (
        <DashboardAlert
          type="warning"
          title="Terminal Inactive: No Open Cashier Shift"
          message="You cannot record cash or card payments until you open a register drawer and declare your opening cash float."
          actionText="Open Shift Now"
          onAction={() => setShowOpenModal(true)}
        />
      ) : (
        <DashboardAlert
          type="info"
          title={`Active Shift: #${activeShift.shiftNumber} in ${activeShift.cashDrawer?.name || 'Main POS Drawer'}`}
          message={`Shift opened at ${new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} with PKR ${Number(activeShift.openingCash).toLocaleString()} opening float.`}
          actionText="Go to POS Register"
          onAction={() => navigate('/cashier')}
        />
      )}

      {error && <DashboardErrorState title="Cashier POS Service Error" message={error} onRetry={fetchCashierData} />}

      {/* 3. KPI Metrics Banner (6 Cards) */}
      {loading ? (
        <DashboardSkeletonCards count={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 1: Shift Status */}
          <DashboardMetricCard
            title="Terminal Shift Status"
            value={activeShift ? 'OPEN / ACTIVE' : 'NO ACTIVE SHIFT'}
            subtext={activeShift ? `Shift #${activeShift.shiftNumber}` : 'Register drawer closed'}
            icon={activeShift ? Unlock : Lock}
            variant={activeShift ? 'emerald' : 'amber'}
            badge={activeShift ? 'Live' : 'Standby'}
            onClick={() => (!activeShift ? setShowOpenModal(true) : navigate('/cashier'))}
          />

          {/* Card 2: Opening Cash Float */}
          <DashboardMetricCard
            title="Opening Cash Float"
            value={activeShift ? `PKR ${Number(activeShift.openingCash).toLocaleString()}` : 'PKR 0'}
            subtext="Declared at shift start"
            icon={Building2}
            variant="primary"
          />

          {/* Card 3: Expected Cash In Drawer */}
          <DashboardMetricCard
            title="Expected Cash In Drawer"
            value={
              activeShift?.liveTotals
                ? `PKR ${Number(activeShift.liveTotals.expectedCash || 0).toLocaleString()}`
                : activeShift
                ? `PKR ${Number(activeShift.openingCash).toLocaleString()}`
                : 'PKR 0'
            }
            subtext="Float + cash inflows - payouts"
            icon={DollarSign}
            variant="teal"
          />

          {/* Card 4: Collections This Shift */}
          <DashboardMetricCard
            title="Collections This Shift"
            value={
              activeShift?.liveTotals
                ? `PKR ${Number(activeShift.liveTotals.totalCollected || 0).toLocaleString()}`
                : 'PKR 0'
            }
            subtext={
              activeShift?.liveTotals
                ? `Card: PKR ${Number(activeShift.liveTotals.cardTotal || 0).toLocaleString()}`
                : 'Gross shift revenue'
            }
            icon={Receipt}
            variant="purple"
            badge="Shift"
          />

          {/* Card 5: Transactions Processed */}
          <DashboardMetricCard
            title="Transactions Processed"
            value={activeShift?.liveTotals?.transactionCount ?? 0}
            subtext="Total payment receipts logged"
            icon={CheckCircle2}
            variant="emerald"
          />

          {/* Card 6: Pending Invoices Queue */}
          <DashboardMetricCard
            title="Pending Patient Invoices"
            value={unpaidInvoices.length}
            subtext={`PKR ${totalOutstandingBalance.toLocaleString()} balance due`}
            icon={AlertCircle}
            variant={unpaidInvoices.length > 0 ? 'amber' : 'slate'}
            badge={unpaidInvoices.length > 0 ? 'Awaiting POS' : undefined}
          />
        </div>
      )}

      {/* 4. Main Operational Layout: POS Payment Queue & Terminal Management */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.2fr)', gap: 20 }}>
        {/* LEFT COLUMN: Patient Payment Queue */}
        <DashboardSection
          title="Point-of-Sale (POS) Payment Queue"
          subtitle="Collect payments for outpatient consultations, diagnostics, pharmacy orders, and inpatient folios"
          icon={Receipt}
          badge={unpaidInvoices.length}
          action={
            <button
              onClick={() => navigate('/billing')}
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              Search All Invoices
            </button>
          }
          noPadding
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading patient payment folios...
            </div>
          ) : unpaidInvoices.length === 0 ? (
            <DashboardEmptyState
              title="No pending invoices in queue"
              description="When doctors, laboratories, or wards generate bills for patients, they will appear here ready for payment."
              icon={CheckCircle2}
              actionText="Refresh Folios"
              onAction={handleManualRefresh}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Invoice #</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Patient & MRN</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Setting</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Gross Total</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Balance Due</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidInvoices.slice(0, 10).map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>
                        #{inv.invoiceNumber || inv.id}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {inv.patient?.name || 'Walk-in Patient'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          MRN #{inv.patient?.patientId || 'N/A'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className="badge"
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {inv.careSetting || 'OPD'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                        PKR {Number(inv.grossTotal || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#dc2626' }}>
                        PKR {Number(inv.balance || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            if (!activeShift) {
                              setShowOpenModal(true);
                            } else {
                              navigate('/cashier');
                            }
                          }}
                          className="btn btn-primary"
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>Collect</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardSection>

        {/* RIGHT COLUMN: Terminal Shift Management & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Active Shift Card */}
          <DashboardSection
            title="Terminal Shift Summary"
            subtitle="Current register balance and shift breakdown"
            icon={Building2}
          >
            {activeShift ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Shift Number</span>
                  <strong style={{ color: '#0284c7' }}>#{activeShift.shiftNumber}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cash Drawer</span>
                  <span>{activeShift.cashDrawer?.name || 'Default POS Drawer'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Opening Cash Float</span>
                  <strong>PKR {Number(activeShift.openingCash).toLocaleString()}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cash Inflow (Sales)</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>
                    +PKR {Number(activeShift.liveTotals?.cashInflow || 0).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Card & Digital Collections</span>
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>
                    PKR {Number(activeShift.liveTotals?.cardTotal || 0).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cash Payouts</span>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                    -PKR {Number(activeShift.liveTotals?.cashOutflow || 0).toLocaleString()}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#f0f9ff',
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#0369a1', fontSize: 14 }}>Expected Physical Cash</span>
                  <span style={{ fontWeight: 800, color: '#0369a1', fontSize: 16 }}>
                    PKR {Number(activeShift.liveTotals?.expectedCash ?? activeShift.openingCash).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => navigate('/cashier')}
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                  >
                    POS Workspace
                  </button>
                  <button
                    onClick={() => navigate('/cashier')}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: 12, padding: '8px 0' }}
                  >
                    Close Shift
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Lock size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: 15 }}>No Register Open</h4>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                  Declare opening cash float and select a physical cash drawer to begin POS sessions.
                </p>
                <button
                  onClick={() => setShowOpenModal(true)}
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: 13 }}
                >
                  Open Cashier Shift
                </button>
              </div>
            )}
          </DashboardSection>

          {/* Quick Cashier Actions */}
          <DashboardSection title="POS Fast Shortcuts" icon={Activity}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <button
                onClick={() => navigate('/cashier')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <Receipt size={15} style={{ color: '#0284c7' }} />
                <span>Collect POS</span>
              </button>

              <button
                onClick={() => navigate('/cashier')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <MinusCircle size={15} style={{ color: '#dc2626' }} />
                <span>Petty Payout</span>
              </button>

              <button
                onClick={() => navigate('/billing')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <CreditCard size={15} style={{ color: '#7c3aed' }} />
                <span>All Invoices</span>
              </button>

              <button
                onClick={() => navigate('/cashier')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <Calendar size={15} style={{ color: '#10b981' }} />
                <span>Day Book</span>
              </button>
            </div>
          </DashboardSection>
        </div>
      </div>

      {/* MODAL: Open Cashier Shift */}
      {showOpenModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 440,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Unlock size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Open Cashier Shift</h3>
              </div>
              <button
                onClick={() => setShowOpenModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleOpenShift}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                  Select Physical Cash Drawer *
                </label>
                <select
                  className="form-input"
                  value={selectedDrawerId}
                  onChange={(e) => setSelectedDrawerId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  {drawers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                  {drawers.length === 0 && <option value="">Default POS Drawer #1</option>}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                  Opening Cash Float (PKR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  placeholder="e.g. 5000"
                  style={{ width: '100%' }}
                  required
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Starting change in the physical drawer before commencing transactions.
                </span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                  Opening Notes (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="e.g. Morning OPD shift, starting float verified"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: 13 }}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: 13 }}
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Opening...' : 'Confirm & Open Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
