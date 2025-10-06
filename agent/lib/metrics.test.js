#!/usr/bin/env node

/**
 * Unit tests for metrics.js
 * Tests metrics collection and writing functionality
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import { MetricsCollector, createMetricsCollector, formatMetrics } from './metrics.js';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import assert from 'node:assert';

describe('Metrics Collector', () => {
  const config = {
    metrics_dir: 'test-metrics',
    enabled: true
  };

  let collector;

  beforeEach(() => {
    collector = new MetricsCollector(config);
  });

  afterEach(() => {
    // Clean up test metrics directory
    try {
      if (existsSync('test-metrics/run.json')) {
        unlinkSync('test-metrics/run.json');
      }
      if (existsSync('test-metrics')) {
        rmdirSync('test-metrics');
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create collector with default config', () => {
      const defaultCollector = new MetricsCollector();
      
      assert(defaultCollector.config);
      assert.strictEqual(defaultCollector.config.enabled, true);
      assert.strictEqual(defaultCollector.config.metrics_dir, 'metrics');
    });

    it('should merge provided configuration', () => {
      const customConfig = {
        metrics_dir: 'custom-metrics',
        enabled: false
      };
      
      const customCollector = new MetricsCollector(customConfig);
      
      assert.strictEqual(customCollector.config.metrics_dir, 'custom-metrics');
      assert.strictEqual(customCollector.config.enabled, false);
    });
  });

  describe('startReview', () => {
    it('should start metrics collection', () => {
      const reviewInfo = {
        pr_number: 123,
        repository: 'owner/repo',
        model_used: 'claude-3-5-sonnet-20241022'
      };
      
      collector.startReview(reviewInfo);
      
      assert(collector.metrics);
      assert.strictEqual(collector.metrics.pr_number, 123);
      assert.strictEqual(collector.metrics.repository, 'owner/repo');
      assert.strictEqual(collector.metrics.model_used, 'claude-3-5-sonnet-20241022');
      assert.strictEqual(collector.metrics.status, 'running');
    });

    it('should not start if disabled', () => {
      const disabledCollector = new MetricsCollector({ enabled: false });
      
      disabledCollector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      assert.strictEqual(disabledCollector.metrics, null);
    });
  });

  describe('recordFileStats', () => {
    it('should record file statistics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const fileStats = {
        files_reviewed: 5,
        files_excluded: 2,
        total_additions: 100,
        total_deletions: 50,
        total_hunks: 10
      };
      
      collector.recordFileStats(fileStats);
      
      assert.strictEqual(collector.metrics.files_reviewed, 5);
      assert.strictEqual(collector.metrics.files_excluded, 2);
      assert.strictEqual(collector.metrics.total_additions, 100);
      assert.strictEqual(collector.metrics.total_deletions, 50);
      assert.strictEqual(collector.metrics.total_hunks, 10);
    });

    it('should handle missing file stats', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.recordFileStats({});
      
      assert.strictEqual(collector.metrics.files_reviewed, 0);
      assert.strictEqual(collector.metrics.files_excluded, 0);
    });

    it('should not record if not started', () => {
      collector.recordFileStats({ files_reviewed: 5 });
      
      assert.strictEqual(collector.metrics, null);
    });
  });

  describe('recordCostStats', () => {
    it('should record cost statistics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const costStats = {
        est_cost_usd: 0.05,
        tokens_used: 1000,
        truncated_due_to_limits: false
      };
      
      collector.recordCostStats(costStats);
      
      assert.strictEqual(collector.metrics.est_cost_usd, 0.05);
      assert.strictEqual(collector.metrics.tokens_used, 1000);
      assert.strictEqual(collector.metrics.truncated_due_to_limits, false);
    });

    it('should handle truncated review', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const costStats = {
        est_cost_usd: 0.50,
        tokens_used: 5000,
        truncated_due_to_limits: true
      };
      
      collector.recordCostStats(costStats);
      
      assert.strictEqual(collector.metrics.truncated_due_to_limits, true);
    });
  });

  describe('recordCommentStats', () => {
    it('should record comment statistics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const commentStats = {
        num_comments_posted: 3,
        issues: [
          { category: 'bug', confidence: 0.9 },
          { category: 'style', confidence: 0.7 },
          { category: 'bug', confidence: 0.8 }
        ]
      };
      
      collector.recordCommentStats(commentStats);
      
      assert.strictEqual(collector.metrics.num_comments_posted, 3);
      assert.strictEqual(collector.metrics.issues_by_category.bug, 2);
      assert.strictEqual(collector.metrics.issues_by_category.style, 1);
      assert(Math.abs(collector.metrics.avg_confidence - 0.8) < 0.001);
    });

    it('should handle empty issues array', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.recordCommentStats({ num_comments_posted: 0, issues: [] });
      
      assert.strictEqual(collector.metrics.num_comments_posted, 0);
      assert.strictEqual(Object.keys(collector.metrics.issues_by_category).length, 0);
    });
  });

  describe('recordIssues', () => {
    it('should record issues and calculate average confidence', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const issues = [
        { category: 'bug', confidence: 0.9 },
        { category: 'style', confidence: 0.7 },
        { category: 'security', confidence: 0.8 }
      ];
      
      collector.recordIssues(issues);
      
      assert.strictEqual(collector.metrics.issues_by_category.bug, 1);
      assert.strictEqual(collector.metrics.issues_by_category.style, 1);
      assert.strictEqual(collector.metrics.issues_by_category.security, 1);
      assert(Math.abs(collector.metrics.avg_confidence - 0.8) < 0.001);
    });

    it('should handle issues with invalid confidence', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const issues = [
        { category: 'bug', confidence: 0.9 },
        { category: 'style', confidence: 1.5 }, // Invalid
        { category: 'security' } // No confidence
      ];
      
      collector.recordIssues(issues);
      
      assert.strictEqual(collector.metrics.avg_confidence, 0.9);
    });
  });

  describe('recordTimeToFirstFeedback', () => {
    it('should record time to first feedback', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.recordTimeToFirstFeedback(5000); // 5 seconds
      
      assert.strictEqual(collector.metrics.time_to_first_feedback_sec, 5);
    });
  });

  describe('markSuccess', () => {
    it('should mark review as successful', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.markSuccess();
      
      assert.strictEqual(collector.metrics.status, 'success');
    });
  });

  describe('markError', () => {
    it('should mark review as failed with error message', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.markError('API call failed');
      
      assert.strictEqual(collector.metrics.status, 'error');
      assert.strictEqual(collector.metrics.error_message, 'API call failed');
    });
  });

  describe('markTruncated', () => {
    it('should mark review as truncated', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.markTruncated();
      
      assert.strictEqual(collector.metrics.status, 'truncated');
      assert.strictEqual(collector.metrics.truncated_due_to_limits, true);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const metrics = collector.getMetrics();
      
      assert(metrics);
      assert.strictEqual(metrics.pr_number, 123);
    });

    it('should return null if not started', () => {
      const metrics = collector.getMetrics();
      
      assert.strictEqual(metrics, null);
    });

    it('should return a copy of metrics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      const metrics1 = collector.getMetrics();
      const metrics2 = collector.getMetrics();
      
      assert.notStrictEqual(metrics1, metrics2);
      assert.deepStrictEqual(metrics1, metrics2);
    });
  });

  describe('reset', () => {
    it('should reset metrics collector', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.reset();
      
      assert.strictEqual(collector.metrics, null);
      assert.strictEqual(collector.startTime, null);
    });
  });

  describe('getSummary', () => {
    it('should return metrics summary', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      collector.recordFileStats({ files_reviewed: 5 });
      collector.recordCommentStats({ num_comments_posted: 3 });
      collector.recordCostStats({ est_cost_usd: 0.05 });
      collector.markSuccess();
      
      const summary = collector.getSummary();
      
      assert(summary.includes('PR #123'));
      assert(summary.includes('5 files'));
      assert(summary.includes('3 comments'));
      assert(summary.includes('$0.0500'));
      assert(summary.includes('success'));
    });

    it('should return no metrics message if not started', () => {
      const summary = collector.getSummary();
      
      assert.strictEqual(summary, 'No metrics available');
    });
  });

  describe('recordCustomMetric', () => {
    it('should record custom metrics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.recordCustomMetric('custom_field', 'custom_value');
      
      assert.strictEqual(collector.metrics.custom_metrics.custom_field, 'custom_value');
    });
  });

  describe('recordApiCall', () => {
    it('should record API call metrics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.recordApiCall('github', {
        duration_ms: 1000,
        success: true,
        retries: 0
      });
      
      const apiMetrics = collector.metrics.api_calls.github;
      assert.strictEqual(apiMetrics.total_calls, 1);
      assert.strictEqual(apiMetrics.successful_calls, 1);
      assert.strictEqual(apiMetrics.failed_calls, 0);
      assert.strictEqual(apiMetrics.total_duration_ms, 1000);
    });

    it('should accumulate multiple API calls', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.recordApiCall('claude', { duration_ms: 500, success: true, retries: 0 });
      collector.recordApiCall('claude', { duration_ms: 300, success: false, retries: 1 });
      
      const apiMetrics = collector.metrics.api_calls.claude;
      assert.strictEqual(apiMetrics.total_calls, 2);
      assert.strictEqual(apiMetrics.successful_calls, 1);
      assert.strictEqual(apiMetrics.failed_calls, 1);
      assert.strictEqual(apiMetrics.total_duration_ms, 800);
      assert.strictEqual(apiMetrics.total_retries, 1);
    });
  });

  describe('recordPerformance', () => {
    it('should record performance metrics', () => {
      collector.startReview({ pr_number: 123, repository: 'owner/repo' });
      
      collector.recordPerformance({
        diff_parsing_ms: 100,
        ai_review_ms: 2000,
        comment_posting_ms: 500
      });
      
      const perf = collector.metrics.performance;
      assert.strictEqual(perf.diff_parsing_ms, 100);
      assert.strictEqual(perf.ai_review_ms, 2000);
      assert.strictEqual(perf.comment_posting_ms, 500);
      assert.strictEqual(perf.total_ms, 2600);
    });
  });

  describe('isEnabled', () => {
    it('should return true when enabled', () => {
      assert.strictEqual(collector.isEnabled(), true);
    });

    it('should return false when disabled', () => {
      const disabledCollector = new MetricsCollector({ enabled: false });
      assert.strictEqual(disabledCollector.isEnabled(), false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      collector.updateConfig({ enabled: false, custom_field: 'value' });
      
      assert.strictEqual(collector.config.enabled, false);
      assert.strictEqual(collector.config.custom_field, 'value');
      assert.strictEqual(collector.config.metrics_dir, 'test-metrics');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = collector.getConfig();
      
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.metrics_dir, 'test-metrics');
    });

    it('should return a copy of configuration', () => {
      const config1 = collector.getConfig();
      const config2 = collector.getConfig();
      
      assert.notStrictEqual(config1, config2);
      assert.deepStrictEqual(config1, config2);
    });
  });

  describe('createMetricsCollector', () => {
    it('should create metrics collector instance', () => {
      const customCollector = createMetricsCollector({ enabled: false });
      
      assert(customCollector instanceof MetricsCollector);
      assert.strictEqual(customCollector.config.enabled, false);
    });
  });

  describe('formatMetrics', () => {
    it('should format metrics for display', () => {
      const metrics = {
        pr_number: 123,
        repository: 'owner/repo',
        status: 'success',
        time_to_first_feedback_sec: 5,
        files_reviewed: 5,
        files_excluded: 2,
        num_comments_posted: 3,
        est_cost_usd: 0.05,
        tokens_used: 1000,
        model_used: 'claude-3-5-sonnet-20241022',
        issues_by_category: { bug: 2, style: 1 },
        avg_confidence: 0.8
      };
      
      const formatted = formatMetrics(metrics);
      
      assert(formatted.includes('PR #123'));
      assert(formatted.includes('Repository: owner/repo'));
      assert(formatted.includes('Status: success'));
      assert(formatted.includes('Time to first feedback: 5s'));
      assert(formatted.includes('Files reviewed: 5'));
      assert(formatted.includes('Comments posted: 3'));
      assert(formatted.includes('Estimated cost: $0.0500'));
      assert(formatted.includes('Issues by category:'));
      assert(formatted.includes('- bug: 2'));
      assert(formatted.includes('- style: 1'));
      assert(formatted.includes('Average confidence: 80.0%'));
    });

    it('should handle null metrics', () => {
      const formatted = formatMetrics(null);
      
      assert.strictEqual(formatted, 'No metrics available');
    });

    it('should handle metrics without optional fields', () => {
      const metrics = {
        pr_number: 123,
        repository: 'owner/repo',
        status: 'success',
        time_to_first_feedback_sec: 0,
        files_reviewed: 0,
        files_excluded: 0,
        num_comments_posted: 0,
        est_cost_usd: 0,
        tokens_used: 0,
        model_used: 'claude-3-5-sonnet-20241022'
      };
      
      const formatted = formatMetrics(metrics);
      
      assert(formatted.includes('PR #123'));
      assert(!formatted.includes('Issues by category:'));
      assert(!formatted.includes('Average confidence:'));
    });
  });
});
