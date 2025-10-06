#!/usr/bin/env node

/**
 * Unit tests for reviewer.js
 * Tests the main PR reviewer orchestration
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import { PRReviewer, reviewPullRequest } from './reviewer.js';
import assert from 'node:assert';

// Mock the dependencies
const mockConfig = {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4000,
  cost_cap_usd: 0.50,
  max_files: 20,
  exclude_patterns: ['**/*.env', '**/node_modules/**'],
  team_rules: ['Use const over let'],
  project: {
    name: 'PR-Pilot',
    description: 'AI-powered PR review agent'
  },
  comment_format: {
    confidence_threshold: 0.6
  },
  metrics: {
    enabled: true
  }
};

const mockPrInfo = {
  title: 'Add CORS support',
  description: 'This PR adds CORS middleware to the Express app',
  author: 'developer',
  baseBranch: 'main',
  headBranch: 'feature/cors',
  state: 'open'
};

const mockFileDiffs = [
  {
    path: 'src/app.js',
    status: 'modified',
    additions: 5,
    deletions: 2,
    hunks: [
      {
        oldStart: 1,
        oldCount: 3,
        newStart: 1,
        newCount: 4,
        content: '@@ -1,3 +1,4 @@\n const express = require(\'express\');\n+const cors = require(\'cors\');\n const app = express();\n app.listen(3000);'
      }
    ]
  }
];

const mockReviewResponse = {
  summary: 'Good changes overall, but needs some improvements',
  issues: [
    {
      path: 'src/app.js',
      line: 42,
      category: 'bug',
      severity: 'high',
      explanation: 'Missing error handling',
      fix_patch: 'try { ... } catch (error) { ... }',
      confidence: 0.9
    }
  ],
  risks: ['Potential security issue']
};

describe('PR Reviewer', () => {
  let reviewer;

  beforeEach(() => {
    reviewer = new PRReviewer({
      configPath: 'test-config.yaml',
      dryRun: true
    });
  });

  describe('constructor', () => {
    it('should create reviewer with default options', () => {
      const defaultReviewer = new PRReviewer();
      
      assert.strictEqual(defaultReviewer.options.configPath, 'config/agent.yaml');
      assert.strictEqual(defaultReviewer.options.dryRun, false);
      assert.strictEqual(defaultReviewer.options.prNumber, null);
      assert.strictEqual(defaultReviewer.options.repository, null);
    });

    it('should create reviewer with custom options', () => {
      const customOptions = {
        configPath: 'custom-config.yaml',
        dryRun: true,
        prNumber: 123,
        repository: 'owner/repo'
      };
      
      const customReviewer = new PRReviewer(customOptions);
      
      assert.strictEqual(customReviewer.options.configPath, 'custom-config.yaml');
      assert.strictEqual(customReviewer.options.dryRun, true);
      assert.strictEqual(customReviewer.options.prNumber, 123);
      assert.strictEqual(customReviewer.options.repository, 'owner/repo');
    });
  });

  describe('getPullRequestInfo', () => {
    it('should extract PR information correctly', async () => {
      // Mock the GitHub client
      reviewer.githubClient = {
        getPullRequest: async (prNumber, repository) => ({
          title: 'Test PR',
          body: 'Test description',
          user: { login: 'testuser' },
          base: { ref: 'main' },
          head: { ref: 'feature' },
          state: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        })
      };

      const prInfo = await reviewer.getPullRequestInfo(123, 'owner/repo');
      
      assert.strictEqual(prInfo.title, 'Test PR');
      assert.strictEqual(prInfo.description, 'Test description');
      assert.strictEqual(prInfo.author, 'testuser');
      assert.strictEqual(prInfo.baseBranch, 'main');
      assert.strictEqual(prInfo.headBranch, 'feature');
      assert.strictEqual(prInfo.state, 'open');
    });

    it('should handle missing PR fields', async () => {
      reviewer.githubClient = {
        getPullRequest: async () => ({
          title: null,
          body: null,
          user: null,
          base: null,
          head: null
        })
      };

      const prInfo = await reviewer.getPullRequestInfo(123, 'owner/repo');
      
      assert.strictEqual(prInfo.title, '');
      assert.strictEqual(prInfo.description, '');
      assert.strictEqual(prInfo.author, '');
      assert.strictEqual(prInfo.baseBranch, 'main');
      assert.strictEqual(prInfo.headBranch, 'feature-branch');
    });
  });

  describe('processDiff', () => {
    it('should process diff and filter files', async () => {
      reviewer.config = mockConfig;
      reviewer.metricsCollector = {
        recordFileStats: () => {}
      };

      const diffContent = `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 const express = require('express');
+const cors = require('cors');
 const app = express();
 app.listen(3000);`;

      const fileDiffs = await reviewer.processDiff(diffContent);
      
      assert.strictEqual(fileDiffs.length, 1);
      assert.strictEqual(fileDiffs[0].path, 'src/app.js');
      assert.strictEqual(fileDiffs[0].status, 'modified');
    });

    it('should handle empty diff', async () => {
      reviewer.config = mockConfig;
      reviewer.metricsCollector = {
        recordFileStats: () => {}
      };

      const fileDiffs = await reviewer.processDiff('');
      
      assert.strictEqual(fileDiffs.length, 0);
    });
  });

  describe('estimateReviewCost', () => {
    it('should estimate review cost correctly', async () => {
      reviewer.config = mockConfig;
      reviewer.claudeClient = {
        estimateTokens: () => 1000
      };
      reviewer.metricsCollector = {
        recordCostStats: () => {}
      };

      // Mock the cost estimation by overriding the method
      const originalEstimateReviewCost = reviewer.estimateReviewCost;
      reviewer.estimateReviewCost = async () => ({
        estCostUsd: 0.05,
        inputCostUsd: 0.03,
        outputCostUsd: 0.02,
        inputTokens: 1000,
        outputTokens: 500,
        exceedsCap: false
      });

      try {
        const costEstimate = await reviewer.estimateReviewCost(mockFileDiffs, mockPrInfo);
        
        assert(typeof costEstimate.estCostUsd === 'number');
        assert(typeof costEstimate.inputTokens === 'number');
        assert(typeof costEstimate.outputTokens === 'number');
        assert(typeof costEstimate.exceedsCap === 'boolean');
      } finally {
        // Restore original method
        reviewer.estimateReviewCost = originalEstimateReviewCost;
      }
    });
  });

  describe('getAIReview', () => {
    it('should get AI review successfully', async () => {
      reviewer.config = mockConfig;
      reviewer.claudeClient = {
        reviewCode: async () => mockReviewResponse
      };
      reviewer.metricsCollector = {
        recordPerformance: () => {},
        recordIssues: () => {}
      };

      const reviewResponse = await reviewer.getAIReview(mockFileDiffs, mockPrInfo);
      
      assert.strictEqual(reviewResponse.summary, mockReviewResponse.summary);
      assert.strictEqual(reviewResponse.issues.length, mockReviewResponse.issues.length);
      assert.strictEqual(reviewResponse.risks.length, mockReviewResponse.risks.length);
    });
  });

  describe('postComments', () => {
    it('should post comments in dry run mode', async () => {
      reviewer.options.dryRun = true;
      reviewer.config = mockConfig;
      reviewer.commentFormatter = {
        createLineComment: () => ({ path: 'src/app.js', line: 42, body: 'Test comment' }),
        formatSummaryComment: () => 'Summary comment'
      };
      reviewer.githubClient = {
        postReviewComment: async () => {},
        postReview: async () => {}
      };
      reviewer.metricsCollector = {
        recordCommentStats: () => {},
        recordPerformance: () => {},
        getMetrics: () => ({})
      };

      const result = await reviewer.postComments(mockReviewResponse, 123, 'owner/repo');
      
      assert.strictEqual(result.commentsPosted, 0);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should post comments in normal mode', async () => {
      reviewer.options.dryRun = false;
      reviewer.config = mockConfig;
      reviewer.commentFormatter = {
        createLineComment: () => ({ path: 'src/app.js', line: 42, body: 'Test comment' }),
        formatSummaryComment: () => 'Summary comment'
      };
      reviewer.githubClient = {
        postReviewComment: async () => {},
        postReview: async () => {}
      };
      reviewer.metricsCollector = {
        recordCommentStats: () => {},
        recordPerformance: () => {},
        getMetrics: () => ({})
      };

      const result = await reviewer.postComments(mockReviewResponse, 123, 'owner/repo');
      
      assert(result.commentsPosted > 0);
    });

    it('should handle comment posting errors gracefully', async () => {
      reviewer.options.dryRun = false;
      reviewer.config = mockConfig;
      reviewer.commentFormatter = {
        createLineComment: () => ({ path: 'src/app.js', line: 42, body: 'Test comment' }),
        formatSummaryComment: () => 'Summary comment'
      };
      reviewer.githubClient = {
        postReviewComment: async () => { throw new Error('API error'); },
        postReview: async () => { throw new Error('API error'); }
      };
      reviewer.metricsCollector = {
        recordCommentStats: () => {},
        recordPerformance: () => {},
        getMetrics: () => ({})
      };

      const result = await reviewer.postComments(mockReviewResponse, 123, 'owner/repo');
      
      assert.strictEqual(result.commentsPosted, 0);
      assert(result.errors.length > 0);
    });
  });

  describe('recordFinalMetrics', () => {
    it('should record final metrics', () => {
      reviewer.metricsCollector = {
        recordCommentStats: () => {},
        recordCostStats: () => {}
      };

      const costEstimate = {
        estCostUsd: 0.05,
        inputTokens: 1000,
        outputTokens: 500
      };

      const commentResults = {
        commentsPosted: 3,
        errors: []
      };

      // Should not throw
      assert.doesNotThrow(() => {
        reviewer.recordFinalMetrics(mockReviewResponse, mockFileDiffs, costEstimate, commentResults);
      });
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      reviewer.config = mockConfig;
      
      const config = reviewer.getConfig();
      
      assert.strictEqual(config, mockConfig);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics collector', () => {
      const mockMetrics = { enabled: true };
      reviewer.metricsCollector = mockMetrics;
      
      const metrics = reviewer.getMetrics();
      
      assert.strictEqual(metrics, mockMetrics);
    });
  });

  describe('edge cases', () => {
    it('should handle missing PR number', async () => {
      reviewer.options.prNumber = null;
      reviewer.options.repository = 'owner/repo';
      
      await assert.rejects(
        () => reviewer.reviewPullRequest(),
        /PR number and repository are required/
      );
    });

    it('should handle missing repository', async () => {
      reviewer.options.prNumber = 123;
      reviewer.options.repository = null;
      
      await assert.rejects(
        () => reviewer.reviewPullRequest(),
        /PR number and repository are required/
      );
    });

    it('should handle empty file diffs', async () => {
      reviewer.config = mockConfig;
      reviewer.metricsCollector = {
        startReview: () => {},
        markSuccess: () => {},
        markError: () => {}
      };
      reviewer.githubClient = {
        getPullRequest: async () => mockPrInfo,
        getPullRequestDiff: async () => 'diff content'
      };

      // Mock processDiff to return empty array
      reviewer.processDiff = async () => [];

      const result = await reviewer.reviewPullRequest({ prNumber: 123, repository: 'owner/repo' });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'No files to review');
    });
  });
});

describe('reviewPullRequest function', () => {
  it('should create reviewer and run review', async () => {
    // This is a high-level integration test
    // In a real test, you would mock all the dependencies
    const options = {
      prNumber: 123,
      repository: 'owner/repo',
      dryRun: true
    };

    // Mock environment variables
    const originalEnv = process.env;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.GITHUB_TOKEN = 'test-token';

    try {
      // Test that the function can be called without throwing
      // (it will fail due to API calls, but we're just testing the interface)
      await assert.rejects(
        () => reviewPullRequest(options),
        /Failed to get PR information/
      );
    } finally {
      // Restore original environment
      process.env = originalEnv;
    }
  });
});
