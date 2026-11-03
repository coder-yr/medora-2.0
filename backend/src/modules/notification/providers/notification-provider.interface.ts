export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';

export interface NotificationPayload {
  recipientDestination?: string;
  recipientName?: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface DeliveryResult {
  success: boolean;
  provider: string;
  providerMessageId?: string;
  statusCode?: string;
  isTransientError?: boolean;
  error?: string;
  rawResponse?: string;
  durationMs?: number;
}

export interface INotificationProvider {
  readonly channel: NotificationChannel;
  readonly providerName: string;
  send(payload: NotificationPayload): Promise<DeliveryResult>;
}
