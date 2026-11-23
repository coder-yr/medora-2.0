import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/medora?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

function validatePasswordComplexity(password: string): boolean {
  if (password.length < 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

async function bootstrapSuperAdmin() {
  const args = parseArgs();

  const email =
    (args.email as string) ||
    process.env.BOOTSTRAP_SUPERADMIN_EMAIL ||
    'superadmin.test@medora.hospital';

  const login =
    (args.login as string) ||
    process.env.BOOTSTRAP_SUPERADMIN_LOGIN ||
    'superadmin_test';

  const name =
    (args.name as string) ||
    process.env.BOOTSTRAP_SUPERADMIN_NAME ||
    'Dr. Evelyn Cross';

  const password =
    (args.password as string) ||
    process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ||
    'ValidPassword123!';

  const force = Boolean(args.force || process.env.BOOTSTRAP_FORCE);

  console.log('----------------------------------------------------');
  console.log('MEDORA 2.0 — Platform Super Administrator Bootstrap');
  console.log('----------------------------------------------------');

  if (!validatePasswordComplexity(password)) {
    console.error(
      '[Security Error] Password does not meet security requirements:\n' +
        '- Minimum 12 characters\n' +
        '- At least one uppercase letter\n' +
        '- At least one lowercase letter\n' +
        '- At least one number\n' +
        '- At least one special symbol',
    );
    process.exit(1);
  }

  try {
    // 1. Check for existing SuperAdmin
    const existingSuperAdmin = await prisma.user.findFirst({
      where: {
        OR: [{ group: 'SuperAdmin' }, { isSuperAdmin: true }],
      },
    });

    if (existingSuperAdmin && !force) {
      console.log(`[Info] Platform Super Administrator already provisioned:`);
      console.log(`       ID:    ${existingSuperAdmin.id}`);
      console.log(`       Login: ${existingSuperAdmin.login}`);
      console.log(`       Email: ${existingSuperAdmin.email}`);
      console.log(`\nTo update this account, run with the --force flag.`);
      return;
    }

    // 2. Hash password with Argon2id
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || 'Admin';

    // 3. Upsert SuperAdmin record
    const superAdmin = await prisma.user.upsert({
      where: { login },
      update: {
        email,
        firstName,
        lastName,
        password: hashedPassword,
        group: 'SuperAdmin',
        isSuperAdmin: true,
        description: 'Exclusive Platform Super Administrator',
      },
      create: {
        login,
        email,
        firstName,
        lastName,
        password: hashedPassword,
        group: 'SuperAdmin',
        isSuperAdmin: true,
        description: 'Exclusive Platform Super Administrator',
      },
    });

    // 4. Record platform security audit log
    await prisma.platformAuditLog.create({
      data: {
        action: 'CREATE',
        targetType: 'USER',
        targetId: String(superAdmin.id),
        actorUserId: superAdmin.id,
        actorEmail: superAdmin.email,
        actorRole: 'SuperAdmin',
        details: {
          event: 'SUPERADMIN_PROVISIONED',
          method: 'CLI_BOOTSTRAP',
          login: superAdmin.login,
          email: superAdmin.email,
        },
      },
    });

    console.log('[Success] Platform Super Administrator provisioned successfully!');
    console.log(`          User ID:       ${superAdmin.id}`);
    console.log(`          Login:         ${superAdmin.login}`);
    console.log(`          Email:         ${superAdmin.email}`);
    console.log(`          Authority:     Exclusive Platform SuperAdmin (isSuperAdmin=true)`);
    console.log(`          Audit Log:     Logged to platform_audit_logs`);
    console.log('----------------------------------------------------');
  } catch (err: any) {
    console.error('[Fatal Error] Failed to bootstrap SuperAdmin:', err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

bootstrapSuperAdmin();
