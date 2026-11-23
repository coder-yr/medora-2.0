import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/medora?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      login: true,
      email: true,
      firstName: true,
      lastName: true,
      group: true,
      isSuperAdmin: true,
      organizationId: true,
    },
    orderBy: { id: 'asc' },
    take: 50
  });
  console.log('ALL USERS IN DB:');
  console.table(users.map(u => ({
    id: u.id.toString(),
    login: u.login,
    email: u.email,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
    group: u.group,
    isSuperAdmin: u.isSuperAdmin,
    orgId: u.organizationId ? u.organizationId.toString() : null
  })));
}

main().catch(console.error).finally(() => pool.end());
