/**
 * Run All Test Suites
 * 
 * Runs all test cases to verify system is working correctly before diagnosing issues
 * 
 * Usage: npx ts-node -r dotenv/config src/scripts/runAllTests.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_SUITES = [
  { name: 'Carry Forward Flush', command: 'npm run test:carry-forward' },
  { name: 'Carry Forward API', command: 'npm run test:carry-forward-api' },
  { name: 'Binary Bonus Flow', command: 'npm run test:binary-bonus' },
  { name: 'Binary Bonus Scenarios', command: 'npm run test:binary-scenarios' },
  { name: 'Voucher API', command: 'npm run test:voucher-api' },
  { name: 'Voucher Minimum Amount', command: 'npx ts-node -r dotenv/config src/scripts/testVoucherMinimumAmount.ts' },
];

const results: Array<{ name: string; passed: boolean; output: string }> = [];

console.log('='.repeat(80));
console.log('🧪 RUNNING ALL TEST SUITES');
console.log('='.repeat(80));
console.log();

TEST_SUITES.forEach((suite, index) => {
  console.log(`\n[${index + 1}/${TEST_SUITES.length}] Running: ${suite.name}`);
  console.log('-'.repeat(80));
  
  try {
    const output = execSync(suite.command, { 
      cwd: __dirname + '/../..',
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    // Check if output contains success indicators
    const passed = output.includes('✅') || output.includes('PASS') || 
                   (!output.includes('❌') && !output.includes('FAIL') && output.includes('Test'));
    
    results.push({ name: suite.name, passed, output });
    
    console.log(output);
    console.log(`\n${passed ? '✅' : '❌'} ${suite.name}: ${passed ? 'PASSED' : 'FAILED'}`);
  } catch (error: any) {
    const output = error.stdout?.toString() || error.message || '';
    results.push({ name: suite.name, passed: false, output });
    console.log(output);
    console.log(`\n❌ ${suite.name}: FAILED (Error occurred)`);
  }
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(80));

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`Total Test Suites: ${results.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(2)}%`);

if (failed > 0) {
  console.log('\n❌ Failed Test Suites:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}`);
  });
}

console.log('\n' + '='.repeat(80));

// Save results to file
const logFile = path.join(__dirname, '../../test-results-all.log');
fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
console.log(`\n📄 Full results saved to: ${logFile}`);

process.exit(failed > 0 ? 1 : 0);
