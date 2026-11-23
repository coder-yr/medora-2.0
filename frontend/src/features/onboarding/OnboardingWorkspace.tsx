import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Building2,
  Users,
  Settings,
  Layers,
  Sparkles,
  ArrowRight,
  Shield,
  Stethoscope,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ChecklistItem {
  step: number;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string | null;
}

interface OnboardingData {
  id: string;
  organizationId: string;
  isCompleted: boolean;
  completedAt?: string | null;
  currentStep: string;
  checklist: Record<string, ChecklistItem>;
}

export const OnboardingWorkspace: React.FC = () => {
  const { currentUser, token, apiBaseUrl } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);

  const orgId = currentUser?.organizationId || '1';

  const fetchOnboarding = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/organizations/${orgId}/onboarding`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to retrieve organization onboarding state.');
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading onboarding checklist.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, orgId, token]);

  useEffect(() => {
    void fetchOnboarding();
  }, [fetchOnboarding]);

  const toggleStep = async (stepKey: string, currentCompleted: boolean) => {
    setUpdating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/organizations/${orgId}/onboarding`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stepKey,
          completed: !currentCompleted,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to update step.');
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error updating checklist step.');
    } finally {
      setUpdating(false);
    }
  };

  const completeAll = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/organizations/${orgId}/onboarding`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isCompleted: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to finalize onboarding.');
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error finalizing onboarding.');
    } finally {
      setUpdating(false);
    }
  };

  const checklistItems = data?.checklist ? Object.entries(data.checklist) : [];
  const completedCount = checklistItems.filter(([_, item]) => item.completed).length;
  const totalCount = checklistItems.length || 1;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4 }}>
              TENANT ONBOARDING
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>Organization #{orgId}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            Welcome to Medora 2.0
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
            Complete the operational checklist to initialize clinical workflows, invite staff, and configure branches.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '10px 16px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Go to Dashboard
          </button>
          {!data?.isCompleted && (
            <button
              onClick={completeAll}
              disabled={updating}
              style={{ padding: '10px 20px', borderRadius: 8, background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Finish Onboarding
            </button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24, marginBottom: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Onboarding Completion Progress
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              {completedCount} of {totalCount} readiness steps completed
            </p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: data?.isCompleted ? '#10b981' : '#0284c7' }}>
            {percentage}%
          </span>
        </div>

        {/* Progress Bar Track */}
        <div style={{ width: '100%', height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: data?.isCompleted ? '#10b981' : '#0284c7',
              borderRadius: 5,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {data?.isCompleted && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={18} />
            <span>Facility is fully onboarded and operating in live production status.</span>
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 20, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Checklist Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {checklistItems.map(([key, item]) => {
          return (
            <div
              key={key}
              style={{
                background: '#ffffff',
                borderRadius: 12,
                border: item.completed ? '1px solid #e2e8f0' : '1px solid #bfdbfe',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: item.completed ? 'none' : '0 2px 4px rgba(2, 132, 199, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <button
                  type="button"
                  onClick={() => toggleStep(key, item.completed)}
                  disabled={updating}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: item.completed ? '#10b981' : '#cbd5e1',
                    marginTop: 2,
                    padding: 0,
                  }}
                >
                  <CheckCircle2 size={24} style={{ fill: item.completed ? '#ecfdf5' : 'transparent' }} />
                </button>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: item.completed ? '#475569' : '#0f172a' }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    {item.description}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {key === 'staff_invitation' && (
                  <Link
                    to="/staff-management"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: '#f0f9ff',
                      color: '#0284c7',
                      border: '1px solid #bae6fd',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Manage Staff <ArrowRight size={14} />
                  </Link>
                )}
                {key === 'settings_configured' && (
                  <Link
                    to="/settings"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Settings <ExternalLink size={14} />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => toggleStep(key, item.completed)}
                  disabled={updating}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: item.completed ? '#f1f5f9' : '#0284c7',
                    color: item.completed ? '#475569' : '#ffffff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {item.completed ? 'Mark Incomplete' : 'Mark Completed'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
