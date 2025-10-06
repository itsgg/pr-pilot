#!/usr/bin/env node

/**
 * Configuration Loading Test Script
 * Tests configuration loading for GitHub Actions
 */

import { loadConfig } from '../agent/lib/config.js';

async function testConfigLoading() {
  try {
    console.log('Testing configuration loading...');
    
    const config = await loadConfig('config/agent.yaml');
    console.log('✅ Configuration loaded successfully');
    console.log('Model:', config.model);
    console.log('Max tokens:', config.max_tokens);
    console.log('Cost cap: $' + config.cost_cap_usd);
    console.log('Max files:', config.max_files);
    
    // Validate essential fields
    if (!config.model) {
      throw new Error('Model is required');
    }
    
    if (!config.max_tokens || config.max_tokens <= 0) {
      throw new Error('Max tokens must be positive');
    }
    
    if (!config.cost_cap_usd || config.cost_cap_usd <= 0) {
      throw new Error('Cost cap must be positive');
    }
    
    console.log('✅ Configuration validation passed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Configuration loading test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testConfigLoading();
