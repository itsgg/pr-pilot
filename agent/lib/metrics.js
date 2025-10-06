#!/usr/bin/env node

/**
 * Metrics collector for PR-Pilot
 * Collects and writes runtime metrics for monitoring and analysis
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Represents runtime metrics for a PR review
 * @typedef {Object} ReviewMetrics
 * @property {string} timestamp - ISO timestamp of the review
 * @property {number} pr_number - Pull request number
 * @property {string} repository - Repository name (owner/repo)
 * @property {number} time_to_first_feedback_sec - Time to first feedback in seconds
 * @property {number} num_comments_posted - Number of comments posted
 * @property {number} est_cost_usd - Estimated cost in USD
 * @property {boolean} truncated_due_to_limits - Whether review was truncated due to limits
 * @property {number} files_reviewed - Number of files reviewed
 * @property {number} files_excluded - Number of files excluded
 * @property {number} total_additions - Total lines added
 * @property {number} total_deletions - Total lines deleted
 * @property {number} total_hunks - Total hunks processed
 * @property {Object} issues_by_category - Issues grouped by category
 * @property {number} avg_confidence - Average confidence of issues
 * @property {string} model_used - AI model used for review
 * @property {number} tokens_used - Number of tokens used
 * @property {string} status - Review status (success, error, truncated)
 * @property {string} error_message - Error message if status is error
 */

/**
 * Metrics collector for PR-Pilot
 */
export class MetricsCollector {
  /**
   * Creates a new metrics collector
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = {
      metrics_dir: 'metrics',
      enabled: true,
      ...config
    };
    
    this.startTime = null;
    this.metrics = null;
  }

  /**
   * Starts collecting metrics for a review
   * @param {Object} reviewInfo - Review information
   * @param {number} reviewInfo.pr_number - Pull request number
   * @param {string} reviewInfo.repository - Repository name
   * @param {string} reviewInfo.model_used - AI model used
   */
  startReview(reviewInfo) {
    if (!this.config.enabled) {
      return;
    }

    this.startTime = Date.now();
    this.metrics = {
      timestamp: new Date().toISOString(),
      pr_number: reviewInfo.pr_number,
      repository: reviewInfo.repository,
      model_used: reviewInfo.model_used,
      time_to_first_feedback_sec: 0,
      num_comments_posted: 0,
      est_cost_usd: 0,
      truncated_due_to_limits: false,
      files_reviewed: 0,
      files_excluded: 0,
      total_additions: 0,
      total_deletions: 0,
      total_hunks: 0,
      issues_by_category: {},
      avg_confidence: 0,
      tokens_used: 0,
      status: 'running',
      error_message: null
    };

    console.log(`[pr-pilot] Started metrics collection for PR #${reviewInfo.pr_number}`);
  }

  /**
   * Records file processing metrics
   * @param {Object} fileStats - File processing statistics
   * @param {number} fileStats.files_reviewed - Number of files reviewed
   * @param {number} fileStats.files_excluded - Number of files excluded
   * @param {number} fileStats.total_additions - Total lines added
   * @param {number} fileStats.total_deletions - Total lines deleted
   * @param {number} fileStats.total_hunks - Total hunks processed
   */
  recordFileStats(fileStats) {
    if (!this.metrics) return;

    this.metrics.files_reviewed = fileStats.files_reviewed || 0;
    this.metrics.files_excluded = fileStats.files_excluded || 0;
    this.metrics.total_additions = fileStats.total_additions || 0;
    this.metrics.total_deletions = fileStats.total_deletions || 0;
    this.metrics.total_hunks = fileStats.total_hunks || 0;
  }

  /**
   * Records cost metrics
   * @param {Object} costStats - Cost statistics
   * @param {number} costStats.est_cost_usd - Estimated cost in USD
   * @param {number} costStats.tokens_used - Number of tokens used
   * @param {boolean} costStats.truncated_due_to_limits - Whether truncated due to limits
   */
  recordCostStats(costStats) {
    if (!this.metrics) return;

    this.metrics.est_cost_usd = costStats.est_cost_usd || 0;
    this.metrics.tokens_used = costStats.tokens_used || 0;
    this.metrics.truncated_due_to_limits = costStats.truncated_due_to_limits || false;
  }

  /**
   * Records comment posting metrics
   * @param {Object} commentStats - Comment statistics
   * @param {number} commentStats.num_comments_posted - Number of comments posted
   * @param {Array} commentStats.issues - Array of issues found
   */
  recordCommentStats(commentStats) {
    if (!this.metrics) return;

    this.metrics.num_comments_posted = commentStats.num_comments_posted || 0;
    
    if (commentStats.issues && Array.isArray(commentStats.issues)) {
      this.recordIssues(commentStats.issues);
    }
  }

  /**
   * Records issues found during review
   * @param {Array} issues - Array of issues
   */
  recordIssues(issues) {
    if (!this.metrics || !Array.isArray(issues)) return;

    // Group issues by category
    const issuesByCategory = {};
    let totalConfidence = 0;
    let validConfidenceCount = 0;

    issues.forEach(issue => {
      const category = issue.category || 'unknown';
      issuesByCategory[category] = (issuesByCategory[category] || 0) + 1;
      
      if (typeof issue.confidence === 'number' && issue.confidence >= 0 && issue.confidence <= 1) {
        totalConfidence += issue.confidence;
        validConfidenceCount++;
      }
    });

    this.metrics.issues_by_category = issuesByCategory;
    this.metrics.avg_confidence = validConfidenceCount > 0 ? totalConfidence / validConfidenceCount : 0;
  }

  /**
   * Records the time to first feedback
   * @param {number} timeToFirstFeedback - Time in milliseconds
   */
  recordTimeToFirstFeedback(timeToFirstFeedback) {
    if (!this.metrics) return;

    this.metrics.time_to_first_feedback_sec = Math.round(timeToFirstFeedback / 1000);
  }

  /**
   * Marks the review as successful
   */
  markSuccess() {
    if (!this.metrics) return;

    this.metrics.status = 'success';
    this.finalizeMetrics();
  }

  /**
   * Marks the review as failed with an error
   * @param {string} errorMessage - Error message
   */
  markError(errorMessage) {
    if (!this.metrics) return;

    this.metrics.status = 'error';
    this.metrics.error_message = errorMessage;
    this.finalizeMetrics();
  }

  /**
   * Marks the review as truncated due to limits
   */
  markTruncated() {
    if (!this.metrics) return;

    this.metrics.status = 'truncated';
    this.metrics.truncated_due_to_limits = true;
    this.finalizeMetrics();
  }

  /**
   * Finalizes metrics and writes to file
   */
  finalizeMetrics() {
    if (!this.metrics) return;

    // Calculate total time if not already set
    if (this.startTime && this.metrics.time_to_first_feedback_sec === 0) {
      const totalTime = Date.now() - this.startTime;
      this.metrics.time_to_first_feedback_sec = Math.round(totalTime / 1000);
    }

    this.writeMetrics();
    console.log(`[pr-pilot] Metrics collection completed for PR #${this.metrics.pr_number}`);
  }

  /**
   * Writes metrics to file
   */
  writeMetrics() {
    if (!this.metrics || !this.config.enabled) return;

    try {
      // Ensure metrics directory exists
      if (!existsSync(this.config.metrics_dir)) {
        mkdirSync(this.config.metrics_dir, { recursive: true });
      }

      const metricsFile = `${this.config.metrics_dir}/run.json`;
      const metricsData = {
        ...this.metrics,
        collected_at: new Date().toISOString()
      };

      writeFileSync(metricsFile, JSON.stringify(metricsData, null, 2));
      console.log(`[pr-pilot] Metrics written to ${metricsFile}`);
    } catch (error) {
      console.error('[pr-pilot] Failed to write metrics:', error.message);
    }
  }

  /**
   * Gets current metrics
   * @returns {ReviewMetrics|null} Current metrics or null if not started
   */
  getMetrics() {
    return this.metrics ? { ...this.metrics } : null;
  }

  /**
   * Resets metrics collector
   */
  reset() {
    this.startTime = null;
    this.metrics = null;
  }

  /**
   * Creates a summary of metrics for logging
   * @returns {string} Metrics summary
   */
  getSummary() {
    if (!this.metrics) {
      return 'No metrics available';
    }

    const m = this.metrics;
    return `PR #${m.pr_number} | ${m.files_reviewed} files | ${m.num_comments_posted} comments | $${m.est_cost_usd.toFixed(4)} | ${m.status}`;
  }

  /**
   * Records a custom metric
   * @param {string} key - Metric key
   * @param {any} value - Metric value
   */
  recordCustomMetric(key, value) {
    if (!this.metrics) return;

    if (!this.metrics.custom_metrics) {
      this.metrics.custom_metrics = {};
    }

    this.metrics.custom_metrics[key] = value;
  }

  /**
   * Records API call metrics
   * @param {string} api - API name (e.g., 'github', 'claude')
   * @param {Object} callStats - Call statistics
   * @param {number} callStats.duration_ms - Call duration in milliseconds
   * @param {boolean} callStats.success - Whether call was successful
   * @param {number} callStats.retries - Number of retries
   */
  recordApiCall(api, callStats) {
    if (!this.metrics) return;

    if (!this.metrics.api_calls) {
      this.metrics.api_calls = {};
    }

    if (!this.metrics.api_calls[api]) {
      this.metrics.api_calls[api] = {
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        total_duration_ms: 0,
        total_retries: 0
      };
    }

    const apiMetrics = this.metrics.api_calls[api];
    apiMetrics.total_calls++;
    apiMetrics.total_duration_ms += callStats.duration_ms || 0;
    apiMetrics.total_retries += callStats.retries || 0;

    if (callStats.success) {
      apiMetrics.successful_calls++;
    } else {
      apiMetrics.failed_calls++;
    }
  }

  /**
   * Records performance metrics
   * @param {Object} perfStats - Performance statistics
   * @param {number} perfStats.diff_parsing_ms - Time spent parsing diff
   * @param {number} perfStats.ai_review_ms - Time spent on AI review
   * @param {number} perfStats.comment_posting_ms - Time spent posting comments
   */
  recordPerformance(perfStats) {
    if (!this.metrics) return;

    this.metrics.performance = {
      diff_parsing_ms: perfStats.diff_parsing_ms || 0,
      ai_review_ms: perfStats.ai_review_ms || 0,
      comment_posting_ms: perfStats.comment_posting_ms || 0,
      total_ms: (perfStats.diff_parsing_ms || 0) + (perfStats.ai_review_ms || 0) + (perfStats.comment_posting_ms || 0)
    };
  }

  /**
   * Checks if metrics collection is enabled
   * @returns {boolean} True if enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Updates configuration
   * @param {Object} newConfig - New configuration to merge
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

/**
 * Creates a metrics collector instance
 * @param {Object} config - Configuration object
 * @returns {MetricsCollector} New metrics collector instance
 */
export function createMetricsCollector(config = {}) {
  return new MetricsCollector(config);
}

/**
 * Formats metrics for display
 * @param {ReviewMetrics} metrics - Metrics to format
 * @returns {string} Formatted metrics string
 */
export function formatMetrics(metrics) {
  if (!metrics) {
    return 'No metrics available';
  }

  const lines = [
    `📊 PR-Pilot Metrics for PR #${metrics.pr_number}`,
    `Repository: ${metrics.repository}`,
    `Status: ${metrics.status}`,
    `Time to first feedback: ${metrics.time_to_first_feedback_sec}s`,
    `Files reviewed: ${metrics.files_reviewed}`,
    `Files excluded: ${metrics.files_excluded}`,
    `Comments posted: ${metrics.num_comments_posted}`,
    `Estimated cost: $${metrics.est_cost_usd.toFixed(4)}`,
    `Tokens used: ${metrics.tokens_used}`,
    `Model: ${metrics.model_used}`
  ];

  if (metrics.issues_by_category && Object.keys(metrics.issues_by_category).length > 0) {
    lines.push('Issues by category:');
    Object.entries(metrics.issues_by_category).forEach(([category, count]) => {
      lines.push(`  - ${category}: ${count}`);
    });
  }

  if (metrics.avg_confidence > 0) {
    lines.push(`Average confidence: ${(metrics.avg_confidence * 100).toFixed(1)}%`);
  }

  if (metrics.truncated_due_to_limits) {
    lines.push('⚠️ Review was truncated due to limits');
  }

  if (metrics.error_message) {
    lines.push(`Error: ${metrics.error_message}`);
  }

  return lines.join('\n');
}
