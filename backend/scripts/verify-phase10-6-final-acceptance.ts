import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HospitalPermission } from '../src/common/constants/permissions.enum';
import { AuthUser } from '../src/common/types/auth-user.interface';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AppointmentService } from '../src/modules/appointment/appointment.service';
import { ConsultationService } from '../src/modules/consultation/consultation.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { NotificationOutboxService } from '../src/modules/notification/notification-outbox.service';
import { PatientService } from '../src/modules/patient/patient.service';
import { PrescriptionService } from '../src/modules/prescription/prescription.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

async function run() {
  console.log('========================================================================');
  console.log('  MEDORA 2.0 — PHASE 10.6 FINAL ACCEPTANCE E2E & SECURITY AUDIT         ');
  console.log('========================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const patientService = app.get(PatientService);
  const appointmentService = app.get(AppointmentService);
  const consultationService = app.get(ConsultationService);
  const prescriptionService = app.get(PrescriptionService);
  const invoiceService = app.get(InvoiceService);
  const outboxService = app.get(NotificationOutboxService);
  const analyticsService = app.get(AnalyticsService);

  const org1 = await prisma.organization.findFirst({ where: { id: 1n } });
  if (!org1) throw new Error('Org 1 not found');
  const branch1 = await prisma.hospitalBranch.findFirst({ where: { organizationId: org1.id, active: true } });
  if (!branch1) throw new Error('Branch 1 not found');
  const user1 = await prisma.user.findFirst({ where: { organizationId: org1.id } });
  if (!user1) throw new Error('User 1 not found');
  const doctor1 = await prisma.doctor.findFirst({ where: { branchId: branch1.id } });
  if (!doctor1) throw new Error('Doctor 1 not found');

  const adminOrg1: AuthUser = {
    id: user1.id.toString(),
    email: user1.email,
    name: `${user1.firstName} ${user1.lastName}`,
    group: 'Admin',
    permissions: Object.values(HospitalPermission),
    organizationId: org1.id,
    branchId: branch1.id,
  };

  const foreignUser: AuthUser = {
    id: '999999',
    email: 'intruder@otherorg.test',
    name: 'Foreign Intruder',
    group: 'Admin',
    permissions: Object.values(HospitalPermission),
    organizationId: 999999n,
    branchId: 999999n,
  };

  const cleanupIds: {
    patientId?: bigint;
    appointmentIds: bigint[];
    consultationId?: bigint;
    prescriptionId?: bigint;
    invoiceId?: bigint;
  } = { appointmentIds: [] };

  try {
    // PHASE 2: Patient Workflow & Allergy State Distinction
    const uniquePhone = `+9199${Date.now().toString().slice(-8)}`;
    const patient = await patientService.create(
      {
        name: 'Audit Patient Phase106',
        phone: uniquePhone,
        sex: 'Female',
        age: '34',
        branchId: branch1.id.toString(),
        emergencyContactName: 'Audit Guardian',
        emergencyContactPhone: '+919900001111',
        emergencyContactRelation: 'Spouse',
        allergies: 'Penicillin',
      } as never,
      user1.id.toString(),
      adminOrg1,
    );
    cleanupIds.patientId = BigInt(patient.id);
    if (!patient.patientId) throw new Error('MRN not generated');
    console.log(`[PASS] Phase 2: Patient registered with MRN ${patient.patientId}`);

    const dupCheck = await patientService.checkDuplicates(
      { phone: uniquePhone, name: 'Audit Patient Phase106' },
      adminOrg1,
    );
    if (!dupCheck.matches || dupCheck.matches.length === 0) {
      throw new Error('Duplicate patient detection failed');
    }
    console.log('[PASS] Phase 2: Duplicate patient detection verified');

    // IDOR check on Patient
    let patientIdorBlocked = false;
    try {
      await patientService.findById(patient.id, foreignUser);
    } catch {
      patientIdorBlocked = true;
    }
    if (!patientIdorBlocked) throw new Error('P0: Patient IDOR not blocked!');
    console.log('[PASS] Phase 11: Patient cross-tenant IDOR blocked');

    // PHASE 3: Appointment & Queue Workflow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const walkIn = await appointmentService.createWalkIn(
      {
        patient: patient.id,
        doctor: doctor1.id.toString(),
        branchId: branch1.id.toString(),
        priority: 'URGENT',
        remarks: 'Phase 10.6 audit walk-in',
      } as never,
      user1.id.toString(),
      adminOrg1,
    );
    cleanupIds.appointmentIds.push(BigInt(walkIn.id));
    if (!walkIn.tokenNumber?.startsWith('W-')) {
      throw new Error(`Expected W-XX token, got ${walkIn.tokenNumber}`);
    }
    console.log(`[PASS] Phase 3: Walk-in registered with token ${walkIn.tokenNumber} (URGENT)`);

    // PHASE 4: Doctor SOAP Consultation, Immutability & Amendments
    const draftConsult = await consultationService.saveVisitConsultation(
      walkIn.id,
      {
        soap_subjective: 'Patient presents with mild fever',
        soap_objective: 'Temp 99.8F, BP 120/80',
        soap_assessment: 'Viral upper respiratory tract infection',
        soap_plan: 'Supportive care and hydration',
        allergy_status: 'CONFIRMED',
        allergies: 'Penicillin',
        action: 'save_draft',
      } as never,
      user1.id.toString(),
      adminOrg1,
    );
    cleanupIds.consultationId = BigInt(draftConsult.id);
    if (draftConsult.status !== 'draft') throw new Error('Expected draft status');

    const signedConsult = await consultationService.saveVisitConsultation(
      walkIn.id,
      {
        soap_subjective: 'Patient presents with mild fever',
        soap_objective: 'Temp 99.8F, BP 120/80',
        soap_assessment: 'Viral upper respiratory tract infection',
        soap_plan: 'Supportive care and hydration',
        allergy_status: 'CONFIRMED',
        allergies: 'Penicillin',
        action: 'sign',
      } as never,
      user1.id.toString(),
      adminOrg1,
    );
    if (signedConsult.status !== 'signed' || !signedConsult.signedAt) {
      throw new Error('Consultation signing failed');
    }

    let immutabilityEnforced = false;
    try {
      await consultationService.saveVisitConsultation(
        walkIn.id,
        { soap_plan: 'Tampered plan', action: 'save_draft' } as never,
        user1.id.toString(),
        adminOrg1,
      );
    } catch {
      immutabilityEnforced = true;
    }
    if (!immutabilityEnforced) throw new Error('P0: Signed consultation was mutable!');

    const amended = await consultationService.amendConsultation(
      signedConsult.id,
      { reason: 'Addendum for follow-up', newNotes: 'Add saline nasal spray' } as never,
      user1.id.toString(),
      adminOrg1,
    );
    if (!amended.amendments || amended.amendments.length === 0) {
      throw new Error('Consultation amendment not persisted');
    }
    console.log('[PASS] Phase 4: SOAP consultation signed, immutable, and auditable amendment added');

    // PHASE 5: Prescription Workflow
    const med = await prisma.medicine.findFirst({ where: { isActive: true } });
    if (!med) throw new Error('No active medicine in DB');

    const rx = await prescriptionService.create(
      {
        patientId: patient.id,
        doctorId: doctor1.id.toString(),
        consultationId: signedConsult.id,
        branchId: branch1.id.toString(),
        date: tomorrowStr,
        status: 'DRAFT',
        items: [
          {
            medicineId: Number(med.id),
            name: med.name,
            dosage: '500mg',
            frequency: 'BD',
            route: 'Oral',
            duration: '5 days',
            quantity: 10,
          },
        ],
      } as never,
      adminOrg1,
    );
    cleanupIds.prescriptionId = BigInt(rx.id);
    if (rx.status !== 'DRAFT') throw new Error('Rx should remain DRAFT until explicit prescriber sign');

    const signedRx = await prescriptionService.sign(
      Number(rx.id),
      { signatureNotes: 'Verified against Penicillin allergy' },
      adminOrg1,
    );
    if (signedRx.status !== 'SIGNED') throw new Error('Rx explicit signing failed');
    console.log('[PASS] Phase 5: Prescription stays DRAFT until explicit prescriber sign-off');

    // PHASE 7: Billing & Financial Integrity Audit + SQL Reconciliation
    const invoice = await invoiceService.create(
      {
        patient: patient.id,
        branchId: branch1.id.toString(),
        date: tomorrowStr,
        status: 'ISSUED',
        items: [
          { name: 'Consultation Fee', quantity: 1, unit_price: 800, tax_rate: 0 },
          { name: 'CBC Panel', quantity: 1, unit_price: 400, tax_rate: 0 },
        ],
      } as never,
      user1.id.toString(),
      adminOrg1,
    );
    cleanupIds.invoiceId = BigInt(invoice.id);

    await invoiceService.recordPayment(
      invoice.id,
      { amount: 500, method: 'UPI', reference: 'UPI-AUDIT-1' } as never,
      user1.id.toString(),
      adminOrg1,
    );
    const afterPartial = await invoiceService.recordPayment(
      invoice.id,
      { amount: 700, method: 'Cash', reference: 'CASH-AUDIT-2' } as never,
      user1.id.toString(),
      adminOrg1,
    );
    if (afterPartial.status !== 'paid') {
      throw new Error(`Expected invoice paid after 500+700=1200, got ${afterPartial.status}`);
    }

    const afterRefund = await invoiceService.processRefund(
      invoice.id,
      { amount: 200, reason: 'Partial test cancellation', method: 'Cash' } as never,
      user1.id.toString(),
      adminOrg1,
    );
    if (afterRefund.status !== 'part paid') {
      throw new Error(`Expected part paid after 200 refund, got ${afterRefund.status}`);
    }

    let overRefundBlocked = false;
    try {
      await invoiceService.processRefund(
        invoice.id,
        { amount: 1500, reason: 'Over-refund attempt', method: 'Cash' } as never,
        user1.id.toString(),
        adminOrg1,
      );
    } catch {
      overRefundBlocked = true;
    }
    if (!overRefundBlocked) throw new Error('P0: Over-refund was not blocked!');

    const sqlRec = await prisma.$queryRawUnsafe<
      Array<{ gross: string; paid: string; refunded: string }>
    >(
      `SELECT p.gross_total::text AS gross,
              COALESCE((SELECT SUM(ip.amount) FROM invoice_payment ip WHERE ip.payment_id = p.id AND ip.status IN ('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')), 0)::text AS paid,
              COALESCE((SELECT SUM(ir.amount) FROM invoice_refund ir WHERE ir.payment_id = p.id), 0)::text AS refunded
       FROM payment p WHERE p.id = ${BigInt(invoice.id)};`,
    );
    const rec = sqlRec[0];
    if (Number(rec.gross) !== 1200 || Number(rec.paid) !== 1200 || Number(rec.refunded) !== 200) {
      throw new Error(`SQL financial reconciliation mismatch: ${JSON.stringify(rec)}`);
    }
    console.log('[PASS] Phase 7: Partial payments, refunds, over-refund guard & SQL reconciliation verified');

    // PHASE 9: Outbox Watchdog
    const recovered = await outboxService.recoverInterruptedJobs(5);
    console.log(`[PASS] Phase 9: Outbox watchdog recoverInterruptedJobs executed (recovered=${recovered})`);

    // PHASE 11: Analytics IDOR
    let analyticsIdorBlocked = false;
    try {
      await analyticsService.getOverview(foreignUser, { period: 'today' });
    } catch {
      analyticsIdorBlocked = true;
    }
    if (!analyticsIdorBlocked) throw new Error('P0: Analytics IDOR not blocked!');
    console.log('[PASS] Phase 11: Analytics cross-tenant IDOR blocked');

    console.log('\n========================================================================');
    console.log('  PHASE 10.6 FINAL ACCEPTANCE AUDIT: ALL LIVE E2E CHECKS PASSED!       ');
    console.log('========================================================================');
  } finally {
    if (cleanupIds.invoiceId) {
      await prisma.invoiceRefund.deleteMany({ where: { paymentId: cleanupIds.invoiceId } });
      await prisma.invoicePayment.deleteMany({ where: { paymentId: cleanupIds.invoiceId } });
      await prisma.invoiceItem.deleteMany({ where: { paymentId: cleanupIds.invoiceId } });
      await prisma.payment.deleteMany({ where: { id: cleanupIds.invoiceId } });
    }
    if (cleanupIds.prescriptionId) {
      await prisma.prescription.deleteMany({ where: { id: cleanupIds.prescriptionId } });
    }
    if (cleanupIds.consultationId) {
      await prisma.consultation.deleteMany({ where: { id: cleanupIds.consultationId } });
    }
    for (const aptId of cleanupIds.appointmentIds) {
      await prisma.notificationOutbox.deleteMany({
        where: { deduplicationKey: { startsWith: `APT-REM-${aptId}` } },
      });
      await prisma.appointment.deleteMany({ where: { id: aptId } });
    }
    if (cleanupIds.patientId) {
      await prisma.patient.deleteMany({ where: { id: cleanupIds.patientId } });
    }
    await app.close();
  }
}

run().catch((err) => {
  console.error('[FAIL] Phase 10.6 audit failed:', err);
  process.exit(1);
});
