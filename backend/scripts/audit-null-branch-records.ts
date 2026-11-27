import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaService } from '../src/modules/prisma/prisma.service';

const prisma = new PrismaService();

async function run() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { id: 'asc' },
  });
  const branches = await prisma.hospitalBranch.findMany({
    select: { id: true, organizationId: true, name: true, code: true },
    orderBy: { id: 'asc' },
  });
  console.log('ORGS:', orgs.map((o) => ({ ...o, id: o.id.toString() })));
  console.log('BRANCHES:', branches.map((b) => ({
    ...b,
    id: b.id.toString(),
    organizationId: b.organizationId?.toString() ?? null,
  })));

  // Check provenance: any null-branch appointment/consultation/prescription/lab/payment linked to a patient/doctor/branch in Org 2+?
  const ambiguousAppts = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*)::bigint AS cnt FROM appointment a
     LEFT JOIN patient p ON p.id = a.patient
     LEFT JOIN hospital_branch hb ON hb.id = p.branch_id
     WHERE a.branch_id IS NULL AND hb.organization_id IS NOT NULL AND hb.organization_id <> 1;`,
  );
  const ambiguousPayments = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*)::bigint AS cnt FROM payment pay
     LEFT JOIN patient p ON p.id = pay.patient
     LEFT JOIN hospital_branch hb ON hb.id = p.branch_id
     WHERE (pay.branch_id IS NULL OR pay.organization_id IS NULL)
       AND hb.organization_id IS NOT NULL AND hb.organization_id <> 1;`,
  );
  console.log('Ambiguous non-Org1 appointments:', ambiguousAppts[0].cnt.toString());
  console.log('Ambiguous non-Org1 payments:', ambiguousPayments[0].cnt.toString());
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
