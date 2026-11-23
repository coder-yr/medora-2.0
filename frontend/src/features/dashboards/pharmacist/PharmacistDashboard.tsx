import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pill,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  ArrowRight,
  FileText,
  Layers,
  Boxes,
  Activity,
  History,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { DashboardMetrics, StockMovement } from '../../../types/pharmacy';
import type { Prescription } from '../../../types/prescription';
import type { Medicine } from '../../../types/medicine';

export const PharmacistDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);

  const [prescriptionFilter, setPrescriptionFilter] = useState<'all' | 'pending' | 'dispensed'>('pending');
  const [stockTab, setStockTab] = useState<'low' | 'near_expiry' | 'movements'>('low');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchPharmacyData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Pharmacy Dashboard KPIs & Summary
      const metricsRes = await fetch(`${apiBaseUrl}/api/v1/pharmacy/dashboard`, { headers }).then((r) => r.json());

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
        if (metricsRes.data.recentMovements) {
          setRecentMovements(metricsRes.data.recentMovements);
        }
      }

      // 2. Fetch Prescriptions for Queue
      const rxRes = await fetch(`${apiBaseUrl}/api/v1/prescriptions?limit=50`, { headers }).then((r) => r.json());
      if (rxRes.success) {
        const list = Array.isArray(rxRes.data)
          ? rxRes.data
          : rxRes.data?.items || rxRes.data?.data || [];
        setPrescriptions(list);
      }

      // 3. Fetch Medicines Catalogue with low stock indicators
      const medRes = await fetch(`${apiBaseUrl}/api/v1/medicines?limit=50`, { headers }).then((r) => r.json());
      if (medRes.success) {
        const medList = Array.isArray(medRes.data)
          ? medRes.data
          : medRes.data?.items || medRes.data?.data || [];
        setMedicines(medList);
      }
    } catch {
      setError('Unable to load pharmacy services. Please check network connectivity or permissions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchPharmacyData();
  }, [fetchPharmacyData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchPharmacyData();
  };

  // Filtered prescription queue
  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter((rx) => {
      // If prescription items have any remaining dispense need, consider pending
      const isDispensed = rx.state?.toLowerCase() === 'dispensed';
      if (prescriptionFilter === 'pending') return !isDispensed;
      if (prescriptionFilter === 'dispensed') return isDispensed;
      return true;
    });
  }, [prescriptions, prescriptionFilter]);

  // Low stock and out-of-stock medicines
  const lowStockMedicines = useMemo(() => {
    return medicines.filter((m) => Number(m.quantity || 0) <= 10);
  }, [medicines]);

  const outOfStockCount = useMemo(() => {
    return medicines.filter((m) => Number(m.quantity || 0) <= 0).length;
  }, [medicines]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header */}
      <DashboardHeader
        title="Pharmacy Operations & Formulary Cockpit"
        subtitle="Manage e-prescriptions, track real-time medicine inventory, monitor expiry alerts, and dispense medication."
        userName={currentUser?.name || 'Pharmacist'}
        userRole="Pharmacist"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Pill}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/pharmacy')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <Pill size={16} />
              Open Dispensing Terminal
            </button>
            <button
              onClick={() => navigate('/medicines')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <Boxes size={16} />
              Formulary Catalogue
            </button>
          </div>
        }
      />

      {/* 2. Critical Inventory Alerts */}
      {metrics && metrics.expiredBatchesCount > 0 && (
        <DashboardAlert
          type="danger"
          title={`Expired Medicine Warning: ${metrics.expiredBatchesCount} batches require quarantine`}
          message="Batches past their expiration date must be segregated immediately and written off to prevent clinical dispensing."
          actionText="Inspect Quarantine Batches"
          onAction={() => navigate('/pharmacy')}
        />
      )}

      {metrics && metrics.expiringWithin30Days > 0 && (
        <DashboardAlert
          type="warning"
          title={`Near Expiry Notice: ${metrics.expiringWithin30Days} batches expiring within 30 days`}
          message="Ensure First-Expiry-First-Out (FEFO) dispensing order is followed to minimize batch write-offs."
          actionText="View Near-Expiry Batches"
          onAction={() => navigate('/pharmacy')}
        />
      )}

      {error && <DashboardErrorState title="Pharmacy Service Error" message={error} onRetry={fetchPharmacyData} />}

      {/* 3. KPI Metrics Banner (6 Cards) */}
      {loading ? (
        <DashboardSkeletonCards count={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 1: Pending Prescriptions */}
          <DashboardMetricCard
            title="Pending Prescriptions"
            value={prescriptions.filter((r) => r.state?.toLowerCase() !== 'dispensed').length}
            subtext="Awaiting pharmacist review & dispensing"
            icon={FileText}
            variant="primary"
            onClick={() => setPrescriptionFilter('pending')}
          />

          {/* Card 2: Dispensed Today */}
          <DashboardMetricCard
            title="Dispensed Today"
            value={metrics?.todayDispensationsCount ?? 0}
            subtext={metrics?.todayTakings ? `Revenue: ₹${metrics.todayTakings.toLocaleString()}` : '0 transactions recorded'}
            icon={CheckCircle2}
            variant="emerald"
            badge="Today"
          />

          {/* Card 3: Low-Stock Medicines */}
          <DashboardMetricCard
            title="Low-Stock Medicines"
            value={metrics?.lowStockCount ?? lowStockMedicines.length}
            subtext="Inventory <= 10 units threshold"
            icon={AlertTriangle}
            variant={metrics && metrics.lowStockCount > 0 ? 'amber' : 'slate'}
            badge={metrics && metrics.lowStockCount > 0 ? 'Action Required' : undefined}
            onClick={() => setStockTab('low')}
          />

          {/* Card 4: Out of Stock */}
          <DashboardMetricCard
            title="Out-of-Stock Medicines"
            value={outOfStockCount}
            subtext="Critical zero inventory items"
            icon={AlertCircle}
            variant={outOfStockCount > 0 ? 'rose' : 'slate'}
            badge={outOfStockCount > 0 ? 'Critical' : undefined}
            onClick={() => setStockTab('low')}
          />

          {/* Card 5: Near Expiry Batches */}
          <DashboardMetricCard
            title="Near-Expiry Batches"
            value={metrics?.expiringWithin30Days ?? 0}
            subtext={`${metrics?.expiredBatchesCount ?? 0} batches already expired`}
            icon={Clock}
            variant={metrics && metrics.expiringWithin30Days > 0 ? 'amber' : 'slate'}
            onClick={() => setStockTab('near_expiry')}
          />

          {/* Card 6: Total Formulary Medicines */}
          <DashboardMetricCard
            title="Formulary Catalog"
            value={metrics?.totalMedicines ?? medicines.length}
            subtext={metrics?.totalRetailValuation ? `Retail val: ₹${metrics.totalRetailValuation.toLocaleString()}` : 'Active medicine items'}
            icon={Boxes}
            variant="purple"
            onClick={() => navigate('/medicines')}
          />
        </div>
      )}

      {/* 4. Main Operational Layout: Prescription Queue & Inventory Monitor */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.2fr)', gap: 20 }}>
        {/* LEFT COLUMN: Prescription Dispensing Queue */}
        <DashboardSection
          title="Outpatient & Inpatient Prescription Queue"
          subtitle="Review doctor-issued e-prescriptions and dispense against verified FEFO batch inventory"
          icon={FileText}
          badge={filteredPrescriptions.length}
          action={
            <div style={{ display: 'flex', gap: 6 }}>
              {(['pending', 'dispensed', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPrescriptionFilter(tab)}
                  className={`btn ${prescriptionFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          }
          noPadding
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading prescription queue...
            </div>
          ) : filteredPrescriptions.length === 0 ? (
            <DashboardEmptyState
              title={`No ${prescriptionFilter} prescriptions found`}
              description="When clinicians issue e-prescriptions during consultations, they will appear here ready for dispensing."
              icon={CheckCircle2}
              actionText="Refresh Prescriptions"
              onAction={handleManualRefresh}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Prescription #</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Patient & MRN</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Prescriber</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Medications</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrescriptions.slice(0, 10).map((rx) => {
                    const isDispensed = rx.state?.toLowerCase() === 'dispensed';
                    return (
                      <tr key={rx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>
                          #{rx.id}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {rx.patient?.name || 'Walk-in Patient'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            MRN #{rx.patient?.patientId || rx.patientId}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>
                          Dr. {rx.doctor?.name || 'Attending Physician'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            <Pill size={12} style={{ color: '#0284c7' }} />
                            {rx.items?.length || 0} drugs
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="badge"
                            style={{
                              background: isDispensed ? '#d1fae5' : '#e0f2fe',
                              color: isDispensed ? '#065f46' : '#0369a1',
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {isDispensed ? 'Dispensed' : 'Ready to Dispense'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate('/pharmacy')}
                            className="btn btn-primary"
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span>Dispense</span>
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPrescriptions.length > 10 && (
                <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: '1px solid var(--border-color)', background: '#fafbfc' }}>
                  <button
                    onClick={() => navigate('/pharmacy')}
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    View all {filteredPrescriptions.length} prescriptions in Pharmacy Workspace
                  </button>
                </div>
              )}
            </div>
          )}
        </DashboardSection>

        {/* RIGHT COLUMN: Inventory Alerts & Stock Movement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Inventory Health & Batches */}
          <DashboardSection
            title="Formulary Stock & Batch Tracking"
            subtitle="Real-time monitor of depleted items, low thresholds, and batch movements"
            icon={Package}
            action={
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setStockTab('low')}
                  className={`btn ${stockTab === 'low' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  Low Stock ({lowStockMedicines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockTab('movements')}
                  className={`btn ${stockTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  Movements
                </button>
              </div>
            }
            noPadding
          >
            {stockTab === 'low' && (
              <div>
                {lowStockMedicines.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 600 }}>All medicine inventories are healthy</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>No stock items currently under threshold.</div>
                  </div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Medicine Name</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>In Stock</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockMedicines.slice(0, 8).map((med) => {
                          const qty = Number(med.quantity || 0);
                          const isOut = qty <= 0;
                          return (
                            <tr key={med.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{med.name}</div>
                                {med.generic && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{med.generic}</div>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>
                                <span style={{ color: isOut ? '#dc2626' : '#d97706' }}>
                                  {qty} {med.box || 'units'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: isOut ? '#fee2e2' : '#fef3c7',
                                    color: isOut ? '#991b1b' : '#92400e',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  {isOut ? 'OUT OF STOCK' : 'LOW STOCK'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {stockTab === 'movements' && (
              <div>
                {recentMovements.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No recent inventory transactions recorded.
                  </div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {recentMovements.slice(0, 8).map((mov) => (
                        <div
                          key={mov.id}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-main)' }}>
                              {mov.medicine?.name || 'Medication Item'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {mov.movementType.replace(/_/g, ' ')} • Batch: {mov.batch?.batchNumber || 'N/A'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: mov.movementType.includes('OUT') || mov.movementType === 'DISPENSING' ? '#dc2626' : '#059669',
                              }}
                            >
                              {mov.movementType.includes('OUT') || mov.movementType === 'DISPENSING' ? '-' : '+'}
                              {mov.quantity}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              bal: {mov.balanceAfter}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DashboardSection>

          {/* Quick Operations & Fast Actions */}
          <DashboardSection title="Pharmacy Quick Workflows" icon={Activity}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <button
                onClick={() => navigate('/pharmacy')}
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
                <Pill size={15} style={{ color: '#0284c7' }} />
                <span>Dispense Rx</span>
              </button>

              <button
                onClick={() => navigate('/medicines')}
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
                <Boxes size={15} style={{ color: '#7c3aed' }} />
                <span>Catalogue & Prices</span>
              </button>

              <button
                onClick={() => navigate('/pharmacy')}
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
                <Layers size={15} style={{ color: '#10b981' }} />
                <span>Receive Goods (GRN)</span>
              </button>

              <button
                onClick={() => navigate('/pharmacy')}
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
                <History size={15} style={{ color: '#f59e0b' }} />
                <span>Stock Adjustments</span>
              </button>
            </div>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
};
