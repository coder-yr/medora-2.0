import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Sliders, RefreshCw, X, Mail, MessageSquare, CheckCircle } from 'lucide-react';
import type { NotificationItem, NotificationPreference } from '../../types/notification';

interface NotificationCenterProps {
  token: string | null;
  apiBaseUrl?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  token,
  apiBaseUrl = 'http://localhost:3000',
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterUnread, setFilterUnread] = useState<boolean>(false);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [prefSaving, setPrefSaving] = useState<boolean>(false);
  const [messageNotice, setMessageNotice] = useState<string | null>(null);

  // Poll unread counter every 30 seconds if authenticated
  useEffect(() => {
    if (!token) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const count = json.data?.unreadCount ?? json.unreadCount ?? 0;
          setUnreadCount(count);
        }
      } catch (err) {
        console.error('Failed to fetch notification unread count:', err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [token, apiBaseUrl]);

  const loadNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = `${apiBaseUrl}/api/v1/notifications?limit=25${filterUnread ? '&isRead=false' : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const items = json.data?.data ?? json.data ?? [];
        setNotifications(items);
      }
    } catch (err) {
      console.error('Failed to load notifications list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, filterUnread]);

  const markAsRead = async (recipientId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/notifications/${recipientId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((item) =>
            item.recipientId === recipientId ? { ...item, isRead: true } : item,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
        setMessageNotice('All notifications marked as read');
        setTimeout(() => setMessageNotice(null), 3000);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const openPreferencesModal = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/notifications/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setPreferences(json.data ?? json);
        setShowPreferences(true);
      }
    } catch (err) {
      console.error('Failed to fetch user preferences:', err);
    }
  };

  const savePreferences = async () => {
    if (!token || !preferences) return;
    setPrefSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        setMessageNotice('Notification preferences saved');
        setShowPreferences(false);
        setTimeout(() => setMessageNotice(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setPrefSaving(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'none',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          padding: '8px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#374151',
        }}
        title="Notifications & Alerts"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 12,
              padding: '2px 6px',
              minWidth: 18,
              textAlign: 'center',
              lineHeight: '14px',
              border: '2px solid #ffffff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Drawer / Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 42,
            right: 0,
            width: 380,
            maxHeight: 520,
            background: '#ffffff',
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    background: '#e0e7ff',
                    color: '#4338ca',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={openPreferencesModal}
                title="Delivery preferences"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <Sliders size={16} />
              </button>
              <button
                type="button"
                onClick={loadNotifications}
                title="Refresh"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Subheader / Filter & Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              borderBottom: '1px solid #f3f4f6',
              fontSize: 12,
              background: '#ffffff',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#4b5563' }}>
              <input
                type="checkbox"
                checked={filterUnread}
                onChange={(e) => setFilterUnread(e.target.checked)}
              />
              <span>Unread only</span>
            </label>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2563eb',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {messageNotice && (
            <div
              style={{
                padding: '6px 16px',
                background: '#dcfce7',
                color: '#15803d',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {messageNotice}
            </div>
          )}

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 380 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <CheckCircle size={28} style={{ margin: '0 auto 8px', color: '#10b981' }} />
                <p style={{ margin: 0 }}>You are all caught up!</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.recipientId}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f3f4f6',
                    background: item.isRead ? '#ffffff' : '#f0f9ff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            item.priority === 'URGENT'
                              ? '#dc2626'
                              : item.priority === 'HIGH'
                              ? '#d97706'
                              : '#6b7280',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.priority}
                      </span>
                      {item.branch && (
                        <span
                          style={{
                            fontSize: 10,
                            background: '#e5e7eb',
                            color: '#374151',
                            padding: '1px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {item.branch.code}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead(item.recipientId)}
                          title="Mark as read"
                          style={{
                            background: '#e0e7ff',
                            border: 'none',
                            color: '#4338ca',
                            borderRadius: 12,
                            padding: '2px 6px',
                            fontSize: 11,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <Check size={12} /> Read
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight: item.isRead ? 500 : 700, fontSize: 13, color: '#111827' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>
                    {item.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && preferences && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: 440,
              maxWidth: '90vw',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#111827' }}>
                Notification Preferences
              </h3>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Select how you wish to receive personal medical and administrative alerts.
              </div>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                  <Bell size={16} /> In-App Alerts
                </div>
                <input
                  type="checkbox"
                  checked={preferences.inAppEnabled}
                  onChange={(e) => setPreferences({ ...preferences, inAppEnabled: e.target.checked })}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                  <Mail size={16} /> Email Notifications
                </div>
                <input
                  type="checkbox"
                  checked={preferences.emailEnabled}
                  onChange={(e) => setPreferences({ ...preferences, emailEnabled: e.target.checked })}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                  <MessageSquare size={16} /> SMS Alerts
                </div>
                <input
                  type="checkbox"
                  checked={preferences.smsEnabled}
                  onChange={(e) => setPreferences({ ...preferences, smsEnabled: e.target.checked })}
                />
              </label>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Quiet Hours (Do Not Disturb)
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Start</label>
                    <input
                      type="time"
                      value={preferences.quietHoursStart || ''}
                      onChange={(e) => setPreferences({ ...preferences, quietHoursStart: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>End</label>
                    <input
                      type="time"
                      value={preferences.quietHoursEnd || ''}
                      onChange={(e) => setPreferences({ ...preferences, quietHoursEnd: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePreferences}
                  disabled={prefSaving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {prefSaving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
