import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaService } from '../src/modules/prisma/prisma.service';

const prisma = new PrismaService();

async function run() {
  const apply = process.argv.includes('--apply');
  console.log('========================================================================');
  console.log(`  MEDORA 2.0 — LEGACY ORG/BRANCH PROVENANCE BACKFILL (${apply ? 'APPLY' : 'DRY-RUN'})`);
  console.log('========================================================================\n');

  const ambiguousPayments = await prisma.$queryRawUnsafe<Array<{ id: bigint; patient: bigint; org_id: bigint | null }>>(
    `SELECT pay.id, pay.patient, hb.organization_id AS org_id
     FROM payment pay
     JOIN patient p ON p.id = pay.patient
     JOIN hospital_branch hb ON hb.id = p.branch_id
     WHERE (pay.branch_id IS NULL OR pay.organization_id IS NULL)
       AND hb.organization_id IS NOT NULL AND hb.organization_id <> 1;`,
  );
  console.log(`Ambiguous non-Org1 payments (will be routed to their patient's actual org/branch): ${ambiguousPayments.length}`);

  if (!apply) {
    console.log('Dry-run complete. Re-run with --apply to execute transactional provenance backfill.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. medicine_batch.organization_id from hospital_branch
    const mbRes = await tx.$executeRawUnsafe(
      `UPDATE medicine_batch mb
       SET organization_id = hb.organization_id
       FROM hospital_branch hb
       WHERE mb.branch_id = hb.id AND mb.organization_id IS NULL AND hb.organization_id IS NOT NULL;`,
    );

    // 2. patient & doctor legacy rows without branch -> Branch 1 (Org 1 Main Campus)
    const patRes = await tx.$executeRawUnsafe(
      `UPDATE patient SET branch_id = 1 WHERE branch_id IS NULL;`,
    );
    const docRes = await tx.$executeRawUnsafe(
      `UPDATE doctor SET branch_id = 1 WHERE branch_id IS NULL;`,
    );

    // 3. appointment.branch_id from patient.branch_id or doctor.branch_id
    const aptRes = await tx.$executeRawUnsafe(
      `UPDATE appointment a
       SET branch_id = COALESCE(p.branch_id, d.branch_id, 1)
       FROM patient p, doctor d
       WHERE a.patient = p.id AND a.doctor = d.id AND a.branch_id IS NULL;`,
    );

    // 4. consultation.branch_id from appointment.branch_id or patient.branch_id
    const conRes = await tx.$executeRawUnsafe(
      `UPDATE consultation c
       SET branch_id = COALESCE(
         (SELECT a.branch_id FROM appointment a WHERE a.id = c.appointment_id),
         (SELECT p.branch_id FROM patient p WHERE p.id = c.patient_id),
         1
       )
       WHERE c.branch_id IS NULL;`,
    );

    // 5. prescription.branch_id & organization_id from consultation/patient -> hospital_branch
    const rxRes = await tx.$executeRawUnsafe(
      `UPDATE prescription rx
       SET branch_id = COALESCE(
         (SELECT c.branch_id FROM consultation c WHERE c.id = rx.consultation_id),
         (SELECT p.branch_id FROM patient p WHERE p.id = rx.patient),
         1
       )
       WHERE rx.branch_id IS NULL;`,
    );
    await tx.$executeRawUnsafe(
      `UPDATE prescription rx
       SET organization_id = hb.organization_id
       FROM hospital_branch hb
       WHERE rx.branch_id = hb.id AND rx.organization_id IS NULL AND hb.organization_id IS NOT NULL;`,
    );

    // 6. lab.branch_id & organization_id from appointment/patient -> hospital_branch
    const labRes = await tx.$executeRawUnsafe(
      `UPDATE lab l
       SET branch_id = COALESCE(
         (SELECT a.branch_id FROM appointment a WHERE a.id = l.appointment_id),
         (SELECT p.branch_id FROM patient p WHERE p.id = l.patient),
         1
       )
       WHERE l.branch_id IS NULL;`,
    );
    await tx.$executeRawUnsafe(
      `UPDATE lab l
       SET organization_id = hb.organization_id
       FROM hospital_branch hb
       WHERE l.branch_id = hb.id AND l.organization_id IS NULL AND hb.organization_id IS NOT NULL;`,
    );

    // 7. payment.branch_id & organization_id from patient.branch_id -> hospital_branch
    const payRes = await tx.$executeRawUnsafe(
      `UPDATE payment pay
       SET branch_id = COALESCE(pay.branch_id, p.branch_id, 1)
       FROM patient p
       WHERE pay.patient = p.id AND pay.branch_id IS NULL;`,
    );
    await tx.$executeRawUnsafe(
      `UPDATE payment pay
       SET organization_id = hb.organization_id
       FROM hospital_branch hb
       WHERE pay.branch_id = hb.id AND pay.organization_id IS NULL AND hb.organization_id IS NOT NULL;`,
    );

    // 8. invoice_payment.branch_id & organization_id from parent payment
    const ipRes = await tx.$executeRawUnsafe(
      `UPDATE invoice_payment ip
       SET branch_id = COALESCE(ip.branch_id, pay.branch_id),
           organization_id = COALESCE(ip.organization_id, pay.organization_id)
       FROM payment pay
       WHERE ip.payment_id = pay.id AND (ip.branch_id IS NULL OR ip.organization_id IS NULL);`,
    );

    console.log('Backfill updated row counts:', {
      medicine_batch: mbRes,
      patient: patRes,
      doctor: docRes,
      appointment: aptRes,
      consultation: conRes,
      prescription: rxRes,
      lab: labRes,
      payment: payRes,
      invoice_payment: ipRes,
    });
  });

  // Post-migration verification
  const remaining = await prisma.$queryRawUnsafe<Array<{ tbl: string; nulls: bigint }>>(
    `SELECT 'patient' AS tbl, COUNT(*)::bigint AS nulls FROM patient WHERE branch_id IS NULL
     UNION ALL SELECT 'doctor', COUNT(*)::bigint FROM doctor WHERE branch_id IS NULL
     UNION ALL SELECT 'appointment', COUNT(*)::bigint FROM appointment WHERE branch_id IS NULL
     UNION ALL SELECT 'consultation', COUNT(*)::bigint FROM consultation WHERE branch_id IS NULL
     UNION ALL SELECT 'prescription', COUNT(*)::bigint FROM prescription WHERE branch_id IS NULL OR organization_id IS NULL
     UNION ALL SELECT 'lab', COUNT(*)::bigint FROM lab WHERE branch_id IS NULL OR organization_id IS NULL
     UNION ALL SELECT 'payment', COUNT(*)::bigint FROM payment WHERE branch_id IS NULL OR organization_id IS NULL
     UNION ALL SELECT 'invoice_payment', COUNT(*)::bigint FROM invoice_payment WHERE branch_id IS NULL OR organization_id IS NULL
     UNION ALL SELECT 'medicine_batch', COUNT(*)::bigint FROM medicine_batch WHERE branch_id IS NULL OR organization_id IS NULL;`,
  );
  console.log('\nPost-backfill remaining NULLs:');
  for (const r of remaining) {
    console.log(`  ${r.tbl.padEnd(18)}: ${r.nulls}`);
  }
}

run()
  .catch((e) => {
    console.error('[FAIL] Backfill error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
