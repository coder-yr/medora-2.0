import React, { useState, useEffect, useMemo } from 'react';
import {
  TestTube,
  Microscope,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Printer,
  UserCheck,
  RefreshCw,
  XCircle,
  Edit3,
  Layers,
  ShieldCheck,
  Activity,
  Barcode,
  ArrowRight,
  ClipboardList,
  AlertCircle,
  FileEdit,
  History,
  X,
} from 'lucide-react';

import type {
  LabCategory,
  LabOrder,
  LabSample,
  LabPriority,
  LabDashboardMetrics,
  AbnormalFlag,
} from '../types/laboratory';

interface Props {
  token: string;
  userRole: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://medora-20-backend.vercel.app';

export function LaboratoryWorkspace({ token, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'catalogue' | 'orders' | 'phlebotomy' | 'workbench' | 'approval' | 'reports'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Dashboard Data
  const [metrics, setMetrics] = useState<LabDashboardMetrics>({
    pendingOrders: 0,
    sampleCollectionQueue: 0,
    processingQueue: 0,
    awaitingVerification: 0,
    completedReports: 0,
    rejectedSamples: 0,
    totalTestsInCatalogue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<LabOrder[]>([]);

  // Catalogue State
  const [catalogue, setCatalogue] = useState<LabCategory[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState<LabCategory | null>(null);
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newTestCategory, setNewTestCategory] = useState('');
  const [newTestDesc, setNewTestDesc] = useState('');
  const [newTestRef, setNewTestRef] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('1500');
  const [newTestSampleType, setNewTestSampleType] = useState('EDTA Whole Blood');
  const [newTestTurnaround, setNewTestTurnaround] = useState('4');
  const [newTestParameters] = useState<
    Array<{ name: string; unit: string; referenceMin: string; referenceMax: string }>
  >([{ name: 'Primary Marker', unit: 'mg/dL', referenceMin: '10', referenceMax: '50' }]);

  // Orders State
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);

  // New Order Form State
  const [orderPatientId, setOrderPatientId] = useState('1');
  const [orderDoctorId, setOrderDoctorId] = useState('1');
  const [orderPriority, setOrderPriority] = useState<LabPriority>('ROUTINE');
  const [orderClinicalNotes, setOrderClinicalNotes] = useState('');
  const [orderSelectedTestIds, setOrderSelectedTestIds] = useState<number[]>([]);
  const [orderGenerateInvoice, setOrderGenerateInvoice] = useState(true);

  // Sample Queue State
  const [samplesQueue, setSamplesQueue] = useState<LabSample[]>([]);
  const [rejectingSampleId, setRejectingSampleId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('HEMOLYZED');
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Workbench & Results State
  const [workbenchOrder, setWorkbenchOrder] = useState<LabOrder | null>(null);
  const [resultValues, setResultValues] = useState<
    Record<
      string,
      { value: string; abnormalFlag: AbnormalFlag; comments: string; unit: string; refRange: string }
    >
  >({});
  const [resultSummary, setResultSummary] = useState('');

  // Verification & Approval State
  const [approvalNotes, setApprovalNotes] = useState('');

  // Report & Amendment State
  const [printableOrder, setPrintableOrder] = useState<LabOrder | null>(null);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [amendmentValues, setAmendmentValues] = useState<Record<string, string>>({});

  // Cancellation State
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Helpers
  const showNotice = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  // Load Dashboard Data
  const loadDashboard = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/dashboard`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMetrics(data.data.metrics);
        setRecentOrders(data.data.recentOrders || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  // Load Test Catalogue
  const loadCatalogue = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/catalogue`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCatalogue(data.data);
      }
    } catch {
      // Graceful fallback
    }
  };

  // Load Orders Worklist
  const loadOrders = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const url = new URL(`${API_BASE_URL}/api/v1/lab/orders`, window.location.origin);
      if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter);
      if (priorityFilter !== 'ALL') url.searchParams.set('priority', priorityFilter);
      if (orderSearch.trim()) url.searchParams.set('search', orderSearch.trim());

      const res = await fetch(url.toString(), {
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOrders(data.data.items || data.data.data || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  // Load Sample Queue
  const loadSampleQueue = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/samples/queue`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSamplesQueue(data.data);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboard();
      loadCatalogue();
      loadOrders();
      loadSampleQueue();
    }
  }, [token, statusFilter, priorityFilter]);

  // Action: Add New Test Catalogue Entry
  const handleCreateCatalogueTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestCategory.trim()) {
      showNotice('Please enter a test name', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: newTestCategory.trim(),
        description: newTestDesc.trim() || undefined,
        referenceValue: newTestRef.trim() || undefined,
        price: parseFloat(newTestPrice) || 0,
        sampleType: newTestSampleType,
        turnaroundHours: parseInt(newTestTurnaround, 10) || 4,
        parameters: newTestParameters.filter((p) => p.name.trim()).map((p, idx) => ({
          name: p.name.trim(),
          unit: p.unit.trim() || undefined,
          referenceRange: p.referenceMin && p.referenceMax ? `${p.referenceMin} - ${p.referenceMax} ${p.unit}`.trim() : undefined,
          displayOrder: idx + 1,
        })),
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/lab/catalogue`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showNotice(`Test "${newTestCategory}" created successfully`);
        setShowAddTestModal(false);
        setNewTestCategory('');
        setNewTestDesc('');
        setNewTestRef('');
        loadCatalogue();
      } else {
        showNotice(data.message || 'Failed to create test catalogue entry', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error creating test', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Create Lab Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSelectedTestIds.length) {
      showNotice('Select at least one test to order', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        patientId: parseInt(orderPatientId, 10),
        doctorId: orderDoctorId ? parseInt(orderDoctorId, 10) : undefined,
        priority: orderPriority,
        clinicalNotes: orderClinicalNotes.trim() || undefined,
        testIds: orderSelectedTestIds,
        generateInvoice: orderGenerateInvoice,
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/lab/orders`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showNotice(`Lab Order #${data.data?.orderNumber || data.data?.id} raised successfully`);
        setShowCreateOrderModal(false);
        setOrderSelectedTestIds([]);
        setOrderClinicalNotes('');
        loadOrders();
        loadSampleQueue();
        loadDashboard();
      } else {
        showNotice(data.message || 'Failed to raise lab order', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Network error raising order', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Collect Sample
  const handleCollectSample = async (sampleId: number | string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/samples/${sampleId}/collect`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ notes: 'Collected at bedside by phlebotomy staff' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Specimen #${data.data?.sampleNumber || sampleId} marked as collected`);
        loadSampleQueue();
        loadOrders();
        loadDashboard();
      } else {
        showNotice(data.message || 'Failed to collect sample', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error collecting sample', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Receive / Accession Sample
  const handleReceiveSample = async (sampleId: number | string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/samples/${sampleId}/receive`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ credentials: 'Cold chain verified, tube barcoded' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Specimen #${sampleId} accessioned into laboratory analytical pool`);
        loadSampleQueue();
        loadOrders();
        loadDashboard();
      } else {
        showNotice(data.message || 'Failed to accession sample', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error accessioning sample', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Reject Sample
  const handleRejectSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingSampleId) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/samples/${rejectingSampleId}/reject`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          reason: rejectionReason,
          notes: rejectionNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Specimen #${rejectingSampleId} rejected and re-draw requested`);
        setRejectingSampleId(null);
        setRejectionNotes('');
        loadSampleQueue();
        loadOrders();
        loadDashboard();
      } else {
        showNotice(data.message || 'Failed to reject sample', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error rejecting sample', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Open Result Workbench
  const openWorkbench = (order: LabOrder) => {
    setWorkbenchOrder(order);
    const initialValues: Record<
      string,
      { value: string; abnormalFlag: AbnormalFlag; comments: string; unit: string; refRange: string }
    > = {};

    order.tests.forEach((test) => {
      if (test.resultParameters && test.resultParameters.length > 0) {
        test.resultParameters.forEach((param) => {
          const key = `${test.id}_${param.parameterId || param.parameterName}`;
          initialValues[key] = {
            value: param.value || '',
            abnormalFlag: param.abnormalFlag || 'NORMAL',
            comments: param.clinicalComments || '',
            unit: param.unitSnapshot || '',
            refRange: param.referenceRangeSnapshot || '',
          };
        });
      } else {
        const key = `${test.id}_main`;
        initialValues[key] = {
          value: test.result || '',
          abnormalFlag: 'NORMAL',
          comments: '',
          unit: '',
          refRange: test.referenceValue || '',
        };
      }
    });

    setResultValues(initialValues);
    setResultSummary(order.report || '');
    setActiveTab('workbench');
  };

  // Action: Save Entered Results
  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workbenchOrder) return;

    try {
      setLoading(true);
      const parametersPayload: any[] = [];

      workbenchOrder.tests.forEach((test) => {
        if (test.resultParameters && test.resultParameters.length > 0) {
          test.resultParameters.forEach((param) => {
            const key = `${test.id}_${param.parameterId || param.parameterName}`;
            const row = resultValues[key];
            if (row) {
              parametersPayload.push({
                testId: Number(test.id),
                parameterId: param.parameterId ? Number(param.parameterId) : undefined,
                parameterName: param.parameterName,
                value: row.value.trim(),
                unitSnapshot: row.unit || undefined,
                referenceRangeSnapshot: row.refRange || undefined,
                abnormalFlag: row.abnormalFlag,
                clinicalComments: row.comments.trim() || undefined,
              });
            }
          });
        } else {
          const key = `${test.id}_main`;
          const row = resultValues[key];
          if (row) {
            parametersPayload.push({
              testId: Number(test.id),
              parameterName: test.name,
              value: row.value.trim(),
              referenceRangeSnapshot: test.referenceValue || undefined,
              abnormalFlag: row.abnormalFlag,
            });
          }
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/v1/lab/orders/${workbenchOrder.id}/results`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          parameters: parametersPayload,
          summary: resultSummary.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showNotice(`Results saved successfully for Order #${workbenchOrder.orderNumber}`);
        loadOrders();
        loadDashboard();
        setWorkbenchOrder(data.data);
      } else {
        showNotice(data.message || 'Failed to save test results', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error saving results', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Verify Results
  const handleVerifyResults = async (orderId: number | string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/orders/${orderId}/verify`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ comments: 'Quality control verified. Parameters within valid analytical limits.' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Order #${orderId} verified by laboratory specialist`);
        loadOrders();
        loadDashboard();
        if (workbenchOrder?.id === orderId) setWorkbenchOrder(data.data);
      } else {
        showNotice(data.message || 'Failed to verify order', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error verifying order', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Finalize & Approve Report
  const handleApproveReport = async (orderId: number | string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/orders/${orderId}/approve`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ remarks: approvalNotes.trim() || 'Clinically evaluated and released.' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Official diagnostic report finalized and signed off`);
        setApprovalNotes('');
        loadOrders();
        loadDashboard();
        if (workbenchOrder?.id === orderId) setWorkbenchOrder(data.data);
      } else {
        showNotice(data.message || 'Failed to approve report', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error approving report', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Controlled Report Amendment
  const handleAmendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printableOrder) return;
    if (!amendmentReason.trim()) {
      showNotice('Mandatory justification reason is required for amendments', 'error');
      return;
    }

    try {
      setLoading(true);
      const updatedParams: any[] = [];
      printableOrder.tests.forEach((t) => {
        if (t.resultParameters && t.resultParameters.length > 0) {
          t.resultParameters.forEach((p) => {
            const key = `${t.id}_${p.parameterId || p.parameterName}`;
            const val = amendmentValues[key] ?? p.value;
            updatedParams.push({
              testId: Number(t.id),
              parameterId: p.parameterId ? Number(p.parameterId) : undefined,
              parameterName: p.parameterName,
              value: String(val).trim(),
              unitSnapshot: p.unitSnapshot || undefined,
              referenceRangeSnapshot: p.referenceRangeSnapshot || undefined,
              abnormalFlag: p.abnormalFlag,
            });
          });
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/v1/lab/orders/${printableOrder.id}/amend`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          reason: amendmentReason.trim(),
          parameters: updatedParams,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Official report amended with audited revision entry`);
        setShowAmendModal(false);
        setAmendmentReason('');
        setPrintableOrder(data.data);
        loadOrders();
      } else {
        showNotice(data.message || 'Failed to amend report', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error amending report', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action: Cancel Order
  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrderId) return;
    if (!cancellationReason.trim()) {
      showNotice('Cancellation reason is required', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/lab/orders/${cancellingOrderId}/cancel`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ reason: cancellationReason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Lab order cancelled successfully`);
        setCancellingOrderId(null);
        setCancellationReason('');
        loadOrders();
        loadDashboard();
      } else {
        showNotice(data.message || 'Failed to cancel order', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'Error cancelling order', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCatalogue = catalogue.filter((item) =>
    item.category.toLowerCase().includes(catalogueSearch.toLowerCase()) ||
    (item.sampleType && item.sampleType.toLowerCase().includes(catalogueSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Flash Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <Activity className="w-5 h-5 text-blue-600" />
            )}
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl flex items-center justify-center text-indigo-400 shadow-inner">
            <Microscope className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Diagnostic Laboratory (LIS)</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Phase 14 Active
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Role: {userRole}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Specimen accessioning, automated analyzer workbench, quality validation & release
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadDashboard();
              loadOrders();
              loadSampleQueue();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-all hover:scale-105 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateOrderModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Requisition
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-indigo-600 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          Dashboard & KPIs
        </button>

        <button
          onClick={() => setActiveTab('catalogue')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'catalogue'
              ? 'bg-white text-indigo-600 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          Test Catalogue ({catalogue.length})
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'orders'
              ? 'bg-white text-indigo-600 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Requisitions ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('phlebotomy')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'phlebotomy'
              ? 'bg-white text-indigo-600 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <TestTube className="w-4 h-4" />
          Phlebotomy & Samples ({samplesQueue.length})
        </button>

        <button
          onClick={() => setActiveTab('workbench')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'workbench'
              ? 'bg-white text-indigo-600 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Microscope className="w-4 h-4" />
          Result Workbench
        </button>

        {printableOrder && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              activeTab === 'reports'
                ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            Official Report ({printableOrder.orderNumber})
          </button>
        )}
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW & DASHBOARD
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Pending Orders</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.pendingOrders}</div>
              <div className="text-xs text-amber-600 font-medium mt-1">Awaiting Specimen</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Phlebotomy Queue</div>
              <div className="text-2xl font-bold text-indigo-600 mt-2">{metrics.sampleCollectionQueue}</div>
              <div className="text-xs text-indigo-600 font-medium mt-1">Pending Draw</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">In Analytical Lab</div>
              <div className="text-2xl font-bold text-sky-600 mt-2">{metrics.processingQueue}</div>
              <div className="text-xs text-sky-600 font-medium mt-1">Accessioned</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Needs Verification</div>
              <div className="text-2xl font-bold text-purple-600 mt-2">{metrics.awaitingVerification}</div>
              <div className="text-xs text-purple-600 font-medium mt-1">Readings Entered</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Approved Reports</div>
              <div className="text-2xl font-bold text-emerald-600 mt-2">{metrics.completedReports}</div>
              <div className="text-xs text-emerald-600 font-medium mt-1">Finalized & Released</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Specimen Rejections</div>
              <div className="text-2xl font-bold text-rose-600 mt-2">{metrics.rejectedSamples}</div>
              <div className="text-xs text-rose-600 font-medium mt-1">Compromised / Re-draw</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Test Formulary</div>
              <div className="text-2xl font-bold text-slate-800 mt-2">{metrics.totalTestsInCatalogue}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">Active Profiles</div>
            </div>
          </div>

          {/* Recent Requisitions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Recent Laboratory Requisitions</h3>
                <p className="text-xs text-slate-500 mt-0.5">Real-time specimen workflow and analytical stage tracking</p>
              </div>
              <button
                onClick={() => setActiveTab('orders')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                View all orders <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Test Profile</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No laboratory requisitions found. Click "New Requisition" to create one.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                          {order.orderNumber || `LAB-${order.id}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{order.patientName}</div>
                          <div className="text-xs text-slate-400">{order.patientPhone || 'Walk-in'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-800">
                            {order.tests?.map((t) => t.name).join(', ') || order.categoryName || 'General Panel'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              order.priority === 'STAT'
                                ? 'bg-rose-100 text-rose-700 animate-pulse'
                                : order.priority === 'URGENT'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {order.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              order.status === 'COMPLETED' || order.status === 'reported'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'VERIFIED'
                                ? 'bg-purple-100 text-purple-800'
                                : order.status === 'RESULT_ENTERED'
                                ? 'bg-blue-100 text-blue-800'
                                : order.status === 'SAMPLE_COLLECTED' || order.status === 'SAMPLE_RECEIVED' || order.status === 'PROCESSING'
                                ? 'bg-sky-100 text-sky-800'
                                : order.status === 'CANCELLED'
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">{order.date}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openWorkbench(order)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-xs flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Workbench
                            </button>
                            <button
                              onClick={() => {
                                setPrintableOrder(order);
                                setActiveTab('reports');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="Print Report"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TEST CATALOGUE & FORMULARY
          ========================================================================= */}
      {activeTab === 'catalogue' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search test name, sample requirement, or specimen type..."
                value={catalogueSearch}
                onChange={(e) => setCatalogueSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setShowAddTestModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Formulary Test
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCatalogue.map((item) => (
              <div
                key={item.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-base">{item.category}</h4>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                      PKR {item.price ? Number(item.price).toLocaleString() : '0'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                    {item.description || 'Clinical diagnostic laboratory test profile.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Specimen Tube:</span>
                      <span className="font-medium text-slate-800">{item.sampleType || 'Standard Specimen'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Turnaround:</span>
                      <span className="font-medium text-slate-800">{item.turnaroundHours} hours</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Reference:</span>
                      <span className="font-mono text-slate-700 truncate max-w-[150px]">{item.referenceValue || 'Variable'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {item.parameters?.length || 0} parameter(s) mapped
                  </span>
                  <button
                    onClick={() => setSelectedCatalogueItem(item)}
                    className="font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    View Details &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: REQUISITIONS & ORDERS
          ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search order number or patient name..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="SAMPLE_PENDING">Sample Pending</option>
                <option value="SAMPLE_COLLECTED">Sample Collected</option>
                <option value="SAMPLE_RECEIVED">Accessioned / Processing</option>
                <option value="RESULT_ENTERED">Results Entered</option>
                <option value="VERIFIED">Verified</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT / Critical</option>
              </select>
            </div>

            <button
              onClick={() => setShowCreateOrderModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              New Requisition
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-4">Order Number</th>
                    <th className="py-3.5 px-4">Patient Demographics</th>
                    <th className="py-3.5 px-4">Requesting Clinician</th>
                    <th className="py-3.5 px-4">Tests Ordered</th>
                    <th className="py-3.5 px-4">Specimen Status</th>
                    <th className="py-3.5 px-4">Stage</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No laboratory orders match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{order.orderNumber}</div>
                          <div className="text-xs text-slate-400">{order.date}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{order.patientName}</div>
                          <div className="text-xs text-slate-400">{order.patientPhone || 'No contact info'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800">{order.doctorName || 'Self-Referred'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 max-w-[200px] truncate">
                            {order.tests?.map((t) => t.name).join(', ') || order.categoryName}
                          </div>
                          <div className="text-xs text-slate-400">{order.tests?.length || 0} line item(s)</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {order.samples && order.samples.length > 0 ? (
                            <div className="space-y-1">
                              {order.samples.map((s) => (
                                <div key={s.id} className="text-xs flex items-center gap-1.5 font-mono">
                                  <Barcode className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{s.sampleNumber}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-sans text-[10px] font-bold ${
                                      s.status === 'COLLECTED'
                                        ? 'bg-sky-100 text-sky-800'
                                        : s.status === 'RECEIVED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : s.status === 'REJECTED'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {s.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No samples</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              order.status === 'COMPLETED' || order.status === 'reported'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'VERIFIED'
                                ? 'bg-purple-100 text-purple-800'
                                : order.status === 'RESULT_ENTERED'
                                ? 'bg-blue-100 text-blue-800'
                                : order.status === 'CANCELLED'
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openWorkbench(order)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-xs flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Workbench
                            </button>
                            <button
                              onClick={() => {
                                setPrintableOrder(order);
                                setActiveTab('reports');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="Print Report"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setCancellingOrderId(Number(order.id))}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Cancel Order"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: PHLEBOTOMY & SPECIMEN ACCESSIONING QUEUE
          ========================================================================= */}
      {activeTab === 'phlebotomy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Specimen Collection & Accessioning Queue</h3>
                <p className="text-xs text-slate-500 mt-0.5">Barcode scanning, phlebotomy confirmation & specimen triage</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {samplesQueue.length} Active Specimens
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-4">Specimen Barcode</th>
                    <th className="py-3.5 px-4">Patient Name</th>
                    <th className="py-3.5 px-4">Sample Type</th>
                    <th className="py-3.5 px-4">Current Status</th>
                    <th className="py-3.5 px-4">Collection Date/Time</th>
                    <th className="py-3.5 px-4 text-right">Phlebotomy Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {samplesQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No pending specimens in the collection queue.
                      </td>
                    </tr>
                  ) : (
                    samplesQueue.map((sample) => (
                      <tr key={sample.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900 flex items-center gap-2">
                            <Barcode className="w-4 h-4 text-slate-500" />
                            {sample.sampleNumber}
                          </div>
                          <div className="text-xs text-slate-400">Order #{sample.lab?.orderNumber || sample.labId}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {sample.lab?.patientName || 'Hospital Patient'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800">
                            {sample.sampleType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              sample.status === 'COLLECTED'
                                ? 'bg-sky-100 text-sky-800'
                                : sample.status === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sample.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sample.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {sample.collectedAt ? new Date(sample.collectedAt).toLocaleTimeString() : 'Pending Draw'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {sample.status === 'PENDING' && (
                              <button
                                onClick={() => handleCollectSample(sample.id)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm transition-all"
                              >
                                Collect Specimen
                              </button>
                            )}

                            {sample.status === 'COLLECTED' && (
                              <button
                                onClick={() => handleReceiveSample(sample.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-all"
                              >
                                Accept & Accession
                              </button>
                            )}

                            {sample.status !== 'REJECTED' && (
                              <button
                                onClick={() => setRejectingSampleId(Number(sample.id))}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium text-xs transition-all"
                              >
                                Reject Specimen
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: RESULT WORKBENCH & PARAMETERS
          ========================================================================= */}
      {activeTab === 'workbench' && (
        <div className="space-y-6">
          {!workbenchOrder ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Microscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No Requisition Selected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Select an order from the Requisitions list or Recent Orders table to enter and verify parameter readings.
              </p>
              <button
                onClick={() => setActiveTab('orders')}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow"
              >
                Choose Requisition
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              {/* Patient Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-900">{workbenchOrder.patientName}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                      {workbenchOrder.orderNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        workbenchOrder.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : workbenchOrder.status === 'VERIFIED'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {workbenchOrder.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Priority: <span className="font-semibold text-slate-800">{workbenchOrder.priority}</span> &bull; Clinician:{' '}
                    <span className="font-semibold text-slate-800">{workbenchOrder.doctorName || 'Self'}</span> &bull; Date:{' '}
                    <span className="font-semibold text-slate-800">{workbenchOrder.date}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {workbenchOrder.status === 'RESULT_ENTERED' && (
                    <button
                      onClick={() => handleVerifyResults(workbenchOrder.id)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition-all flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      Verify Results
                    </button>
                  )}

                  {workbenchOrder.status === 'VERIFIED' && (
                    <button
                      onClick={() => handleApproveReport(workbenchOrder.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Finalize & Approve
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setPrintableOrder(workbenchOrder);
                      setActiveTab('reports');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    Preview Report
                  </button>
                </div>
              </div>

              {/* Parameter Entry Form */}
              <form onSubmit={handleSaveResults} className="space-y-6">
                <div className="space-y-6">
                  {workbenchOrder.tests.map((test) => (
                    <div key={test.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{test.name}</h4>
                          <span className="text-xs text-slate-500">Specimen Tube: {test.sampleType || 'EDTA Whole Blood'}</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          Status: {test.status}
                        </span>
                      </div>

                      {test.resultParameters && test.resultParameters.length > 0 ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-slate-500 uppercase px-2">
                            <div className="col-span-4">Parameter</div>
                            <div className="col-span-3">Reading Value</div>
                            <div className="col-span-2">Unit</div>
                            <div className="col-span-2">Reference Range</div>
                            <div className="col-span-1">Flag</div>
                          </div>

                          {test.resultParameters.map((param) => {
                            const key = `${test.id}_${param.parameterId || param.parameterName}`;
                            const row = resultValues[key] || {
                              value: param.value || '',
                              abnormalFlag: param.abnormalFlag || 'NORMAL',
                              comments: '',
                              unit: param.unitSnapshot || '',
                              refRange: param.referenceRangeSnapshot || '',
                            };

                            return (
                              <div key={param.id} className="grid grid-cols-12 gap-3 items-center bg-white p-2.5 rounded-lg border border-slate-200">
                                <div className="col-span-4 font-semibold text-slate-800 text-xs">
                                  {param.parameterName}
                                </div>
                                <div className="col-span-3">
                                  <input
                                    type="text"
                                    value={row.value}
                                    placeholder="Enter reading..."
                                    disabled={workbenchOrder.status === 'COMPLETED'}
                                    onChange={(e) =>
                                      setResultValues((prev) => ({
                                        ...prev,
                                        [key]: { ...row, value: e.target.value },
                                      }))
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 font-mono">
                                  {row.unit || param.unitSnapshot || '-'}
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 font-mono">
                                  {row.refRange || param.referenceRangeSnapshot || '-'}
                                </div>
                                <div className="col-span-1">
                                  <select
                                    value={row.abnormalFlag}
                                    disabled={workbenchOrder.status === 'COMPLETED'}
                                    onChange={(e) =>
                                      setResultValues((prev) => ({
                                        ...prev,
                                        [key]: { ...row, abnormalFlag: e.target.value as AbnormalFlag },
                                      }))
                                    }
                                    className={`w-full py-1 px-1 rounded text-[10px] font-bold border ${
                                      row.abnormalFlag === 'HIGH' || row.abnormalFlag === 'CRITICAL'
                                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                                        : row.abnormalFlag === 'LOW'
                                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    }`}
                                  >
                                    <option value="NORMAL">NORM</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="LOW">LOW</option>
                                    <option value="CRITICAL">CRIT</option>
                                    <option value="ABNORMAL">ABN</option>
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Result / Findings ({test.name})
                          </label>
                          <textarea
                            rows={3}
                            value={resultValues[`${test.id}_main`]?.value || ''}
                            disabled={workbenchOrder.status === 'COMPLETED'}
                            onChange={(e) => {
                              const key = `${test.id}_main`;
                              const curr = resultValues[key] || {
                                value: '',
                                abnormalFlag: 'NORMAL',
                                comments: '',
                                unit: '',
                                refRange: '',
                              };
                              setResultValues((prev) => ({
                                ...prev,
                                [key]: { ...curr, value: e.target.value },
                              }));
                            }}
                            placeholder="Enter textual result, micro readings, or interpretation..."
                            className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Overall Summary Impression */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Pathologist / Technologist General Clinical Impression
                  </label>
                  <textarea
                    rows={2}
                    value={resultSummary}
                    disabled={workbenchOrder.status === 'COMPLETED'}
                    onChange={(e) => setResultSummary(e.target.value)}
                    placeholder="Enter overall summary diagnosis, differential impression, or analyzer remarks..."
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                {workbenchOrder.status !== 'COMPLETED' && (
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow transition-all flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Save & Submit Results
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 6: OFFICIAL PRINTABLE REPORT
          ========================================================================= */}
      {activeTab === 'reports' && printableOrder && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Official Clinical Laboratory Report Print Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Report
              </button>
              {printableOrder.status === 'COMPLETED' && (
                <button
                  onClick={() => setShowAmendModal(true)}
                  className="px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-xs flex items-center gap-1.5"
                >
                  <FileEdit className="w-3.5 h-3.5" /> Amend Report
                </button>
              )}
            </div>
          </div>

          {/* Printable Hospital Letterhead Report Paper */}
          <div className="bg-white p-8 md:p-12 rounded-2xl border border-slate-300 shadow-lg max-w-4xl mx-auto text-slate-900 font-sans print:p-0 print:border-none print:shadow-none">
            {/* Header Header */}
            <div className="border-b-2 border-slate-900 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-wider text-slate-900">
                    MEDORA HOSPITAL & DIAGNOSTIC CENTER
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Department of Pathology & Clinical Diagnostics &bull; ISO 15189 Certified
                  </p>
                  <p className="text-xs text-slate-400">
                    45 Medical Enclave, Hospital Road &bull; Ph: (051) 920-1234 &bull; Web: medora.hospital
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded border">
                    ACCESSION: {printableOrder.orderNumber}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Report Date: {printableOrder.date}</div>
                </div>
              </div>
            </div>

            {/* Patient Demographics Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-6">
              <div>
                <span className="text-slate-400 block">PATIENT NAME</span>
                <span className="font-bold text-slate-900 text-sm">{printableOrder.patientName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">CONTACT / MRN</span>
                <span className="font-semibold text-slate-800">{printableOrder.patientPhone || 'Walk-In'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">ORDERING CLINICIAN</span>
                <span className="font-semibold text-slate-800">{printableOrder.doctorName || 'Consultant'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">STATUS</span>
                <span className="font-bold text-emerald-700 uppercase">{printableOrder.status}</span>
              </div>
            </div>

            {/* Test Results Breakdown */}
            <div className="space-y-6">
              {printableOrder.tests.map((test) => (
                <div key={test.id} className="border-b border-slate-200 pb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                      {test.name}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">Specimen: {test.sampleType || 'Blood'}</span>
                  </div>

                  {test.resultParameters && test.resultParameters.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="p-2">Parameter</th>
                          <th className="p-2">Observed Reading</th>
                          <th className="p-2">Flag</th>
                          <th className="p-2">Reference Limits</th>
                          <th className="p-2">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {test.resultParameters.map((p) => (
                          <tr key={p.id}>
                            <td className="p-2 font-sans font-medium text-slate-800">{p.parameterName}</td>
                            <td className="p-2 font-bold text-slate-900">{p.value}</td>
                            <td className="p-2">
                              {p.abnormalFlag !== 'NORMAL' ? (
                                <span className="text-rose-600 font-bold px-1.5 py-0.5 rounded bg-rose-50 text-[10px]">
                                  {p.abnormalFlag}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">NORMAL</span>
                              )}
                            </td>
                            <td className="p-2 text-slate-600">{p.referenceRangeSnapshot || '-'}</td>
                            <td className="p-2 text-slate-500">{p.unitSnapshot || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-800">
                      {test.result || 'No recorded observations.'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pathologist Summary Impression */}
            {printableOrder.report && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-900 block mb-1 uppercase tracking-wider text-[10px]">
                  Clinical Pathologist Findings / Impression:
                </span>
                <p className="text-slate-700 whitespace-pre-line">{printableOrder.report}</p>
              </div>
            )}

            {/* Audit Amendments Trail */}
            {printableOrder.amendments && printableOrder.amendments.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-amber-50/50 border border-amber-200 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-800 uppercase text-[10px] tracking-wider mb-2">
                  <History className="w-3.5 h-3.5" /> Official Amendment History
                </div>
                {printableOrder.amendments.map((amend) => (
                  <div key={amend.id} className="text-slate-700 space-y-1 border-t border-amber-200/60 pt-2 first:border-0 first:pt-0">
                    <p className="font-semibold text-slate-900">
                      Amended on {new Date(amend.createdAt).toLocaleString()} by Authorized Staff:
                    </p>
                    <p className="italic text-slate-600">"{amend.reason}"</p>
                  </div>
                ))}
              </div>
            )}

            {/* Digital Sign-off Verification Section */}
            <div className="mt-12 pt-8 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="font-script text-lg text-slate-600 mb-1 font-serif">Electronic Sign-off</div>
                <div className="border-t border-slate-300 pt-1 font-bold text-slate-900">Medical Technologist</div>
                <div className="text-[10px] text-slate-400">Clinical Pathology Validation</div>
              </div>
              <div>
                <div className="font-script text-lg text-slate-600 mb-1 font-serif">Authorized Stamp</div>
                <div className="border-t border-slate-300 pt-1 font-bold text-slate-900">Consultant Pathologist</div>
                <div className="text-[10px] text-slate-400">FCPS (Pathology), Lab Director</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* Modal 1: Create New Requisition */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Raise New Laboratory Requisition
              </h3>
              <button
                onClick={() => setShowCreateOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Patient ID</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={orderPatientId}
                  onChange={(e) => setOrderPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Requesting Doctor ID</label>
                <input
                  type="number"
                  min="1"
                  value={orderDoctorId}
                  onChange={(e) => setOrderDoctorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Priority</label>
                <select
                  value={orderPriority}
                  onChange={(e) => setOrderPriority(e.target.value as LabPriority)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                >
                  <option value="ROUTINE">Routine Diagnostic</option>
                  <option value="URGENT">Urgent Investigation</option>
                  <option value="STAT">STAT / Emergency Panel</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Select Tests from Formulary ({orderSelectedTestIds.length} chosen)
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50/50">
                  {catalogue.map((test) => {
                    const isChecked = orderSelectedTestIds.includes(Number(test.id));
                    return (
                      <label
                        key={test.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all ${
                          isChecked ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const tId = Number(test.id);
                              if (e.target.checked) {
                                setOrderSelectedTestIds((prev) => [...prev, tId]);
                              } else {
                                setOrderSelectedTestIds((prev) => prev.filter((id) => id !== tId));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{test.category}</span>
                        </div>
                        <span className="font-mono text-slate-500">PKR {Number(test.price || 0)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Indication / Diagnosis</label>
                <textarea
                  rows={2}
                  value={orderClinicalNotes}
                  onChange={(e) => setOrderClinicalNotes(e.target.value)}
                  placeholder="Pre-op evaluation, fever of unknown origin, etc."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="generateInvoiceCheckbox"
                  checked={orderGenerateInvoice}
                  onChange={(e) => setOrderGenerateInvoice(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="generateInvoiceCheckbox" className="text-xs text-slate-700 font-medium">
                  Automatically generate billing invoice in Billing Module
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateOrderModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                >
                  Create Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add New Catalogue Test */}
      {showAddTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Add Formulary Diagnostic Test
              </h3>
              <button
                onClick={() => setShowAddTestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCatalogueTest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Test Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lipid Profile, Complete Blood Count"
                  value={newTestCategory}
                  onChange={(e) => setNewTestCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Service Price (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={newTestPrice}
                    onChange={(e) => setNewTestPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Turnaround (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={newTestTurnaround}
                    onChange={(e) => setNewTestTurnaround(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Required Specimen Tube</label>
                <select
                  value={newTestSampleType}
                  onChange={(e) => setNewTestSampleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="EDTA Whole Blood">EDTA Whole Blood (Purple Top)</option>
                  <option value="Serum / Plain">Serum / Clot Activator (Yellow/Red Top)</option>
                  <option value="Sodium Citrate Plasma">Sodium Citrate Plasma (Blue Top)</option>
                  <option value="Fluoride Plasma">Sodium Fluoride (Grey Top)</option>
                  <option value="Spot Urine">Clean Catch Urine Cup</option>
                  <option value="Stool Specimen">Sterile Stool Container</option>
                  <option value="Swab Specimen">Amies Transport Swab</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Standard Reference Value</label>
                <input
                  type="text"
                  placeholder="e.g. 70 - 99 mg/dL or See Parameters"
                  value={newTestRef}
                  onChange={(e) => setNewTestRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Description</label>
                <textarea
                  rows={2}
                  value={newTestDesc}
                  onChange={(e) => setNewTestDesc(e.target.value)}
                  placeholder="Description of methodology or clinical indication"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddTestModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                >
                  Add Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Reject Specimen Triage Modal */}
      {rejectingSampleId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-rose-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Reject Specimen #{rejectingSampleId}
              </h3>
              <button
                onClick={() => setRejectingSampleId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSample} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Rejection Reason</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                >
                  <option value="HEMOLYZED">HEMOLYZED - Specimen lysed</option>
                  <option value="CLOTTED">CLOTTED - Micro-clots present in anticoagulated tube</option>
                  <option value="INSUFFICIENT_VOLUME">INSUFFICIENT VOLUME - Quantity not sufficient</option>
                  <option value="WRONG_CONTAINER">WRONG CONTAINER - Incorrect tube additive</option>
                  <option value="MISLABELED">MISLABELED - Discrepancy on barcode label</option>
                  <option value="LEAKED_IN_TRANSIT">LEAKED IN TRANSIT - Container broken or leaked</option>
                  <option value="TEMPERATURE_EXCURSION">TEMPERATURE EXCURSION - Cold chain violated</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Additional Remarks for Phlebotomist</label>
                <textarea
                  rows={3}
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="e.g. Redraw requested from contralateral arm"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setRejectingSampleId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow"
                >
                  Confirm Rejection & Request Redraw
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Clinical Amendment Modal */}
      {showAmendModal && printableOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-amber-600" />
                Submit Controlled Report Amendment
              </h3>
              <button
                onClick={() => setShowAmendModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAmendReport} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mandatory Clinical Justification Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  placeholder="e.g. Dilution factor re-calculation following second analyzer confirmation"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">
                  Update Parameter Values:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {printableOrder.tests.map((t) =>
                    t.resultParameters?.map((p) => {
                      const key = `${t.id}_${p.parameterId || p.parameterName}`;
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-800">{p.parameterName}:</span>
                          <input
                            type="text"
                            defaultValue={p.value}
                            onChange={(e) =>
                              setAmendmentValues((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="w-32 px-2 py-1 rounded border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAmendModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow"
                >
                  Save Audited Amendment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Cancel Order Modal */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Cancel Lab Order #{cancellingOrderId}
              </h3>
              <button
                onClick={() => setCancellingOrderId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelOrder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Patient discharged before phlebotomy"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCancellingOrderId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal 6: Test Formulary Details */}
      {selectedCatalogueItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <TestTube className="w-5 h-5 text-indigo-600" />
                  {selectedCatalogueItem.category}
                </h3>
                <span className="text-xs text-slate-500">{selectedCatalogueItem.department || 'Clinical Pathology'}</span>
              </div>
              <button
                onClick={() => setSelectedCatalogueItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 block">Specimen Tube</span>
                  <span className="font-semibold text-slate-800">{selectedCatalogueItem.sampleType || 'EDTA Whole Blood'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Turnaround</span>
                  <span className="font-semibold text-slate-800">{selectedCatalogueItem.turnaroundHours || 4} Hours</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Price</span>
                  <span className="font-semibold text-emerald-600">PKR {Number(selectedCatalogueItem.price || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Status</span>
                  <span className="font-semibold text-slate-800">
                    {selectedCatalogueItem.status || (selectedCatalogueItem.isActive ? 'Active' : 'Inactive')}
                  </span>
                </div>
              </div>

              {selectedCatalogueItem.description && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                  {selectedCatalogueItem.description}
                </div>
              )}

              <div>
                <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider mb-2">Mapped Parameters</h4>
                {selectedCatalogueItem.parameters && selectedCatalogueItem.parameters.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedCatalogueItem.parameters.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border text-xs">
                        <span className="font-medium text-slate-800">{p.name}</span>
                        <div className="text-right">
                          <span className="text-slate-500 mr-2">{p.unit || '-'}</span>
                          <span className="font-mono text-slate-700">{p.referenceRange || 'Standard Range'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No individual analytical parameters configured.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedCatalogueItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
