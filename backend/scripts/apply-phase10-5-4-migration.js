const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require(path.join(__dirname, '../node_modules/dotenv')).config({ path: path.join(__dirname, '../.env') });
const { Pool } = require(path.join(__dirname, '../node_modules/pg'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    const migrationName = '20261124100000_phase_10_5_4_prescription_management';
    const migrationSqlPath = path.join(
      __dirname,
      '../prisma/migrations',
      migrationName,
      'migration.sql'
    );
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');

    console.log(`Applying migration ${migrationName}...`);
    await client.query(sql);

    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    const checkMigration = await client.query(
      'SELECT id FROM _prisma_migrations WHERE migration_name = $1',
      [migrationName]
    );

    if (checkMigration.rows.length === 0) {
      await client.query(
        `INSERT INTO _prisma_migrations (
          id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
        ) VALUES (
          $1, $2, NOW(), $3, NULL, NULL, NOW(), 1
        )`,
        [crypto.randomUUID(), checksum, migrationName]
      );
      console.log(`Recorded ${migrationName} in _prisma_migrations`);
    } else {
      console.log(`${migrationName} already recorded in _prisma_migrations`);
    }

    console.log('Verifying created columns on prescription...');
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prescription' 
        AND column_name IN (
          'prescription_number', 'consultation_id', 'organization_id', 'branch_id',
          'status', 'signed_at', 'signed_by_id', 'cancelled_at', 'cancelled_by_id',
          'cancellation_reason'
        )
      ORDER BY column_name;
    `);
    console.log('Columns added to prescription:', cols.rows);

    const medCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prescription_medicine' 
        AND column_name IN (
          'quantity_prescribed', 'unit', 'route', 'frequency', 'timing', 'refills',
          'start_date', 'end_date'
        )
      ORDER BY column_name;
    `);
    console.log('Columns added to prescription_medicine:', medCols.rows);

    const amendmentTable = await client.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'prescription_amendment';
    `);
    console.log('Prescription amendment table:', amendmentTable.rows);

    console.log('Phase 10.5.4 migration applied successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
