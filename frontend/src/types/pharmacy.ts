export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  mfgDate?: string | null;
  expiryDate: string;
  costPrice: number;
  sellingPrice?: number | null;
  initialQuantity: number;
  currentQuantity: number;
  supplierId?: string | null;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'QUARANTINED' | 'RECALLED' | 'SUSPENDED';
  location?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  medicine?: {
    id: string;
    name: string;
    generic?: string | null;
    box?: string | null;
    strength?: string | null;
  };
  supplier?: {
    id: string;
    name: string;
  } | null;
}

export interface StockMovement {
  id: string;
  medicineId: string;
  batchId?: string | null;
  movementType:
    | 'PURCHASE_RECEIPT'
    | 'DISPENSING'
    | 'CUSTOMER_RETURN'
    | 'SUPPLIER_RETURN'
    | 'STOCK_ADJUSTMENT_IN'
    | 'STOCK_ADJUSTMENT_OUT'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
    | 'EXPIRED_WRITE_OFF'
    | 'DAMAGED_WRITE_OFF';
  quantity: number;
  balanceAfter: number;
  unitCost?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  performedBy?: string | null;
  reason?: string | null;
  createdAt: string;
  medicine?: {
    id: string;
    name: string;
    generic?: string | null;
    box?: string | null;
  };
  batch?: {
    id: string;
    batchNumber: string;
    expiryDate: string;
  } | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  medicineId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
  medicine?: {
    id: string;
    name: string;
    box?: string | null;
  };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  orderDate: string;
  expectedDate?: string | null;
  totalAmount: number;
  status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  notes?: string | null;
  createdAt: string;
  supplier?: {
    id: string;
    name: string;
    phone?: string | null;
  };
  items: PurchaseOrderItem[];
}

export interface GoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  medicineId: string;
  batchId: string;
  batchNumber: string;
  mfgDate?: string | null;
  expiryDate: string;
  quantityReceived: number;
  unitCost: number;
  sellingPrice: number;
  lineTotal: number;
  medicine?: {
    id: string;
    name: string;
    box?: string | null;
  };
  batch?: MedicineBatch;
}

export interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId?: string | null;
  supplierId: string;
  receiptDate: string;
  supplierInvoiceNumber?: string | null;
  totalAmount: number;
  notes?: string | null;
  createdAt: string;
  supplier?: {
    id: string;
    name: string;
  };
  items: GoodsReceiptItem[];
}

export interface PharmacyDispensationItem {
  id: string;
  dispensationId: string;
  prescriptionMedicineId?: string | null;
  medicineId?: string | null;
  batchId?: string | null;
  medicineName: string;
  batchNumber?: string | null;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  batch?: MedicineBatch;
}

export interface PharmacyDispensation {
  id: string;
  dispensationNumber: string;
  prescriptionId?: string | null;
  patientId?: string | null;
  doctorId?: string | null;
  patientName?: string | null;
  dispenseDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  invoiceId?: string | null;
  notes?: string | null;
  createdAt: string;
  patient?: {
    id: string;
    name: string;
    patientId: string;
  } | null;
  doctor?: {
    id: string;
    name: string;
  } | null;
  items: PharmacyDispensationItem[];
}

export interface StockAdjustmentItem {
  id: string;
  adjustmentId: string;
  medicineId: string;
  batchId: string;
  systemQuantity: number;
  physicalQuantity: number;
  difference: number;
  unitCost: number;
  medicine?: {
    id: string;
    name: string;
    box?: string | null;
  };
  batch?: MedicineBatch;
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  reason: 'PHYSICAL_COUNT' | 'DAMAGED' | 'EXPIRED' | 'AUDIT_CORRECTION' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string | null;
  createdAt: string;
  items: StockAdjustmentItem[];
}

export interface PharmacyReturnItem {
  id: string;
  returnId: string;
  dispensationItemId?: string | null;
  medicineId: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  totalRefund: number;
  condition: 'SALEABLE' | 'DAMAGED' | 'EXPIRED';
  batch?: MedicineBatch;
}

export interface PharmacyReturn {
  id: string;
  returnNumber: string;
  returnType: 'PATIENT_RETURN' | 'SUPPLIER_RETURN';
  dispensationId?: string | null;
  supplierId?: string | null;
  returnDate: string;
  reason: string;
  totalRefund: number;
  restockToInventory: boolean;
  createdAt: string;
  dispensation?: {
    id: string;
    dispensationNumber: string;
    patientName?: string | null;
  } | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
  items: PharmacyReturnItem[];
}

export interface PrescriptionDispenseLine {
  prescriptionMedicineId: string;
  medicineId: string | null;
  prescribedName: string;
  matchedMedicineName: string | null;
  dosage?: string | null;
  duration?: string | null;
  instructions?: string | null;
  quantityPrescribed: number;
  quantityDispensed: number;
  quantityRemaining: number;
  availableStock: number;
  unitPrice: number;
  batches: MedicineBatch[];
  fefoPlan?: {
    requestedQty: number;
    availableTotal: number;
    isFullyFulfillable: boolean;
    shortfall: number;
    allocations: Array<{
      batch: MedicineBatch;
      allocatedQty: number;
    }>;
  } | null;
}

export interface PrescriptionDispenseContext {
  prescription: {
    id: string;
    date: string;
    state?: string | null;
    patient: {
      id: string;
      name: string;
      patientId: string;
      age?: string | null;
      sex?: string | null;
      phone?: string | null;
    };
    doctor?: {
      id: string;
      name: string;
    } | null;
  };
  lines: PrescriptionDispenseLine[];
}

export interface DashboardMetrics {
  totalMedicines: number;
  lowStockCount: number;
  totalCostValuation: number;
  totalRetailValuation: number;
  expiringWithin30Days: number;
  expiredBatchesCount: number;
  todayDispensationsCount: number;
  todayTakings: number;
  recentMovements: StockMovement[];
  pendingPurchaseOrders: PurchaseOrder[];
}

export interface ValuationReport {
  totalUnits: number;
  totalCostValuation: number;
  totalRetailValuation: number;
  potentialProfit: number;
  breakdown: Array<{
    batchId: string;
    medicineName: string;
    batchNumber: string;
    currentQuantity: number;
    costPrice: number;
    sellingPrice: number;
    costTotal: number;
    retailTotal: number;
  }>;
}
