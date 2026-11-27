import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HospitalPermission } from '../src/common/constants/permissions.enum';
import { AuthUser } from '../src/common/types/auth-user.interface';
import { AppointmentService } from '../src/modules/appointment/appointment.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { NotificationOutboxService } from '../src/modules/notification/notification-outbox.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

async function run() {
  console.log('========================================================================');
  console.log('  MEDORA 2.0 — PHASE 10.6.1 HARDENING & CONCURRENCY BENCHMARK           ');
  console.log('========================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const appointmentService = app.get(AppointmentService);
  const invoiceService = app.get(InvoiceService);
  const outboxService = app.get(NotificationOutboxService);

  const user1 = await prisma.user.findFirst({ where: { organizationId: 1n } });
  const branch1 = await prisma.hospitalBranch.findFirst({ where: { organizationId: 1n, active: true } });
  const doctor1 = await prisma.doctor.findFirst({ where: { branchId: branch1!.id } });
  const patient1 = await prisma.patient.findFirst({ where: { branchId: branch1!.id } });
  if (!user1 || !branch1 || !doctor1 || !patient1) {
    throw new Error('Missing baseline entities for Org 1');
  }

  const adminUser: AuthUser = {
    id: user1.id.toString(),
    email: user1.email,
    name: `${user1.firstName} ${user1.lastName}`,
    group: 'Admin',
    permissions: Object.values(HospitalPermission),
    organizationId: 1n,
    branchId: branch1.id,
  };

  const createdApptIds: bigint[] = [];
  let createdInvoiceId: bigint | null = null;

  try {
    // 1. Referential Integrity (ON DELETE RESTRICT)
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 10);
    const dateStr = testDate.toISOString().slice(0, 10);

    const inv = await invoiceService.create(
      {
        patient: patient1.id.toString(),
        branchId: branch1.id.toString(),
        date: dateStr,
        status: 'ISSUED',
        items: [{ name: 'Audit RESTRICT Check', quantity: 1, unit_price: 250, tax_rate: 0 }],
      } as never,
      user1.id.toString(),
      adminUser,
    );
    createdInvoiceId = BigInt(inv.id);

    let restrictBlocked = false;
    try {
      await prisma.payment.delete({ where: { id: createdInvoiceId } });
    } catch {
      restrictBlocked = true;
    }
    if (!restrictBlocked) {
      throw new Error('P0: Hard-deleting Payment with InvoiceItems was NOT blocked by ON DELETE RESTRICT!');
    }
    console.log('[PASS] Referential Integrity: ON DELETE RESTRICT blocked Payment hard-delete, preserving audit items.');

    // 2. Concurrent Same-Slot Double-Booking Prevention
    const sameSlotRes = await Promise.allSettled([
      appointmentService.create(
        {
          patient: patient1.id.toString(),
          doctor: doctor1.id.toString(),
          branchId: branch1.id.toString(),
          date: dateStr,
          start: '10:00',
          status: 'confirmed',
          remarks: 'Concurrent same-slot A',
        } as never,
        user1.id.toString(),
        adminUser,
      ),
      appointmentService.create(
        {
          patient: patient1.id.toString(),
          doctor: doctor1.id.toString(),
          branchId: branch1.id.toString(),
          date: dateStr,
          start: '10:00',
          status: 'confirmed',
          remarks: 'Concurrent same-slot B',
        } as never,
        user1.id.toString(),
        adminUser,
      ),
    ]);

    const sameSucceeded = sameSlotRes.filter((r) => r.status === 'fulfilled');
    const sameRejected = sameSlotRes.filter((r) => r.status === 'rejected');
    for (const s of sameSucceeded) {
      createdApptIds.push(BigInt((s as PromiseFulfilledResult<{ id: string }>).value.id));
    }
    if (sameSucceeded.length !== 1 || sameRejected.length !== 1) {
      throw new Error(
        `Same-slot concurrency failed: succeeded=${sameSucceeded.length}, rejected=${sameRejected.length}`,
      );
    }
    console.log('[PASS] Same-Slot Concurrency: 1 succeeded, 1 double-booking rejected.');

    // 3. Concurrent Unrelated-Slot Benchmark (4 parallel slots)
    const slots = ['11:00', '11:30', '12:00', '12:30'];
    const t0 = Date.now();
    const multiRes = await Promise.all(
      slots.map((slot) =>
        appointmentService.create(
          {
            patient: patient1.id.toString(),
            doctor: doctor1.id.toString(),
            branchId: branch1.id.toString(),
            date: dateStr,
            start: slot,
            status: 'confirmed',
            remarks: `Parallel slot ${slot}`,
          } as never,
          user1.id.toString(),
          adminUser,
        ),
      ),
    );
    const elapsedMs = Date.now() - t0;
    for (const a of multiRes) createdApptIds.push(BigInt(a.id));
    console.log(`[PASS] Unrelated-Slot Parallel Benchmark: 4 slots booked concurrently in ${elapsedMs} ms.`);

    // 4. Outbox Cron Advisory Lock Pass
    const cronRes = await outboxService.runScheduledOutboxPass(10);
    console.log('[PASS] Scheduled Outbox Advisory Lock Pass:', JSON.stringify(cronRes));
  } finally {
    if (createdInvoiceId) {
      await prisma.invoiceItem.deleteMany({ where: { paymentId: createdInvoiceId } });
      await prisma.payment.deleteMany({ where: { id: createdInvoiceId } });
    }
    for (const id of createdApptIds) {
      await prisma.notificationOutbox.deleteMany({
        where: { deduplicationKey: { startsWith: `APT-REM-${id}` } },
      });
      await prisma.appointment.deleteMany({ where: { id } });
    }
    await app.close();
  }
}

run()
  .then(() => {
    console.log('\n[PASS] ALL PHASE 10.6.1 HARDENING & CONCURRENCY CHECKS PASSED!');
  })
  .catch((err) => {
    console.error('[FAIL] Phase 10.6.1 verification error:', err);
    process.exit(1);
  });
