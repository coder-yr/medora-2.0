const path = require('path');
const fs = require('fs');
require(path.join(__dirname, '../node_modules/dotenv')).config({ path: path.join(__dirname, '../.env') });
const { Pool } = require(path.join(__dirname, '../node_modules/pg'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    const migrationSqlPath = path.join(__dirname, '../prisma/migrations/20261122230000_phase_10_3_organization_registration_provisioning/migration.sql');
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');

    console.log('Applying Phase 10.3 migration...');
    await client.query(sql);

    console.log('Verifying created tables...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('organization_registrations', 'organization_onboardings')
      ORDER BY table_name;
    `);
    console.log('Created tables:', tables.rows);

    const enumCheck = await client.query(`
      SELECT typname FROM pg_type WHERE typname = 'registration_status';
    `);
    console.log('Created enum:', enumCheck.rows);

    console.log('Phase 10.3 migration applied successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
