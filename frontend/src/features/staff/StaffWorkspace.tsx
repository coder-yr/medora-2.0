import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Shield,
  ShieldCheck,
  ArrowRightLeft,
  Award,
  UserX,
  RefreshCw,
  Copy,
  Check,
  Clock,
  History,
  AlertCircle,
  CheckCircle2,
  X,
  TrendingUp,
  Lock,
  Unlock,
} from 'lucide-react';
import type {
  StaffProfile,
  StaffDesignation,
  StaffDashboardMetrics,
  StaffStatus,
  EmploymentType,
  CreateStaffPayload,
  DepartmentTransferPayload,
  ChangeDesignationPayload,
  OffboardStaffPayload,
} from '../../types/staff';

interface Props {
  token: string;
  userRole?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://medora-20-backend.vercel.app';

export function StaffWorkspace({ token, userRole = 'Admin' }: Props) {
  const [activeTab, setActiveTab] = useState<'directory' | 'dashboard' | 'designations'>('directory');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Directory Data
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('');

  // Catalogues
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<StaffDesignation[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<StaffDashboardMetrics | null>(null);

  // Modals & Drawers
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDesignationModal, setShowDesignationModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showLinkUserModal, setShowLinkUserModal] = useState(false);
  const [showOffboardModal, setShowOffboardModal] = useState(false);
  const [showNewDesignationModal, setShowNewDesignationModal] = useState(false);

  // Forms
  const [onboardForm, setOnboardForm] = useState<CreateStaffPayload>({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    address: '',
    gender: 'MALE',
    dateOfBirth: '',
    nationalId: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    qualifications: '',
  });

  const [transferForm, setTransferForm] = useState<DepartmentTransferPayload>({
    targetDepartmentId: 0,
    reason: '',
    isPrimary: true,
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  const [designationForm, setDesignationForm] = useState<ChangeDesignationPayload>({
    targetDesignationId: 0,
    reason: '',
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  const [statusForm, setStatusForm] = useState<{ status: StaffStatus; reason: string }>({
    status: 'ACTIVE',
    reason: '',
  });

  const [linkUserId, setLinkUserId] = useState<string>('');

  const [offboardForm, setOffboardForm] = useState<OffboardStaffPayload>({
    reason: '',
    offboardingDate: new Date().toISOString().split('T')[0],
    deactivateUserAccount: true,
  });

  const [newDesignationForm, setNewDesignationForm] = useState({
    code: '',
    title: '',
    category: 'NURSING',
    description: '',
  });

  // Auto clear notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotice = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch Catalogues
  const fetchCatalogues = useCallback(async () => {
    if (!token) return;
    try {
      const [deptRes, desigRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/departments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/v1/staff/designations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const deptData = await deptRes.json();
      const desigData = await desigRes.json();

      if (deptData.success) {
        setDepartments(deptData.data?.departments || deptData.data || []);
      }
      if (desigData.success) {
        setDesignations(desigData.data || []);
      }
    } catch {
      // Ignored
    }
  }, [token]);

  // Fetch Dashboard Metrics
  const fetchMetrics = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/dashboard/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setDashboardMetrics(json.data);
      }
    } catch {
      // Ignored
    }
  }, [token]);

  // Fetch Staff Directory
  const fetchStaff = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search.trim()) params.set('search', search.trim());
      if (selectedDept) params.set('departmentId', selectedDept);
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedStatus) params.set('employmentStatus', selectedStatus);
      if (selectedAccountFilter) params.set('hasUserAccount', selectedAccountFilter);

      const res = await fetch(`${API_BASE_URL}/api/v1/staff?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setStaffList(json.data?.data || []);
        setTotalCount(json.data?.meta?.total || 0);
      } else {
        showNotice('error', json.message || 'Failed to fetch staff directory');
      }
    } catch {
      showNotice('error', 'Network error connecting to staff service');
    } finally {
      setLoading(false);
    }
  }, [token, page, limit, search, selectedDept, selectedCategory, selectedStatus, selectedAccountFilter]);

  useEffect(() => {
    fetchCatalogues();
    fetchMetrics();
  }, [fetchCatalogues, fetchMetrics]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Fetch full details of single staff profile
  const openStaffDrawer = async (profile: StaffProfile) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/${profile.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setSelectedStaff(json.data);
      } else {
        setSelectedStaff(profile);
      }
    } catch {
      setSelectedStaff(profile);
    }
    setShowProfileDrawer(true);
  };

  // 1. Submit Onboarding
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.firstName.trim() || !onboardForm.lastName.trim()) {
      showNotice('error', 'First name and last name are required');
      return;
    }

    try {
      const payload = {
        ...onboardForm,
        departmentId: onboardForm.departmentId ? Number(onboardForm.departmentId) : undefined,
        designationId: onboardForm.designationId ? Number(onboardForm.designationId) : undefined,
        userId: onboardForm.userId ? Number(onboardForm.userId) : undefined,
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showNotice('success', `Employee onboarded: ${json.data.employeeNumber} (${json.data.displayName})`);
        setShowOnboardModal(false);
        setOnboardForm({
          firstName: '',
          lastName: '',
          displayName: '',
          email: '',
          phone: '',
          alternatePhone: '',
          address: '',
          gender: 'MALE',
          dateOfBirth: '',
          nationalId: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          joiningDate: new Date().toISOString().split('T')[0],
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          qualifications: '',
        });
        fetchStaff();
        fetchMetrics();
      } else {
        showNotice('error', json.message || 'Onboarding failed');
      }
    } catch {
      showNotice('error', 'Failed to communicate with server');
    }
  };

  // 2. Submit Department Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !transferForm.targetDepartmentId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/${selectedStaff.id}/transfer-department`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(transferForm),
      });

      const json = await res.json();
      if (json.success) {
        showNotice('success', `Transferred ${selectedStaff.displayName} to new department`);
        setShowTransferModal(false);
        fetchStaff();
        fetchMetrics();
        if (showProfileDrawer) openStaffDrawer(selectedStaff);
      } else {
        showNotice('error', json.message || 'Transfer failed');
      }
    } catch {
      showNotice('error', 'Error submitting transfer');
    }
  };

  // 3. Submit Designation Change
  const handleDesignationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !designationForm.targetDesignationId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/${selectedStaff.id}/change-designation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(designationForm),
      });

      const json = await res.json();
      if (json.success) {
        showNotice('success', `Designation updated for ${selectedStaff.displayName}`);
        setShowDesignationModal(false);
        fetchStaff();
        fetchMetrics();
        if (showProfileDrawer) openStaffDrawer(selectedStaff);
      } else {
        showNotice('error', json.message || 'Designation update failed');
      }
    } catch {
      showNotice('error', 'Error updating designation');
    }
  };

  // 4. Submit Status Transition
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/${selectedStaff.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(statusForm),
      });

      const json = await res.json();
      if (json.success) {
        showNotice('success', `Status updated to ${statusForm.status}`);
        setShowStatusModal(false);
        fetchStaff();
        fetchMetrics();
        if (showProfileDrawer) openStaffDrawer(selectedStaff);
      } else {
        showNotice('error', json.message || 'Status transition failed');
      }
    } catch {
      showNotice('error', 'Error updating status');
    }
  };

  // 5. Submit User Account Link
  const handleLinkUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !linkUserId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/${selectedStaff.id}/link-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: Number(linkUserId) }),
      });

      const json = await res.json();
      if (json.success) {
        showNotice('success', `User account #${linkUserId} linked to ${selectedStaff.displayName}`);
        setShowLinkUserModal(false);
        setLinkUserId('');
        fetchStaff();
        fetchMetrics();
        if (showProfileDrawer) openStaffDrawer(selectedStaff);
      } else {
        showNotice('error', json.message || 'Failed to link account');
      }
    } catch {
      showNotice('error', 'Error linking user account');
    }
  };

  // 6. Unlink User Account
  const handleUnlinkUser = async (staffId: string) => {
    if (!confirm('Are you sure you want to unlink the login account from this employee?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/${staffId}/unlink-user`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (json.success) {
        showNotice('info', 'User account unlinked from employee');
        fetchStaff();
        fetchMetrics();
        if (showProfileDrawer && selectedStaff) openStaffDrawer(selectedStaff);
      } else {
        showNotice('error', json.message || 'Failed to unlink user');
      }
    } catch {
      showNotice('error', 'Error unlinking user');
    }
  };

  // 7. Submit Offboarding
  const handleOffboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !offboardForm.reason.trim()) {
      showNotice('error', 'A formal exit reason is required for offboarding');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/${selectedStaff.id}/offboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(offboardForm),
      });

      const json = await res.json();
      if (json.success) {
        showNotice('success', `Employee ${selectedStaff.displayName} successfully offboarded`);
        setShowOffboardModal(false);
        fetchStaff();
        fetchMetrics();
        if (showProfileDrawer) openStaffDrawer(selectedStaff);
      } else {
        showNotice('error', json.message || 'Offboarding failed');
      }
    } catch {
      showNotice('error', 'Error executing offboarding');
    }
  };

  // 8. Create Designation
  const handleCreateDesignationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesignationForm.code.trim() || !newDesignationForm.title.trim()) {
      showNotice('error', 'Code and Title are required');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/staff/designations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newDesignationForm),
      });

      const json = await res.json();
      if (json.success) {
        showNotice('success', `Designation '${json.data.title}' added to catalogue`);
        setShowNewDesignationModal(false);
        setNewDesignationForm({ code: '', title: '', category: 'NURSING', description: '' });
        fetchCatalogues();
        fetchMetrics();
      } else {
        showNotice('error', json.message || 'Failed to create designation');
      }
    } catch {
      showNotice('error', 'Error creating designation');
    }
  };

  // Status color pill
  const getStatusBadge = (status: StaffStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">Active</span>;
      case 'ON_LEAVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">On Leave</span>;
      case 'SUSPENDED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">Suspended</span>;
      case 'INACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">Inactive</span>;
      case 'TERMINATED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">Terminated</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  // Designation Category Badge
  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      NURSING: 'bg-teal-50 text-teal-700 border-teal-200',
      RECEPTION: 'bg-blue-50 text-blue-700 border-blue-200',
      PHARMACY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      LABORATORY: 'bg-purple-50 text-purple-700 border-purple-200',
      FINANCE: 'bg-amber-50 text-amber-700 border-amber-200',
      ADMINISTRATION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      RADIOLOGY: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    };
    const c = colors[category] || 'bg-gray-50 text-gray-700 border-gray-200';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${c}`}>{category}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-lg shadow-sm border ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : notification.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : notification.type === 'error' ? (
              <AlertCircle size={18} className="text-rose-600" />
            ) : (
              <AlertCircle size={18} className="text-blue-600" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Non-Medical Staff Registers & HR Directory</h1>
              <p className="text-xs text-slate-500">
                Centralized staff records, designation catalogues, department transfers and lifecycle governance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStaff()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Refresh directory"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {userRole === 'Admin' && (
            <button
              onClick={() => setShowOnboardModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              <UserPlus size={16} />
              <span>Onboard Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'directory'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={16} />
          <span>Staff Directory</span>
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('dashboard');
            fetchMetrics();
          }}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'dashboard'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp size={16} />
          <span>HR Metrics & Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('designations')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'designations'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award size={16} />
          <span>Designations Catalogue</span>
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
            {designations.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. DIRECTORY TAB                                                          */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Quick Filters & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search Box */}
              <div className="md:col-span-2 relative">
                <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, employee #, email, phone..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Department Filter */}
              <div>
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Employment Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Quick Filters:</span>

              <button
                onClick={() => {
                  setSelectedCategory('');
                  setSelectedAccountFilter('');
                  setSelectedStatus('');
                  setSelectedDept('');
                  setSearch('');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full border transition ${
                  !selectedCategory && !selectedAccountFilter && !selectedStatus && !selectedDept && !search
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Staff
              </button>

              {['NURSING', 'RECEPTION', 'PHARMACY', 'LABORATORY', 'FINANCE', 'ADMINISTRATION'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === cat ? '' : cat);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-full border transition ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <span className="mx-1 text-slate-300">|</span>

              <button
                onClick={() => {
                  setSelectedAccountFilter(selectedAccountFilter === 'false' ? '' : 'false');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full border transition ${
                  selectedAccountFilter === 'false'
                    ? 'bg-amber-100 border-amber-300 text-amber-800 font-semibold'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                Unlinked User Accounts
              </button>
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Employee #</th>
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-4 py-3">Designation & Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">User Account</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Loading staff records...</span>
                      </td>
                    </tr>
                  ) : staffList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">No staff records match filter criteria</p>
                        <p className="text-xs text-slate-400 mt-1">Try clearing filters or onboarding a new employee</p>
                      </td>
                    </tr>
                  ) : (
                    staffList.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition group">
                        {/* Employee Number */}
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{s.employeeNumber}</span>
                            <button
                              onClick={() => copyToClipboard(s.employeeNumber, s.id)}
                              className="text-slate-400 hover:text-slate-600 transition"
                              title="Copy Employee ID"
                            >
                              {copiedId === s.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>

                        {/* Name & Avatar */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                              {s.firstName?.[0]}
                              {s.lastName?.[0]}
                            </div>
                            <div>
                              <div
                                onClick={() => openStaffDrawer(s)}
                                className="font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer transition"
                              >
                                {s.displayName}
                              </div>
                              <div className="text-xs text-slate-400">
                                Joined {new Date(s.joiningDate).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Designation & Category */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-slate-800">
                            {s.designation?.title || 'Unassigned Role'}
                          </div>
                          {s.designation?.category && (
                            <div className="mt-0.5">{getCategoryBadge(s.designation.category)}</div>
                          )}
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Building2 size={14} className="text-slate-400" />
                            <span>{s.department?.name || 'Unassigned'}</span>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {s.email && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Mail size={12} className="text-slate-400" />
                              <span>{s.email}</span>
                            </div>
                          )}
                          {s.phone && (
                            <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                              <Phone size={12} className="text-slate-400" />
                              <span>{s.phone}</span>
                            </div>
                          )}
                          {!s.email && !s.phone && <span className="text-slate-400 italic">None</span>}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(s.employmentStatus)}</td>

                        {/* User Account */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {s.userId && s.user ? (
                            <div className="flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full w-max">
                              <ShieldCheck size={12} />
                              <span>@{s.user.login}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Unlinked
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openStaffDrawer(s)}
                              className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition"
                              title="View Full Profile Drawer"
                            >
                              Profile
                            </button>

                            {userRole === 'Admin' && s.employmentStatus !== 'TERMINATED' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStaff(s);
                                    setTransferForm({
                                      targetDepartmentId: 0,
                                      reason: '',
                                      isPrimary: true,
                                      effectiveDate: new Date().toISOString().split('T')[0],
                                    });
                                    setShowTransferModal(true);
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition"
                                  title="Transfer Department"
                                >
                                  Transfer
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedStaff(s);
                                    setDesignationForm({
                                      targetDesignationId: 0,
                                      reason: '',
                                      effectiveDate: new Date().toISOString().split('T')[0],
                                    });
                                    setShowDesignationModal(true);
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition"
                                  title="Change Designation / Promote"
                                >
                                  Role
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedStaff(s);
                                    setOffboardForm({
                                      reason: '',
                                      offboardingDate: new Date().toISOString().split('T')[0],
                                      deactivateUserAccount: true,
                                    });
                                    setShowOffboardModal(true);
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded transition"
                                  title="Offboard Employee"
                                >
                                  Exit
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalCount > limit && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                <div>
                  Showing {Math.min((page - 1) * limit + 1, totalCount)} to{' '}
                  {Math.min(page * limit, totalCount)} of {totalCount} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded bg-white border border-slate-300 disabled:opacity-50 hover:bg-slate-100"
                  >
                    Previous
                  </button>
                  <span>Page {page} of {Math.ceil(totalCount / limit)}</span>
                  <button
                    disabled={page >= Math.ceil(totalCount / limit)}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded bg-white border border-slate-300 disabled:opacity-50 hover:bg-slate-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HR METRICS & DASHBOARD TAB                                             */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && dashboardMetrics && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Total Headcount</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {dashboardMetrics.overview.totalEmployees}
              </div>
              <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 size={12} /> Registered
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Active Duty</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {dashboardMetrics.overview.activeEmployees}
              </div>
              <div className="text-xs text-slate-400 mt-1">Operational</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">On Leave</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {dashboardMetrics.overview.onLeaveEmployees}
              </div>
              <div className="text-xs text-slate-400 mt-1">Authorized</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Suspended / Inactive</div>
              <div className="text-2xl font-bold text-slate-600 mt-1">
                {dashboardMetrics.overview.suspendedEmployees + dashboardMetrics.overview.inactiveEmployees}
              </div>
              <div className="text-xs text-slate-400 mt-1">Non-operational</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Offboarded</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {dashboardMetrics.overview.terminatedEmployees}
              </div>
              <div className="text-xs text-slate-400 mt-1">Historical preserved</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Unlinked Logins</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {dashboardMetrics.overview.unlinkedAccounts}
              </div>
              <div className="text-xs text-slate-400 mt-1">Profile-only</div>
            </div>
          </div>

          {/* Department & Designation Distributions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Department Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Building2 size={16} className="text-indigo-600" />
                <span>Headcount by Department</span>
              </h2>

              <div className="space-y-3">
                {dashboardMetrics.staffByDepartment.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No department data recorded</p>
                ) : (
                  dashboardMetrics.staffByDepartment.map((d) => (
                    <div key={d.departmentId} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-700">{d.departmentName}</span>
                        <span className="text-slate-500">{d.count} staff</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((d.count / Math.max(dashboardMetrics.overview.totalEmployees, 1)) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Designation Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Briefcase size={16} className="text-indigo-600" />
                <span>Designation Distribution</span>
              </h2>

              <div className="space-y-3">
                {dashboardMetrics.staffByDesignation.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No designation data recorded</p>
                ) : (
                  dashboardMetrics.staffByDesignation.map((des) => (
                    <div key={des.designationId} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-800">{des.title}</span>
                          {getCategoryBadge(des.category)}
                        </div>
                        <span className="text-slate-500 font-semibold">{des.count}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((des.count / Math.max(dashboardMetrics.overview.totalEmployees, 1)) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Employment History Stream */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
              <History size={16} className="text-indigo-600" />
              <span>Recent Staff Activity & Auditable Events</span>
            </h2>

            <div className="space-y-3">
              {dashboardMetrics.recentChanges.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No recent events logged</p>
              ) : (
                dashboardMetrics.recentChanges.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {event.eventType}
                        </span>
                        {event.previousValue && event.newValue && (
                          <span className="text-slate-500">
                            ({event.previousValue} → <strong className="text-indigo-600">{event.newValue}</strong>)
                          </span>
                        )}
                      </div>
                      {event.comments && <p className="text-slate-600">{event.comments}</p>}
                    </div>

                    <div className="text-right text-slate-400 whitespace-nowrap">
                      <div>{new Date(event.createdAt).toLocaleDateString()}</div>
                      <div>{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DESIGNATIONS CATALOGUE TAB                                             */}
      {/* ========================================================================= */}
      {activeTab === 'designations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Hospital Designation Catalogue</h2>
              <p className="text-xs text-slate-500">
                Configured job titles and staff classifications mapped to operational units
              </p>
            </div>

            {userRole === 'Admin' && (
              <button
                onClick={() => setShowNewDesignationModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
              >
                <Award size={14} />
                <span>Add Designation</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {designations.map((d) => (
              <div key={d.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {d.code}
                  </span>
                  {getCategoryBadge(d.category)}
                </div>
                <div className="font-bold text-sm text-slate-900">{d.title}</div>
                {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Status</span>
                  <span className={d.isActive ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                    {d.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PROFILE DETAILS DRAWER                                                    */}
      {/* ========================================================================= */}
      {showProfileDrawer && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg uppercase shadow">
                  {selectedStaff.firstName?.[0]}
                  {selectedStaff.lastName?.[0]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedStaff.displayName}</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span className="font-mono font-semibold">{selectedStaff.employeeNumber}</span>
                    <span>•</span>
                    <span>{getStatusBadge(selectedStaff.employmentStatus)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowProfileDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Primary Info Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Employment Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Department</span>
                    <span className="font-semibold text-slate-800">{selectedStaff.department?.name || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Designation</span>
                    <span className="font-semibold text-slate-800">{selectedStaff.designation?.title || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Employment Type</span>
                    <span className="font-semibold text-slate-800">{selectedStaff.employmentType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Joining Date</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(selectedStaff.joiningDate).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedStaff.nationalId && (
                    <div>
                      <span className="text-slate-400 block">National ID</span>
                      <span className="font-semibold text-slate-800">{selectedStaff.nationalId}</span>
                    </div>
                  )}
                  {selectedStaff.branch && (
                    <div>
                      <span className="text-slate-400 block">Branch</span>
                      <span className="font-semibold text-slate-800">{selectedStaff.branch.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* User Account Link Status */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Authentication Link</h3>
                  {selectedStaff.userId ? (
                    <button
                      onClick={() => handleUnlinkUser(selectedStaff.id)}
                      className="text-xs font-medium text-rose-600 hover:underline flex items-center gap-1"
                    >
                      <Unlock size={12} /> Unlink Account
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowLinkUserModal(true)}
                      className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Lock size={12} /> Link User Account
                    </button>
                  )}
                </div>

                {selectedStaff.userId && selectedStaff.user ? (
                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-indigo-900">@{selectedStaff.user.login}</div>
                      <div className="text-indigo-700">{selectedStaff.user.email}</div>
                      <div className="text-indigo-600 mt-1">Role Group: {selectedStaff.user.group}</div>
                    </div>
                    <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 font-semibold text-xs">
                      Linked
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No authentication account currently linked to this employee profile.
                  </div>
                )}
              </div>

              {/* Contact Details */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact & Address</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Primary Email</span>
                    <span className="font-semibold text-slate-800">{selectedStaff.email || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Primary Phone</span>
                    <span className="font-semibold text-slate-800">{selectedStaff.phone || 'None'}</span>
                  </div>
                  {selectedStaff.alternatePhone && (
                    <div>
                      <span className="text-slate-400 block">Alternate Phone</span>
                      <span className="font-semibold text-slate-800">{selectedStaff.alternatePhone}</span>
                    </div>
                  )}
                  {selectedStaff.address && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Address</span>
                      <span className="font-semibold text-slate-800">{selectedStaff.address}</span>
                    </div>
                  )}
                  {selectedStaff.emergencyContactName && (
                    <div>
                      <span className="text-slate-400 block">Emergency Contact</span>
                      <span className="font-semibold text-slate-800">
                        {selectedStaff.emergencyContactName} ({selectedStaff.emergencyContactPhone || 'N/A'})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Department Assignment History */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Department Assignment History
                </h3>

                <div className="space-y-2">
                  {selectedStaff.departmentAssignments?.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <span>{a.department?.name || 'Department'}</span>
                          {a.isPrimary && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-semibold">
                              Primary
                            </span>
                          )}
                          {!a.effectiveEnd && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 font-semibold">
                              Current
                            </span>
                          )}
                        </div>
                        {a.reason && <p className="text-slate-500 mt-1">{a.reason}</p>}
                      </div>
                      <div className="text-right text-slate-400">
                        <div>From {new Date(a.effectiveStart).toLocaleDateString()}</div>
                        {a.effectiveEnd && <div>To {new Date(a.effectiveEnd).toLocaleDateString()}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Employment Audit History Timeline */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Employment Audit Trail
                </h3>

                <div className="space-y-2">
                  {selectedStaff.employmentHistory?.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white flex items-start justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{h.eventType}</div>
                        {h.comments && <p className="text-slate-600 mt-0.5">{h.comments}</p>}
                        {h.recorder && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Recorded by @{h.recorder.login}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-slate-400">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  setStatusForm({ status: selectedStaff.employmentStatus, reason: '' });
                  setShowStatusModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
              >
                Change Status
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTransferForm({
                      targetDepartmentId: 0,
                      reason: '',
                      isPrimary: true,
                      effectiveDate: new Date().toISOString().split('T')[0],
                    });
                    setShowTransferModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                >
                  Transfer Dept
                </button>

                <button
                  onClick={() => {
                    setDesignationForm({
                      targetDesignationId: 0,
                      reason: '',
                      effectiveDate: new Date().toISOString().split('T')[0],
                    });
                    setShowDesignationModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100"
                >
                  Change Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ONBOARD STAFF                                                    */}
      {/* ========================================================================= */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <UserPlus size={18} className="text-indigo-600" />
                <span>Onboard New Non-Medical Staff</span>
              </div>
              <button onClick={() => setShowOnboardModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.firstName}
                    onChange={(e) => setOnboardForm({ ...onboardForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.lastName}
                    onChange={(e) => setOnboardForm({ ...onboardForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                  <select
                    value={onboardForm.departmentId || ''}
                    onChange={(e) => setOnboardForm({ ...onboardForm, departmentId: Number(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Designation & Role</label>
                  <select
                    value={onboardForm.designationId || ''}
                    onChange={(e) => setOnboardForm({ ...onboardForm, designationId: Number(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select Designation...</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Employment Type</label>
                  <select
                    value={onboardForm.employmentType}
                    onChange={(e) => setOnboardForm({ ...onboardForm, employmentType: e.target.value as EmploymentType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                    <option value="LOCUM">Locum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={onboardForm.joiningDate}
                    onChange={(e) => setOnboardForm({ ...onboardForm, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                  <select
                    value={onboardForm.gender || 'MALE'}
                    onChange={(e) => setOnboardForm({ ...onboardForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="employee@medora.hospital"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                  <input
                    type="text"
                    value={onboardForm.phone}
                    onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="+1-555-0100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                <input
                  type="text"
                  value={onboardForm.address}
                  onChange={(e) => setOnboardForm({ ...onboardForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Residential address"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Complete Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DEPARTMENT TRANSFER                                              */}
      {/* ========================================================================= */}
      {showTransferModal && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-blue-600" />
                <span>Department Transfer</span>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-900 text-xs">
                Transferring <strong>{selectedStaff.displayName}</strong> from current department{' '}
                <strong>{selectedStaff.department?.name || 'Unassigned'}</strong>. Assignment history will be
                preserved.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Department *</label>
                <select
                  required
                  value={transferForm.targetDepartmentId}
                  onChange={(e) => setTransferForm({ ...transferForm, targetDepartmentId: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select target department...</option>
                  {departments
                    .filter((d) => d.id !== selectedStaff.departmentId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={transferForm.effectiveDate}
                  onChange={(e) => setTransferForm({ ...transferForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transfer Reason / Notes</label>
                <textarea
                  rows={2}
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. Clinical rotation, Promotion, Staff request"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DESIGNATION CHANGE                                               */}
      {/* ========================================================================= */}
      {showDesignationModal && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <Award size={18} className="text-purple-600" />
                <span>Change Designation / Promote</span>
              </div>
              <button onClick={() => setShowDesignationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDesignationSubmit} className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-purple-50 text-purple-900 text-xs">
                Current Role for {selectedStaff.displayName}:{' '}
                <strong>{selectedStaff.designation?.title || 'Unassigned'}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">New Designation *</label>
                <select
                  required
                  value={designationForm.targetDesignationId}
                  onChange={(e) =>
                    setDesignationForm({ ...designationForm, targetDesignationId: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select new designation...</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={designationForm.effectiveDate}
                  onChange={(e) => setDesignationForm({ ...designationForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Promotion Notes</label>
                <textarea
                  rows={2}
                  value={designationForm.reason}
                  onChange={(e) => setDesignationForm({ ...designationForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. Promoted to Senior Grade"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDesignationModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                  Apply Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: OFFBOARD STAFF                                                   */}
      {/* ========================================================================= */}
      {showOffboardModal && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-rose-100 flex items-center justify-between bg-rose-50">
              <div className="font-bold text-rose-900 flex items-center gap-2">
                <UserX size={18} className="text-rose-600" />
                <span>Employee Offboarding & Exit</span>
              </div>
              <button onClick={() => setShowOffboardModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOffboardSubmit} className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                <strong>Policy Assurance:</strong> Offboarding marks employment status as{' '}
                <code>TERMINATED</code> and ends active assignments. Historical medical records, cashier shifts,
                prescriptions, and audit logs remain <strong>fully preserved and immutable</strong>.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Exit Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={offboardForm.reason}
                  onChange={(e) => setOffboardForm({ ...offboardForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. Formal resignation / Contract concluded / Retirement"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Effective Exit Date</label>
                <input
                  type="date"
                  value={offboardForm.offboardingDate}
                  onChange={(e) => setOffboardForm({ ...offboardForm, offboardingDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {selectedStaff.userId && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="deactivateAccount"
                    checked={offboardForm.deactivateUserAccount}
                    onChange={(e) =>
                      setOffboardForm({ ...offboardForm, deactivateUserAccount: e.target.checked })
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="deactivateAccount" className="text-xs text-slate-700 font-medium">
                    Revoke active login sessions and disable user login
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOffboardModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  Confirm Offboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: LINK USER ACCOUNT                                                */}
      {/* ========================================================================= */}
      {showLinkUserModal && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <Shield size={18} className="text-indigo-600" />
                <span>Link User Account</span>
              </div>
              <button onClick={() => setShowLinkUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLinkUserSubmit} className="p-6 space-y-4">
              <div className="text-xs text-slate-600">
                Link an existing authentication account to <strong>{selectedStaff.displayName}</strong> ({selectedStaff.employeeNumber}).
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">User Account ID *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5"
                  value={linkUserId}
                  onChange={(e) => setLinkUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enforces 1-to-1 account link. Each user account can only be attached to one employee.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLinkUserModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Link Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: STATUS CHANGE                                                    */}
      {/* ========================================================================= */}
      {showStatusModal && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" />
                <span>Update Employment Status</span>
              </div>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">New Status *</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value as StaffStatus })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="ACTIVE">Active (On Duty)</option>
                  <option value="ON_LEAVE">On Leave (Approved Absence)</option>
                  <option value="SUSPENDED">Suspended (Pending Review)</option>
                  <option value="INACTIVE">Inactive (Deactivated)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Reason</label>
                <textarea
                  rows={2}
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Reason for status change..."
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: ADD NEW DESIGNATION                                              */}
      {/* ========================================================================= */}
      {showNewDesignationModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <Award size={18} className="text-indigo-600" />
                <span>Add Designation to Catalogue</span>
              </div>
              <button onClick={() => setShowNewDesignationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDesignationSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Designation Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NURSE-ICU"
                  value={newDesignationForm.code}
                  onChange={(e) => setNewDesignationForm({ ...newDesignationForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Intensive Care Specialist Nurse"
                  value={newDesignationForm.title}
                  onChange={(e) => setNewDesignationForm({ ...newDesignationForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
                <select
                  value={newDesignationForm.category}
                  onChange={(e) => setNewDesignationForm({ ...newDesignationForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="NURSING">NURSING</option>
                  <option value="RECEPTION">RECEPTION</option>
                  <option value="PHARMACY">PHARMACY</option>
                  <option value="LABORATORY">LABORATORY</option>
                  <option value="FINANCE">FINANCE</option>
                  <option value="ADMINISTRATION">ADMINISTRATION</option>
                  <option value="RADIOLOGY">RADIOLOGY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Role responsibilities..."
                  value={newDesignationForm.description}
                  onChange={(e) => setNewDesignationForm({ ...newDesignationForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewDesignationModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
