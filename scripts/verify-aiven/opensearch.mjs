import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import OpenSearch from '@opensearch-project/opensearch';

const { Client } = OpenSearch;

// Aiven OpenSearch configuration from environment variables
const config = {
  node: process.env.OPENSEARCH_URL || 'https://pulsecart-os-12115-phoenixeyev5-11e7.d.aivencloud.com:27571',
  auth: process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD
    ? {
        username: process.env.OPENSEARCH_USERNAME,
        password: process.env.OPENSEARCH_PASSWORD,
      }
    : undefined,
  ssl: {
    rejectUnauthorized: process.env.OPENSEARCH_VERIFY_CERTS !== 'false',
  },
  requestTimeout: 10000,
};

const client = new Client(config);

async function main() {
  console.log('Connecting to Aiven OpenSearch...');
  console.log(`URL: ${config.node}`);
  console.log(`Verify certs: ${config.ssl.rejectUnauthorized}`);

  try {
    // Cluster health check
    const health = await client.cluster.health();
    console.log('\nCluster health:');
    console.log(`  Status: ${health.body.status}`);
    console.log(`  Cluster name: ${health.body.cluster_name}`);
    console.log(`  Nodes: ${health.body.number_of_nodes}`);
    console.log(`  Data nodes: ${health.body.number_of_data_nodes}`);

    // List indices
    try {
      const indices = await client.cat.indices({ format: 'json' });
      console.log('\nIndices:');
      if (indices.body.length === 0) {
        console.log('  (none)');
      } else {
        for (const idx of indices.body) {
          const count = idx && idx.docs ? idx.docs.count : '?';
          console.log(`  ${idx.index} - ${count} docs`);
        }
      }
    } catch (idxErr) {
      console.log('\nIndices: (could not list)');
    }

    // Ping
    const ping = await client.ping();
    console.log(`\nPing: ${ping ? 'OK' : 'FAILED'}`);

    console.log('\nOpenSearch connection: VERIFIED');
  } catch (err) {
    console.error('\nOpenSearch connection FAILED:');
    console.error(err.message);
    process.exit(1);
  }
}

main();
