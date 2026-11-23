const path = require('path');
require(path.join(__dirname, '../node_modules/dotenv')).config({ path: path.join(__dirname, '../.env') });
const { Pool } = require(path.join(__dirname, '../node_modules/pg'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('Checking current columns for users table...');
    const before = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name LIKE '%mfa%';
    `);
    console.log('Before:', before.rows);

    console.log('Applying migration...');
    await client.query(`
      ALTER TABLE "users" ALTER COLUMN "mfa_secret" TYPE VARCHAR(255);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_recovery_codes" JSONB DEFAULT '[]'::jsonb;
    `);

    const after = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name LIKE '%mfa%';
    `);
    console.log('After:', after.rows);
    console.log('Migration successfully applied!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
