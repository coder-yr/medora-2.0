import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaService } from '../src/modules/prisma/prisma.service';
import { FollowUpService } from '../src/modules/follow-up/follow-up.service';
import { FollowUpPriority, ReminderPreference } from '../src/modules/follow-up/dto/follow-up.dto';
import { NotificationService } from '../src/modules/notification/notification.service';
import { AuthUser } from '../src/common/types/auth-user.interface';

const prisma = new PrismaService();

async function run() {
  console.log('========================================================================');
  console.log('  MEDORA 2.0 — PHASE 10.5.8 FOLLOW-UPS & NOTIFICATION ENGINE VERIFY   ');
  console.log('========================================================================\n');

  const notificationService = new NotificationService(prisma as any);
  const followUpService = new FollowUpService(prisma as any, notificationService);

  // 1. Identify test user, org, branch, patient, and doctor
  const userRecord = await prisma.user.findFirst();
  if (!userRecord) throw new Error('No user found in database for testing.');

  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No organization found.');

  const branch = await prisma.hospitalBranch.findFirst({ where: { organizationId: org.id } });
  if (!branch) throw new Error('No branch found for organization.');

  let patient = await prisma.patient.findFirst();
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: 'Elena Rostova',
        phone: '+91 9988776655',
        email: `elena_${Date.now()}@test.medora.health`,
        sex: 'FEMALE',
      },
    });
  }

  let doctor = await prisma.doctor.findFirst();
  if (!doctor) {
    doctor = await prisma.doctor.create({
      data: {
        name: 'Dr. Marcus Vance',
        department: 'Internal Medicine',
      },
    });
  }

  const testUser: AuthUser = {
    id: userRecord.id.toString(),
    email: userRecord.email,
    name: `${userRecord.firstName} ${userRecord.lastName}`,
    group: 'Admin',
    permissions: [],
    organizationId: org.id,
    branchId: branch.id,
    isSuperAdmin: true,
  };

  console.log(`[PASS] Environment ready: Org #${org.id}, Branch #${branch.id}, Patient #${patient.id}, Doctor #${doctor.id}`);

  // 2. Patient Communication Preferences & Consent
  console.log('\n--- 1. Testing Patient Communication Preferences & Consent ---');
  const initialPref = await notificationService.getPatientPreferences(patient.id);
  console.log(`[INFO] Current consent for Patient #${patient.id}: Appointment=${initialPref.appointmentConsent}, Lab=${initialPref.labConsent}`);

  const updatedPref = await notificationService.updatePatientPreferences(patient.id, {
    appointmentConsent: true,
    labConsent: true,
    followUpConsent: true,
    billingConsent: false,
    consentSource: 'PATIENT_PORTAL',
    preferredChannel: 'SMS',
  });
  if (updatedPref.appointmentConsent !== true || updatedPref.billingConsent !== false) {
    throw new Error('Failed to update patient notification preferences/consent.');
  }
  console.log('[PASS] Patient consent matrix successfully updated and verified in DB.');

  // 3. Clinical Follow-up Creation & Sequential ID Generation
  console.log('\n--- 2. Testing Clinical Follow-up Creation & Sequence Format ---');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDateStr = tomorrow.toISOString().split('T')[0];

  const followUp = await followUpService.create(
    {
      patientId: Number(patient.id),
      doctorId: Number(doctor.id),
      branchId: Number(branch.id),
      dueDate: dueDateStr,
      dueTime: '10:30',
      reason: 'Post-operative wound inspection & suture evaluation',
      priority: FollowUpPriority.URGENT,
      reminderPreference: ReminderPreference.SMS,
      clinicalNotes: 'Check incision site for erythema or discharge. Redress sterile gauze.',
    },
    testUser,
  );

  if (!followUp.followUpNumber.startsWith('FOL-')) {
    throw new Error(`Invalid followUpNumber format: ${followUp.followUpNumber}`);
  }
  console.log(`[PASS] Created Follow-up: ${followUp.followUpNumber} (ID: ${followUp.id}, Status: ${followUp.status})`);

  // Verify Follow-up status transition to COMPLETED
  const completedFollowUp = await followUpService.complete(BigInt(followUp.id), testUser, {
    notes: 'Wound healing well, sutures removed successfully.',
  });
  if (completedFollowUp.status !== 'COMPLETED') {
    throw new Error(`Expected status COMPLETED, got: ${completedFollowUp.status}`);
  }
  console.log(`[PASS] Follow-up completed with clinical notes: ${completedFollowUp.status}`);

  // 4. Appointment Automated Reminders (24h & 2h) & Deduplication Keys
  console.log('\n--- 3. Testing Appointment Automated Reminder Scheduling ---');
  // Create an appointment for 2 days from now
  const aptDate = new Date();
  aptDate.setDate(aptDate.getDate() + 2);
  const dateStr = aptDate.toISOString().split('T')[0];

  const appointment = await prisma.appointment.create({
    data: {
      branchId: branch.id,
      patientId: patient.id,
      doctorId: doctor.id,
      date: dateStr,
      sTime: `${dateStr} 14:00:00`,
      eTime: `${dateStr} 14:30:00`,
      timeSlot: '14:00',
      status: 'confirmed',
    },
  });

  await notificationService.scheduleAppointmentReminders(appointment.id);
  console.log(`[PASS] Appointment reminders scheduled for Appointment #${appointment.id}`);

  // Check outbox for deduplication keys
  const outboxReminders = await prisma.notificationOutbox.findMany({
    where: {
      deduplicationKey: {
        in: [`APT-REM-${appointment.id}-24H`, `APT-REM-${appointment.id}-2H`],
      },
    },
  });
  if (outboxReminders.length < 2) {
    throw new Error(`Expected at least 2 reminder entries in outbox, found ${outboxReminders.length}`);
  }
  console.log(`[PASS] Found ${outboxReminders.length} reminder outbox records with deterministic deduplication keys:`);
  for (const r of outboxReminders) {
    console.log(`   - DeduplicationKey: ${r.deduplicationKey}, ScheduledAt: ${r.scheduledAt?.toISOString()}`);
  }

  // 5. Dynamic Suppression on Appointment Cancellation
  console.log('\n--- 4. Testing Reminder Suppression upon Appointment Cancellation ---');
  await notificationService.cancelAppointmentReminders(appointment.id);

  const pendingAfterCancel = await prisma.notificationOutbox.findMany({
    where: {
      deduplicationKey: {
        in: [`APT-REM-${appointment.id}-24H`, `APT-REM-${appointment.id}-2H`],
      },
      status: 'PENDING',
    },
  });
  if (pendingAfterCancel.length !== 0) {
    throw new Error(`Expected 0 pending reminders after cancellation, found ${pendingAfterCancel.length}`);
  }
  console.log('[PASS] Outbox reminders successfully suppressed/cancelled without phantom messages.');

  // 6. Critical Laboratory Result Escalation & Clinical Acknowledgement
  console.log('\n--- 5. Testing Critical Laboratory Result Escalation ---');
  // Create a dummy lab record
  const lab = await prisma.lab.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      patientId: patient.id,
      doctorId: doctor.id,
      orderNumber: `LAB-VER-${Date.now()}`,
      date: dateStr,
      status: 'completed',
    },
  });

  const escalation = await notificationService.triggerCriticalResultEscalation(
    lab.id,
    'Critical hyperkalemia detected: Serum Potassium 6.8 mmol/L. Immediate clinical intervention required.'
  );

  if (!escalation) {
    throw new Error('Failed to create critical laboratory escalation.');
  }
  console.log(`[PASS] Critical Escalation registered: #${escalation.id} for Lab #${lab.id} (Status: ${escalation.isAcknowledged ? 'ACKNOWLEDGED' : 'PENDING'})`);

  // Verify Acknowledgement
  const acknowledged = await notificationService.acknowledgeCriticalEscalation(
    escalation.id,
    userRecord.id,
    'Notified attending physician Dr. Vance. Patient admitted to telemetry for calcium gluconate and insulin-dextrose therapy.'
  );

  if (acknowledged.isAcknowledged !== true || !acknowledged.acknowledgedAt) {
    throw new Error(`Critical escalation failed to acknowledge: isAcknowledged=${acknowledged.isAcknowledged}`);
  }
  console.log(`[PASS] Critical escalation acknowledged by User #${userRecord.id} at ${acknowledged.acknowledgedAt}`);

  // Clean up test data created during verification
  console.log('\n--- Cleaning up temporary test verification records ---');
  await prisma.criticalLabEscalation.deleteMany({ where: { labOrderId: lab.id } });
  await prisma.lab.delete({ where: { id: lab.id } });
  await prisma.notificationOutbox.deleteMany({
    where: { deduplicationKey: { startsWith: `APT-REM-${appointment.id}` } },
  });
  await prisma.appointment.delete({ where: { id: appointment.id } });
  await prisma.followUp.delete({ where: { id: BigInt(followUp.id) } });
  console.log('[PASS] Cleanup complete.');

  console.log('\n========================================================================');
  console.log('  ALL PHASE 10.5.8 VERIFICATION TESTS PASSED SUCCESSFULLY!             ');
  console.log('========================================================================');
}

run()
  .catch((e) => {
    console.error('[FAIL] Verification encountered an error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
