import React, { useState, useEffect, useTransition } from 'react';
import {
  BookOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Lock,
  Unlock,
  Layers,
  FileSpreadsheet,
  Plus,
  Search,
  Send,
  XCircle,
  CreditCard,
  Building,
} from 'lucide-react';
import type {
  Account,
  AccountType,
  AccountingPeriod,
  DashboardMetrics,
  Expense,
  ExpenseCategory,
  JournalEntry,
  TrialBalanceReport,
  ProfitLossReport,
  BalanceSheetReport,
  GeneralLedgerReport,
} from '../../types/accounting';

interface AccountingWorkspaceProps {
  token: string;
}

const isDev = import.meta.env.DEV;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:3000' : '');

export function AccountingWorkspace({ token }: AccountingWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'journals' | 'expenses' | 'reports' | 'periods'>('dashboard');
  const [, startTransition] = useTransition();

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data states
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('');
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [journalStatusFilter, setJournalStatusFilter] = useState('');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('');

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState<{ id: string; journalNumber: string } | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<{ id: string; expenseNumber: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // New Account Form
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('ASSET');
  const [newAccountBalance, setNewAccountBalance] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [newAccountDesc, setNewAccountDesc] = useState('');

  // New Journal Entry Form (Multi-line debit/credit builder)
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [journalDesc, setJournalDesc] = useState('');
  const [journalLines, setJournalLines] = useState<Array<{ accountId: string; debit: number; credit: number; description: string }>>([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ]);
  const [journalPostImmediately, setJournalPostImmediately] = useState(true);

  // New Expense Form
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseInvoiceNo, setExpenseInvoiceNo] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('CASH');

  // New Period Form
  const [periodCode, setPeriodCode] = useState('');
  const [periodName, setPeriodName] = useState('');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');

  // Reports state
  const [reportSubTab, setReportSubTab] = useState<'tb' | 'pl' | 'bs' | 'gl'>('tb');
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerReport | null>(null);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');

  // Fetch Dashboard
  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setMetrics(data.data);
    } catch {
      // Graceful fallback
    }
  };

  // Fetch Accounts
  const fetchAccounts = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/api/v1/accounting/accounts`);
      if (accountTypeFilter) url.searchParams.set('accountType', accountTypeFilter);
      if (searchQuery) url.searchParams.set('search', searchQuery);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setAccounts(data.data.items || []);
    } catch {
      // Fallback
    }
  };

  // Fetch Journals
  const fetchJournals = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/api/v1/accounting/journals`);
      if (journalStatusFilter) url.searchParams.set('status', journalStatusFilter);
      if (searchQuery) url.searchParams.set('search', searchQuery);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setJournals(data.data.items || []);
    } catch {
      // Fallback
    }
  };

  // Fetch Expenses
  const fetchExpenses = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/api/v1/accounting/expenses`);
      if (expenseStatusFilter) url.searchParams.set('status', expenseStatusFilter);
      if (searchQuery) url.searchParams.set('vendorName', searchQuery);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setExpenses(data.data.items || []);
    } catch {
      // Fallback
    }
  };

  // Fetch Expense Categories
  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/expense-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setCategories(data.data || []);
    } catch {
      // Fallback
    }
  };

  // Fetch Periods
  const fetchPeriods = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/periods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPeriods(data.data.items || []);
    } catch {
      // Fallback
    }
  };

  // Fetch Reports
  const fetchReports = async () => {
    try {
      if (reportSubTab === 'tb') {
        const res = await fetch(`${API_BASE_URL}/api/v1/accounting/reports/trial-balance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setTrialBalance(data.data);
      } else if (reportSubTab === 'pl') {
        const res = await fetch(`${API_BASE_URL}/api/v1/accounting/reports/profit-loss`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setProfitLoss(data.data);
      } else if (reportSubTab === 'bs') {
        const res = await fetch(`${API_BASE_URL}/api/v1/accounting/reports/balance-sheet`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setBalanceSheet(data.data);
      } else if (reportSubTab === 'gl' && selectedLedgerAccountId) {
        const res = await fetch(`${API_BASE_URL}/api/v1/accounting/reports/general-ledger/${selectedLedgerAccountId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setGeneralLedger(data.data);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (!token) return;
    startTransition(() => {
      if (activeTab === 'dashboard') fetchDashboard();
      if (activeTab === 'accounts') fetchAccounts();
      if (activeTab === 'journals') {
        fetchJournals();
        fetchAccounts();
      }
      if (activeTab === 'expenses') {
        fetchExpenses();
        fetchCategories();
      }
      if (activeTab === 'reports') {
        fetchAccounts();
        fetchReports();
      }
      if (activeTab === 'periods') fetchPeriods();
    });
  }, [token, activeTab, accountTypeFilter, journalStatusFilter, expenseStatusFilter, reportSubTab, selectedLedgerAccountId]);

  // Compute live Debit/Credit balance in Journal Modal
  const totalModalDebit = journalLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalModalCredit = journalLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const modalDifference = Math.abs(totalModalDebit - totalModalCredit);
  const isJournalBalanced = modalDifference < 0.01 && totalModalDebit > 0;

  // Handle Journal Submit
  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isJournalBalanced) {
      setNotification({ type: 'error', message: 'Total debits must equal total credits.' });
      return;
    }

    try {
      const payload = {
        accountingDate: journalDate,
        description: journalDesc,
        postImmediately: journalPostImmediately,
        lines: journalLines.map((l) => ({
          accountId: Number(l.accountId),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || journalDesc,
        })),
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/journals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: `Journal ${data.data.journalNumber} created successfully.` });
        setShowJournalModal(false);
        fetchJournals();
        fetchDashboard();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to create journal.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network communication error.' });
    }
  };

  // Handle Journal Reversal
  const handleReverseJournal = async () => {
    if (!showReverseModal || !reversalReason.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/journals/${showReverseModal.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: `Reversal entry ${data.data.journalNumber} posted.` });
        setShowReverseModal(null);
        setReversalReason('');
        fetchJournals();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Reversal failed.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error reversing journal.' });
    }
  };

  // Handle Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accountCode: newAccountCode.trim(),
          accountName: newAccountName.trim(),
          accountType: newAccountType,
          normalBalance: newAccountBalance,
          description: newAccountDesc.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: `Account ${data.data.accountCode} created.` });
        setShowAccountModal(false);
        setNewAccountCode('');
        setNewAccountName('');
        fetchAccounts();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to create account.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error creating account.' });
    }
  };

  // Handle Create Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          categoryId: Number(expenseCategoryId),
          description: expenseDesc.trim(),
          amount: Number(expenseAmount),
          expenseDate,
          vendorName: expenseVendor.trim() || undefined,
          invoiceNumber: expenseInvoiceNo.trim() || undefined,
          paymentMethod: expensePaymentMethod,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: `Expense ${data.data.expenseNumber} drafted.` });
        setShowExpenseModal(false);
        setExpenseDesc('');
        setExpenseAmount(0);
        fetchExpenses();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to create expense.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error creating expense.' });
    }
  };

  // Handle Submit Expense
  const handleSubmitExpense = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/expenses/${id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Expense submitted for supervisor approval.' });
        fetchExpenses();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to submit.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error.' });
    }
  };

  // Handle Approve Expense
  const handleApproveExpense = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/expenses/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: 'Approved via Web Hub' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Expense approved.' });
        fetchExpenses();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Approval failed.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error.' });
    }
  };

  // Handle Reject Expense
  const handleRejectExpense = async () => {
    if (!showRejectModal || !rejectionReason.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/expenses/${showRejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Expense rejected.' });
        setShowRejectModal(null);
        setRejectionReason('');
        fetchExpenses();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Rejection failed.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error.' });
    }
  };

  // Handle Pay Expense
  const handlePayExpense = async (id: string) => {
    if (!confirm('Disburse payment and generate double-entry journal entry?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/expenses/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Payment disbursed and balanced journal entry posted.' });
        fetchExpenses();
        fetchDashboard();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Payment disbursement failed.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error.' });
    }
  };

  // Handle Create Period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          periodCode: periodCode.trim(),
          name: periodName.trim(),
          startDate: periodStartDate,
          endDate: periodEndDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Period ${data.data.periodCode} created.` });
        setShowPeriodModal(false);
        fetchPeriods();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to create period.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error.' });
    }
  };

  // Handle Close Period
  const handleClosePeriod = async (id: string) => {
    if (!confirm('Are you sure you want to lock and close this accounting period? All further transactions will be blocked.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/periods/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ closingNotes: 'Closed via Accounting Hub' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Period closed and locked.' });
        fetchPeriods();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to close period.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error.' });
    }
  };

  // Handle Reopen Period
  const handleReopenPeriod = async (id: string) => {
    const reason = prompt('Please enter mandatory audit reason for reopening locked period:');
    if (!reason || !reason.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/accounting/periods/${id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Period reopened.' });
        fetchPeriods();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to reopen period.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error.' });
    }
  };

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={24} style={{ color: '#0284c7' }} /> General Accounting & Double-Entry Ledger
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Chart of Accounts, Journal Entries, Expense Lifecycle & Financial Statements
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <TrendingUp size={16} /> Overview
          </button>
          <button
            className={`btn ${activeTab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('accounts')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Layers size={16} /> Chart of Accounts
          </button>
          <button
            className={`btn ${activeTab === 'journals' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('journals')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <BookOpen size={16} /> Journal Entries
          </button>
          <button
            className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('expenses')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <DollarSign size={16} /> Expenses
          </button>
          <button
            className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('reports')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <FileSpreadsheet size={16} /> Financial Reports
          </button>
          <button
            className={`btn ${activeTab === 'periods' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('periods')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Calendar size={16} /> Periods
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          style={{
            padding: '10px 16px',
            marginBottom: 16,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: notification.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: DASHBOARD OVERVIEW */}
      {/* ======================================================== */}
      {activeTab === 'dashboard' && metrics && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Monthly Revenue</span>
                <TrendingUp size={20} style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: 24, margin: '8px 0 0 0', color: '#14532d' }}>
                PKR {metrics.totalRevenueMonth.toLocaleString()}
              </h3>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 600 }}>Monthly Expenses</span>
                <TrendingDown size={20} style={{ color: '#dc2626' }} />
              </div>
              <h3 style={{ fontSize: 24, margin: '8px 0 0 0', color: '#7f1d1d' }}>
                PKR {metrics.totalExpenseMonth.toLocaleString()}
              </h3>
            </div>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#075985', fontWeight: 600 }}>Net Operating Surplus</span>
                <DollarSign size={20} style={{ color: '#0284c7' }} />
              </div>
              <h3 style={{ fontSize: 24, margin: '8px 0 0 0', color: '#0c4a6e' }}>
                PKR {metrics.netSurplusMonth.toLocaleString()}
              </h3>
            </div>

            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#6b21a8', fontWeight: 600 }}>Cash & Bank Liquidity</span>
                <Building size={20} style={{ color: '#9333ea' }} />
              </div>
              <h3 style={{ fontSize: 24, margin: '8px 0 0 0', color: '#581c87' }}>
                PKR {metrics.totalLiquidity.toLocaleString()}
              </h3>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>Accounts Receivable</span>
                <CreditCard size={20} style={{ color: '#d97706' }} />
              </div>
              <h3 style={{ fontSize: 24, margin: '8px 0 0 0', color: '#78350f' }}>
                PKR {metrics.totalReceivables.toLocaleString()}
              </h3>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowJournalModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> New Journal Entry
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowExpenseModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> Record Expense
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setActiveTab('reports');
                setReportSubTab('tb');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={16} /> View Trial Balance
            </button>
          </div>

          {/* Recent Double-Entry Journals */}
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recent Double-Entry Journals</h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Journal #</th>
                    <th>Date</th>
                    <th>Narration</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentJournals && metrics.recentJournals.length > 0 ? (
                    metrics.recentJournals.map((j) => (
                      <tr key={j.id}>
                        <td style={{ fontWeight: 600, color: '#0284c7' }}>{j.journalNumber}</td>
                        <td>{new Date(j.accountingDate).toLocaleDateString()}</td>
                        <td>{j.description}</td>
                        <td>
                          <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                            {j.sourceModule}
                          </span>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: j.status === 'POSTED' ? '#dcfce7' : j.status === 'DRAFT' ? '#fef9c3' : '#fee2e2',
                              color: j.status === 'POSTED' ? '#166534' : j.status === 'DRAFT' ? '#854d0e' : '#991b1b',
                            }}
                          >
                            {j.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {Number(j.totalDebit).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        No journal entries posted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CHART OF ACCOUNTS */}
      {/* ======================================================== */}
      {activeTab === 'accounts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 240 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search code or name..."
                  className="form-input"
                  style={{ paddingLeft: 32 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ width: 160 }}
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="ASSET">Assets (1xxx)</option>
                <option value="LIABILITY">Liabilities (2xxx)</option>
                <option value="EQUITY">Equity (3xxx)</option>
                <option value="REVENUE">Revenue (4xxx)</option>
                <option value="EXPENSE">Expenses (5xxx)</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowAccountModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> New Account
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Normal Balance</th>
                  <th>System</th>
                  <th>Manual Post</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0284c7' }}>{acc.accountCode}</td>
                    <td style={{ fontWeight: 600 }}>{acc.accountName}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            acc.accountType === 'ASSET'
                              ? '#eff6ff'
                              : acc.accountType === 'LIABILITY'
                              ? '#fef2f2'
                              : acc.accountType === 'EQUITY'
                              ? '#faf5ff'
                              : acc.accountType === 'REVENUE'
                              ? '#f0fdf4'
                              : '#fffbeb',
                          color:
                            acc.accountType === 'ASSET'
                              ? '#1e40af'
                              : acc.accountType === 'LIABILITY'
                              ? '#991b1b'
                              : acc.accountType === 'EQUITY'
                              ? '#6b21a8'
                              : acc.accountType === 'REVENUE'
                              ? '#166534'
                              : '#92400e',
                        }}
                      >
                        {acc.accountType}
                      </span>
                    </td>
                    <td>{acc.normalBalance}</td>
                    <td>
                      {acc.isSystemAccount ? (
                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                          System Protected
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Custom</span>
                      )}
                    </td>
                    <td>{acc.allowManualPosting ? 'Yes' : 'Automated Only'}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: acc.isActive ? '#dcfce7' : '#fee2e2',
                          color: acc.isActive ? '#166534' : '#991b1b',
                        }}
                      >
                        {acc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: JOURNAL ENTRIES */}
      {/* ======================================================== */}
      {activeTab === 'journals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 240 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search journal # or desc..."
                  className="form-input"
                  style={{ paddingLeft: 32 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ width: 140 }}
                value={journalStatusFilter}
                onChange={(e) => setJournalStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="POSTED">POSTED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="REVERSED">REVERSED</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowJournalModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> New Journal Entry
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Journal #</th>
                  <th>Date</th>
                  <th>Narration</th>
                  <th>Source</th>
                  <th>Total Debit</th>
                  <th>Total Credit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {journals.map((j) => (
                  <tr key={j.id}>
                    <td style={{ fontWeight: 700, color: '#0284c7' }}>{j.journalNumber}</td>
                    <td>{new Date(j.accountingDate).toLocaleDateString()}</td>
                    <td>{j.description}</td>
                    <td>
                      <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                        {j.sourceModule}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{Number(j.totalDebit).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{Number(j.totalCredit).toLocaleString()}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: j.status === 'POSTED' ? '#dcfce7' : j.status === 'DRAFT' ? '#fef9c3' : '#fee2e2',
                          color: j.status === 'POSTED' ? '#166534' : j.status === 'DRAFT' ? '#854d0e' : '#991b1b',
                        }}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {j.status === 'POSTED' && !j.reversedEntryId && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setShowReverseModal({ id: j.id, journalNumber: j.journalNumber })}
                        >
                          <RotateCcw size={14} /> Reverse
                        </button>
                      )}
                      {j.status === 'REVERSED' && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reversed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: EXPENSES */}
      {/* ======================================================== */}
      {activeTab === 'expenses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 240 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search vendor..."
                  className="form-input"
                  style={{ paddingLeft: 32 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ width: 150 }}
                value={expenseStatusFilter}
                onChange={(e) => setExpenseStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PAID">PAID</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowExpenseModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> New Expense
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Expense #</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ fontWeight: 700, color: '#0284c7' }}>{exp.expenseNumber}</td>
                    <td>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                    <td>{exp.category?.name}</td>
                    <td>{exp.description}</td>
                    <td>{exp.vendorName || '-'}</td>
                    <td style={{ fontWeight: 600 }}>PKR {Number(exp.amount).toLocaleString()}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            exp.status === 'PAID'
                              ? '#dcfce7'
                              : exp.status === 'APPROVED'
                              ? '#eff6ff'
                              : exp.status === 'SUBMITTED'
                              ? '#fef9c3'
                              : exp.status === 'REJECTED'
                              ? '#fee2e2'
                              : '#f1f5f9',
                          color:
                            exp.status === 'PAID'
                              ? '#166534'
                              : exp.status === 'APPROVED'
                              ? '#1e40af'
                              : exp.status === 'SUBMITTED'
                              ? '#854d0e'
                              : exp.status === 'REJECTED'
                              ? '#991b1b'
                              : '#475569',
                        }}
                      >
                        {exp.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {exp.status === 'DRAFT' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => handleSubmitExpense(exp.id)}
                          >
                            <Send size={13} /> Submit
                          </button>
                        )}
                        {exp.status === 'SUBMITTED' && (
                          <>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: 12, background: '#16a34a' }}
                              onClick={() => handleApproveExpense(exp.id)}
                            >
                              <CheckCircle size={13} /> Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 12, color: '#dc2626' }}
                              onClick={() => setShowRejectModal({ id: exp.id, expenseNumber: exp.expenseNumber })}
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </>
                        )}
                        {exp.status === 'APPROVED' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => handlePayExpense(exp.id)}
                          >
                            <DollarSign size={13} /> Pay & Post
                          </button>
                        )}
                        {exp.status === 'PAID' && (
                          <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Paid</span>
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

      {/* ======================================================== */}
      {/* TAB 5: FINANCIAL REPORTS */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              className={`btn ${reportSubTab === 'tb' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setReportSubTab('tb')}
              style={{ fontSize: 13 }}
            >
              Trial Balance
            </button>
            <button
              className={`btn ${reportSubTab === 'pl' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setReportSubTab('pl')}
              style={{ fontSize: 13 }}
            >
              Profit & Loss (P&L)
            </button>
            <button
              className={`btn ${reportSubTab === 'bs' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setReportSubTab('bs')}
              style={{ fontSize: 13 }}
            >
              Balance Sheet
            </button>
            <button
              className={`btn ${reportSubTab === 'gl' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setReportSubTab('gl')}
              style={{ fontSize: 13 }}
            >
              General Ledger
            </button>
          </div>

          {/* Trial Balance SubTab */}
          {reportSubTab === 'tb' && trialBalance && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Trial Balance</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>As of {trialBalance.asOfDate}</p>
                </div>
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: trialBalance.isBalanced ? '#ecfdf5' : '#fef2f2',
                    color: trialBalance.isBalanced ? '#065f46' : '#991b1b',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {trialBalance.isBalanced ? '✓ Balanced Equilibrium' : '⚠ Out of Balance'}
                </div>
              </div>

              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Debit (PKR)</th>
                    <th style={{ textAlign: 'right' }}>Credit (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.accounts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.accountCode}</td>
                      <td>{a.accountName}</td>
                      <td>{a.accountType}</td>
                      <td style={{ textAlign: 'right' }}>
                        {a.netDebit > 0 ? a.netDebit.toLocaleString() : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {a.netCredit > 0 ? a.netCredit.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={3}>TOTAL EQUILIBRIUM</td>
                    <td style={{ textAlign: 'right', color: '#0284c7' }}>
                      PKR {trialBalance.totalDebitSum.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', color: '#0284c7' }}>
                      PKR {trialBalance.totalCreditSum.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Profit & Loss SubTab */}
          {reportSubTab === 'pl' && profitLoss && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>Profit & Loss (Income Statement)</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Period: {profitLoss.startDate} to {profitLoss.endDate}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Revenue Section */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: '#166534', marginBottom: 12 }}>Operating Revenues</h4>
                  {profitLoss.revenues.map((r) => (
                    <div key={r.accountCode} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span>{r.accountCode} - {r.accountName}</span>
                      <span style={{ fontWeight: 600 }}>PKR {r.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, color: '#166534' }}>
                    <span>Total Revenue</span>
                    <span>PKR {profitLoss.totalRevenue.toLocaleString()}</span>
                  </div>
                </div>

                {/* Expenses Section */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: '#991b1b', marginBottom: 12 }}>Operating Expenses</h4>
                  {profitLoss.expenses.map((e) => (
                    <div key={e.accountCode} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span>{e.accountCode} - {e.accountName}</span>
                      <span style={{ fontWeight: 600 }}>PKR {e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, color: '#991b1b' }}>
                    <span>Total Expense</span>
                    <span>PKR {profitLoss.totalExpense.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Net Operating Surplus / (Deficit)</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: profitLoss.netOperatingIncome >= 0 ? '#166534' : '#991b1b' }}>
                  PKR {profitLoss.netOperatingIncome.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Balance Sheet SubTab */}
          {reportSubTab === 'bs' && balanceSheet && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Balance Sheet</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>As of {balanceSheet.asOfDate}</p>
                </div>
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: balanceSheet.isBalanced ? '#ecfdf5' : '#fef2f2',
                    color: balanceSheet.isBalanced ? '#065f46' : '#991b1b',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {balanceSheet.isBalanced ? '✓ Assets = Liabilities + Equity' : '⚠ Out of Balance'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Assets */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0284c7', marginBottom: 12 }}>Total Assets</h4>
                  {balanceSheet.assets.map((a) => (
                    <div key={a.accountCode} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span>{a.accountCode} - {a.accountName}</span>
                      <span style={{ fontWeight: 600 }}>PKR {a.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, color: '#0284c7' }}>
                    <span>Total Assets</span>
                    <span>PKR {balanceSheet.totalAssets.toLocaleString()}</span>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: '#9333ea', marginBottom: 12 }}>Liabilities & Equity</h4>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Liabilities:</div>
                  {balanceSheet.liabilities.map((l) => (
                    <div key={l.accountCode} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{l.accountCode} - {l.accountName}</span>
                      <span>PKR {l.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', margin: '12px 0 4px 0' }}>Equity:</div>
                  {balanceSheet.equity.map((e) => (
                    <div key={e.accountCode} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{e.accountCode} - {e.accountName}</span>
                      <span>PKR {e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#166534' }}>
                    <span>Current Period Net Surplus</span>
                    <span>PKR {balanceSheet.currentPeriodNetSurplus.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, color: '#9333ea', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <span>Total Liabilities & Equity</span>
                    <span>PKR {balanceSheet.totalLiabilitiesAndEquity.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Ledger SubTab */}
          {reportSubTab === 'gl' && (
            <div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Select Account:</span>
                <select
                  className="form-select"
                  style={{ width: 280 }}
                  value={selectedLedgerAccountId}
                  onChange={(e) => setSelectedLedgerAccountId(e.target.value)}
                >
                  <option value="">-- Choose Account --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} - {a.accountName}
                    </option>
                  ))}
                </select>
              </div>

              {generalLedger ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#f8fafc', borderRadius: 6, marginBottom: 12 }}>
                    <div>
                      <strong>Account: </strong> {generalLedger.account.code} - {generalLedger.account.name}
                    </div>
                    <div>
                      <strong>Opening Balance: </strong> PKR {generalLedger.openingBalance.toLocaleString()} |{' '}
                      <strong>Closing Balance: </strong> PKR {generalLedger.closingBalance.toLocaleString()}
                    </div>
                  </div>

                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Journal #</th>
                        <th>Narration</th>
                        <th style={{ textAlign: 'right' }}>Debit</th>
                        <th style={{ textAlign: 'right' }}>Credit</th>
                        <th style={{ textAlign: 'right' }}>Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generalLedger.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.accountingDate}</td>
                          <td style={{ color: '#0284c7', fontWeight: 600 }}>{entry.journalNumber}</td>
                          <td>{entry.narration}</td>
                          <td style={{ textAlign: 'right' }}>{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                          <td style={{ textAlign: 'right' }}>{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>PKR {entry.runningBalance.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Select an account above to generate its chronological General Ledger audit trail.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: ACCOUNTING PERIODS */}
      {/* ======================================================== */}
      {activeTab === 'periods' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Accounting Periods & Fiscal Locks</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage month-end closing and book lockouts</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowPeriodModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> New Period
            </button>
          </div>

          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Period Code</th>
                <th>Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{p.periodCode}</td>
                  <td>{p.name}</td>
                  <td>{new Date(p.startDate).toLocaleDateString()}</td>
                  <td>{new Date(p.endDate).toLocaleDateString()}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: p.status === 'OPEN' ? '#dcfce7' : '#fee2e2',
                        color: p.status === 'OPEN' ? '#166534' : '#991b1b',
                      }}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.status === 'OPEN' ? (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleClosePeriod(p.id)}
                      >
                        <Lock size={13} /> Close Period
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleReopenPeriod(p.id)}
                      >
                        <Unlock size={13} /> Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NEW ACCOUNT */}
      {/* ======================================================== */}
      {showAccountModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 440, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Create Account</h3>
            <form onSubmit={handleCreateAccount}>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Account Code (e.g. 1015, 5250)</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Account Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Account Type</label>
                  <select
                    className="form-select"
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as any)}
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="REVENUE">REVENUE</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Normal Balance</label>
                  <select
                    className="form-select"
                    value={newAccountBalance}
                    onChange={(e) => setNewAccountBalance(e.target.value as any)}
                  >
                    <option value="DEBIT">DEBIT</option>
                    <option value="CREDIT">CREDIT</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={newAccountDesc}
                  onChange={(e) => setNewAccountDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAccountModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NEW JOURNAL ENTRY (DOUBLE-ENTRY BUILDER) */}
      {/* ======================================================== */}
      {showJournalModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 720, maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Create Double-Entry Journal Entry</h3>
            <form onSubmit={handleCreateJournal}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="form-label">Accounting Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={journalDate}
                    onChange={(e) => setJournalDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Journal Narration / Description</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Bank deposit from Cashier vault"
                    value={journalDesc}
                    onChange={(e) => setJournalDesc(e.target.value)}
                  />
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>Debit & Credit Lines</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: 12 }}
                    onClick={() => setJournalLines([...journalLines, { accountId: '', debit: 0, credit: 0, description: '' }])}
                  >
                    + Add Line
                  </button>
                </div>

                {journalLines.map((line, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr 40px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select
                      className="form-select"
                      required
                      value={line.accountId}
                      onChange={(e) => {
                        const updated = [...journalLines];
                        updated[idx].accountId = e.target.value;
                        setJournalLines(updated);
                      }}
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.accountCode} - {a.accountName}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="Debit"
                      value={line.debit || ''}
                      onChange={(e) => {
                        const updated = [...journalLines];
                        updated[idx].debit = parseFloat(e.target.value) || 0;
                        if (updated[idx].debit > 0) updated[idx].credit = 0;
                        setJournalLines(updated);
                      }}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="Credit"
                      value={line.credit || ''}
                      onChange={(e) => {
                        const updated = [...journalLines];
                        updated[idx].credit = parseFloat(e.target.value) || 0;
                        if (updated[idx].credit > 0) updated[idx].debit = 0;
                        setJournalLines(updated);
                      }}
                    />

                    {journalLines.length > 2 && (
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}
                        onClick={() => {
                          const updated = journalLines.filter((_, i) => i !== idx);
                          setJournalLines(updated);
                        }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}

                {/* Equilibrium Totals Bar */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: isJournalBalanced ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${isJournalBalanced ? '#a7f3d0' : '#fecaca'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 12,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Total Debits: </span>
                    <span>PKR {totalModalDebit.toLocaleString()}</span>
                    <span style={{ margin: '0 8px' }}>|</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Total Credits: </span>
                    <span>PKR {totalModalCredit.toLocaleString()}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isJournalBalanced ? '#065f46' : '#991b1b' }}>
                    {isJournalBalanced ? '✓ Balanced (Sum Dr == Sum Cr)' : `⚠ Out of Balance by PKR ${modalDifference.toFixed(2)}`}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={journalPostImmediately}
                    onChange={(e) => setJournalPostImmediately(e.target.checked)}
                  />
                  <span>Post immediately to General Ledger (otherwise save as DRAFT)</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowJournalModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!isJournalBalanced}>
                  Save & Post Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NEW EXPENSE */}
      {/* ======================================================== */}
      {showExpenseModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 480, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Record Expense</h3>
            <form onSubmit={handleCreateExpense}>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  required
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Biomedical equipment servicing"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Amount (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    required
                    value={expenseAmount || ''}
                    onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Vendor Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Siemens Healthcare"
                    value={expenseVendor}
                    onChange={(e) => setExpenseVendor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Invoice / Bill Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. INV-2026-99"
                    value={expenseInvoiceNo}
                    onChange={(e) => setExpenseInvoiceNo(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={expensePaymentMethod}
                  onChange={(e) => setExpensePaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Draft Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REVERSE JOURNAL */}
      {/* ======================================================== */}
      {showReverseModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 440, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#dc2626' }}>
              Reverse Journal {showReverseModal.journalNumber}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              A mirror-image reversal entry will be generated, swapping all debit and credit lines and locking the original entry.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Mandatory Audit Reason</label>
              <textarea
                className="form-input"
                rows={3}
                required
                placeholder="Reason for reversal..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowReverseModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ background: '#dc2626' }} onClick={handleReverseJournal}>
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REJECT EXPENSE */}
      {/* ======================================================== */}
      {showRejectModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 440, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#dc2626' }}>
              Reject Expense {showRejectModal.expenseNumber}
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Mandatory Reason for Rejection</label>
              <textarea
                className="form-input"
                rows={3}
                required
                placeholder="Specify why this expense is rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ background: '#dc2626' }} onClick={handleRejectExpense}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NEW PERIOD */}
      {/* ======================================================== */}
      {showPeriodModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 440, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Create Accounting Period</h3>
            <form onSubmit={handleCreatePeriod}>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Period Code (e.g. FY2026-M12)</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={periodCode}
                  onChange={(e) => setPeriodCode(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Period Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. December 2026"
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPeriodModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
