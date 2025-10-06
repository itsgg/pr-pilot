#!/usr/bin/env node

/**
 * Performance Test Script
 * Tests PR-Pilot performance for GitHub Actions
 */

import { PRReviewer } from '../agent/reviewer.js';

async function runPerformanceTest() {
  try {
    console.log('Running performance test...');
    
    const startTime = Date.now();
    
    // Test PRReviewer instantiation
    const reviewer = new PRReviewer({ dryRun: true });
    console.log('✅ PRReviewer instantiated successfully');
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Performance test completed in ${duration}ms`);
    
    // Basic performance check
    if (duration > 5000) {
      console.warn('⚠️  Performance test took longer than expected');
      process.exit(1);
    }
    
    console.log('✅ Performance test passed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runPerformanceTest();
