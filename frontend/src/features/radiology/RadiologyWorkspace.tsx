import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Plus,
  Search,
  Printer,
  RefreshCw,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  FileEdit,
  History,
  X,
  Camera,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

import type {
  RadiologyCategory,
  RadiologyExam,
  RadiologyOrder,
  RadiologyModality,
  RadiologyUrgency,
  RadiologyDashboardMetrics,
} from '../../types/radiology';

interface Props {
  token: string;
  userRole: string;
}

const isDev = import.meta.env.DEV;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:3000' : '');

export function RadiologyWorkspace({ token, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'catalogue' | 'orders' | 'scheduling' | 'worklist' | 'reporting' | 'print'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<RadiologyDashboardMetrics['metrics']>({
    pendingOrders: 0,
    scheduledToday: 0,
    awaitingExamination: 0,
    inProgress: 0,
    reportsPending: 0,
    awaitingVerification: 0,
    completedReports: 0,
    cancelledOrders: 0,
    totalExamsInCatalogue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RadiologyOrder[]>([]);

  // Catalogue
  const [categories, setCategories] = useState<RadiologyCategory[]>([]);
  const [exams, setExams] = useState<RadiologyExam[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [modalityFilter, setModalityFilter] = useState<string>('ALL');
  const [selectedExam, setSelectedExam] = useState<RadiologyExam | null>(null);
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newExamModality, setNewExamModality] = useState<RadiologyModality>('xray');
  const [newExamCategoryId, setNewExamCategoryId] = useState<number | undefined>();
  const [newExamPrice, setNewExamPrice] = useState('60');
  const [newExamTurnaround, setNewExamTurnaround] = useState('4');
  const [newExamPrep, setNewExamPrep] = useState('');
  const [newExamTemplate, setNewExamTemplate] = useState('');

  // Orders Worklist
  const [orders, setOrders] = useState<RadiologyOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [orderModalityFilter, setOrderModalityFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);

  // Create Order Form
  const [orderPatientId, setOrderPatientId] = useState('1');
  const [orderDoctorId, setOrderDoctorId] = useState('1');
  const [orderUrgency, setOrderUrgency] = useState<RadiologyUrgency>('routine');
  const [orderClinicalNotes, setOrderClinicalNotes] = useState('');
  const [orderSelectedExamIds, setOrderSelectedExamIds] = useState<number[]>([]);
  const [orderGenerateInvoice, setOrderGenerateInvoice] = useState(true);

  // Scheduling Modal
  const [schedulingOrder, setSchedulingOrder] = useState<RadiologyOrder | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleRoom, setScheduleRoom] = useState('Room-X101');
  const [scheduleForceConflict, setScheduleForceConflict] = useState(false);
  const [scheduleNotes, setScheduleNotes] = useState('');

  // Reporting Workbench State
  const [reportingOrder, setReportingOrder] = useState<RadiologyOrder | null>(null);
  const [reportFindings, setReportFindings] = useState('');
  const [reportImpression, setReportImpression] = useState('');
  const [reportRecommendations, setReportRecommendations] = useState('');

  // Amendment Modal State
  const [amendingOrder, setAmendingOrder] = useState<RadiologyOrder | null>(null);
  const [amendReason, setAmendReason] = useState('');
  const [amendFindings, setAmendFindings] = useState('');
  const [amendImpression, setAmendImpression] = useState('');

  // Cancellation Modal State
  const [cancellingOrder, setCancellingOrder] = useState<RadiologyOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Printable Report Target
  const [printOrder, setPrintOrder] = useState<RadiologyOrder | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  // =========================================================================
  // API FETCHERS
  // =========================================================================

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/dashboard`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMetrics(data.data.metrics || metrics);
        setRecentOrders(data.data.recentOrders || []);
      }
    } catch {
      // Offline fallback
    }
  }, [getHeaders, metrics]);

  const fetchCatalogue = useCallback(async () => {
    try {
      const [catRes, examRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/radiology/catalogue/categories`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/api/v1/radiology/catalogue/exams`, { headers: getHeaders() }),
      ]);
      const catData = await catRes.json();
      const examData = await examRes.json();

      if (catData.success && catData.data) {
        setCategories(catData.data);
      }
      if (examData.success && examData.data) {
        setExams(examData.data);
      }
    } catch {
      // Offline fallback
    }
  }, [getHeaders]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders?limit=100`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOrders(data.data.orders || data.data.items || data.data || []);
      }
    } catch (err: any) {
      showToast('error', `Failed to load radiology orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // Initial Load
  useEffect(() => {
    fetchDashboard();
    fetchCatalogue();
    fetchOrders();
  }, [fetchDashboard, fetchCatalogue, fetchOrders]);

  // =========================================================================
  // CATALOGUE ACTIONS
  // =========================================================================

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim()) {
      showToast('error', 'Exam name is required');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/catalogue/exams`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: newExamName.trim(),
          modality: newExamModality,
          categoryId: newExamCategoryId ? Number(newExamCategoryId) : undefined,
          price: parseFloat(newExamPrice) || 0,
          turnaroundHours: parseInt(newExamTurnaround, 10) || 24,
          preparationInstructions: newExamPrep.trim() || undefined,
          reportTemplate: newExamTemplate.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Created exam ${data.data.name} (${data.data.code})`);
        setShowAddExamModal(false);
        setNewExamName('');
        setNewExamPrep('');
        setNewExamTemplate('');
        fetchCatalogue();
      } else {
        showToast('error', data.error?.message || 'Failed to create exam');
      }
    } catch (err: any) {
      showToast('error', `Network error creating exam: ${err.message}`);
    }
  };

  // =========================================================================
  // ORDER ACTIONS
  // =========================================================================

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderSelectedExamIds.length === 0) {
      showToast('error', 'Please select at least one imaging exam to order');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          patientId: Number(orderPatientId),
          doctorId: Number(orderDoctorId),
          examIds: orderSelectedExamIds,
          clinicalIndication: orderClinicalNotes.trim() || undefined,
          clinicalNotes: orderClinicalNotes.trim() || undefined,
          urgency: orderUrgency,
          urgent: orderUrgency !== 'routine',
          bill: orderGenerateInvoice,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Requisition created for ${data.data?.length || 1} exam(s)`);
        setShowCreateOrderModal(false);
        setOrderSelectedExamIds([]);
        setOrderClinicalNotes('');
        fetchOrders();
        fetchDashboard();
      } else {
        showToast('error', data.error?.message || 'Failed to create radiology order');
      }
    } catch (err: any) {
      showToast('error', `Network error: ${err.message}`);
    }
  };

  // =========================================================================
  // SCHEDULING & WORKFLOW ACTIONS
  // =========================================================================

  const handleScheduleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingOrder || !scheduleTime) {
      showToast('error', 'Please select appointment date and time');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${schedulingOrder.id}/schedule`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          scheduledAt: new Date(scheduleTime).toISOString(),
          equipmentRoom: scheduleRoom,
          notes: scheduleNotes.trim() || undefined,
          forceConflict: scheduleForceConflict,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Order #${schedulingOrder.orderNumber} scheduled in ${scheduleRoom}`);
        setSchedulingOrder(null);
        setScheduleForceConflict(false);
        fetchOrders();
        fetchDashboard();
      } else {
        showToast('error', data.error?.message || 'Failed to schedule examination');
      }
    } catch (err: any) {
      showToast('error', `Scheduling error: ${err.message}`);
    }
  };

  const handleMarkArrived = async (order: RadiologyOrder) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${order.id}/arrived`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Patient marked arrived for #${order.orderNumber}`);
        fetchOrders();
        fetchDashboard();
      } else {
        showToast('error', data.error?.message || 'Failed to mark arrival');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleStartExam = async (order: RadiologyOrder) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${order.id}/start`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ equipmentRoom: order.equipmentRoom || 'Room-X101' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Examination marked in-progress for #${order.orderNumber}`);
        fetchOrders();
        fetchDashboard();
      } else {
        showToast('error', data.error?.message || 'Failed to start examination');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleCompleteExam = async (order: RadiologyOrder) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${order.id}/complete`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ imageCount: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Scan completed for #${order.orderNumber}. Ready for Radiologist report.`);
        fetchOrders();
        fetchDashboard();
      } else {
        showToast('error', data.error?.message || 'Failed to complete examination');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // =========================================================================
  // REPORTING WORKBENCH & AMENDMENTS
  // =========================================================================

  const openReportingWorkbench = (order: RadiologyOrder) => {
    setReportingOrder(order);
    setReportFindings(order.findings || order.radiologyExam?.reportTemplate || '');
    setReportImpression(order.impression || '');
    setReportRecommendations(order.recommendations || '');
    setActiveTab('reporting');
  };

  const handleSaveReportDraft = async () => {
    if (!reportingOrder) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${reportingOrder.id}/draft`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          findings: reportFindings.trim(),
          impression: reportImpression.trim() || undefined,
          recommendations: reportRecommendations.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('info', 'Draft findings saved safely');
        fetchOrders();
      } else {
        showToast('error', data.error?.message || 'Failed to save draft');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleSubmitFormalReport = async () => {
    if (!reportingOrder) return;
    if (!reportImpression.trim()) {
      showToast('error', 'Diagnostic impression is mandatory for formal report sign-off');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${reportingOrder.id}/report`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          findings: reportFindings.trim() || 'No active acute findings.',
          impression: reportImpression.trim(),
          recommendations: reportRecommendations.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Diagnostic report finalized for #${reportingOrder.orderNumber}`);
        fetchOrders();
        fetchDashboard();
        setReportingOrder(data.data);
      } else {
        showToast('error', data.error?.message || 'Report submission failed');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleVerifyReport = async (orderId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${orderId}/verify`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Report quality verified and stamped');
        fetchOrders();
        fetchDashboard();
        if (reportingOrder?.id === orderId) {
          setReportingOrder(data.data);
        }
      } else {
        showToast('error', data.error?.message || 'Verification failed');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleAuthorizeRelease = async (orderId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${orderId}/approve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Diagnostic report authorized for clinical release');
        fetchOrders();
        fetchDashboard();
        if (reportingOrder?.id === orderId) {
          setReportingOrder(data.data);
        }
      } else {
        showToast('error', data.error?.message || 'Authorization failed');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleCreateAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendingOrder || !amendReason.trim()) {
      showToast('error', 'Clinical reason for amendment is mandatory');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${amendingOrder.id}/amend`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          reason: amendReason.trim(),
          findings: amendFindings.trim() || undefined,
          impression: amendImpression.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Audited report amendment logged successfully');
        setAmendingOrder(null);
        setAmendReason('');
        fetchOrders();
      } else {
        showToast('error', data.error?.message || 'Failed to issue amendment');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder || !cancelReason.trim()) {
      showToast('error', 'Cancellation reason is mandatory');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/radiology/orders/${cancellingOrder.id}/cancel`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Order #${cancellingOrder.orderNumber} cancelled`);
        setCancellingOrder(null);
        setCancelReason('');
        fetchOrders();
        fetchDashboard();
      } else {
        showToast('error', data.error?.message || 'Failed to cancel order');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Filtered Lists
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesModality = modalityFilter === 'ALL' || exam.modality.toLowerCase() === modalityFilter.toLowerCase();
      const matchesSearch =
        !catalogueSearch.trim() ||
        exam.name.toLowerCase().includes(catalogueSearch.toLowerCase()) ||
        exam.code.toLowerCase().includes(catalogueSearch.toLowerCase()) ||
        (exam.bodyPart && exam.bodyPart.toLowerCase().includes(catalogueSearch.toLowerCase()));
      return matchesModality && matchesSearch;
    });
  }, [exams, modalityFilter, catalogueSearch]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'ALL' || order.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesModality = orderModalityFilter === 'ALL' || order.modality?.toLowerCase() === orderModalityFilter.toLowerCase();
      const matchesUrgency = urgencyFilter === 'ALL' || order.urgency.toLowerCase() === urgencyFilter.toLowerCase();
      const matchesSearch =
        !orderSearch.trim() ||
        order.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
        (order.patient?.name && order.patient.name.toLowerCase().includes(orderSearch.toLowerCase())) ||
        (order.patient?.patientId && order.patient.patientId.toLowerCase().includes(orderSearch.toLowerCase())) ||
        (order.examName && order.examName.toLowerCase().includes(orderSearch.toLowerCase()));
      return matchesStatus && matchesModality && matchesUrgency && matchesSearch;
    });
  }, [orders, statusFilter, orderModalityFilter, urgencyFilter, orderSearch]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950 border-rose-500/50 text-rose-200'
              : 'bg-cyan-950 border-cyan-500/50 text-cyan-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : notification.type === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-cyan-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="bg-slate-950/80 border-b border-slate-800 backdrop-blur sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Medora 2.0 | Radiology Information System
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>PACS-Ready Diagnostic Imaging & Reporting</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span className="text-cyan-400 font-mono">RIS-CORE v2.0</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">Role: {userRole}</span>
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateOrderModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Imaging Order</span>
          </button>
          <button
            onClick={() => {
              fetchDashboard();
              fetchOrders();
            }}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition"
            title="Refresh Radiology Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-950/40 border-b border-slate-800 px-6 flex items-center gap-2 overflow-x-auto text-sm">
        {[
          { id: 'overview', label: 'Department Overview', icon: Activity },
          { id: 'orders', label: 'Imaging Requisitions', icon: FileText, badge: metrics.pendingOrders },
          { id: 'scheduling', label: 'Scanner Scheduling', icon: Calendar, badge: metrics.scheduledToday },
          { id: 'worklist', label: 'Scanner Worklist', icon: Camera, badge: metrics.awaitingExamination + metrics.inProgress },
          { id: 'reporting', label: 'Reporting Workbench', icon: FileEdit, badge: metrics.reportsPending },
          { id: 'catalogue', label: 'Modality Catalogue', icon: SlidersHorizontal, badge: metrics.totalExamsInCatalogue },
          { id: 'print', label: 'Printable Report', icon: Printer },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition whitespace-nowrap ${
                isActive
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-800 text-cyan-300 font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & DASHBOARD METRICS */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Pending Requisitions', count: metrics.pendingOrders, color: 'border-amber-500/40 text-amber-400 bg-amber-950/20' },
                { label: 'Scheduled Today', count: metrics.scheduledToday, color: 'border-blue-500/40 text-blue-400 bg-blue-950/20' },
                { label: 'Arrived / In Queue', count: metrics.awaitingExamination, color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20' },
                { label: 'Scanning Now', count: metrics.inProgress, color: 'border-purple-500/40 text-purple-400 bg-purple-950/20' },
                { label: 'Reports Pending', count: metrics.reportsPending, color: 'border-rose-500/40 text-rose-400 bg-rose-950/20' },
                { label: 'Completed Studies', count: metrics.completedReports, color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20' },
              ].map((kpi, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${kpi.color} backdrop-blur shadow-sm`}>
                  <p className="text-xs text-slate-400 font-medium">{kpi.label}</p>
                  <p className="text-2xl font-bold font-mono mt-1">{kpi.count}</p>
                </div>
              ))}
            </div>

            {/* Quick Modality Distribution & Recent Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span>Modality Suites & Units</span>
                </h2>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { name: 'X-Ray (Plain Film)', room: 'Room-X101', status: 'Operational' },
                    { name: 'Computed Tomography', room: 'CT Suite 1', status: 'Operational' },
                    { name: 'Ultrasonography', room: 'US Bay 2', status: 'In Use' },
                    { name: 'MRI 1.5 Tesla', room: 'MRI Bay 1', status: 'Operational' },
                    { name: 'Mammography', room: 'Mammo Suite', status: 'Operational' },
                    { name: 'Fluoroscopy', room: 'Fluoro Unit', status: 'Idle' },
                  ].map((unit, idx) => (
                    <div key={idx} className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                      <p className="font-medium text-slate-300">{unit.name}</p>
                      <p className="text-slate-500 text-[11px] font-mono mt-0.5">{unit.room}</p>
                      <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                        {unit.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders List */}
              <div className="lg:col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Recent Imaging Requisitions</span>
                  </h2>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    View All Orders &rarr;
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="py-2">Order #</th>
                        <th className="py-2">Patient</th>
                        <th className="py-2">Exam / Modality</th>
                        <th className="py-2">Urgency</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recentOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            No radiology orders placed yet today.
                          </td>
                        </tr>
                      ) : (
                        recentOrders.slice(0, 6).map((order) => (
                          <tr key={order.id} className="hover:bg-slate-900/50">
                            <td className="py-2.5 font-mono text-cyan-400">{order.orderNumber}</td>
                            <td className="py-2.5">
                              <p className="font-medium text-slate-200">{order.patient?.name || 'Walk-in'}</p>
                              <p className="text-[10px] text-slate-500">{order.patient?.patientId}</p>
                            </td>
                            <td className="py-2.5">
                              <p className="text-slate-300">{order.examName || order.radiologyExam?.name}</p>
                              <span className="uppercase text-[10px] font-mono text-indigo-400">
                                {order.modality || order.radiologyExam?.modality}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  order.urgency === 'stat'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse'
                                    : order.urgency === 'urgent'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {order.urgency}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                  order.status === 'reported' || order.status === 'COMPLETED'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                    : order.status === 'done'
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/30'
                                    : order.status === 'in_progress'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-500/30'
                                    : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => openReportingWorkbench(order)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PROCEDURE CATALOGUE & FORMULARY */}
        {/* ========================================================================= */}
        {activeTab === 'catalogue' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search procedure by name, code or anatomy..."
                    value={catalogueSearch}
                    onChange={(e) => setCatalogueSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 text-slate-200"
                  />
                </div>
                <select
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 text-slate-200"
                >
                  <option value="ALL">All Modalities</option>
                  <option value="xray">X-Ray</option>
                  <option value="ultrasound">Ultrasound</option>
                  <option value="ct">CT Scan</option>
                  <option value="mri">MRI</option>
                  <option value="mammography">Mammography</option>
                  <option value="fluoroscopy">Fluoroscopy</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <button
                onClick={() => setShowAddExamModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Procedure</span>
              </button>
            </div>

            {/* Procedures Table */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Procedure Name</th>
                    <th className="py-3 px-4">Modality</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">TAT</th>
                    <th className="py-3 px-4">Preparation Instructions</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExams.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No procedures found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredExams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-3 px-4 font-mono text-cyan-400 font-semibold">{exam.code}</td>
                        <td className="py-3 px-4 font-medium text-slate-200">{exam.name}</td>
                        <td className="py-3 px-4">
                          <span className="uppercase text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                            {exam.modality}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{exam.category?.name || 'General'}</td>
                        <td className="py-3 px-4 font-mono text-emerald-400">
                          ${exam.price !== null && exam.price !== undefined ? Number(exam.price).toFixed(2) : '0.00'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{exam.turnaroundHours || 24}h</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                          {exam.preparationInstructions || 'Standard procedure preparation.'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedExam(exam)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                          >
                            Details
                          </button>
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
        {/* TAB 3: IMAGING REQUISITIONS & ORDERS */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by order #, MRN, patient..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 text-slate-200"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ordered">Ordered (Pending)</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="arrived">Arrived</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done (Unreported)</option>
                  <option value="reported">Reported</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={orderModalityFilter}
                  onChange={(e) => setOrderModalityFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="ALL">All Modalities</option>
                  <option value="xray">X-Ray</option>
                  <option value="ct">CT Scan</option>
                  <option value="ultrasound">Ultrasound</option>
                  <option value="mri">MRI</option>
                </select>

                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="ALL">All Urgencies</option>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">Emergency STAT</option>
                </select>
              </div>

              <button
                onClick={() => setShowCreateOrderModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-lg text-sm font-medium shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Requisition</span>
              </button>
            </div>

            {/* Orders Worklist Table */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Patient Demographics</th>
                    <th className="py-3 px-4">Exam & Modality</th>
                    <th className="py-3 px-4">Indication</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Scheduled Slot</th>
                    <th className="py-3 px-4 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No radiology orders match the specified filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-3 px-4 font-mono text-cyan-400 font-semibold">{order.orderNumber}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-200">{order.patient?.name}</p>
                          <p className="text-[10px] text-slate-400">MRN: {order.patient?.patientId}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-slate-200 font-medium">{order.examName || order.radiologyExam?.name}</p>
                          <span className="uppercase text-[10px] font-mono text-indigo-400">
                            {order.modality || order.radiologyExam?.modality}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-400">
                          {order.clinicalIndication || 'None provided'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              order.urgency === 'stat'
                                ? 'bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse'
                                : order.urgency === 'urgent'
                                ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {order.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                              order.status === 'reported' || order.status === 'COMPLETED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : order.status === 'done'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/30'
                                : order.status === 'in_progress'
                                ? 'bg-purple-950 text-purple-300 border border-purple-500/30'
                                : order.status === 'cancelled'
                                ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {order.scheduledAt ? (
                            <div>
                              <p>{new Date(order.scheduledAt).toLocaleDateString()}</p>
                              <p className="text-cyan-400">{new Date(order.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              <span className="text-[10px] text-slate-500">{order.equipmentRoom}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">Not scheduled</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {order.status === 'ordered' && (
                            <button
                              onClick={() => {
                                setSchedulingOrder(order);
                                setScheduleTime(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
                              }}
                              className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 rounded text-[11px] transition"
                            >
                              Schedule
                            </button>
                          )}
                          {(order.status === 'ordered' || order.status === 'scheduled') && (
                            <button
                              onClick={() => handleMarkArrived(order)}
                              className="px-2 py-1 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 rounded text-[11px] transition"
                            >
                              Arrived
                            </button>
                          )}
                          {order.status === 'arrived' && (
                            <button
                              onClick={() => handleStartExam(order)}
                              className="px-2 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 rounded text-[11px] transition"
                            >
                              Start
                            </button>
                          )}
                          {order.status === 'in_progress' && (
                            <button
                              onClick={() => handleCompleteExam(order)}
                              className="px-2 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded text-[11px] transition"
                            >
                              Finish Scan
                            </button>
                          )}
                          {['done', 'reported', 'VERIFIED', 'COMPLETED'].includes(order.status) && (
                            <button
                              onClick={() => openReportingWorkbench(order)}
                              className="px-2 py-1 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 rounded text-[11px] transition"
                            >
                              Report
                            </button>
                          )}
                          {['reported', 'VERIFIED', 'COMPLETED'].includes(order.status) && (
                            <button
                              onClick={() => {
                                setPrintOrder(order);
                                setActiveTab('print');
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                              title="Print diagnostic report"
                            >
                              <Printer className="w-3.5 h-3.5 inline" />
                            </button>
                          )}
                          {!['reported', 'VERIFIED', 'COMPLETED', 'cancelled'].includes(order.status) && (
                            <button
                              onClick={() => setCancellingOrder(order)}
                              className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded text-[11px] transition"
                            >
                              Cancel
                            </button>
                          )}
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
        {/* TAB 4: SCANNER SCHEDULING & PLANNER */}
        {/* ========================================================================= */}
        {activeTab === 'scheduling' && (
          <div className="space-y-6">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>Today's Scanner Room Bookings</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Room-X101', 'CT Suite 1', 'US Bay 2'].map((room) => {
                  const roomOrders = orders.filter((o) => o.equipmentRoom === room && o.scheduledAt);
                  return (
                    <div key={room} className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-semibold text-cyan-400">{room}</span>
                        <span className="text-xs text-slate-400">{roomOrders.length} bookings</span>
                      </div>
                      <div className="space-y-2">
                        {roomOrders.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">No bookings for this room.</p>
                        ) : (
                          roomOrders.map((o) => (
                            <div key={o.id} className="p-2.5 rounded bg-slate-950 border border-slate-800/80 text-xs flex justify-between items-center">
                              <div>
                                <p className="font-medium text-slate-200">{o.patient?.name}</p>
                                <p className="text-[11px] text-slate-400">{o.examName}</p>
                              </div>
                              <span className="font-mono text-cyan-400 text-[11px]">
                                {new Date(o.scheduledAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: SCANNER WORKLIST (ARRIVAL & SCAN PROGRESSION) */}
        {/* ========================================================================= */}
        {activeTab === 'worklist' && (
          <div className="space-y-6">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Patient Arrival & Acquisition Worklist</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Awaiting Examination (Arrived) */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-cyan-400 flex items-center justify-between">
                    <span>Awaiting Scan (Patients in Waiting Room)</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                      {orders.filter((o) => o.status === 'arrived').length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {orders
                      .filter((o) => o.status === 'arrived')
                      .map((o) => (
                        <div key={o.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-slate-200">{o.patient?.name}</p>
                            <p className="text-slate-400 font-mono text-[11px]">{o.examName} ({o.modality})</p>
                            <p className="text-slate-500 text-[10px]">Arrived at: {o.arrivedAt ? new Date(o.arrivedAt).toLocaleTimeString() : 'Just now'}</p>
                          </div>
                          <button
                            onClick={() => handleStartExam(o)}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded text-xs transition"
                          >
                            Call & Start Scan
                          </button>
                        </div>
                      ))}
                    {orders.filter((o) => o.status === 'arrived').length === 0 && (
                      <p className="text-xs text-slate-500 py-4 text-center italic">No patients currently in the waiting area.</p>
                    )}
                  </div>
                </div>

                {/* Column 2: Currently Scanning (In Progress) */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-purple-400 flex items-center justify-between">
                    <span>Acquisition In-Progress</span>
                    <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-500/30 text-purple-300">
                      {orders.filter((o) => o.status === 'in_progress').length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {orders
                      .filter((o) => o.status === 'in_progress')
                      .map((o) => (
                        <div key={o.id} className="p-3 bg-slate-950 border border-purple-900/40 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-slate-200">{o.patient?.name}</p>
                            <p className="text-slate-400 font-mono text-[11px]">{o.examName}</p>
                            <span className="text-[10px] text-purple-400 font-mono">Scanner: {o.equipmentRoom || 'Room-X101'}</span>
                          </div>
                          <button
                            onClick={() => handleCompleteExam(o)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs transition"
                          >
                            Mark Completed
                          </button>
                        </div>
                      ))}
                    {orders.filter((o) => o.status === 'in_progress').length === 0 && (
                      <p className="text-xs text-slate-500 py-4 text-center italic">No scans currently running.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: RADIOLOGIST REPORTING WORKBENCH */}
        {/* ========================================================================= */}
        {activeTab === 'reporting' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Study Selector Queue */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                <span>Studies Awaiting Report</span>
                <span className="text-xs text-cyan-400 font-mono">
                  {orders.filter((o) => ['done', 'reported', 'VERIFIED'].includes(o.status)).length} total
                </span>
              </h2>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {orders
                  .filter((o) => ['done', 'reported', 'VERIFIED', 'COMPLETED'].includes(o.status))
                  .map((order) => {
                    const isSelected = reportingOrder?.id === order.id;
                    return (
                      <div
                        key={order.id}
                        onClick={() => openReportingWorkbench(order)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-cyan-400 font-semibold">{order.orderNumber}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                              order.status === 'COMPLETED'
                                ? 'bg-emerald-950 text-emerald-300'
                                : order.status === 'reported'
                                ? 'bg-indigo-950 text-indigo-300'
                                : 'bg-amber-950 text-amber-300'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="font-medium text-slate-200 mt-1">{order.patient?.name}</p>
                        <p className="text-slate-400 text-[11px]">{order.examName}</p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Right: Diagnostic Dictation & Reporting Form */}
            <div className="lg:col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-6 space-y-5">
              {reportingOrder ? (
                <>
                  {/* Study Header Banner */}
                  <div className="border-b border-slate-800 pb-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-100">{reportingOrder.examName}</h2>
                      <p className="text-xs text-slate-400">
                        Patient: <span className="text-slate-200 font-medium">{reportingOrder.patient?.name}</span> ({reportingOrder.patient?.patientId}) |{' '}
                        Modality: <span className="uppercase font-mono text-indigo-400">{reportingOrder.modality}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
                        Status: {reportingOrder.status}
                      </span>
                    </div>
                  </div>

                  {/* Clinical Indication Display */}
                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs space-y-1">
                    <p className="font-semibold text-slate-400 uppercase text-[10px]">Clinical Indication & History</p>
                    <p className="text-slate-200">{reportingOrder.clinicalIndication || 'No clinical indication recorded by ordering physician.'}</p>
                  </div>

                  {/* Radiologist Dictation Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Radiological Observations & Findings
                      </label>
                      <textarea
                        rows={6}
                        value={reportFindings}
                        onChange={(e) => setReportFindings(e.target.value)}
                        placeholder="Detailed anatomical observations by region..."
                        disabled={['COMPLETED'].includes(reportingOrder.status)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-cyan-500 text-slate-200 font-mono disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Diagnostic Impression / Conclusion</span>
                        <span className="text-rose-400 text-[10px]">* Mandatory</span>
                      </label>
                      <textarea
                        rows={3}
                        value={reportImpression}
                        onChange={(e) => setReportImpression(e.target.value)}
                        placeholder="Primary radiological diagnosis or critical impression..."
                        disabled={['COMPLETED'].includes(reportingOrder.status)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-cyan-500 text-slate-200 font-mono disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Follow-up Recommendations
                      </label>
                      <input
                        type="text"
                        value={reportRecommendations}
                        onChange={(e) => setReportRecommendations(e.target.value)}
                        placeholder="Optional clinical correlation, repeat scan interval..."
                        disabled={['COMPLETED'].includes(reportingOrder.status)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-200 font-mono disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Amendments History Alert */}
                  {reportingOrder.amendments && reportingOrder.amendments.length > 0 && (
                    <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-lg text-xs space-y-2">
                      <p className="font-semibold text-amber-300 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        <span>Audit Log: {reportingOrder.amendments.length} Post-Release Amendment(s)</span>
                      </p>
                      {reportingOrder.amendments.map((am) => (
                        <div key={am.id} className="text-slate-300 border-t border-amber-900/40 pt-1 text-[11px]">
                          <span className="text-slate-400">{new Date(am.createdAt).toLocaleString()}:</span>{' '}
                          <span className="italic">{am.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Workflow Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      {!['reported', 'VERIFIED', 'COMPLETED'].includes(reportingOrder.status) && (
                        <button
                          onClick={handleSaveReportDraft}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                        >
                          Save Draft
                        </button>
                      )}

                      {!['reported', 'VERIFIED', 'COMPLETED'].includes(reportingOrder.status) && (
                        <button
                          onClick={handleSubmitFormalReport}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium shadow-md transition"
                        >
                          Submit Formal Report
                        </button>
                      )}

                      {reportingOrder.status === 'reported' && (
                        <button
                          onClick={() => handleVerifyReport(reportingOrder.id)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
                        >
                          Quality Verify (QC)
                        </button>
                      )}

                      {['reported', 'VERIFIED'].includes(reportingOrder.status) && (
                        <button
                          onClick={() => handleAuthorizeRelease(reportingOrder.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium shadow-md transition"
                        >
                          Authorize & Release
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {['reported', 'VERIFIED', 'COMPLETED'].includes(reportingOrder.status) && (
                        <button
                          onClick={() => {
                            setAmendingOrder(reportingOrder);
                            setAmendFindings(reportingOrder.findings || '');
                            setAmendImpression(reportingOrder.impression || '');
                          }}
                          className="px-3 py-1.5 bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded text-xs font-medium transition flex items-center gap-1.5"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Audited Amendment</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setPrintOrder(reportingOrder);
                          setActiveTab('print');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Preview</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-slate-500 space-y-3">
                  <FileEdit className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm">Select an imaging study from the left queue to enter or review diagnostic reports.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: PROFESSIONAL PRINTABLE RADIOLOGY REPORT */}
        {/* ========================================================================= */}
        {activeTab === 'print' && (
          <div className="space-y-6">
            <div className="flex justify-end gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium shadow transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>

            {/* Formal Report Paper Preview */}
            <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-2xl max-w-4xl mx-auto space-y-6 print:p-0 print:shadow-none print:m-0">
              {/* Hospital Header */}
              <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">MEDORA 2.0 ADVANCED IMAGING</h1>
                  <p className="text-xs text-slate-600 font-medium">Department of Radiology & Diagnostic Imaging</p>
                  <p className="text-[11px] text-slate-500">Accredited Tertiary Hospital • Digital PACS / RIS Subsystem</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-mono font-bold text-slate-800">ACCESSION #{printOrder?.orderNumber || 'RAD-SAMPLE'}</p>
                  <p className="text-slate-500">Report Status: {printOrder?.status || 'Final Authorized'}</p>
                </div>
              </div>

              {/* Patient Demographics Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500 block uppercase text-[10px]">Patient Name</span>
                  <span className="font-bold text-slate-900">{printOrder?.patient?.name || 'Jane Doe'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase text-[10px]">Medical Record #</span>
                  <span className="font-mono text-slate-900">{printOrder?.patient?.patientId || 'MRN-88219'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase text-[10px]">Age / Sex</span>
                  <span className="text-slate-900">{printOrder?.patient?.age || '42 Y'} / {printOrder?.patient?.sex || 'Female'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase text-[10px]">Referring Doctor</span>
                  <span className="text-slate-900">{printOrder?.doctor?.name || 'Dr. Medical Staff'}</span>
                </div>
              </div>

              {/* Examination Details */}
              <div className="space-y-1 border-b border-slate-200 pb-3 text-xs">
                <p>
                  <span className="font-semibold text-slate-700">PROCEDURE:</span>{' '}
                  <span className="font-bold text-slate-900">{printOrder?.examName || printOrder?.radiologyExam?.name || 'Chest Radiography PA / Lateral'}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-700">MODALITY:</span>{' '}
                  <span className="uppercase font-mono text-slate-800">{printOrder?.modality || printOrder?.radiologyExam?.modality || 'XRAY'}</span> |{' '}
                  <span className="font-semibold text-slate-700">EQUIPMENT ROOM:</span>{' '}
                  <span className="text-slate-800">{printOrder?.equipmentRoom || 'Room-X101'}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-700">CLINICAL INDICATION:</span>{' '}
                  <span className="text-slate-800">{printOrder?.clinicalIndication || 'Persistent cough, r/o focal consolidation.'}</span>
                </p>
              </div>

              {/* Clinical Findings */}
              <div className="space-y-2 text-sm leading-relaxed">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                  Findings
                </h3>
                <p className="text-slate-800 font-serif whitespace-pre-line">
                  {printOrder?.findings ||
                    'LUNGS: The lungs are normally expanded and clear. There is no focal airspace consolidation, pleural effusion, or pneumothorax.\n\nHEART & MEDIASTINUM: The cardiothoracic ratio is normal. The mediastinal contours and pulmonary vasculature are unremarkable.\n\nBONES & SOFT TISSUES: The osseous structures of the thorax demonstrate no acute fracture or suspicious osteolytic lesion.'}
                </p>
              </div>

              {/* Diagnostic Impression */}
              <div className="space-y-2 text-sm pt-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                  Impression
                </h3>
                <p className="text-slate-900 font-bold font-serif">
                  {printOrder?.impression || 'No acute cardiopulmonary disease identified. Clear chest radiograph.'}
                </p>
              </div>

              {/* Recommendations */}
              {printOrder?.recommendations && (
                <div className="space-y-1 text-xs pt-1">
                  <span className="font-bold text-slate-700">RECOMMENDATIONS:</span>{' '}
                  <span className="text-slate-800">{printOrder.recommendations}</span>
                </div>
              )}

              {/* Amendment Watermark If Applicable */}
              {printOrder?.amendments && printOrder.amendments.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[11px]">Amended Official Report Addendum</p>
                  <p>This diagnostic record has been officially amended on {new Date(printOrder.amendments[0].createdAt).toLocaleString()}. Clinical reason: {printOrder.amendments[0].reason}</p>
                </div>
              )}

              {/* Digital Signatures and Authentication */}
              <div className="pt-8 border-t-2 border-slate-800 flex justify-between items-end text-xs text-slate-600">
                <div>
                  <p className="font-mono text-[10px] text-slate-400">DIGITAL AUDIT STAMP: MEDORA-RIS-SIG-{printOrder?.id || '9012'}</p>
                  <p className="text-[10px] text-slate-400">Electronically validated in Medora 2.0 PACS/RIS</p>
                </div>
                <div className="text-right">
                  <div className="font-serif italic text-base font-bold text-slate-800">
                    {printOrder?.reportedBy?.name || 'Dr. Diagnostic Radiologist, MD'}
                  </div>
                  <p className="font-medium text-slate-700">Consultant Radiologist</p>
                  <p className="text-[11px] text-slate-500">Board Certified Diagnostic Imaging</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: CREATE REQUISITION */}
      {/* ========================================================================= */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>New Radiology Imaging Requisition</span>
              </h2>
              <button onClick={() => setShowCreateOrderModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Patient ID / MRN</label>
                  <input
                    type="number"
                    value={orderPatientId}
                    onChange={(e) => setOrderPatientId(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ordering Doctor ID</label>
                  <input
                    type="number"
                    value={orderDoctorId}
                    onChange={(e) => setOrderDoctorId(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Select Procedure(s)</label>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-900 border border-slate-700 rounded-lg p-2">
                  {exams.map((exam) => {
                    const isChecked = orderSelectedExamIds.includes(exam.id);
                    return (
                      <label key={exam.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOrderSelectedExamIds([...orderSelectedExamIds, exam.id]);
                            } else {
                              setOrderSelectedExamIds(orderSelectedExamIds.filter((id) => id !== exam.id));
                            }
                          }}
                          className="rounded text-cyan-500 focus:ring-0"
                        />
                        <span className="font-mono text-cyan-400">{exam.code}</span>
                        <span className="text-slate-200 flex-1">{exam.name}</span>
                        <span className="text-emerald-400 font-mono">${Number(exam.price || 0).toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Urgency Priority</label>
                  <select
                    value={orderUrgency}
                    onChange={(e) => setOrderUrgency(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">Emergency STAT</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={orderGenerateInvoice}
                      onChange={(e) => setOrderGenerateInvoice(e.target.checked)}
                      className="rounded text-cyan-500"
                    />
                    <span>Auto-raise Billing Charge</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Clinical Indication & History</label>
                <textarea
                  rows={2}
                  value={orderClinicalNotes}
                  onChange={(e) => setOrderClinicalNotes(e.target.value)}
                  placeholder="Provisional diagnosis, symptoms, clinical question..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateOrderModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium shadow"
                >
                  Create Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SCHEDULE ORDER WITH COLLISION ENGINE */}
      {/* ========================================================================= */}
      {schedulingOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>Schedule Scanner Appointment</span>
              </h2>
              <button onClick={() => setSchedulingOrder(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleOrder} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <p className="font-semibold text-slate-200">{schedulingOrder.examName}</p>
                <p className="text-slate-400 font-mono text-[11px]">Order: #{schedulingOrder.orderNumber}</p>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Appointment Datetime</label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Equipment Room</label>
                <select
                  value={scheduleRoom}
                  onChange={(e) => setScheduleRoom(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="Room-X101">Room-X101 (X-Ray Plain Film)</option>
                  <option value="CT Suite 1">CT Suite 1 (64-Slice CT)</option>
                  <option value="US Bay 2">US Bay 2 (Color Doppler Ultrasound)</option>
                  <option value="MRI Bay 1">MRI Bay 1 (1.5T Superconducting)</option>
                  <option value="Mammo Suite">Mammo Suite (Digital Mammography)</option>
                  <option value="Fluoro Unit">Fluoro Unit (Fluoroscopy & Barium)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Technologist & Prep Notes</label>
                <input
                  type="text"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="e.g. Wheelchair assistance required; oral contrast pre-dispensed"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={scheduleForceConflict}
                    onChange={(e) => setScheduleForceConflict(e.target.checked)}
                    className="rounded text-rose-500 focus:ring-0"
                  />
                  <span className="text-[11px]">Override Room Collision (Emergency STAT Only)</span>
                </label>
                <p className="text-[10px] text-slate-500 mt-1">
                  Medora checks for existing bookings in the same room within 30 minutes to prevent equipment overlaps.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSchedulingOrder(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium shadow"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CATALOGUE EXAM */}
      {/* ========================================================================= */}
      {showAddExamModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Add Imaging Procedure to Catalogue</span>
              </h2>
              <button onClick={() => setShowAddExamModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Procedure Name</label>
                <input
                  type="text"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="e.g. Chest PA & Lateral View"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Modality</label>
                  <select
                    value={newExamModality}
                    onChange={(e) => setNewExamModality(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="xray">X-Ray</option>
                    <option value="ct">CT Scan</option>
                    <option value="ultrasound">Ultrasound</option>
                    <option value="mri">MRI</option>
                    <option value="mammography">Mammography</option>
                    <option value="fluoroscopy">Fluoroscopy</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={newExamCategoryId || ''}
                    onChange={(e) => setNewExamCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="">None / General</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newExamPrice}
                    onChange={(e) => setNewExamPrice(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Turnaround Time (Hours)</label>
                  <input
                    type="number"
                    value={newExamTurnaround}
                    onChange={(e) => setNewExamTurnaround(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Patient Preparation Instructions</label>
                <textarea
                  rows={2}
                  value={newExamPrep}
                  onChange={(e) => setNewExamPrep(e.target.value)}
                  placeholder="e.g. Fasting for 6 hours; remove metallic objects."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddExamModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium shadow"
                >
                  Save Procedure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AUDITED REPORT AMENDMENT */}
      {/* ========================================================================= */}
      {amendingOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Issue Audited Report Amendment</span>
              </h2>
              <button onClick={() => setAmendingOrder(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAmendment} className="space-y-3 text-xs">
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-amber-200">
                Authorized reports cannot be silently overwritten. Amendments append an audited clinical justification record.
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mandatory Clinical Justification <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  placeholder="e.g. Second-opinion radiologist review clarifies minor apical pleural thickening..."
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Amended Findings</label>
                <textarea
                  rows={4}
                  value={amendFindings}
                  onChange={(e) => setAmendFindings(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Amended Impression</label>
                <textarea
                  rows={2}
                  value={amendImpression}
                  onChange={(e) => setAmendImpression(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAmendingOrder(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium shadow"
                >
                  Save Amendment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CANCEL ORDER */}
      {/* ========================================================================= */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                <span>Cancel Radiology Order</span>
              </h2>
              <button onClick={() => setCancellingOrder(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelOrder} className="space-y-4 text-xs">
              <p className="text-slate-300">
                Are you sure you want to cancel order <span className="font-mono text-cyan-400">#{cancellingOrder.orderNumber}</span>?
              </p>

              <div>
                <label className="block text-slate-400 mb-1">Cancellation Reason <span className="text-rose-400">*</span></label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="State the administrative or clinical reason for cancellation..."
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium shadow"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: EXAM DETAILS */}
      {selectedExam && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-3 shadow-2xl text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-100 text-sm">{selectedExam.name} ({selectedExam.code})</h3>
              <button onClick={() => setSelectedExam(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p><span className="text-slate-400">Modality:</span> <span className="uppercase font-mono text-indigo-400 font-bold">{selectedExam.modality}</span></p>
            <p><span className="text-slate-400">Price:</span> <span className="text-emerald-400 font-mono font-bold">${Number(selectedExam.price || 0).toFixed(2)}</span></p>
            <p><span className="text-slate-400">Turnaround:</span> {selectedExam.turnaroundHours || 24} hours</p>
            <p><span className="text-slate-400">Preparation:</span> {selectedExam.preparationInstructions || 'Standard procedure preparation.'}</p>
            {selectedExam.reportTemplate && (
              <div>
                <span className="text-slate-400 block mb-1 font-semibold">Report Template:</span>
                <pre className="bg-slate-900 p-2.5 rounded text-[11px] text-slate-300 font-mono whitespace-pre-wrap border border-slate-800">{selectedExam.reportTemplate}</pre>
              </div>
            )}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button onClick={() => setSelectedExam(null)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default RadiologyWorkspace;
