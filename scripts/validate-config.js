#!/usr/bin/env node

/**
 * Configuration Validation Script
 * Validates PR-Pilot configuration for GitHub Actions
 */

import { loadConfig } from '../agent/lib/config.js';

async function validateConfiguration() {
  try {
    console.log('Validating configuration...');
    
    const config = await loadConfig('config/agent.yaml');
    
    console.log('✅ Configuration is valid');
    console.log('Model:', config.model);
    console.log('Max tokens:', config.max_tokens);
    console.log('Cost cap: $' + config.cost_cap_usd);
    console.log('Max files:', config.max_files);
    console.log('Exclude patterns:', config.exclude_patterns.length);
    
    // Validate required fields
    const requiredFields = ['model', 'max_tokens', 'cost_cap_usd', 'max_files'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
    
    // Validate model
    if (!config.model || typeof config.model !== 'string') {
      throw new Error('Model must be a non-empty string');
    }
    
    // Validate max_tokens
    if (!Number.isInteger(config.max_tokens) || config.max_tokens <= 0) {
      throw new Error('Max tokens must be a positive integer');
    }
    
    // Validate cost_cap_usd
    if (typeof config.cost_cap_usd !== 'number' || config.cost_cap_usd <= 0) {
      throw new Error('Cost cap must be a positive number');
    }
    
    // Validate max_files
    if (!Number.isInteger(config.max_files) || config.max_files <= 0) {
      throw new Error('Max files must be a positive integer');
    }
    
    // Validate exclude_patterns
    if (!Array.isArray(config.exclude_patterns)) {
      throw new Error('Exclude patterns must be an array');
    }
    
    console.log('✅ All configuration validations passed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    process.exit(1);
  }
}

// Run validation
validateConfiguration();
