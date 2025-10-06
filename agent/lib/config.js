#!/usr/bin/env node

/**
 * Configuration loader and validator for PR-Pilot
 * Loads and validates the agent.yaml configuration file
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { redactSecrets, validateConfigSecurity } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Default configuration values
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4000,
  cost_cap_usd: 0.50,
  max_files: 20,
  context_lines: 60,
  exclude_patterns: [
    '**/*.env',
    '**/*.env.*',
    '**/secrets/**',
    '**/dist/**',
    '**/build/**',
    '**/node_modules/**',
    '**/*.min.js',
    '**/*.min.css',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/.git/**',
    '**/coverage/**',
    '**/*.log',
    '**/tmp/**',
    '**/temp/**'
  ],
  project: {
    name: 'PR-Pilot',
    description: 'AI-powered Pull Request review agent using Claude'
  },
  team_rules: [
    'No hardcoded secrets or API keys',
    'Use async/await, not callbacks',
    'Add JSDoc comments to exported functions',
    'Prefer const over let, never var',
    'Handle errors explicitly with try/catch'
  ],
  comment_format: {
    category_emojis: {
      bug: '🐛',
      style: '💅',
      security: '🔒',
      perf: '⚡',
      test: '🧪'
    },
    min_confidence: 0.6,
    max_comment_length: 2000
  },
  github: {
    timeout: 30,
    retries: 3,
    retry_delay: 1000
  },
  claude: {
    timeout: 60,
    retries: 2,
    retry_delay: 2000,
    temperature: 0.1
  },
  logging: {
    level: 'info',
    timestamps: true,
    redact_secrets: true
  },
  metrics: {
    enabled: true,
    output_file: 'metrics/run.json',
    detailed_timing: true
  }
};

/**
 * Configuration schema for validation
 * @type {Object}
 */
const CONFIG_SCHEMA = {
  model: { type: 'string', required: true },
  max_tokens: { type: 'number', required: true, min: 1, max: 100000 },
  cost_cap_usd: { type: 'number', required: true, min: 0.01, max: 100 },
  max_files: { type: 'number', required: true, min: 1, max: 1000 },
  context_lines: { type: 'number', required: true, min: 0, max: 1000 },
  exclude_patterns: { type: 'array', required: true, items: { type: 'string' } },
  project: {
    type: 'object',
    required: true,
    properties: {
      name: { type: 'string', required: true },
      description: { type: 'string', required: true }
    }
  },
  team_rules: { type: 'array', required: true, items: { type: 'string' } }
};

/**
 * Validates a configuration value against its schema
 * @param {*} value - The value to validate
 * @param {Object} schema - The schema definition
 * @param {string} path - The path to the value (for error messages)
 * @throws {Error} If validation fails
 */
function validateValue(value, schema, path) {
  if (schema.required && (value === undefined || value === null)) {
    throw new Error(`Missing required configuration: ${path}`);
  }

  if (value === undefined || value === null) {
    return; // Optional field
  }

  if (schema.type === 'string' && typeof value !== 'string') {
    throw new Error(`Invalid configuration: ${path} must be a string`);
  }

  if (schema.type === 'number' && typeof value !== 'number') {
    throw new Error(`Invalid configuration: ${path} must be a number`);
  }

  if (schema.type === 'array' && !Array.isArray(value)) {
    throw new Error(`Invalid configuration: ${path} must be an array`);
  }

  if (schema.type === 'object' && typeof value !== 'object') {
    throw new Error(`Invalid configuration: ${path} must be an object`);
  }

  if (schema.type === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      throw new Error(`Invalid configuration: ${path} must be >= ${schema.min}`);
    }
    if (schema.max !== undefined && value > schema.max) {
      throw new Error(`Invalid configuration: ${path} must be <= ${schema.max}`);
    }
  }

  if (schema.type === 'array' && schema.items) {
    value.forEach((item, index) => {
      validateValue(item, schema.items, `${path}[${index}]`);
    });
  }

  if (schema.type === 'object' && schema.properties) {
    Object.entries(schema.properties).forEach(([key, propSchema]) => {
      validateValue(value[key], propSchema, `${path}.${key}`);
    });
  }
}

/**
 * Validates the entire configuration object
 * @param {Object} config - The configuration to validate
 * @throws {Error} If validation fails
 */
function validateConfig(config) {
  Object.entries(CONFIG_SCHEMA).forEach(([key, schema]) => {
    validateValue(config[key], schema, key);
  });
}

/**
 * Merges user configuration with defaults
 * @param {Object} userConfig - User configuration from file
 * @param {Object} defaults - Default configuration
 * @returns {Object} Merged configuration
 */
function mergeConfig(userConfig, defaults) {
  const merged = { ...defaults };

  Object.keys(userConfig).forEach(key => {
    if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
      merged[key] = { ...defaults[key], ...userConfig[key] };
    } else {
      merged[key] = userConfig[key];
    }
  });

  return merged;
}

/**
 * Loads and validates configuration from file
 * @param {string} configPath - Path to configuration file
 * @returns {Object} Validated configuration object
 * @throws {Error} If loading or validation fails
 */
export function loadConfig(configPath = 'config/agent.yaml') {
  try {
    console.log(`[pr-pilot] Loading configuration from: ${configPath}`);

    // Resolve path relative to project root
    const resolvedPath = resolve(process.cwd(), configPath);
    
    // Read and parse YAML file
    const fileContent = readFileSync(resolvedPath, 'utf8');
    const userConfig = yaml.load(fileContent);

    if (!userConfig || typeof userConfig !== 'object') {
      throw new Error('Configuration file is empty or invalid');
    }

    // Merge with defaults
    const config = mergeConfig(userConfig, DEFAULT_CONFIG);

    // Validate configuration
    validateConfig(config);
    
    // Validate configuration for security issues
    validateConfigSecurity(config);

    console.log(`[pr-pilot] Configuration loaded successfully`);
    console.log(`[pr-pilot] Model: ${config.model}`);
    console.log(`[pr-pilot] Max tokens: ${config.max_tokens}`);
    console.log(`[pr-pilot] Cost cap: $${config.cost_cap_usd}`);
    console.log(`[pr-pilot] Max files: ${config.max_files}`);
    console.log(`[pr-pilot] Exclude patterns: ${config.exclude_patterns.length}`);

    return config;

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    if (error.name === 'YAMLException') {
      throw new Error(`Invalid YAML in configuration file: ${error.message}`);
    }

    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Gets configuration with environment variable overrides
 * @param {string} configPath - Path to configuration file
 * @returns {Object} Configuration with environment overrides
 */
export function getConfig(configPath = 'config/agent.yaml') {
  const config = loadConfig(configPath);

  // Apply environment variable overrides
  if (process.env.DRY_RUN) {
    config.dry_run = process.env.DRY_RUN === 'true';
  }

  if (process.env.PR_NUMBER) {
    config.pr_number = parseInt(process.env.PR_NUMBER, 10);
  }

  if (process.env.REPOSITORY) {
    config.repository = process.env.REPOSITORY;
  }

  if (process.env.GITHUB_API_URL) {
    config.github.api_url = process.env.GITHUB_API_URL;
  }

  if (process.env.ANTHROPIC_API_URL) {
    config.claude.api_url = process.env.ANTHROPIC_API_URL;
  }

  return config;
}

/**
 * Validates required environment variables
 * @throws {Error} If required environment variables are missing
 */
export function validateEnvironment() {
  const required = ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('[pr-pilot] Environment variables validated');
}

/**
 * Redacts sensitive information from configuration for logging
 * @param {Object} config - Configuration object
 * @returns {Object} Configuration with sensitive data redacted
 */
export function redactConfig(config) {
  const redacted = { ...config };
  
  // Convert to string and redact secrets
  const configStr = JSON.stringify(redacted);
  const redactedStr = redactSecrets(configStr);
  
  try {
    return JSON.parse(redactedStr);
  } catch (error) {
    // Fallback to manual redaction if JSON parsing fails
    if (redacted.github?.token) {
      redacted.github.token = '***REDACTED***';
    }
    
    if (redacted.claude?.api_key) {
      redacted.claude.api_key = '***REDACTED***';
    }

    return redacted;
  }
}
