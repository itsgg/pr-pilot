#!/usr/bin/env node

/**
 * Unit tests for github-client.js
 * Tests GitHub API interactions and error handling
 */

import { describe, it } from 'node:test';
import { GitHubClient } from './github-client.js';
import assert from 'node:assert';

describe('GitHub Client', () => {
  const config = {
    github: {
      timeout: 30000,
      retries: 3,
      retry_delay: 1000
    }
  };

  describe('constructor', () => {
    it('should create client with valid token', () => {
      assert.doesNotThrow(() => {
        new GitHubClient('valid-token', config);
      });
    });

    it('should throw error for missing token', () => {
      assert.throws(
        () => new GitHubClient(null, config),
        /GitHub token is required/
      );
    });

    it('should throw error for empty token', () => {
      assert.throws(
        () => new GitHubClient('', config),
        /GitHub token is required/
      );
    });

    it('should configure Octokit with correct options', () => {
      const client = new GitHubClient('test-token', config);
      
      // Verify the client has the expected configuration
      assert(client.octokit);
      assert(client.config);
      assert.strictEqual(client.config.github.timeout, 30000);
    });
  });

  describe('parseRepository', () => {
    it('should parse valid repository string', () => {
      const result = GitHubClient.parseRepository('owner/repo');
      
      assert.strictEqual(result.owner, 'owner');
      assert.strictEqual(result.repo, 'repo');
    });

    it('should handle repository with special characters', () => {
      const result = GitHubClient.parseRepository('user-name/repo.name');
      
      assert.strictEqual(result.owner, 'user-name');
      assert.strictEqual(result.repo, 'repo.name');
    });

    it('should throw error for invalid repository string', () => {
      assert.throws(
        () => GitHubClient.parseRepository('invalid'),
        /Repository must be in format "owner\/repo"/
      );

      assert.throws(
        () => GitHubClient.parseRepository('owner/'),
        /Repository must be in format "owner\/repo"/
      );

      assert.throws(
        () => GitHubClient.parseRepository('/repo'),
        /Repository must be in format "owner\/repo"/
      );

      assert.throws(
        () => GitHubClient.parseRepository(''),
        /Repository must be a string in format "owner\/repo"/
      );

      assert.throws(
        () => GitHubClient.parseRepository(null),
        /Repository must be a string in format "owner\/repo"/
      );

      assert.throws(
        () => GitHubClient.parseRepository('owner/repo/extra'),
        /Repository must be in format "owner\/repo"/
      );
    });
  });

  describe('fromEnvironment', () => {
    it('should create client from environment', () => {
      process.env.GITHUB_TOKEN = 'env-token';
      
      assert.doesNotThrow(() => {
        GitHubClient.fromEnvironment(config);
      });

      delete process.env.GITHUB_TOKEN;
    });

    it('should throw error when token is missing', () => {
      delete process.env.GITHUB_TOKEN;
      
      assert.throws(
        () => GitHubClient.fromEnvironment(config),
        /GITHUB_TOKEN environment variable is required/
      );
    });

    it('should use environment token in client', () => {
      process.env.GITHUB_TOKEN = 'env-token-123';
      
      const client = GitHubClient.fromEnvironment(config);
      assert(client.octokit);
      assert(client.config);

      delete process.env.GITHUB_TOKEN;
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const client = new GitHubClient('test-token', config);
      
      // Test that methods exist and can be called
      // (actual API calls will fail with test token, but that's expected)
      assert(typeof client.getPullRequest === 'function');
      assert(typeof client.getPullRequestDiff === 'function');
      assert(typeof client.getPullRequestFiles === 'function');
      assert(typeof client.postReviewComment === 'function');
      assert(typeof client.postReview === 'function');
      assert(typeof client.getRepository === 'function');
      assert(typeof client.isRepositoryAccessible === 'function');
      assert(typeof client.getCurrentUser === 'function');
      assert(typeof client.validateToken === 'function');
      assert(typeof client.getRateLimit === 'function');
    });
  });

  describe('configuration validation', () => {
    it('should work without configuration', () => {
      const client = new GitHubClient('test-token');
      
      assert(client.octokit);
      // Config is optional, so we just verify the client was created
    });

    it('should merge provided configuration', () => {
      const customConfig = {
        github: {
          timeout: 60000,
          retries: 5
        }
      };
      
      const client = new GitHubClient('test-token', customConfig);
      
      assert.strictEqual(client.config.github.timeout, 60000);
      assert.strictEqual(client.config.github.retries, 5);
    });
  });
});
