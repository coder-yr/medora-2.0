import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: 'admin.test@medora.hospital', mode: 'insensitive' } },
    include: {
      organizationMemberships: {
        include: { organization: true }
      },
      organization: true
    }
  });
  console.log('USER:', JSON.stringify(user, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, group: true, isSuperAdmin: true, organizationId: true }
  });
  console.log('ALL USERS:', JSON.stringify(allUsers, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
