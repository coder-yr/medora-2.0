export type ShiftStatus = 'OPEN' | 'CLOSING' | 'PENDING_APPROVAL' | 'CLOSED' | 'REJECTED';

export type TransactionType =
  | 'PAYMENT_RECEIVED'
  | 'REFUND'
  | 'CASH_PAYOUT'
  | 'OPENING_FLOAT'
  | 'CASH_ADJUSTMENT'
  | 'REVERSAL';

export interface CashDrawer {
  id: string;
  name: string;
  code: string;
  branchId?: string | null;
  assignedCashierId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftDenomination {
  denomination: number;
  count: number;
  amount: number;
}

export interface CashierShiftTotals {
  openingFloat: number;
  cashInflow: number;
  cashOutflow: number;
  cashAdjustments: number;
  expectedCash: number;
  cardTotal: number;
  bankTransferTotal: number;
  chequeTotal: number;
  onlineTotal: number;
  writeOffTotal: number;
  totalCollected: number;
  nonCashTotal: number;
  transactionCount: number;
}

export interface CashierShift {
  id: string;
  shiftNumber: string;
  cashierId: string;
  branchId?: string | null;
  cashDrawerId?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number | string;
  expectedCash?: number | string | null;
  countedCash?: number | string | null;
  cashVariance?: number | string | null;
  status: ShiftStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  closingNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  cashier?: {
    id: string;
    login: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  cashDrawer?: CashDrawer | null;
  liveTotals?: CashierShiftTotals;
  denominations?: ShiftDenomination[];
}

export interface CashTransaction {
  id: string;
  shiftId: string;
  transactionNumber: string;
  transactionType: TransactionType;
  paymentId?: string | null;
  invoicePaymentId?: string | null;
  sourceModule: string;
  sourceReference?: string | null;
  paymentMethod: string;
  amount: number | string;
  isCash: boolean;
  direction: 'INFLOW' | 'OUTFLOW';
  recordedBy: string;
  occurredAt: string;
  reversalReference?: string | null;
  notes?: string | null;
  recipient?: string | null;
  payment?: {
    id: string;
    amount: number | string;
    patientId: string;
    patient?: {
      id: string;
      name: string;
      patientId: string;
    };
  } | null;
}

export interface DayBookLine {
  date: string;
  invoice: string;
  patient: string;
  patientType: string;
  service: string;
  department: string;
  bucket: string;
  gross: number;
  discount: number;
  net: number;
  doctorShare: number;
  hospitalShare: number;
}

export interface DayBookCollections {
  cash: number;
  card: number;
  bank_transfer: number;
  cheque: number;
  online: number;
  write_off: number;
  other: number;
  total: number;
  count: number;
}

export interface DayBookReport {
  filters: {
    from: string;
    to: string;
    kind: string;
  };
  lines: DayBookLine[];
  byDepartment: Record<string, Record<string, number>>;
  byServiceKind: Record<string, number>;
  collections: DayBookCollections;
  totalBilledNet: number;
}

export interface PatientSettlementPreview {
  patient: {
    id: string;
    name: string;
    patientId: string;
    phone?: string;
  };
  totalReceivable: number;
  unpaidInvoices: Array<{
    id: string;
    date: string;
    grossTotal: number;
    amountReceived: number;
    balanceDue: number;
    careSetting?: string;
  }>;
}

export interface SettlePatientResult {
  success: boolean;
  patientId: string;
  amountSettled: number;
  amountWrittenOff: number;
  invoicesSettledCount: number;
  shiftId: string;
  settledInvoices: Array<{
    invoiceId: string;
    paidAmount: number;
    writeOffAmount: number;
    remainingBalance: number;
    newStatus: string;
  }>;
}
