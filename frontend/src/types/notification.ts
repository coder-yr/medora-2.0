export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'RETRYABLE' | 'DEAD_LETTER' | 'CANCELLED';

export interface NotificationItem {
  recipientId: string;
  notificationId: string;
  uuid: string;
  eventType: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  metadata?: Record<string, any>;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface NotificationPreference {
  id?: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  channelOverrides?: Record<string, any>;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export interface NotificationTemplate {
  id: string;
  templateKey: string;
  channel: NotificationChannel;
  locale: string;
  subject?: string | null;
  body: string;
  variables?: string[] | null;
  version: number;
  isActive: boolean;
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueueHealth {
  status: 'HEALTHY' | 'DEGRADED';
  pendingCount: number;
  processingCount: number;
  retryableCount: number;
  deadLetterCount: number;
  deliveredTotal: number;
  activeProviders: {
    IN_APP: string;
    EMAIL: string;
    SMS: string;
  };
  checkedAt: string;
}

export interface AdminNotification {
  id: string;
  uuid: string;
  eventType: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  recipients?: Array<{
    id: string;
    userId?: string | null;
    patientId?: string | null;
    destination?: string | null;
    recipientName?: string | null;
    isRead: boolean;
  }>;
  outbox?: {
    id: string;
    status: OutboxStatus;
    attempts: number;
    maxAttempts: number;
    nextRetryAt?: string | null;
    lastError?: string | null;
    lastErrorCategory?: string | null;
  } | null;
  deliveries?: Array<{
    id: string;
    provider: string;
    status: string;
    sentAt: string;
    errorMessage?: string | null;
  }>;
}
