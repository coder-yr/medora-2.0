import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Briefcase,
  Building2,
  Clock,
  Search,
  ShieldAlert,
  History,
  Tag,
  Mail,
  Phone,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { StaffProfile, StaffDashboardMetrics, StaffEmploymentHistory } from '../../../types/staff';

export const HRDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId, userPermissions, userRole } = useAuth();
  const navigate = useNavigate();

  const hasPermission = useCallback(
    (perm: string) => userRole === 'Super Admin' || userPermissions.includes(perm),
    [userRole, userPermissions],
  );

  const [metrics, setMetrics] = useState<StaffDashboardMetrics | null>(null);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [recentHistory, setRecentHistory] = useState<StaffEmploymentHistory[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchHRData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Staff & HR Dashboard KPIs
      const metricsRes = await fetch(`${apiBaseUrl}/api/v1/staff/dashboard/metrics`, { headers }).then((r) => r.json());
      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
        if (metricsRes.data.recentHistory || metricsRes.data.recentChanges) {
          setRecentHistory(metricsRes.data.recentHistory || metricsRes.data.recentChanges || []);
        }
      }

      // 2. Fetch Staff Roster List
      const staffRes = await fetch(`${apiBaseUrl}/api/v1/staff?limit=50`, { headers }).then((r) => r.json());
      if (staffRes.success) {
        const list = Array.isArray(staffRes.data)
          ? staffRes.data
          : staffRes.data?.items || staffRes.data?.data || [];
        setStaffList(list);
      }
    } catch {
      setError('Unable to load Human Resources & Staff Management services. Please verify network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchHRData();
  }, [fetchHRData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchHRData();
  };

  // Safe overview metric extractors (supports totalEmployees or totalStaff)
  const overview = metrics?.overview as any;
  const totalEmployees = overview?.totalEmployees ?? overview?.totalStaff ?? staffList.length;
  const activeEmployees = overview?.activeEmployees ?? overview?.activeStaff ?? 0;
  const onLeaveEmployees = overview?.onLeaveEmployees ?? overview?.onLeaveStaff ?? 0;
  const inactiveEmployees =
    (overview?.inactiveEmployees ?? overview?.inactiveStaff ?? 0) +
    (overview?.suspendedEmployees ?? overview?.suspendedStaff ?? 0) +
    (overview?.terminatedEmployees ?? overview?.terminatedStaff ?? 0);
  const unlinkedAccounts = overview?.unlinkedAccounts ?? 0;

  // Filter staff by status and search query
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const status = (staff.employmentStatus || '').toUpperCase();

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (staff.displayName || `${staff.firstName} ${staff.lastName}`).toLowerCase();
        const empNum = (staff.employeeNumber || '').toLowerCase();
        const email = (staff.email || '').toLowerCase();
        const phone = (staff.phone || '').toLowerCase();
        const dept = (staff.department?.name || '').toLowerCase();
        const desig = (staff.designation?.title || '').toLowerCase();

        return (
          name.includes(q) ||
          empNum.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          dept.includes(q) ||
          desig.includes(q)
        );
      }

      return true;
    });
  }, [staffList, statusFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* 1. Header Banner */}
      <DashboardHeader
        title="Human Resources & Staff Administration"
        subtitle="Workforce headcount, department assignments, employee credentials, and personnel audit trail."
        userName={currentUser?.name}
        userRole="HR Administrator"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Briefcase}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/staff')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Users size={15} />
              Staff Directory
            </button>
          </div>
        }
      />

      {error && (
        <DashboardAlert
          type="danger"
          title="Personnel Administration Notice"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 2. Workforce Key Performance Indicators (6 Cards) */}
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
          <DashboardMetricCard
            title="Total Headcount"
            value={totalEmployees}
            subtext="Registered hospital staff"
            icon={Users}
            variant="primary"
            badge="Staff"
            onClick={() => setStatusFilter('all')}
          />

          <DashboardMetricCard
            title="Active Workforce"
            value={activeEmployees}
            subtext="On-duty clinical & support"
            icon={UserCheck}
            variant="emerald"
            badge="Active"
            onClick={() => setStatusFilter('ACTIVE')}
          />

          <DashboardMetricCard
            title="On Leave"
            value={onLeaveEmployees}
            subtext="Approved leave of absence"
            icon={Clock}
            variant="amber"
            badge="Leave"
            onClick={() => setStatusFilter('ON_LEAVE')}
          />

          <DashboardMetricCard
            title="Inactive / Suspended"
            value={inactiveEmployees}
            subtext="Inactive or terminated profiles"
            icon={UserX}
            variant="rose"
            badge="Inactive"
            onClick={() => setStatusFilter('INACTIVE')}
          />

          <DashboardMetricCard
            title="Unlinked Accounts"
            value={unlinkedAccounts}
            subtext="Profiles pending login binding"
            icon={ShieldAlert}
            variant="purple"
            badge="Security"
            onClick={() => navigate('/staff')}
          />

          <DashboardMetricCard
            title="Departments"
            value={metrics?.staffByDepartment?.length ?? 0}
            subtext="Hospital divisions staffed"
            icon={Building2}
            variant="slate"
            badge="Divisions"
            onClick={() => navigate('/departments')}
          />
        </div>
      )}

      {/* 3. Department Headcount Breakdown */}
      {metrics?.staffByDepartment && metrics.staffByDepartment.length > 0 && (
        <DashboardSection
          title="Department Distribution"
          subtitle="Staff deployment across operational hospital departments."
          badge={`${metrics.staffByDepartment.length} DEPARTMENTS`}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {metrics.staffByDepartment.map((dept) => (
              <div
                key={dept.departmentId}
                className="card"
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{dept.departmentName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Department Staff</div>
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 12,
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                  }}
                >
                  {dept.count}
                </span>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      {/* 4. Staff Directory Worklist */}
      <DashboardSection
        title="Personnel Roster"
        subtitle="Manage hospital employees, professional designations, and department allocations."
        badge={`${filteredStaff.length} PROFILES`}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-card-header)', borderRadius: 6, padding: 2 }}>
              <button
                onClick={() => setStatusFilter('all')}
                style={{
                  border: 'none',
                  background: statusFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'all' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                style={{
                  border: 'none',
                  background: statusFilter === 'ACTIVE' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'ACTIVE' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('ON_LEAVE')}
                style={{
                  border: 'none',
                  background: statusFilter === 'ON_LEAVE' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'ON_LEAVE' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'ON_LEAVE' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                On Leave
              </button>
              <button
                onClick={() => setStatusFilter('INACTIVE')}
                style={{
                  border: 'none',
                  background: statusFilter === 'INACTIVE' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'INACTIVE' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'INACTIVE' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                Inactive
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: 220 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 9,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search staff, designation, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 28px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                }}
              />
            </div>
          </div>
        }
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading staff directory...
          </div>
        ) : filteredStaff.length === 0 ? (
          <DashboardEmptyState
            title="No staff profiles found"
            description={
              searchQuery
                ? `No staff members match query "${searchQuery}".`
                : 'There are currently no staff profiles matching the selected filter.'
            }
            icon={Users}
            actionText="Open Staff Management"
            onAction={() => navigate('/staff')}
          />
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Employee ID</th>
                  <th style={{ padding: '10px 12px' }}>Staff Name & Contact</th>
                  <th style={{ padding: '10px 12px' }}>Department</th>
                  <th style={{ padding: '10px 12px' }}>Designation</th>
                  <th style={{ padding: '10px 12px' }}>Employment Type</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const status = (staff.employmentStatus || '').toUpperCase();
                  const isActive = status === 'ACTIVE';
                  const isOnLeave = status === 'ON_LEAVE';

                  return (
                    <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {/* Employee Number */}
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        <div>{staff.employeeNumber || `EMP-${staff.id}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                          Joined: {staff.joiningDate ? new Date(staff.joiningDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      {/* Staff Name & Contact */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {staff.displayName || `${staff.firstName} ${staff.lastName}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                          {staff.email && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Mail size={11} /> {staff.email}
                            </span>
                          )}
                          {staff.phone && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Phone size={11} /> {staff.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500 }}>{staff.department?.name || 'Unassigned'}</div>
                      </td>

                      {/* Designation */}
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                          }}
                        >
                          {staff.designation?.title || 'General Staff'}
                        </span>
                      </td>

                      {/* Employment Type */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {staff.employmentType || 'FULL_TIME'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            textTransform: 'uppercase',
                            backgroundColor: isActive ? '#dcfce7' : isOnLeave ? '#fef3c7' : '#fee2e2',
                            color: isActive ? '#15803d' : isOnLeave ? '#d97706' : '#dc2626',
                          }}
                        >
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => navigate('/staff')}
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title={hasPermission('staff_update') ? 'Manage full staff record' : 'View staff profile'}
                        >
                          {hasPermission('staff_update') ? 'Manage Profile' : 'View Profile'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* 5. Recent Personnel Audit Trail */}
      {recentHistory.length > 0 && (
        <DashboardSection
          title="Personnel Changes & Audit Log"
          subtitle="Recent employee status changes, onboarding, and department transfers."
          badge={`${recentHistory.length} RECENT EVENTS`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentHistory.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <History size={16} style={{ color: 'var(--primary)' }} />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {item.eventType || 'STATUS_UPDATE'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {item.staffProfileId ? `Employee #${item.staffProfileId}` : ''}
                      {item.previousValue && item.newValue
                        ? ` (${item.previousValue} → ${item.newValue})`
                        : ''}
                    </span>
                    {item.comments && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.comments}</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      {/* 6. HR Quick Links */}
      <DashboardSection
        title="Human Resources Navigation"
        subtitle="Quick access to organizational registers, department rosters, and account credentials."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/staff')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                }}
              >
                <Users size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Staff Profile Management</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Onboard new employees, link system user accounts, and update emergency contacts.
            </p>
          </div>

          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/departments')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#ede9fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7c3aed',
                }}
              >
                <Building2 size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Department Roster</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Review clinical and administrative departments, bed allocations, and head of departments.
            </p>
          </div>

          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/settings')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669',
                }}
              >
                <Tag size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Hospital Policies & Settings</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Configure hospital branding, shift policies, notification templates, and branch definitions.
            </p>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
};
