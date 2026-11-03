import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

function getData(res: any) {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('Notifications, Messaging & Background Infrastructure (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;
  let doctorUserId: string;
  let receptionistUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // 1. Authenticate Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    adminToken = getData(adminRes).accessToken;

    // 2. Authenticate Doctor
    const docRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    const docData = getData(docRes);
    doctorToken = docData.accessToken;
    doctorUserId = docData.user.id;

    // 3. Authenticate Receptionist
    const recRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'receptionist.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    const recData = getData(recRes);
    receptionistToken = recData.accessToken;
    receptionistUserId = recData.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Security: Banned Legacy Unauthenticated Payment Reminder Cron', () => {
    it('must reject unauthenticated access to /cronjob/payment-reminder or legacy routes', async () => {
      // The legacy public cron route must return 404 (or 401 if behind auth)
      await request(app.getHttpServer())
        .get('/cronjob/payment-reminder')
        .expect(404);

      await request(app.getHttpServer())
        .post('/cronjob/payment-reminder')
        .expect(404);
    });
  });

  describe('2. User Notification Center & Recipient Isolation', () => {
    let createdNotificationId: string;
    let doctorRecipientId: string;

    it('Admin creates an event notification targeted specifically to Doctor', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          eventType: 'CLINICAL_ALERT',
          channel: 'IN_APP',
          title: 'Critical Lab Result Ready',
          message: 'Lab result for Patient #101 requires immediate review',
          priority: 'URGENT',
          recipients: [{ userId: doctorUserId }],
          deduplicationKey: `e2e-alert-${Date.now()}`,
        })
        .expect(201);

      const data = getData(res);
      expect(data).toBeDefined();
      expect(data.id).toBeDefined();
      createdNotificationId = String(data.id);
    });

    it('Doctor sees the notification in their feed with unread count = 1+', async () => {
      const countRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const countData = getData(countRes);
      expect(countData.unreadCount).toBeGreaterThanOrEqual(1);

      const feedRes = await request(app.getHttpServer())
        .get('/api/v1/notifications?isRead=false')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const feedData = getData(feedRes);
      expect(feedData.data.length).toBeGreaterThanOrEqual(1);

      const docItem = feedData.data.find(
        (n: any) => n.notificationId === createdNotificationId,
      );
      expect(docItem).toBeDefined();
      expect(docItem.title).toBe('Critical Lab Result Ready');
      expect(docItem.isRead).toBe(false);
      doctorRecipientId = docItem.recipientId;
    });

    it('RECIPIENT ISOLATION: Receptionist CANNOT see Doctor notification', async () => {
      const feedRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);

      const feedData = getData(feedRes);
      const leakedItem = feedData.data.find(
        (n: any) => n.notificationId === createdNotificationId,
      );
      expect(leakedItem).toBeUndefined();
    });

    it('Doctor marks notification as read', async () => {
      const markRes = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${doctorRecipientId}/read`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const markData = getData(markRes);
      expect(markData.isRead).toBe(true);
      expect(markData.readAt).toBeDefined();
    });

    it('Doctor can mark all notifications as read', async () => {
      const markAllRes = await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const resData = getData(markAllRes);
      expect(resData.updatedCount).toBeDefined();

      const countRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(getData(countRes).unreadCount).toBe(0);
    });
  });

  describe('3. User Preferences Management', () => {
    it('Doctor fetches default preferences', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const data = getData(res);
      expect(data).toBeDefined();
      expect(data.inAppEnabled).toBe(true);
    });

    it('Doctor updates preferences with quiet hours', async () => {
      const updateRes = await request(app.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          inAppEnabled: true,
          emailEnabled: false,
          smsEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
        })
        .expect(200);

      const data = getData(updateRes);
      expect(data.emailEnabled).toBe(false);
      expect(data.quietHoursStart).toBe('22:00');
      expect(data.quietHoursEnd).toBe('07:00');
    });
  });

  describe('4. Transactional Outbox, Deduplication & Provider Processing', () => {
    const dedupKey = `test-dedup-${Date.now()}`;
    let outboxNotificationId: string;

    it('Queue an email notification into the outbox', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          eventType: 'PATIENT_WELCOME',
          channel: 'EMAIL',
          title: 'Welcome to Medora',
          message: 'Thank you for registering at our hospital facility.',
          priority: 'NORMAL',
          recipients: [
            {
              destination: 'patient.test@example.com',
              recipientName: 'Alice Patient',
            },
          ],
          deduplicationKey: dedupKey,
        })
        .expect(201);

      const data = getData(res);
      expect(data.id).toBeDefined();
      outboxNotificationId = String(data.id);
    });

    it('DEDUPLICATION: Queuing again with the same deduplicationKey returns existing record without creating duplicate', async () => {
      const dupRes = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          eventType: 'PATIENT_WELCOME',
          channel: 'EMAIL',
          title: 'Welcome to Medora - Second Attempt',
          message: 'Second attempt message body',
          recipients: [{ destination: 'patient.test@example.com' }],
          deduplicationKey: dedupKey,
        })
        .expect(201);

      const data = getData(dupRes);
      expect(String(data.id)).toBe(outboxNotificationId);
    });

    it('Admin triggers outbox processor batch', async () => {
      const processRes = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications/process-outbox?batchSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stats = getData(processRes);
      expect(stats.processed).toBeGreaterThanOrEqual(1);
      expect(stats.delivered).toBeGreaterThanOrEqual(1);
    });

    it('Verification of delivery record created by outbox processing', async () => {
      const notifRes = await request(app.getHttpServer())
        .get(`/api/v1/admin/notifications/${outboxNotificationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const notif = getData(notifRes);
      expect(notif.status).toBe('DELIVERED');
      expect(notif.deliveries.length).toBeGreaterThanOrEqual(1);
      expect(notif.deliveries[0].status).toBe('SUCCESS');
      expect(notif.deliveries[0].provider).toBe('DEV_MOCK_EMAIL');
    });
  });

  describe('5. Error Classification, Exponential Backoff & Manual Retry', () => {
    let transientNotifId: string;

    it('Queue an SMS with a destination that triggers transient 504 error', async () => {
      // DevMockSmsProvider triggers transient error on phone numbers ending with 999999
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          eventType: 'APPOINTMENT_REMINDER',
          channel: 'SMS',
          title: 'Appointment Reminder',
          message: 'Reminder for your clinic visit tomorrow.',
          priority: 'HIGH',
          recipients: [
            {
              destination: '+92300999999',
              recipientName: 'Test Timeout User',
            },
          ],
          deduplicationKey: `transient-sms-${Date.now()}`,
        })
        .expect(201);

      transientNotifId = String(getData(res).id);
    });

    it('Processor classifies timeout as TRANSIENT and schedules RETRYABLE state with backoff', async () => {
      const processRes = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications/process-outbox?batchSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stats = getData(processRes);
      expect(stats.retryable).toBeGreaterThanOrEqual(1);

      const notifRes = await request(app.getHttpServer())
        .get(`/api/v1/admin/notifications/${transientNotifId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const notif = getData(notifRes);
      expect(notif.outbox).toBeDefined();
      expect(notif.outbox.status).toBe('RETRYABLE');
      expect(notif.outbox.attempts).toBe(1);
      expect(notif.outbox.nextRetryAt).toBeDefined();
      expect(notif.outbox.lastErrorCategory).toBe('TRANSIENT');
    });

    it('Admin can trigger manual retry for a notification', async () => {
      const retryRes = await request(app.getHttpServer())
        .post(`/api/v1/admin/notifications/${transientNotifId}/retry`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const retryData = getData(retryRes);
      expect(retryData.status).toBe('PENDING');
      expect(retryData.attempts).toBe(0);
    });
  });

  describe('6. Template CRUD & Variable Placeholder Rendering', () => {
    let createdTemplateId: string;
    const templateKey = `SURGERY_SCHEDULED_${Date.now()}`;

    it('Admin creates a notification template', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/notification-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          templateKey,
          channel: 'EMAIL',
          locale: 'en',
          subject: 'Surgery Scheduled for {{patientName}}',
          body: 'Dear {{patientName}}, your procedure is scheduled in OR {{room}} on {{date}}.',
          variables: ['patientName', 'room', 'date'],
        })
        .expect(201);

      const data = getData(res);
      expect(data.templateKey).toBe(templateKey);
      expect(data.variables).toContain('patientName');
      createdTemplateId = String(data.id);
    });

    it('Admin lists templates and finds created template', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/admin/notification-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const list = getData(listRes);
      const found = list.find((t: any) => String(t.id) === createdTemplateId);
      expect(found).toBeDefined();
    });

    it('Admin updates template body and increments version', async () => {
      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/admin/notification-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Surgery Confirmation: {{patientName}}',
          body: 'Dear {{patientName}}, please report to OR {{room}} at {{date}} fasting.',
        })
        .expect(200);

      const updated = getData(updateRes);
      expect(updated.version).toBe(2);
      expect(updated.subject).toBe('Surgery Confirmation: {{patientName}}');
    });
  });

  describe('7. Queue Health & Watchdog Recovery', () => {
    it('Admin retrieves queue health report', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/notifications/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const health = getData(res);
      expect(health.status).toMatch(/HEALTHY|DEGRADED/);
      expect(health.pendingCount).toBeDefined();
      expect(health.deliveredTotal).toBeDefined();
      expect(health.activeProviders.IN_APP).toBe('OPERATIONAL');
    });

    it('Watchdog recovery recovers interrupted processing tasks', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications/recover-stuck?timeoutMinutes=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.recoveredCount).toBeDefined();
    });
  });
});
