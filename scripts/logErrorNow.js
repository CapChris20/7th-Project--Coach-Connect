#!/usr/bin/env node
require('dotenv').config();
const { logError } = require('../utils/logError');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('📝 Usage: node scripts/logErrorNow.js "Error message" [context] [errorCode]');
  console.log('\nLogs ANY type of error - Firebase, API, UI, network, etc.');
  console.log('\nExamples:');
  console.log('  node scripts/logErrorNow.js "Failed to load nutrition data" "NutritionScreen"');
  console.log('  node scripts/logErrorNow.js "Network request failed" "API" "NETWORK_ERROR"');
  console.log('  node scripts/logErrorNow.js "Component crashed" "HomeScreen"');
  process.exit(0);
}

const errorMessage = args[0];
const context = args[1] || 'Manual Log';

const error = new Error(errorMessage);
error.code = args[2] || null;

logError(error, context)
  .then(() => {
    console.log('✅ Error logged successfully!');
    console.log(`   Check ERRORS.md for details`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Failed to log error:', err);
    process.exit(1);
  });

