import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { Kafka, logLevel } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'pulsecart-verify',
  logLevel: logLevel.ERROR,
  brokers: [
    process.env.KAFKA_BOOTSTRAP ||
      'pulsecart-kafka-12115-phoenixeyev5-11e7.j.aivencloud.com:27584',
  ],
  ssl: {
    rejectUnauthorized: false,
  },
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
    username: process.env.KAFKA_SASL_USERNAME || 'avnadmin',
    password: process.env.KAFKA_SASL_PASSWORD || '',
  },
  connectionTimeout: 10000,
  requestTimeout: 10000,
  retry: {
    initialRetryTime: 100,
    retries: 2,
  },
});

const admin = kafka.admin();

async function main() {
  console.log('Connecting to Aiven Kafka...');
  console.log(`Bootstrap: ${process.env.KAFKA_BOOTSTRAP || 'pulsecart-kafka-12115-phoenixeyev5-11e7.j.aivencloud.com:27584'}`);
  console.log(`SASL mechanism: ${process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256'}`);
  console.log(`SASL username: ${process.env.KAFKA_SASL_USERNAME || 'avnadmin'}`);

  try {
    await admin.connect();

    // Fetch cluster metadata
    const metadata = await admin.fetchTopicMetadata();
    console.log('\nCluster metadata:');
    console.log(`  Topics: ${metadata.topicMetadata?.length ?? 0}`);

    if (metadata.topicMetadata?.length > 0) {
      for (const topic of metadata.topicMetadata) {
        console.log(`    ${topic.name} (${topic.partitionMetadata?.length ?? 0} partitions)`);
      }
    } else {
      console.log('    (no topics yet)');
    }

    await admin.disconnect();

    console.log('\nKafka connection: VERIFIED');
  } catch (err) {
    console.error('\nKafka connection FAILED:');
    console.error(err.message);
    process.exit(1);
  }
}

main();
