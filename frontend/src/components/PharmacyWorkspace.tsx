import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Package,
  Clock,
  DollarSign,
  TrendingUp,
  Receipt,
  ShoppingCart,
  RotateCcw,
  Sliders,
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  X,
  Printer,
} from 'lucide-react';
import type {
  DashboardMetrics,
  MedicineBatch,
  StockMovement,
  PurchaseOrder,
  GoodsReceipt,
  PharmacyDispensation,
  StockAdjustment,
  PharmacyReturn,
  PrescriptionDispenseContext,
  ValuationReport,
} from '../types/pharmacy';
import type { Supplier } from '../types/medicine';

interface Props {
  apiBaseUrl: string;
  token: string;
  userRole: 'Doctor' | 'Admin' | 'Pharmacist' | 'Laboratorist';
  onNotification: (type: 'success' | 'error', message: string) => void;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

export function PharmacyWorkspace({
  apiBaseUrl,
  token,
  userRole,
  onNotification,
}: Props) {
  // Main Workspace Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'dispense' | 'inventory' | 'purchases' | 'adjustments' | 'reports'
  >('overview');

  // Loading states
  const [loading, setLoading] = useState(false);

  // 1. Dashboard State
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);

  // 2. Batches State
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('');
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [newBatch, setNewBatch] = useState(() => ({
    medicineId: '',
    batchNumber: '',
    mfgDate: '',
    expiryDate: '',
    costPrice: '',
    sellingPrice: '',
    quantity: '',
    supplierId: '',
    notes: '',
  }));

  // 3. Purchasing & GRN State
  const [purchasesSubTab, setPurchasesSubTab] = useState<'orders' | 'receipts'>('orders');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalogMedicines, setCatalogMedicines] = useState<any[]>([]);
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [showCreateGRNModal, setShowCreateGRNModal] = useState(false);
  const [newPO, setNewPO] = useState(() => ({
    supplierId: '',
    orderDate: getTodayString(),
    expectedDate: '',
    notes: '',
    items: [{ medicineId: '', quantityOrdered: 10, unitCost: 5.0 }],
  }));
  const [newGRN, setNewGRN] = useState(() => ({
    supplierId: '',
    purchaseOrderId: '',
    receiptDate: getTodayString(),
    supplierInvoiceNumber: '',
    notes: '',
    items: [
      {
        medicineId: '',
        batchNumber: '',
        expiryDate: '',
        quantityReceived: 10,
        unitCost: 5.0,
        sellingPrice: 10.0,
      },
    ],
  }));

  // 4. Dispensing State
  const [prescriptionLookupId, setPrescriptionLookupId] = useState('');
  const [dispenseContext, setDispenseContext] = useState<PrescriptionDispenseContext | null>(null);
  const [dispenseItems, setDispenseItems] = useState<
    Array<{
      prescriptionMedicineId?: string;
      medicineId: string;
      batchId?: string;
      quantity: number;
      unitPrice: number;
      medicineName: string;
    }>
  >([]);
  const [generateInvoice, setGenerateInvoice] = useState(true);
  const [dispensationReceipt, setDispensationReceipt] = useState<PharmacyDispensation | null>(null);

  // 5. Adjustments & Returns State
  const [adjSubTab, setAdjSubTab] = useState<'adjustments' | 'returns'>('adjustments');
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [returns, setReturns] = useState<PharmacyReturn[]>([]);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [newAdj, setNewAdj] = useState(() => ({
    adjustmentDate: getTodayString(),
    reason: 'PHYSICAL_COUNT',
    notes: '',
    medicineId: '',
    batchId: '',
    systemQuantity: 0,
    physicalQuantity: 0,
  }));
  const [newReturn, setNewReturn] = useState(() => ({
    returnType: 'PATIENT_RETURN' as 'PATIENT_RETURN' | 'SUPPLIER_RETURN',
    dispensationId: '',
    returnDate: getTodayString(),
    reason: '',
    restockToInventory: true,
    dispensationItemId: '',
    medicineId: '',
    batchId: '',
    quantity: 1,
    condition: 'SALEABLE' as 'SALEABLE' | 'DAMAGED' | 'EXPIRED',
  }));

  // 6. Reports State
  const [reportsSubTab, setReportsSubTab] = useState<'valuation' | 'expiry' | 'lowstock' | 'movements'>('valuation');
  const [valuation, setValuation] = useState<ValuationReport | null>(null);
  const [expiryReport, setExpiryReport] = useState<any>(null);
  const [lowStockReport, setLowStockReport] = useState<any[]>([]);
  const [stockLedger, setStockLedger] = useState<StockMovement[]>([]);

  // Permissions helper
  const canManage = userRole === 'Admin' || userRole === 'Pharmacist';

  // Auth fetch wrapper
  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const base = apiBaseUrl ? `${apiBaseUrl}${path}` : path;
      const res = await fetch(base, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error?.message || data?.message || 'Server request failed';
        throw new Error(Array.isArray(errorMsg) ? errorMsg.join('; ') : errorMsg);
      }
      return data;
    },
    [apiBaseUrl, token],
  );

  // 1. Fetch Dashboard
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/pharmacy/dashboard');
      if (res.success) {
        setDashboard(res.data);
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onNotification]);

  // 2. Fetch Batches
  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (batchSearch.trim()) query.set('q', batchSearch.trim());
      if (batchStatusFilter) query.set('status', batchStatusFilter);
      const res = await apiFetch(`/api/v1/pharmacy/batches?${query.toString()}`);
      if (res.success) {
        setBatches(res.data.items || []);
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, batchSearch, batchStatusFilter, onNotification]);

  // 3. Fetch Supporting data (Suppliers, Catalogue)
  const loadSupportingData = useCallback(async () => {
    try {
      const [supRes, medRes] = await Promise.all([
        apiFetch('/api/v1/medicines/meta/suppliers'),
        apiFetch('/api/v1/medicines?limit=100'),
      ]);
      if (supRes.success) setSuppliers(supRes.data || []);
      if (medRes.success) setCatalogMedicines(medRes.data?.data || []);
    } catch {
      // Ignore
    }
  }, [apiFetch]);

  // 4. Fetch Purchases
  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const [poRes, grnRes] = await Promise.all([
        apiFetch('/api/v1/pharmacy/purchases/orders'),
        apiFetch('/api/v1/pharmacy/purchases/receipts'),
      ]);
      if (poRes.success) setPurchaseOrders(poRes.data.items || []);
      if (grnRes.success) setGoodsReceipts(grnRes.data.items || []);
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onNotification]);

  // 5. Fetch Adjustments & Returns
  const loadAdjustmentsAndReturns = useCallback(async () => {
    try {
      setLoading(true);
      const [adjRes, retRes] = await Promise.all([
        apiFetch('/api/v1/pharmacy/adjustments'),
        apiFetch('/api/v1/pharmacy/returns'),
      ]);
      if (adjRes.success) setAdjustments(adjRes.data.items || []);
      if (retRes.success) setReturns(retRes.data.items || []);
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onNotification]);

  // 6. Fetch Reports
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const [valRes, expRes, lowRes, ledgerRes] = await Promise.all([
        apiFetch('/api/v1/pharmacy/reports/valuation'),
        apiFetch('/api/v1/pharmacy/reports/expiring?days=60'),
        apiFetch('/api/v1/pharmacy/reports/low-stock?threshold=15'),
        apiFetch('/api/v1/pharmacy/movements?limit=40'),
      ]);
      if (valRes.success) setValuation(valRes.data);
      if (expRes.success) setExpiryReport(expRes.data);
      if (lowRes.success) setLowStockReport(lowRes.data || []);
      if (ledgerRes.success) setStockLedger(ledgerRes.data.items || []);
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onNotification]);

  // Load appropriate data on tab change
  useEffect(() => {
    if (!token) return;
    loadSupportingData();

    if (activeTab === 'overview') loadDashboard();
    else if (activeTab === 'inventory') loadBatches();
    else if (activeTab === 'purchases') loadPurchases();
    else if (activeTab === 'adjustments') loadAdjustmentsAndReturns();
    else if (activeTab === 'reports') loadReports();
  }, [
    token,
    activeTab,
    loadDashboard,
    loadBatches,
    loadPurchases,
    loadAdjustmentsAndReturns,
    loadReports,
    loadSupportingData,
  ]);

  // ===========================================================================
  // DISPENSING HANDLERS
  // ===========================================================================

  const handleLookupPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescriptionLookupId.trim()) return;

    try {
      setLoading(true);
      const res = await apiFetch(
        `/api/v1/pharmacy/dispensations/context/${prescriptionLookupId.trim()}`,
      );
      if (res.success) {
        setDispenseContext(res.data);
        const initialDispense: any[] = [];
        res.data.lines.forEach((line: any) => {
          if (line.fefoPlan && line.fefoPlan.allocations.length > 0) {
            line.fefoPlan.allocations.forEach((alloc: any) => {
              initialDispense.push({
                prescriptionMedicineId: line.prescriptionMedicineId,
                medicineId: line.medicineId,
                batchId: alloc.batch.id,
                quantity: alloc.allocatedQty,
                unitPrice: line.unitPrice || alloc.batch.sellingPrice || 10,
                medicineName: line.matchedMedicineName || line.prescribedName,
              });
            });
          } else if (line.quantityRemaining > 0) {
            initialDispense.push({
              prescriptionMedicineId: line.prescriptionMedicineId,
              medicineId: line.medicineId,
              quantity: line.quantityRemaining,
              unitPrice: line.unitPrice || 10,
              medicineName: line.matchedMedicineName || line.prescribedName,
            });
          }
        });
        setDispenseItems(initialDispense);
        onNotification('success', `Prescription #${prescriptionLookupId} loaded with FEFO batch allocations.`);
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteDispense = async () => {
    if (!dispenseContext) return;
    if (dispenseItems.length === 0) {
      onNotification('error', 'Select at least one medication to dispense.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        prescriptionId: Number(dispenseContext.prescription.id),
        patientId: Number(dispenseContext.prescription.patient.id),
        patientName: dispenseContext.prescription.patient.name,
        dispenseDate: getTodayString(),
        generateInvoice,
        items: dispenseItems.map((item) => ({
          prescriptionMedicineId: item.prescriptionMedicineId ? Number(item.prescriptionMedicineId) : undefined,
          medicineId: item.medicineId ? Number(item.medicineId) : undefined,
          batchId: item.batchId ? Number(item.batchId) : undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await apiFetch('/api/v1/pharmacy/dispensations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        onNotification('success', `Dispensation ${res.data.dispensationNumber} executed and stock deducted.`);
        setDispensationReceipt(res.data);
        setDispenseContext(null);
        setDispenseItems([]);
        setPrescriptionLookupId('');
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // INVENTORY & BATCH CREATION
  // ===========================================================================

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/pharmacy/batches', {
        method: 'POST',
        body: JSON.stringify({
          medicineId: Number(newBatch.medicineId),
          batchNumber: newBatch.batchNumber.trim(),
          mfgDate: newBatch.mfgDate || undefined,
          expiryDate: newBatch.expiryDate,
          costPrice: parseFloat(newBatch.costPrice),
          sellingPrice: newBatch.sellingPrice ? parseFloat(newBatch.sellingPrice) : undefined,
          quantity: parseInt(newBatch.quantity, 10),
          supplierId: newBatch.supplierId ? Number(newBatch.supplierId) : undefined,
          notes: newBatch.notes || undefined,
        }),
      });

      if (res.success) {
        onNotification('success', `Batch "${res.data.batchNumber}" registered successfully.`);
        setShowCreateBatchModal(false);
        setNewBatch({
          medicineId: '',
          batchNumber: '',
          mfgDate: '',
          expiryDate: '',
          costPrice: '',
          sellingPrice: '',
          quantity: '',
          supplierId: '',
          notes: '',
        });
        loadBatches();
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // PURCHASING & GRN CREATION
  // ===========================================================================

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/pharmacy/purchases/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: Number(newPO.supplierId),
          orderDate: newPO.orderDate,
          expectedDate: newPO.expectedDate || undefined,
          notes: newPO.notes || undefined,
          items: newPO.items.map((i) => ({
            medicineId: Number(i.medicineId),
            quantityOrdered: Number(i.quantityOrdered),
            unitCost: Number(i.unitCost),
          })),
        }),
      });

      if (res.success) {
        onNotification('success', `Purchase order ${res.data.poNumber} created.`);
        setShowCreatePOModal(false);
        loadPurchases();
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/pharmacy/purchases/receipts', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: Number(newGRN.supplierId),
          purchaseOrderId: newGRN.purchaseOrderId ? Number(newGRN.purchaseOrderId) : undefined,
          receiptDate: newGRN.receiptDate,
          supplierInvoiceNumber: newGRN.supplierInvoiceNumber || undefined,
          notes: newGRN.notes || undefined,
          items: newGRN.items.map((i) => ({
            medicineId: Number(i.medicineId),
            batchNumber: i.batchNumber.trim(),
            expiryDate: i.expiryDate,
            quantityReceived: Number(i.quantityReceived),
            unitCost: Number(i.unitCost),
            sellingPrice: Number(i.sellingPrice),
          })),
        }),
      });

      if (res.success) {
        onNotification('success', `Goods Receipt ${res.data.receiptNumber} received into batch inventory.`);
        setShowCreateGRNModal(false);
        loadPurchases();
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // ADJUSTMENT & RETURN HANDLERS
  // ===========================================================================

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/pharmacy/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          adjustmentDate: newAdj.adjustmentDate,
          reason: newAdj.reason,
          notes: newAdj.notes || undefined,
          items: [
            {
              medicineId: Number(newAdj.medicineId),
              batchId: Number(newAdj.batchId),
              physicalQuantity: Number(newAdj.physicalQuantity),
            },
          ],
        }),
      });

      if (res.success) {
        onNotification('success', `Adjustment ${res.data.adjustmentNumber} recorded and ledger updated.`);
        setShowAdjustmentModal(false);
        loadAdjustmentsAndReturns();
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/pharmacy/returns', {
        method: 'POST',
        body: JSON.stringify({
          returnType: newReturn.returnType,
          dispensationId: newReturn.dispensationId ? Number(newReturn.dispensationId) : undefined,
          returnDate: newReturn.returnDate,
          reason: newReturn.reason,
          restockToInventory: newReturn.restockToInventory,
          items: [
            {
              dispensationItemId: newReturn.dispensationItemId ? Number(newReturn.dispensationItemId) : undefined,
              medicineId: Number(newReturn.medicineId),
              batchId: Number(newReturn.batchId),
              quantity: Number(newReturn.quantity),
              condition: newReturn.condition,
            },
          ],
        }),
      });

      if (res.success) {
        onNotification('success', `Return ${res.data.returnNumber} processed.`);
        setShowReturnModal(false);
        loadAdjustmentsAndReturns();
      }
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-emerald-700/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-emerald-500/30 text-emerald-300 rounded-full border border-emerald-400/30">
                Phase 13 • Inventory & Dispensing
              </span>
              <span className="text-xs text-emerald-200/70">
                Authoritative Batch Ledger & FEFO Engine
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Pharmacy Operations</h1>
            <p className="text-emerald-100/80 text-sm mt-1 max-w-2xl">
              Transactional batch-level inventory tracking, FEFO prescription dispensing, Goods
              Receipts (GRN), multi-batch physical counts, returns reconciliation, and live valuation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('dispense')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/40 transition flex items-center gap-2 text-sm"
            >
              <Receipt className="w-4 h-4" />
              Dispense Rx
            </button>
            {canManage && (
              <button
                onClick={() => setShowCreateGRNModal(true)}
                className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-white font-medium rounded-xl border border-emerald-500/30 transition flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Receive GRN
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-emerald-600/30">
          {[
            { id: 'overview', label: 'Dashboard', icon: TrendingUp },
            { id: 'dispense', label: 'Dispense Workspace', icon: Receipt },
            { id: 'inventory', label: 'Batch Inventory', icon: Boxes },
            { id: 'purchases', label: 'Purchases & GRN', icon: ShoppingCart },
            { id: 'adjustments', label: 'Returns & Adjustments', icon: RotateCcw },
            { id: 'reports', label: 'Valuation & Ledger', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-emerald-950 shadow-md font-semibold'
                    : 'text-emerald-100/90 hover:bg-emerald-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-emerald-300'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW / DASHBOARD TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {dashboard ? (
            <>
              {/* Metric KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow transition">
                  <div className="flex items-center justify-between text-slate-500 text-sm">
                    <span>Retail Valuation</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    ${dashboard.totalRetailValuation.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Cost: ${dashboard.totalCostValuation.toLocaleString()} (Margin: $
                    {(dashboard.totalRetailValuation - dashboard.totalCostValuation).toLocaleString()})
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow transition">
                  <div className="flex items-center justify-between text-slate-500 text-sm">
                    <span>Active Formulary</span>
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {dashboard.totalMedicines} Medicines
                  </div>
                  <div className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {dashboard.lowStockCount} below stock threshold
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow transition">
                  <div className="flex items-center justify-between text-slate-500 text-sm">
                    <span>Expiring (30 Days)</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 mt-2">
                    {dashboard.expiringWithin30Days} Batches
                  </div>
                  <div className="text-xs text-rose-600 mt-1">
                    {dashboard.expiredBatchesCount} expired (dispense locked)
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow transition">
                  <div className="flex items-center justify-between text-slate-500 text-sm">
                    <span>Today's Takings</span>
                    <Receipt className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    ${dashboard.todayTakings.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {dashboard.todayDispensationsCount} prescriptions dispensed today
                  </div>
                </div>
              </div>

              {/* Recent Movements & Pending Orders */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Movements */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-600" />
                      Recent Stock Movements
                    </h3>
                    <button
                      onClick={() => {
                        setActiveTab('reports');
                        setReportsSubTab('movements');
                      }}
                      className="text-xs text-emerald-700 hover:underline font-medium"
                    >
                      View complete ledger
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dashboard.recentMovements.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        No recent stock movements recorded.
                      </div>
                    ) : (
                      dashboard.recentMovements.map((m) => (
                        <div key={m.id} className="py-3 flex items-center justify-between text-sm">
                          <div>
                            <div className="font-semibold text-slate-800">
                              {m.medicine?.name || 'Medication'}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Lot: {m.batch?.batchNumber || 'N/A'}</span>
                              <span>•</span>
                              <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>•</span>
                              <span className="italic">{m.reason || m.movementType}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                m.quantity > 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Bal: {m.balanceAfter}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Pending Purchase Orders */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                      Pending Purchase Orders
                    </h3>
                    <button
                      onClick={() => setActiveTab('purchases')}
                      className="text-xs text-blue-700 hover:underline font-medium"
                    >
                      Manage orders
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dashboard.pendingPurchaseOrders.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        No pending purchase orders waiting for delivery.
                      </div>
                    ) : (
                      dashboard.pendingPurchaseOrders.map((po) => (
                        <div key={po.id} className="py-3 flex items-center justify-between text-sm">
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-2">
                              <span>{po.poNumber}</span>
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-md">
                                {po.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Supplier: {po.supplier?.name || 'Direct'} • Order Date: {po.orderDate}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900">${po.totalAmount}</div>
                            {canManage && (
                              <button
                                onClick={() => {
                                  setActiveTab('purchases');
                                  setPurchasesSubTab('receipts');
                                  setShowCreateGRNModal(true);
                                  setNewGRN((prev) => ({
                                    ...prev,
                                    supplierId: po.supplierId,
                                    purchaseOrderId: po.id,
                                  }));
                                }}
                                className="text-xs text-emerald-700 font-semibold hover:underline mt-1"
                              >
                                Receive GRN
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border">
              Loading pharmacy dashboard metrics...
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DISPENSING WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'dispense' && (
        <div className="space-y-6">
          {/* Prescription Lookup Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="font-bold text-slate-900 text-lg mb-2">Prescription Dispensing Terminal</h3>
            <p className="text-slate-500 text-sm mb-4">
              Enter prescription reference to load clinical regimen lines with automatic FEFO batch allocation.
            </p>
            <form onSubmit={handleLookupPrescription} className="flex gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Prescription ID (e.g. 1)"
                  value={prescriptionLookupId}
                  onChange={(e) => setPrescriptionLookupId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition"
              >
                {loading ? 'Searching...' : 'Load Regimen'}
              </button>
            </form>
          </div>

          {/* Active Dispensing Encounter Context */}
          {dispenseContext && (
            <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-md p-6 space-y-6">
              {/* Patient & Doctor Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xl text-slate-900">
                      Prescription #{dispenseContext.prescription.id}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {dispenseContext.prescription.state || 'Issued'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4">
                    <span>
                      Patient:{' '}
                      <strong className="text-slate-800">
                        {dispenseContext.prescription.patient.name}
                      </strong>{' '}
                      ({dispenseContext.prescription.patient.patientId})
                    </span>
                    <span>
                      Doctor:{' '}
                      <strong className="text-slate-800">
                        {dispenseContext.prescription.doctor?.name || 'Attending Physician'}
                      </strong>
                    </span>
                    <span>Prescribed: {dispenseContext.prescription.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generateInvoice}
                      onChange={(e) => setGenerateInvoice(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    Generate Invoice in Billing
                  </label>
                </div>
              </div>

              {/* Medication Lines with FEFO Allocations */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                  Prescription Regimen Lines & FEFO Batch Breakdown
                </h4>
                {dispenseContext.lines.map((line) => (
                  <div
                    key={line.prescriptionMedicineId}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-base">
                          {line.prescribedName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex gap-2">
                          <span>Dosage: {line.dosage || 'N/A'}</span>
                          <span>•</span>
                          <span>Duration: {line.duration || 'N/A'}</span>
                          <span>•</span>
                          <span>Instructions: {line.instructions || 'Standard'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Total Need</div>
                          <span className="font-bold text-slate-800">
                            {line.quantityPrescribed} units
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Dispensed</div>
                          <span className="font-bold text-blue-600">
                            {line.quantityDispensed} units
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Remaining</div>
                          <span className="font-bold text-amber-700">
                            {line.quantityRemaining} units
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Available Stock</div>
                          <span
                            className={`font-bold ${
                              line.availableStock >= line.quantityRemaining
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {line.availableStock} in batches
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FEFO Batches Available */}
                    <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        FEFO Batches:
                      </span>
                      {line.batches.length === 0 ? (
                        <span className="text-xs text-rose-600 font-medium">
                          No active unexpired batches in inventory!
                        </span>
                      ) : (
                        line.batches.map((b) => (
                          <div
                            key={b.id}
                            className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 flex items-center gap-2 shadow-xs"
                          >
                            <span className="font-mono text-emerald-800">{b.batchNumber}</span>
                            <span className="text-slate-400">|</span>
                            <span>Exp: {new Date(b.expiryDate).toLocaleDateString()}</span>
                            <span className="text-slate-400">|</span>
                            <span className="font-bold text-slate-900">
                              {b.currentQuantity} avail
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary and Dispense Confirmation */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-emerald-900 font-semibold uppercase tracking-wider">
                    Total Dispensation Summary
                  </div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">
                    $
                    {dispenseItems
                      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
                      .toFixed(2)}
                  </div>
                  <div className="text-xs text-emerald-700">
                    {dispenseItems.reduce((acc, i) => acc + i.quantity, 0)} total medication units allocated
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDispenseContext(null);
                      setDispenseItems([]);
                    }}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteDispense}
                    disabled={loading || dispenseItems.length === 0}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Dispense Stock
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Receipt Modal */}
          {dispensationReceipt && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-lg">Dispensing Receipt</h3>
                  </div>
                  <button
                    onClick={() => setDispensationReceipt(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-sm text-slate-600 space-y-1">
                  <div>
                    Dispensation #: <strong>{dispensationReceipt.dispensationNumber}</strong>
                  </div>
                  <div>
                    Date: {dispensationReceipt.dispenseDate} | Status: {dispensationReceipt.status}
                  </div>
                  {dispensationReceipt.invoiceId && (
                    <div className="text-emerald-700 font-semibold">
                      Linked Invoice #: {dispensationReceipt.invoiceId} (Paid)
                    </div>
                  )}
                </div>

                <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase">Items Dispensed</div>
                  {dispensationReceipt.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-none">
                      <div>
                        <div className="font-semibold text-slate-800">{item.medicineName}</div>
                        <div className="text-xs text-slate-400">Lot: {item.batchNumber || 'N/A'}</div>
                      </div>
                      <div className="text-right">
                        <div>
                          {item.quantity} x ${item.unitPrice}
                        </div>
                        <div className="font-bold text-slate-900">${item.totalPrice}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-bold text-base text-slate-900 pt-2">
                  <span>Grand Total</span>
                  <span>${dispensationReceipt.totalAmount}</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 border rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => setDispensationReceipt(null)}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVENTORY & BATCH MANAGEMENT TAB */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search batch # or drug name..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <select
                value={batchStatusFilter}
                onChange={(e) => setBatchStatusFilter(e.target.value)}
                className="py-2 px-3 border rounded-xl text-sm bg-white text-slate-700 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="DEPLETED">Depleted</option>
                <option value="QUARANTINED">Quarantined</option>
              </select>
            </div>

            {canManage && (
              <button
                onClick={() => setShowCreateBatchModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Intake Opening Batch
              </button>
            )}
          </div>

          {/* Batches Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="py-3 px-4">Medicine Name</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Balance / Initial</th>
                    <th className="py-3 px-4">Cost Price</th>
                    <th className="py-3 px-4">Selling Price</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No medicine batches match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => {
                      const isExpired = b.status === 'EXPIRED';
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {b.medicine?.name}
                            {b.medicine?.generic && (
                              <span className="block text-xs font-normal text-slate-400">
                                {b.medicine.generic}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-emerald-800">
                            {b.batchNumber}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                                isExpired
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {new Date(b.expiryDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold">
                            <span className={b.currentQuantity === 0 ? 'text-slate-400' : 'text-slate-900'}>
                              {b.currentQuantity}
                            </span>
                            <span className="text-slate-400 text-xs font-normal"> / {b.initialQuantity}</span>
                          </td>
                          <td className="py-3 px-4">${b.costPrice}</td>
                          <td className="py-3 px-4 font-semibold text-emerald-700">
                            ${b.sellingPrice || b.costPrice}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {b.supplier?.name || 'Opening Stock'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                b.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : b.status === 'EXPIRED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal: Register Opening Batch */}
          {showCreateBatchModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="font-bold text-slate-900 text-lg">Intake Medicine Batch</h3>
                  <button
                    onClick={() => setShowCreateBatchModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateBatch} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Medicine Formulary *
                    </label>
                    <select
                      required
                      value={newBatch.medicineId}
                      onChange={(e) => setNewBatch({ ...newBatch, medicineId: e.target.value })}
                      className="w-full p-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="">Select Medicine...</option>
                      {catalogMedicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.generic || 'Generic'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Batch Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="LOT-2026-X"
                        value={newBatch.batchNumber}
                        onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Expiry Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newBatch.expiryDate}
                        onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={newBatch.quantity}
                        onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cost Price ($) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newBatch.costPrice}
                        onChange={(e) => setNewBatch({ ...newBatch, costPrice: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Selling Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newBatch.sellingPrice}
                        onChange={(e) => setNewBatch({ ...newBatch, sellingPrice: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supplier Reference (Optional)
                    </label>
                    <select
                      value={newBatch.supplierId}
                      onChange={(e) => setNewBatch({ ...newBatch, supplierId: e.target.value })}
                      className="w-full p-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="">None / Direct Intake</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowCreateBatchModal(false)}
                      className="px-4 py-2 border rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
                    >
                      Register Batch
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PURCHASING & GOODS RECEIPTS (GRN) TAB */}
      {/* ========================================================================= */}
      {activeTab === 'purchases' && (
        <div className="space-y-6">
          {/* Sub Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setPurchasesSubTab('orders')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  purchasesSubTab === 'orders'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Purchase Orders ({purchaseOrders.length})
              </button>
              <button
                onClick={() => setPurchasesSubTab('receipts')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  purchasesSubTab === 'receipts'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Goods Receipts / GRN ({goodsReceipts.length})
              </button>
            </div>

            {canManage && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreatePOModal(true)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-slate-500" />
                  New Purchase Order
                </button>
                <button
                  onClick={() => setShowCreateGRNModal(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Receive GRN into Batches
                </button>
              </div>
            )}
          </div>

          {/* Sub Tab: Purchase Orders */}
          {purchasesSubTab === 'orders' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Expected Date</th>
                    <th className="py-3 px-4">Line Items</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No purchase orders recorded.
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {po.poNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {po.supplier?.name || 'Direct'}
                        </td>
                        <td className="py-3 px-4">{po.orderDate}</td>
                        <td className="py-3 px-4">{po.expectedDate || 'N/A'}</td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {po.items.map((i) => `${i.medicine?.name || 'Med'} (${i.quantityOrdered}x)`).join(', ')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">${po.totalAmount}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              po.status === 'RECEIVED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : po.status === 'ORDERED'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub Tab: Goods Receipts */}
          {purchasesSubTab === 'receipts' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="py-3 px-4">GRN Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Receipt Date</th>
                    <th className="py-3 px-4">Invoice Ref</th>
                    <th className="py-3 px-4">Batches Registered</th>
                    <th className="py-3 px-4">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {goodsReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No goods receipts recorded.
                      </td>
                    </tr>
                  ) : (
                    goodsReceipts.map((grn) => (
                      <tr key={grn.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                          {grn.receiptNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {grn.supplier?.name}
                        </td>
                        <td className="py-3 px-4">{grn.receiptDate}</td>
                        <td className="py-3 px-4 text-xs font-mono">{grn.supplierInvoiceNumber || 'N/A'}</td>
                        <td className="py-3 px-4 text-xs">
                          {grn.items.map((i) => (
                            <div key={i.id} className="text-slate-700">
                              • {i.medicine?.name} [Lot: {i.batchNumber}] ({i.quantityReceived} units)
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">${grn.totalAmount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal: Create Purchase Order (PO) */}
          {showCreatePOModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="font-bold text-slate-900 text-lg">Create Purchase Order</h3>
                  <button
                    onClick={() => setShowCreatePOModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreatePO} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supplier *
                    </label>
                    <select
                      required
                      value={newPO.supplierId}
                      onChange={(e) => setNewPO({ ...newPO, supplierId: e.target.value })}
                      className="w-full p-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="">Select Supplier...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Order Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newPO.orderDate}
                        onChange={(e) => setNewPO({ ...newPO, orderDate: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Expected Delivery Date
                      </label>
                      <input
                        type="date"
                        value={newPO.expectedDate}
                        onChange={(e) => setNewPO({ ...newPO, expectedDate: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 pt-2 border-t">
                    <label className="block text-xs font-bold text-slate-800 uppercase">
                      Order Items
                    </label>
                    {newPO.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center text-sm">
                        <select
                          required
                          value={item.medicineId}
                          onChange={(e) => {
                            const copy = [...newPO.items];
                            copy[idx].medicineId = e.target.value;
                            setNewPO({ ...newPO, items: copy });
                          }}
                          className="flex-1 p-1.5 border rounded-lg bg-white text-xs"
                        >
                          <option value="">Select Medicine...</option>
                          {catalogMedicines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          required
                          value={item.quantityOrdered}
                          onChange={(e) => {
                            const copy = [...newPO.items];
                            copy[idx].quantityOrdered = Number(e.target.value);
                            setNewPO({ ...newPO, items: copy });
                          }}
                          className="w-20 p-1.5 border rounded-lg text-xs"
                        />
                        <input
                          type="number"
                          placeholder="Cost ($)"
                          step="0.01"
                          required
                          value={item.unitCost}
                          onChange={(e) => {
                            const copy = [...newPO.items];
                            copy[idx].unitCost = Number(e.target.value);
                            setNewPO({ ...newPO, items: copy });
                          }}
                          className="w-24 p-1.5 border rounded-lg text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowCreatePOModal(false)}
                      className="px-4 py-2 border rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                    >
                      Issue Purchase Order
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Create Goods Receipt (GRN) */}
          {showCreateGRNModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="font-bold text-slate-900 text-lg">Receive Goods Receipt (GRN)</h3>
                  <button
                    onClick={() => setShowCreateGRNModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateGRN} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Supplier *
                      </label>
                      <select
                        required
                        value={newGRN.supplierId}
                        onChange={(e) => setNewGRN({ ...newGRN, supplierId: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm bg-white"
                      >
                        <option value="">Select Supplier...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Supplier Invoice #
                      </label>
                      <input
                        type="text"
                        placeholder="INV-2026-99"
                        value={newGRN.supplierInvoiceNumber}
                        onChange={(e) => setNewGRN({ ...newGRN, supplierInvoiceNumber: e.target.value })}
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* GRN Line Items */}
                  <div className="space-y-3 pt-2 border-t">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Batch Details To Receive
                    </label>
                    {newGRN.items.map((item, idx) => (
                      <div key={idx} className="p-3 border rounded-xl bg-slate-50 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-500">Medicine</label>
                            <select
                              required
                              value={item.medicineId}
                              onChange={(e) => {
                                const copy = [...newGRN.items];
                                copy[idx].medicineId = e.target.value;
                                setNewGRN({ ...newGRN, items: copy });
                              }}
                              className="w-full p-1.5 border rounded-lg bg-white text-xs"
                            >
                              <option value="">Select...</option>
                              {catalogMedicines.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Batch Number</label>
                            <input
                              type="text"
                              required
                              placeholder="LOT-9988"
                              value={item.batchNumber}
                              onChange={(e) => {
                                const copy = [...newGRN.items];
                                copy[idx].batchNumber = e.target.value;
                                setNewGRN({ ...newGRN, items: copy });
                              }}
                              className="w-full p-1.5 border rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs text-slate-500">Expiry Date</label>
                            <input
                              type="date"
                              required
                              value={item.expiryDate}
                              onChange={(e) => {
                                const copy = [...newGRN.items];
                                copy[idx].expiryDate = e.target.value;
                                setNewGRN({ ...newGRN, items: copy });
                              }}
                              className="w-full p-1.5 border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Received Qty</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={item.quantityReceived}
                              onChange={(e) => {
                                const copy = [...newGRN.items];
                                copy[idx].quantityReceived = Number(e.target.value);
                                setNewGRN({ ...newGRN, items: copy });
                              }}
                              className="w-full p-1.5 border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Cost Price ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={item.unitCost}
                              onChange={(e) => {
                                const copy = [...newGRN.items];
                                copy[idx].unitCost = Number(e.target.value);
                                setNewGRN({ ...newGRN, items: copy });
                              }}
                              className="w-full p-1.5 border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Retail ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={item.sellingPrice}
                              onChange={(e) => {
                                const copy = [...newGRN.items];
                                copy[idx].sellingPrice = Number(e.target.value);
                                setNewGRN({ ...newGRN, items: copy });
                              }}
                              className="w-full p-1.5 border rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowCreateGRNModal(false)}
                      className="px-4 py-2 border rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
                    >
                      Receive & Increment Batches
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. RETURNS & STOCK ADJUSTMENTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'adjustments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setAdjSubTab('adjustments')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  adjSubTab === 'adjustments'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Physical Stock Adjustments ({adjustments.length})
              </button>
              <button
                onClick={() => setAdjSubTab('returns')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  adjSubTab === 'returns'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pharmacy Returns ({returns.length})
              </button>
            </div>

            {canManage && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdjustmentModal(true)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"
                >
                  <Sliders className="w-4 h-4" />
                  Perform Physical Count Adjustment
                </button>
                <button
                  onClick={() => setShowReturnModal(true)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Process Return
                </button>
              </div>
            )}
          </div>

          {/* Sub Tab: Adjustments List */}
          {adjSubTab === 'adjustments' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="py-3 px-4">Adjustment #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Adjusted Batches</th>
                    <th className="py-3 px-4">Variance Details</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No physical stock adjustments recorded.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {a.adjustmentNumber}
                        </td>
                        <td className="py-3 px-4">{a.adjustmentDate}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{a.reason}</td>
                        <td className="py-3 px-4 text-xs">
                          {a.items.map((i) => (
                            <div key={i.id}>
                              {i.medicine?.name} [Lot: {i.batch?.batchNumber}]
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {a.items.map((i) => (
                            <div key={i.id} className="font-semibold">
                              Sys: {i.systemQuantity} → Phys: {i.physicalQuantity} (
                              <span
                                className={i.difference >= 0 ? 'text-emerald-700' : 'text-rose-700'}
                              >
                                {i.difference >= 0 ? `+${i.difference}` : i.difference}
                              </span>
                              )
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800">
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub Tab: Returns List */}
          {adjSubTab === 'returns' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="py-3 px-4">Return #</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Return Date</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Restocked to Inventory?</th>
                    <th className="py-3 px-4">Total Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No pharmacy returns recorded.
                      </td>
                    </tr>
                  ) : (
                    returns.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {r.returnNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.returnType === 'PATIENT_RETURN'
                                ? 'bg-blue-50 text-blue-800'
                                : 'bg-purple-50 text-purple-800'
                            }`}
                          >
                            {r.returnType}
                          </span>
                        </td>
                        <td className="py-3 px-4">{r.returnDate}</td>
                        <td className="py-3 px-4 text-xs italic">{r.reason}</td>
                        <td className="py-3 px-4 text-xs font-semibold">
                          {r.restockToInventory ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Restocked
                            </span>
                          ) : (
                            <span className="text-rose-600">Damaged / Written-off</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">${r.totalRefund}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal: Physical Stock Adjustment */}
          {showAdjustmentModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="font-bold text-slate-900 text-lg">Physical Stock Count Adjustment</h3>
                  <button
                    onClick={() => setShowAdjustmentModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateAdjustment} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Batch to Adjust *
                    </label>
                    <select
                      required
                      value={newAdj.batchId}
                      onChange={(e) => {
                        const bId = e.target.value;
                        const b = batches.find((item) => item.id.toString() === bId);
                        setNewAdj({
                          ...newAdj,
                          batchId: bId,
                          medicineId: b?.medicineId || '',
                          systemQuantity: b?.currentQuantity || 0,
                          physicalQuantity: b?.currentQuantity || 0,
                        });
                      }}
                      className="w-full p-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="">Select Batch...</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.medicine?.name} [Lot: {b.batchNumber}] ({b.currentQuantity} units)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border rounded-xl text-sm">
                    <div>
                      <div className="text-xs text-slate-500">System Recorded Qty</div>
                      <div className="text-lg font-bold text-slate-800">{newAdj.systemQuantity}</div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 font-semibold block mb-0.5">
                        Physical Verified Count *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newAdj.physicalQuantity}
                        onChange={(e) =>
                          setNewAdj({ ...newAdj, physicalQuantity: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full p-1.5 border rounded-lg text-sm bg-white font-bold"
                      />
                    </div>
                  </div>

                  <div className="text-xs font-bold text-right">
                    Variance Difference:{' '}
                    <span
                      className={
                        newAdj.physicalQuantity - newAdj.systemQuantity >= 0
                          ? 'text-emerald-700 font-extrabold'
                          : 'text-rose-700 font-extrabold'
                      }
                    >
                      {newAdj.physicalQuantity - newAdj.systemQuantity >= 0
                        ? `+${newAdj.physicalQuantity - newAdj.systemQuantity}`
                        : newAdj.physicalQuantity - newAdj.systemQuantity}{' '}
                      units
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Adjustment Reason *
                    </label>
                    <select
                      value={newAdj.reason}
                      onChange={(e) => setNewAdj({ ...newAdj, reason: e.target.value })}
                      className="w-full p-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="PHYSICAL_COUNT">Physical Inventory Count</option>
                      <option value="DAMAGED">Damaged / Broken Packaging</option>
                      <option value="EXPIRED">Expired Medication Write-Off</option>
                      <option value="AUDIT_CORRECTION">Audit Correction</option>
                      <option value="OTHER">Other Discrepancy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Audit Explanation Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Explain physical variance justification..."
                      value={newAdj.notes}
                      onChange={(e) => setNewAdj({ ...newAdj, notes: e.target.value })}
                      className="w-full p-2 border rounded-xl text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAdjustmentModal(false)}
                      className="px-4 py-2 border rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700"
                    >
                      Commit Adjustment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Process Return */}
          {showReturnModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="font-bold text-slate-900 text-lg">Process Pharmacy Return</h3>
                  <button
                    onClick={() => setShowReturnModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateReturn} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Return Category *
                    </label>
                    <select
                      value={newReturn.returnType}
                      onChange={(e) =>
                        setNewReturn({
                          ...newReturn,
                          returnType: e.target.value as any,
                        })
                      }
                      className="w-full p-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="PATIENT_RETURN">Patient Return</option>
                      <option value="SUPPLIER_RETURN">Supplier Return</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Batch to Return *
                    </label>
                    <select
                      required
                      value={newReturn.batchId}
                      onChange={(e) => {
                        const bId = e.target.value;
                        const b = batches.find((item) => item.id.toString() === bId);
                        setNewReturn({
                          ...newReturn,
                          batchId: bId,
                          medicineId: b?.medicineId || '',
                        });
                      }}
                      className="w-full p-2 border rounded-xl text-sm bg-white"
                    >
                      <option value="">Select Batch...</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.medicine?.name} [Lot: {b.batchNumber}] ({b.currentQuantity} units)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Return Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newReturn.quantity}
                        onChange={(e) =>
                          setNewReturn({ ...newReturn, quantity: parseInt(e.target.value, 10) || 1 })
                        }
                        className="w-full p-2 border rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Condition *
                      </label>
                      <select
                        value={newReturn.condition}
                        onChange={(e) =>
                          setNewReturn({
                            ...newReturn,
                            condition: e.target.value as any,
                            restockToInventory: e.target.value === 'SALEABLE',
                          })
                        }
                        className="w-full p-2 border rounded-xl text-sm bg-white"
                      >
                        <option value="SALEABLE">Saleable (Restock to Active Stock)</option>
                        <option value="DAMAGED">Damaged (Write-off)</option>
                        <option value="EXPIRED">Expired (Write-off)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reason for Return *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Patient changed prescription / Defective blister"
                      value={newReturn.reason}
                      onChange={(e) => setNewReturn({ ...newReturn, reason: e.target.value })}
                      className="w-full p-2 border rounded-xl text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowReturnModal(false)}
                      className="px-4 py-2 border rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800"
                    >
                      Process Return
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. REPORTS & STOCK AUDIT LEDGER TAB */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Sub Navigation */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-fit">
            {[
              { id: 'valuation', label: 'Valuation Report', icon: DollarSign },
              { id: 'expiry', label: 'Expiry Alerts', icon: AlertTriangle },
              { id: 'lowstock', label: 'Low Stock Report', icon: Clock },
              { id: 'movements', label: 'Immutable Audit Ledger', icon: FileSpreadsheet },
            ].map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => setReportsSubTab(r.id as any)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                    reportsSubTab === r.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Sub Tab: Valuation Report */}
          {reportsSubTab === 'valuation' && valuation && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border">
                  <div className="text-xs text-slate-500 font-medium">Total Stock Units</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {valuation.totalUnits.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                  <div className="text-xs text-slate-500 font-medium">Inventory Cost Basis</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    ${valuation.totalCostValuation.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                  <div className="text-xs text-slate-500 font-medium">Retail Selling Value</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">
                    ${valuation.totalRetailValuation.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border">
                  <div className="text-xs text-slate-500 font-medium">Potential Gross Margin</div>
                  <div className="text-2xl font-bold text-blue-700 mt-1">
                    ${valuation.potentialProfit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Valuation Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                    <tr>
                      <th className="py-3 px-4">Medicine</th>
                      <th className="py-3 px-4">Batch Number</th>
                      <th className="py-3 px-4">Stock Units</th>
                      <th className="py-3 px-4">Cost / Unit</th>
                      <th className="py-3 px-4">Retail / Unit</th>
                      <th className="py-3 px-4">Cost Total</th>
                      <th className="py-3 px-4">Retail Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {valuation.breakdown.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-800">{row.medicineName}</td>
                        <td className="py-3 px-4 font-mono text-emerald-800">{row.batchNumber}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{row.currentQuantity}</td>
                        <td className="py-3 px-4">${row.costPrice}</td>
                        <td className="py-3 px-4">${row.sellingPrice}</td>
                        <td className="py-3 px-4">${row.costTotal}</td>
                        <td className="py-3 px-4 font-bold text-emerald-700">${row.retailTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab: Expiry Alerts */}
          {reportsSubTab === 'expiry' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border">
                <h4 className="font-bold text-slate-900 text-base mb-2">Expiring Medication Inventory</h4>
                <div className="text-xs text-slate-500">
                  Batches past expiry date are automatically locked from dispensing.
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                    <tr>
                      <th className="py-3 px-4">Medicine</th>
                      <th className="py-3 px-4">Batch Number</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Units in Stock</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Urgency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiryReport?.expiringSoonBatches?.length === 0 &&
                    expiryReport?.expiredBatches?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No batches expiring within the alert window.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {expiryReport?.expiredBatches?.map((b: any) => (
                          <tr key={b.id} className="bg-rose-50/40">
                            <td className="py-3 px-4 font-semibold text-rose-950">{b.medicine?.name}</td>
                            <td className="py-3 px-4 font-mono font-bold text-rose-800">{b.batchNumber}</td>
                            <td className="py-3 px-4 font-bold text-rose-700">
                              {new Date(b.expiryDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">{b.currentQuantity}</td>
                            <td className="py-3 px-4 text-xs">{b.supplier?.name || 'Opening Stock'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                EXPIRED (LOCKED)
                              </span>
                            </td>
                          </tr>
                        ))}
                        {expiryReport?.expiringSoonBatches?.map((b: any) => (
                          <tr key={b.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-semibold text-slate-900">{b.medicine?.name}</td>
                            <td className="py-3 px-4 font-mono text-emerald-800">{b.batchNumber}</td>
                            <td className="py-3 px-4 font-semibold text-amber-700">
                              {new Date(b.expiryDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">{b.currentQuantity}</td>
                            <td className="py-3 px-4 text-xs">{b.supplier?.name || 'Opening Stock'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Expiring Soon
                              </span>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab: Low Stock Report */}
          {reportsSubTab === 'lowstock' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="py-3 px-4">Medicine</th>
                    <th className="py-3 px-4">Generic Formulation</th>
                    <th className="py-3 px-4">Pack / Box</th>
                    <th className="py-3 px-4">Total Inventory Units</th>
                    <th className="py-3 px-4">Active Batches</th>
                    <th className="py-3 px-4">Stock Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockReport.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        All formulary medicines are adequately stocked above threshold.
                      </td>
                    </tr>
                  ) : (
                    lowStockReport.map((med) => (
                      <tr key={med.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{med.name}</td>
                        <td className="py-3 px-4 text-slate-500">{med.generic || 'N/A'}</td>
                        <td className="py-3 px-4 text-xs">{med.box || 'Standard'}</td>
                        <td className="py-3 px-4 font-bold text-rose-700">{med.quantity} units</td>
                        <td className="py-3 px-4 text-xs">
                          {med.batches?.length > 0 ? (
                            med.batches.map((b: any) => `${b.batchNumber} (${b.currentQuantity})`).join(', ')
                          ) : (
                            <span className="text-rose-500 italic">No active batches</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            LOW STOCK
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub Tab: Immutable Audit Ledger */}
          {reportsSubTab === 'movements' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Medicine</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4">Qty Change</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No audit ledger records found.
                      </td>
                    </tr>
                  ) : (
                    stockLedger.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-xs font-mono text-slate-500">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">{m.medicine?.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {m.batch?.batchNumber || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              m.movementType.includes('RECEIPT') || m.movementType.includes('IN')
                                ? 'bg-emerald-50 text-emerald-700'
                                : m.movementType.includes('DISPENSING')
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {m.movementType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold">
                          <span className={m.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{m.balanceAfter}</td>
                        <td className="py-3 px-4 text-xs italic text-slate-500">{m.reason || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
