#!/usr/bin/env node

/**
 * Unit tests for config.js
 * Tests configuration loading, validation, and error handling
 */

import { describe, it } from 'node:test';
import { loadConfig, getConfig, validateEnvironment, redactConfig } from './config.js';
import assert from 'node:assert';

describe('Config Loader', () => {
  describe('loadConfig', () => {
    it('should load valid configuration successfully', () => {
      const config = loadConfig('config/agent.yaml');
      
      assert.strictEqual(config.model, 'claude-sonnet-4-20250514');
      assert.strictEqual(config.max_tokens, 4000);
      assert.strictEqual(config.cost_cap_usd, 0.50);
      assert.strictEqual(config.max_files, 20);
      assert.strictEqual(config.context_lines, 60);
      assert(Array.isArray(config.exclude_patterns));
      assert.strictEqual(config.project.name, 'PR-Pilot');
      assert.strictEqual(config.project.description, 'AI-powered Pull Request review agent using Claude');
      assert(Array.isArray(config.team_rules));
    });

    it('should merge with defaults for missing optional fields', () => {
      const config = loadConfig('config/agent.yaml');
      
      // Check that defaults are applied
      assert.strictEqual(config.comment_format.category_emojis.bug, '🐛');
      assert.strictEqual(config.github.timeout, 30);
      assert.strictEqual(config.claude.timeout, 60);
      assert.strictEqual(config.logging.level, 'info');
      assert.strictEqual(config.metrics.enabled, true);
    });

    it('should throw error for missing file', () => {
      assert.throws(
        () => loadConfig('nonexistent.yaml'),
        /Configuration file not found/
      );
    });
  });

  describe('getConfig', () => {
    it('should apply environment variable overrides', () => {
      // Set environment variables
      process.env.DRY_RUN = 'true';
      process.env.PR_NUMBER = '123';
      process.env.REPOSITORY = 'owner/repo';

      const config = getConfig('config/agent.yaml');

      assert.strictEqual(config.dry_run, true);
      assert.strictEqual(config.pr_number, 123);
      assert.strictEqual(config.repository, 'owner/repo');

      // Clean up
      delete process.env.DRY_RUN;
      delete process.env.PR_NUMBER;
      delete process.env.REPOSITORY;
    });
  });

  describe('validateEnvironment', () => {
    it('should pass with all required environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';

      assert.doesNotThrow(() => validateEnvironment());

      // Clean up
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GITHUB_TOKEN;
    });

    it('should throw error for missing environment variables', () => {
      const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
      const originalGithubToken = process.env.GITHUB_TOKEN;
      
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GITHUB_TOKEN;

      assert.throws(
        () => validateEnvironment(),
        /Missing required environment variables/
      );

      // Restore
      if (originalAnthropicKey) process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      if (originalGithubToken) process.env.GITHUB_TOKEN = originalGithubToken;
    });
  });

  describe('redactConfig', () => {
    it('should redact sensitive information', () => {
      const config = {
        github: { token: 'secret-token' },
        claude: { api_key: 'secret-key' },
        model: 'claude-sonnet-4-20250514'
      };

      const redacted = redactConfig(config);

      // The new implementation uses string-based redaction
      const redactedStr = JSON.stringify(redacted);
      assert(redactedStr.includes('***REDACTED***'));
      assert(!redactedStr.includes('secret-token'));
      assert(!redactedStr.includes('secret-key'));
      assert(redactedStr.includes('claude-sonnet-4-20250514'));
    });
  });
});
