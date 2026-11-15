import React, { useState, useEffect } from 'react';
import {
  Bell,
  RefreshCw,
  RotateCcw,
  Play,
  Activity,
  Layers,
  FileText,
  Filter,
} from 'lucide-react';
import type { AdminNotification, QueueHealth, NotificationTemplate } from '../../types/notification';

interface NotificationAdminWorkspaceProps {
  token: string | null;
  activeBranchId?: string | null;
  apiBaseUrl?: string;
}

export const NotificationAdminWorkspace: React.FC<NotificationAdminWorkspaceProps> = ({
  token,
  activeBranchId,
  apiBaseUrl = 'http://localhost:3000',
}) => {
  const [activeTab, setActiveTab] = useState<'outbox' | 'templates' | 'health'>('outbox');
  const [health, setHealth] = useState<QueueHealth | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [processingOutbox, setProcessingOutbox] = useState<boolean>(false);

  // Load Queue Health
  const loadHealth = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/admin/notifications/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setHealth(json.data ?? json);
      }
    } catch (err) {
      console.error('Failed to load queue health:', err);
    }
  };

  // Load Administrative Outbox Notifications
  const loadNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (channelFilter) params.append('channel', channelFilter);
      if (activeBranchId) params.append('branchId', activeBranchId);
      params.append('limit', '50');

      const res = await fetch(`${apiBaseUrl}/api/v1/admin/notifications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data?.data ?? json.data ?? []);
      }
    } catch (err) {
      console.error('Failed to load admin notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Templates
  const loadTemplates = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/admin/notification-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data ?? json);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'outbox') {
      loadNotifications();
    } else if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'health') {
      loadHealth();
    }
  }, [token, activeTab, statusFilter, channelFilter, activeBranchId]);

  // Trigger Immediate Outbox Processing Pass
  const triggerProcessOutbox = async () => {
    if (!token) return;
    setProcessingOutbox(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/admin/notifications/process-outbox?batchSize=25`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const stats = json.data ?? json;
        setActionNotice(
          `Processed: ${stats.processed}, Delivered: ${stats.delivered}, Retryable: ${stats.retryable}, Failed: ${stats.failed}`,
        );
        loadHealth();
        loadNotifications();
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err) {
      console.error('Failed to trigger outbox processor:', err);
    } finally {
      setProcessingOutbox(false);
    }
  };

  // Manual Retry for Dead-letter / Failed Notification
  const retryNotification = async (notificationId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/admin/notifications/${notificationId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionNotice(`Notification #${notificationId} reset for immediate retry`);
        loadNotifications();
        loadHealth();
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error('Failed to retry notification:', err);
    }
  };

  return (
    <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header & Sub-Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '16px 20px',
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={20} style={{ color: '#2563eb' }} />
            Notifications, Outbox & Background Messaging
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            Inspect transactional outbox jobs, provider delivery logs, system health, and message templates.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={triggerProcessOutbox}
            disabled={processingOutbox}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Play size={15} />
            {processingOutbox ? 'Processing...' : 'Process Outbox Batch'}
          </button>
        </div>
      </div>

      {/* Health Overview Cards */}
      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>System Status</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: health.status === 'HEALTHY' ? '#10b981' : '#f59e0b', marginTop: 4 }}>
              {health.status}
            </div>
          </div>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Pending Outbox</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
              {health.pendingCount}
            </div>
          </div>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Retryable Backoff</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706', marginTop: 4 }}>
              {health.retryableCount}
            </div>
          </div>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Dead-Letter Queue</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: health.deadLetterCount > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
              {health.deadLetterCount}
            </div>
          </div>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Delivered Total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginTop: 4 }}>
              {health.deliveredTotal}
            </div>
          </div>
        </div>
      )}

      {actionNotice && (
        <div style={{ padding: '10px 16px', background: '#dcfce7', color: '#166534', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
          {actionNotice}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => setActiveTab('outbox')}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'outbox' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'outbox' ? '#2563eb' : '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Layers size={16} /> Outbox Queue & Deliveries
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'templates' ? '#2563eb' : '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FileText size={16} /> Notification Templates
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('health')}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'health' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'health' ? '#2563eb' : '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Activity size={16} /> Queue Health & Telemetry
        </button>
      </div>

      {/* Tab 1: Outbox List */}
      {activeTab === 'outbox' && (
        <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* Filters Bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={16} style={{ color: '#6b7280' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Filters:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">All Outbox Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="RETRYABLE">RETRYABLE</option>
              <option value="DEAD_LETTER">DEAD_LETTER</option>
            </select>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">All Channels</option>
              <option value="IN_APP">IN_APP</option>
              <option value="EMAIL">EMAIL</option>
              <option value="SMS">SMS</option>
            </select>
            <button
              type="button"
              onClick={loadNotifications}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                  <th style={{ padding: '10px 14px' }}>ID / Event</th>
                  <th style={{ padding: '10px 14px' }}>Channel</th>
                  <th style={{ padding: '10px 14px' }}>Title & Content</th>
                  <th style={{ padding: '10px 14px' }}>Outbox Status</th>
                  <th style={{ padding: '10px 14px' }}>Attempts</th>
                  <th style={{ padding: '10px 14px' }}>Branch</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                      Loading outbox jobs...
                    </td>
                  </tr>
                ) : notifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                      No notifications found for current criteria.
                    </td>
                  </tr>
                ) : (
                  notifications.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>#{item.id}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{item.eventType}</div>
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background:
                              item.channel === 'IN_APP' ? '#dbeafe' : item.channel === 'EMAIL' ? '#fef3c7' : '#e0e7ff',
                            color:
                              item.channel === 'IN_APP' ? '#1e40af' : item.channel === 'EMAIL' ? '#92400e' : '#3730a3',
                            fontWeight: 600,
                          }}
                        >
                          {item.channel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', maxWidth: 300 }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.message}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontWeight: 600,
                            background:
                              item.outbox?.status === 'DELIVERED'
                                ? '#dcfce7'
                                : item.outbox?.status === 'DEAD_LETTER'
                                ? '#fee2e2'
                                : item.outbox?.status === 'RETRYABLE'
                                ? '#fef3c7'
                                : '#f3f4f6',
                            color:
                              item.outbox?.status === 'DELIVERED'
                                ? '#166534'
                                : item.outbox?.status === 'DEAD_LETTER'
                                ? '#991b1b'
                                : item.outbox?.status === 'RETRYABLE'
                                ? '#92400e'
                                : '#374151',
                          }}
                        >
                          {item.outbox?.status || item.status}
                        </span>
                        {item.outbox?.lastError && (
                          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, maxWidth: 220 }}>
                            {item.outbox.lastError}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        {item.outbox ? `${item.outbox.attempts} / ${item.outbox.maxAttempts}` : '1 / 1'}
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', color: '#6b7280' }}>
                        {item.branch ? item.branch.code : 'GLOBAL'}
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                        {(item.outbox?.status === 'DEAD_LETTER' || item.outbox?.status === 'RETRYABLE') && (
                          <button
                            type="button"
                            onClick={() => retryNotification(item.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                              borderRadius: 4,
                              padding: '4px 8px',
                              fontSize: 12,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            <RotateCcw size={12} /> Retry
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

      {/* Tab 2: Notification Templates */}
      {activeTab === 'templates' && (
        <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 20 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 600, color: '#111827' }}>
            System Notification Templates
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 16,
                  background: '#fafafa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{tpl.templateKey}</span>
                  <span style={{ fontSize: 11, background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    {tpl.channel} (v{tpl.version})
                  </span>
                </div>
                {tpl.subject && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    Subject: {tpl.subject}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'pre-wrap', background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  {tpl.body}
                </div>
                {tpl.variables && (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Variables: {Array.isArray(tpl.variables) ? tpl.variables.join(', ') : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Queue Health & Telemetry */}
      {activeTab === 'health' && health && (
        <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827' }}>
            Provider Infrastructure Status
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>In-App Provider</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                {health.activeProviders.IN_APP}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#4b5563' }}>
                Zero network dependency. Persists directly to recipient feed.
              </p>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Email Provider</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                {health.activeProviders.EMAIL}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#4b5563' }}>
                Simulated provider active. Sanitizes HTML and validates recipient address format.
              </p>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>SMS Telecom Provider</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                {health.activeProviders.SMS}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#4b5563' }}>
                Normalises Pakistani/International phone formats. Redacts numbers in logs for PHI privacy.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
