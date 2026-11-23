import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  BookOpen,
  PieChart,
  Scale,
  Receipt,
  Activity,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { DashboardMetrics as AccountingMetrics, JournalEntry, Expense } from '../../../types/accounting';
import type { CashierShift } from '../../../types/cashier';
import type { ExecutiveOverviewData } from '../../../types/dashboard';

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  date: string;
  grossTotal: number;
  balance: number;
  paymentStatus: string;
  patient?: {
    id: string;
    patientId: string;
    name: string;
  } | null;
}

export const AccountantDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [accountingMetrics, setAccountingMetrics] = useState<AccountingMetrics | null>(null);
  const [overview, setOverview] = useState<ExecutiveOverviewData | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<InvoiceListItem[]>([]);
  const [pendingShifts, setPendingShifts] = useState<CashierShift[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<Expense[]>([]);
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);

  const [activeQueueTab, setActiveQueueTab] = useState<'invoices' | 'shifts' | 'journals' | 'expenses'>('invoices');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchFinancialData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Accounting Core Dashboard Metrics
      const accRes = await fetch(`${apiBaseUrl}/api/v1/accounting/dashboard`, { headers }).then((r) => r.json());
      if (accRes.success && accRes.data) {
        setAccountingMetrics(accRes.data);
        if (accRes.data.recentJournals) {
          setRecentJournals(accRes.data.recentJournals);
        }
      }

      // 2. Fetch Executive Overview for today's recognized revenue, cash and non-cash collections
      const overviewRes = await fetch(`${apiBaseUrl}/api/v1/dashboard/overview?period=today`, { headers }).then((r) => r.json());
      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }

      // 3. Fetch Outstanding Unpaid Invoices
      const invRes = await fetch(`${apiBaseUrl}/api/v1/invoices?show=outstanding&limit=15`, { headers }).then((r) => r.json());
      if (invRes.success) {
        const list = Array.isArray(invRes.data)
          ? invRes.data
          : invRes.data?.data || invRes.data?.items || [];
        setUnpaidInvoices(list);
      }

      // 4. Fetch Cashier Shifts Awaiting Approval / Reconciliation
      const shiftsRes = await fetch(`${apiBaseUrl}/api/v1/cashier/shifts?status=CLOSED`, { headers }).then((r) => r.json());
      if (shiftsRes.success) {
        const sList = Array.isArray(shiftsRes.data)
          ? shiftsRes.data
          : shiftsRes.data?.items || shiftsRes.data?.data || [];
        setPendingShifts(sList);
      }

      // 5. Fetch Pending Expense Vouchers
      const expRes = await fetch(`${apiBaseUrl}/api/v1/accounting/expenses?status=SUBMITTED`, { headers }).then((r) => r.json());
      if (expRes.success) {
        const eList = Array.isArray(expRes.data)
          ? expRes.data
          : expRes.data?.items || expRes.data?.data || [];
        setPendingExpenses(eList);
      }
    } catch {
      setError('Unable to load financial accounting services. Verify financial authorizations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchFinancialData();
  };

  const totalCollectionsToday = useMemo(() => {
    if (!overview?.financial) return 0;
    return (overview.financial.cashCollections || 0) + (overview.financial.nonCashCollections || 0);
  }, [overview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header */}
      <DashboardHeader
        title="Financial Management & Accounting Cockpit"
        subtitle="Authoritative hospital general ledger, accounts receivable tracking, cashier reconciliation, and financial statement oversight."
        userName={currentUser?.name || 'Accountant'}
        userRole="Accountant"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={CreditCard}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/accounting')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <BookOpen size={16} />
              General Ledger
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <Receipt size={16} />
              Billing & Folios
            </button>
          </div>
        }
      />

      {/* 2. Urgent Reconciliation & Shift Notice */}
      {pendingShifts.length > 0 && (
        <DashboardAlert
          type="warning"
          title={`Cashier Reconciliation Required: ${pendingShifts.length} closed shifts pending supervisor review`}
          message="Closed POS drawer shifts require supervisor verification and bank deposit sign-off."
          actionText="Review Cashier Shifts"
          onAction={() => navigate('/cashier')}
        />
      )}

      {error && <DashboardErrorState title="Financial Ledger Error" message={error} onRetry={fetchFinancialData} />}

      {/* 3. KPI Metrics Banner (6 Cards) */}
      {loading ? (
        <DashboardSkeletonCards count={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 1: Revenue Recognized Today */}
          <DashboardMetricCard
            title="Revenue Recognized Today"
            value={overview?.financial ? `₹${overview.financial.recognizedRevenue.toLocaleString()}` : '₹0'}
            subtext="Earned clinical & diagnostic services"
            icon={TrendingUp}
            variant="primary"
            badge="Today"
          />

          {/* Card 2: Total Collections Today */}
          <DashboardMetricCard
            title="Collections Today"
            value={`₹${totalCollectionsToday.toLocaleString()}`}
            subtext={
              overview?.financial
                ? `Cash: ₹${overview.financial.cashCollections.toLocaleString()} • Non-Cash: ₹${overview.financial.nonCashCollections.toLocaleString()}`
                : 'Settled payments'
            }
            icon={IndianRupee}
            variant="emerald"
            badge="Cash Flow"
          />

          {/* Card 3: Outstanding Receivables */}
          <DashboardMetricCard
            title="Outstanding Receivables (A/R)"
            value={
              accountingMetrics
                ? `₹${accountingMetrics.totalReceivables.toLocaleString()}`
                : overview?.financial
                ? `₹${overview.financial.accountsReceivable.toLocaleString()}`
                : '₹0'
            }
            subtext={`${unpaidInvoices.length} folios with unpaid balances`}
            icon={AlertCircle}
            variant={unpaidInvoices.length > 0 ? 'amber' : 'slate'}
            badge={unpaidInvoices.length > 0 ? 'Collect' : undefined}
            onClick={() => setActiveQueueTab('invoices')}
          />

          {/* Card 4: Revenue This Month */}
          <DashboardMetricCard
            title="Revenue This Month (GL)"
            value={accountingMetrics ? `₹${accountingMetrics.totalRevenueMonth.toLocaleString()}` : '₹0'}
            subtext={
              accountingMetrics
                ? `Net Operating Surplus: ₹${accountingMetrics.netSurplusMonth.toLocaleString()}`
                : 'Posted journal revenue'
            }
            icon={PieChart}
            variant="purple"
          />

          {/* Card 5: Cashier Shifts Pending Close/Approval */}
          <DashboardMetricCard
            title="Cashier Shifts Pending"
            value={pendingShifts.length || overview?.financial?.openOrPendingShifts || 0}
            subtext="Closed shifts awaiting supervisor sign-off"
            icon={Clock}
            variant={pendingShifts.length > 0 ? 'amber' : 'slate'}
            badge={pendingShifts.length > 0 ? 'Review' : undefined}
            onClick={() => setActiveQueueTab('shifts')}
          />

          {/* Card 6: Pending Expense Vouchers */}
          <DashboardMetricCard
            title="Pending Expense Approvals"
            value={accountingMetrics?.pendingExpensesCount ?? pendingExpenses.length}
            subtext="Submitted payment vouchers awaiting approval"
            icon={FileCheck}
            variant={pendingExpenses.length > 0 ? 'rose' : 'slate'}
            badge={pendingExpenses.length > 0 ? 'Action' : undefined}
            onClick={() => setActiveQueueTab('expenses')}
          />
        </div>
      )}

      {/* 4. Actionable Financial Queues & Ledger Oversight */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1.1fr)', gap: 20 }}>
        {/* LEFT COLUMN: Multi-Tab Financial Operational Queues */}
        <DashboardSection
          title="Financial Control & Reconciliation Queues"
          subtitle="Inspect open customer folios, pending shift reconciliations, journal vouchers, and expense claims"
          icon={Scale}
          action={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveQueueTab('invoices')}
                className={`btn ${activeQueueTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Unpaid Invoices ({unpaidInvoices.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('shifts')}
                className={`btn ${activeQueueTab === 'shifts' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Cashier Shifts ({pendingShifts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('expenses')}
                className={`btn ${activeQueueTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Expenses ({pendingExpenses.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('journals')}
                className={`btn ${activeQueueTab === 'journals' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Recent Journals
              </button>
            </div>
          }
          noPadding
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading financial queues...
            </div>
          ) : activeQueueTab === 'invoices' ? (
            /* TAB 1: Unpaid Invoices Queue */
            unpaidInvoices.length === 0 ? (
              <DashboardEmptyState
                title="All patient billing folios are settled"
                description="There are currently no outstanding or overdue invoices in the accounts receivable ledger."
                icon={CheckCircle2}
                actionText="Refresh Invoices"
                onAction={handleManualRefresh}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Invoice #</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Patient & MRN</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Date</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Total</th>
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
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {inv.date || 'Recent'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)' }}>
                          ₹{Number(inv.grossTotal || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#dc2626' }}>
                          ₹{Number(inv.balance || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate('/billing')}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Inspect Folio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeQueueTab === 'shifts' ? (
            /* TAB 2: Cashier Shifts Pending Approval */
            pendingShifts.length === 0 ? (
              <DashboardEmptyState
                title="No closed cashier shifts pending review"
                description="When cashiers close their POS drawer shifts, they will appear here for accountant reconciliation."
                icon={CheckCircle2}
                actionText="Refresh Shifts"
                onAction={handleManualRefresh}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Shift #</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Cashier</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Drawer</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Expected Cash</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingShifts.slice(0, 10).map((shift) => (
                      <tr key={shift.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>
                          {shift.shiftNumber}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {shift.cashier?.firstName} {shift.cashier?.lastName || shift.cashier?.login}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {shift.cashDrawer?.name || 'Main POS Drawer'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#059669' }}>
                          ₹{Number(shift.expectedCash || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            CLOSED (PENDING)
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate('/cashier')}
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Reconcile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeQueueTab === 'expenses' ? (
            /* TAB 3: Pending Expenses */
            pendingExpenses.length === 0 ? (
              <DashboardEmptyState
                title="No expense claims awaiting approval"
                description="Submitted departmental expense vouchers will appear here for financial controller review."
                icon={CheckCircle2}
                actionText="Refresh Expenses"
                onAction={handleManualRefresh}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Voucher #</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Category & Description</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Date</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Amount</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingExpenses.slice(0, 10).map((exp) => (
                      <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>
                          #{exp.expenseNumber || exp.id}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {exp.description}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Category: {exp.category?.name || 'General Operations'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {exp.expenseDate}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#dc2626' }}>
                          ₹{Number(exp.amount || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate('/accounting')}
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Review Voucher
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* TAB 4: Recent Journal Entries */
            recentJournals.length === 0 ? (
              <DashboardEmptyState
                title="No recent journal entries"
                description="Double-entry journal vouchers created by system modules will appear here."
                icon={BookOpen}
                actionText="Refresh Ledger"
                onAction={handleManualRefresh}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Journal #</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Accounting Date</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Description</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Debit / Credit</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJournals.slice(0, 10).map((j) => (
                      <tr key={j.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>
                          {j.journalNumber}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {j.accountingDate ? j.accountingDate.split('T')[0] : 'Recent'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--text-main)' }}>
                          {j.description}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#059669' }}>
                          ₹{Number(j.totalDebit || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              background: j.status === 'POSTED' ? '#d1fae5' : '#e0f2fe',
                              color: j.status === 'POSTED' ? '#065f46' : '#0369a1',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {j.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </DashboardSection>

        {/* RIGHT COLUMN: Financial Distribution & Fast Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Revenue & Liquidity Health */}
          <DashboardSection
            title="Hospital Financial Position"
            subtitle="Authoritative cash, bank, and surplus overview"
            icon={PieChart}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Cash & Bank Liquidity</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                    ₹{accountingMetrics ? accountingMetrics.totalLiquidity.toLocaleString() : '0'}
                  </div>
                </div>
                <CreditCard size={24} style={{ color: '#059669' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current Month Operating Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>
                    ₹{accountingMetrics ? accountingMetrics.totalExpenseMonth.toLocaleString() : '0'}
                  </div>
                </div>
                <Scale size={24} style={{ color: '#dc2626' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Net Monthly Surplus</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginTop: 2 }}>
                    ₹{accountingMetrics ? accountingMetrics.netSurplusMonth.toLocaleString() : '0'}
                  </div>
                </div>
                <TrendingUp size={24} style={{ color: '#166534' }} />
              </div>
            </div>
          </DashboardSection>

          {/* Financial Fast Actions */}
          <DashboardSection title="Accounting Workflows" icon={Activity}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
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
                <Receipt size={15} style={{ color: '#0284c7' }} />
                <span>Patient Invoices</span>
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
                <IndianRupee size={15} style={{ color: '#10b981' }} />
                <span>Shift Approval</span>
              </button>

              <button
                onClick={() => navigate('/accounting')}
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
                <BookOpen size={15} style={{ color: '#7c3aed' }} />
                <span>General Ledger</span>
              </button>

              <button
                onClick={() => navigate('/accounting')}
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
                <PieChart size={15} style={{ color: '#f59e0b' }} />
                <span>Trial Balance</span>
              </button>
            </div>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
};
