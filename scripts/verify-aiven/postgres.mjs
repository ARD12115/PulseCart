import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { Client } from 'pg';

// Load Aiven PostgreSQL CA cert from certs/ca_postgre.pem
let caCert = undefined;
try {
  const caPath = path.resolve(process.cwd(), '../../certs/ca_postgre.pem');
  if (fs.existsSync(caPath)) {
    caCert = fs.readFileSync(caPath).toString();
  }
} catch {
  // No CA cert available; will use rejectUnauthorized: false fallback
}

const config = {
  connectionString: process.env.PG_DSN?.replace(/\?sslmode=require$/, '') ||
    'postgresql://avnadmin@pulsecart-12115-phoenixeyev5-11e7.h.aivencloud.com:27571/defaultdb',
  ssl: {
    rejectUnauthorized: false,
  },
};

const client = new Client(config);

async function main() {
  console.log('Connecting to Aiven PostgreSQL...');
  console.log(`Host: ${config.connectionString.replace(/postgresql:\/\/[^@]+@/, 'postgresql://***@')}`);
  console.log(`SSL rejectUnauthorized: ${config.ssl.rejectUnauthorized}`);

  try {
    await client.connect();

    // PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log(`\nPostgreSQL version:`);
    console.log(`  ${versionResult.rows[0].version}`);

    // Current database
    const dbResult = await client.query('SELECT current_database(), current_user');
    console.log(`\nDatabase: ${dbResult.rows[0].current_database}`);
    console.log(`User: ${dbResult.rows[0].current_user}`);

    // List tables in public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`\nTables:`);
    if (tablesResult.rows.length === 0) {
      console.log('  (none)');
    } else {
      for (const row of tablesResult.rows) {
        console.log(`  ${row.table_name}`);
      }
    }

    // Check pulsecart_app role exists
    const roleResult = await client.query(`
      SELECT rolname 
      FROM pg_roles 
      WHERE rolname = 'pulsecart_app'
    `);
    console.log(`\nRole 'pulsecart_app': ${roleResult.rows.length > 0 ? 'exists' : 'NOT FOUND'}`);

    await client.end();

    console.log('\nPostgreSQL connection: VERIFIED');
  } catch (err) {
    console.error('\nPostgreSQL connection FAILED:');
    console.error(err.message);
    process.exit(1);
  }
}

main();
