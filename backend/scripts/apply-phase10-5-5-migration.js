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
    const migrationName = '20261124170000_phase_10_5_5_laboratory_integration';
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

    console.log('Verifying created columns on lab...');
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lab' AND column_name IN ('organization_id', 'branch_id')
    `);
    console.log('Columns added to lab:', cols.rows);

    const catCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lab_category' AND column_name IN ('code', 'department', 'specimen_type', 'critical_low', 'critical_high')
    `);
    console.log('Columns added to lab_category:', catCols.rows);

    const sampleCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lab_sample' AND column_name IN ('collector_location', 'condition', 'is_recollection', 'recollected_from_id')
    `);
    console.log('Columns added to lab_sample:', sampleCols.rows);

    console.log('Phase 10.5.5 migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
