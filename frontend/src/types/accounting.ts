export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type AccountingPeriodStatus = 'OPEN' | 'CLOSING' | 'CLOSED';
export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';

export interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  description?: string | null;
  accountType: AccountType;
  accountSubType?: string | null;
  normalBalance: NormalBalance;
  parentAccountId?: string | null;
  isSystemAccount: boolean;
  isActive: boolean;
  allowManualPosting: boolean;
  currency: string;
  branchId?: string | null;
  parentAccount?: {
    id: string;
    accountCode: string;
    accountName: string;
  } | null;
  children?: Account[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountingPeriod {
  id: string;
  periodCode: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
  branchId?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  closingNotes?: string | null;
  closer?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  } | null;
  createdAt?: string;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  lineNumber: number;
  debit: number | string;
  credit: number | string;
  description?: string | null;
  account?: {
    id: string;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
  };
}

export interface JournalEntry {
  id: string;
  journalNumber: string;
  accountingDate: string;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  sourceModule: string;
  sourceReference?: string | null;
  idempotencyKey?: string | null;
  status: JournalStatus;
  totalDebit: number | string;
  totalCredit: number | string;
  branchId?: string | null;
  periodId?: string | null;
  createdById: string;
  postedById?: string | null;
  postedAt?: string | null;
  reversedEntryId?: string | null;
  reversalReason?: string | null;
  lines: JournalEntryLine[];
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  };
  poster?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  } | null;
  reversedEntry?: {
    id: string;
    journalNumber: string;
    description: string;
  } | null;
  reversalBy?: {
    id: string;
    journalNumber: string;
    description: string;
  } | null;
  createdAt?: string;
}

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  accountId?: string | null;
  isActive: boolean;
  account?: {
    id: string;
    accountCode: string;
    accountName: string;
  } | null;
}

export interface Expense {
  id: string;
  expenseNumber: string;
  categoryId: string;
  description: string;
  amount: number | string;
  expenseDate: string;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  paymentMethod: string;
  status: ExpenseStatus;
  branchId?: string | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  paidAt?: string | null;
  paidById?: string | null;
  postedJournalEntryId?: string | null;
  notes?: string | null;
  category: ExpenseCategory;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  };
  approver?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  } | null;
  payer?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  } | null;
  postedJournalEntry?: {
    id: string;
    journalNumber: string;
    status: string;
  } | null;
  createdAt?: string;
}

export interface DashboardMetrics {
  totalRevenueMonth: number;
  totalExpenseMonth: number;
  netSurplusMonth: number;
  totalLiquidity: number;
  totalReceivables: number;
  pendingExpensesCount: number;
  recentJournals: JournalEntry[];
}

export interface TrialBalanceReport {
  asOfDate: string;
  isBalanced: boolean;
  totalDebitSum: number;
  totalCreditSum: number;
  accounts: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    normalBalance: NormalBalance;
    debitTotal: number;
    creditTotal: number;
    netDebit: number;
    netCredit: number;
  }>;
}

export interface ProfitLossReport {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalExpense: number;
  netOperatingIncome: number;
  revenues: Array<{
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
  expenses: Array<{
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
}

export interface BalanceSheetReport {
  asOfDate: string;
  isBalanced: boolean;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentPeriodNetSurplus: number;
  totalLiabilitiesAndEquity: number;
  assets: Array<{
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
  liabilities: Array<{
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
  equity: Array<{
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
}

export interface GeneralLedgerReport {
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    normalBalance: NormalBalance;
  };
  openingBalance: number;
  closingBalance: number;
  entries: Array<{
    id: string;
    journalNumber: string;
    accountingDate: string;
    narration: string;
    referenceType?: string | null;
    referenceId?: string | null;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}
