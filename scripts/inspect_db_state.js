const path = require('path');
const fs = require('fs');

// Load backend/.env
const envPath = path.resolve(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const { PrismaPg } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/adapter-pg'));
const { Pool } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- 1. Organizations & Settings Verification ---');
  const orgs = await prisma.organization.findMany({
    include: {
      settings: true,
      branches: true,
      users: true,
      userMemberships: true,
      hospitalSettings: true,
    },
  });

  console.log(`Found ${orgs.length} organization(s):`);
  orgs.forEach(o => {
    console.log(`- Org #${o.id}: [${o.code}] "${o.name}" (Type: ${o.type}, Status: ${o.status})`);
    console.log(`  Settings: Legal="${o.settings?.legalName}", Currency="${o.settings?.defaultCurrency}", Timezone="${o.settings?.defaultTimezone}"`);
    console.log(`  Branches (${o.branches.length}): ${o.branches.map(b => `${b.code} (#${b.id})`).join(', ')}`);
    console.log(`  Users (${o.users.length}): ${o.users.slice(0, 5).map(u => u.email).join(', ')}...`);
    console.log(`  UserOrganizationMemberships: ${o.userMemberships.length}`);
    console.log(`  HospitalSettings linked: ${o.hospitalSettings.length}`);
  });

  console.log('\n--- 2. Foreign Key & Backfill Integrity ---');
  const branches = await prisma.hospitalBranch.findMany();
  console.log(`All ${branches.length} branches have organizationId:`, branches.every(b => b.organizationId !== null));

  const hospitalSettings = await prisma.hospitalSettings.findMany();
  console.log(`All ${hospitalSettings.length} hospitalSettings have organizationId:`, hospitalSettings.every(s => s.organizationId !== null));

  const users = await prisma.user.findMany();
  console.log(`All ${users.length} users have organizationId:`, users.every(u => u.organizationId !== null));

  const memberships = await prisma.userOrganizationMembership.count();
  console.log(`Total user_organization_memberships created: ${memberships}`);
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
