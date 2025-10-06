#!/usr/bin/env node

/**
 * PR-Pilot Main Reviewer
 * Orchestrates the complete PR review process
 */

import { loadConfig, validateEnvironment } from './lib/config.js';
import { GitHubClient } from './lib/github-client.js';
import { ClaudeClient } from './lib/claude-client.js';
import { CommentFormatter } from './lib/comment-formatter.js';
import { MetricsCollector } from './lib/metrics.js';
import { parseDiff, filterFiles, limitFiles, getDiffStats } from './lib/diff-parser.js';
import { estimateApiCost, checkCostCap } from './lib/cost-estimator.js';
import { createSystemPrompt, createUserPrompt } from './prompts/review-prompt.js';
import { validatePRNumber, validateRepository, RateLimiter } from './lib/security.js';

/**
 * Main PR Reviewer class
 */
export class PRReviewer {
  /**
   * Creates a new PR reviewer
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.config = null;
    this.githubClient = null;
    this.claudeClient = null;
    this.commentFormatter = null;
    this.metricsCollector = null;
    this.rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
    this.options = {
      configPath: options.configPath || 'config/agent.yaml',
      dryRun: options.dryRun || false,
      prNumber: options.prNumber || null,
      repository: options.repository || null
    };
  }

  /**
   * Initializes the reviewer with configuration and clients
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('[pr-pilot] Initializing PR reviewer...');

      // Load configuration
      this.config = await loadConfig(this.options.configPath);
      console.log('[pr-pilot] Configuration loaded');

      // Validate environment variables
      validateEnvironment();
      console.log('[pr-pilot] Environment validated');

      // Initialize clients
      this.githubClient = GitHubClient.fromEnvironment(this.config);
      this.claudeClient = ClaudeClient.fromEnvironment(this.config);
      this.commentFormatter = new CommentFormatter(this.config.comment_format);
      this.metricsCollector = new MetricsCollector(this.config.metrics);

      console.log('[pr-pilot] Clients initialized');
    } catch (error) {
      console.error('[pr-pilot] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Reviews a pull request
   * @param {Object} options - Review options
   * @param {number} options.prNumber - Pull request number
   * @param {string} options.repository - Repository (owner/repo)
   * @returns {Promise<Object>} Review results
   */
  async reviewPullRequest(options = {}) {
    const prNumber = options.prNumber || this.options.prNumber;
    const repository = options.repository || this.options.repository;

    if (!prNumber || !repository) {
      throw new Error('PR number and repository are required');
    }

    // Validate inputs
    const validatedPRNumber = validatePRNumber(prNumber);
    const validatedRepo = validateRepository(repository);

    try {
      console.log(`[pr-pilot] Starting review for PR #${prNumber} in ${repository}`);

      // Start metrics collection
      this.metricsCollector.startReview({
        pr_number: prNumber,
        repository: repository,
        model_used: this.config.model
      });

      // Get PR information
      const prInfo = await this.getPullRequestInfo(prNumber, repository);
      console.log(`[pr-pilot] PR title: ${prInfo.title}`);

      // Get PR diff
      const diffContent = await this.getPullRequestDiff(prNumber, repository);
      console.log(`[pr-pilot] Diff length: ${diffContent.length} characters`);

      // Parse and filter diff
      const fileDiffs = await this.processDiff(diffContent);
      console.log(`[pr-pilot] Processing ${fileDiffs.length} files`);

      if (fileDiffs.length === 0) {
        console.log('[pr-pilot] No files to review after filtering');
        this.metricsCollector.markSuccess();
        return { success: true, message: 'No files to review' };
      }

      // Estimate cost and check limits
      const costEstimate = await this.estimateReviewCost(fileDiffs, prInfo);
      console.log(`[pr-pilot] Estimated cost: $${costEstimate.estCostUsd.toFixed(4)}`);

      if (costEstimate.exceedsCap) {
        console.log('[pr-pilot] Cost cap exceeded, truncating review');
        this.metricsCollector.markTruncated();
        return { success: false, message: 'Cost cap exceeded' };
      }

      // Get AI review
      const reviewResponse = await this.getAIReview(fileDiffs, prInfo);
      console.log(`[pr-pilot] AI review completed: ${reviewResponse.issues.length} issues found`);

      // Post comments
      const commentResults = await this.postComments(reviewResponse, prNumber, repository);
      console.log(`[pr-pilot] Posted ${commentResults.commentsPosted} comments`);

      // Record final metrics
      this.recordFinalMetrics(reviewResponse, fileDiffs, costEstimate, commentResults);

      this.metricsCollector.markSuccess();
      return {
        success: true,
        issuesFound: reviewResponse.issues.length,
        commentsPosted: commentResults.commentsPosted,
        costUsd: costEstimate.estCostUsd
      };

    } catch (error) {
      console.error('[pr-pilot] Review failed:', error.message);
      this.metricsCollector.markError(error.message);
      throw error;
    }
  }

  /**
   * Gets pull request information
   * @param {number} prNumber - PR number
   * @param {string} repository - Repository name
   * @returns {Promise<Object>} PR information
   */
  async getPullRequestInfo(prNumber, repository) {
    try {
      const { owner, repo } = validateRepository(repository);
      const pr = await this.githubClient.getPullRequest(owner, repo, prNumber);
      return {
        title: pr.title || '',
        description: pr.body || '',
        author: pr.user?.login || '',
        baseBranch: pr.base?.ref || 'main',
        headBranch: pr.head?.ref || 'feature-branch',
        state: pr.state || 'open',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at
      };
    } catch (error) {
      console.error('[pr-pilot] Failed to get PR info:', error.message);
      throw new Error(`Failed to get PR information: ${error.message}`);
    }
  }

  /**
   * Gets pull request diff
   * @param {number} prNumber - PR number
   * @param {string} repository - Repository name
   * @returns {Promise<string>} Diff content
   */
  async getPullRequestDiff(prNumber, repository) {
    try {
      const { owner, repo } = validateRepository(repository);
      const diff = await this.githubClient.getPullRequestDiff(owner, repo, prNumber);
      return diff;
    } catch (error) {
      console.error('[pr-pilot] Failed to get PR diff:', error.message);
      throw new Error(`Failed to get PR diff: ${error.message}`);
    }
  }

  /**
   * Processes diff content and filters files
   * @param {string} diffContent - Raw diff content
   * @returns {Promise<Array>} Processed file diffs
   */
  async processDiff(diffContent) {
    try {
      // Parse diff
      const fileDiffs = parseDiff(diffContent);
      console.log(`[pr-pilot] Parsed ${fileDiffs.length} files from diff`);

      // Filter files based on exclude patterns
      const filteredDiffs = filterFiles(fileDiffs, this.config.exclude_patterns);
      console.log(`[pr-pilot] ${fileDiffs.length - filteredDiffs.length} files excluded by patterns`);

      // Limit number of files
      const limitedDiffs = limitFiles(filteredDiffs, this.config.max_files);
      console.log(`[pr-pilot] Limited to ${limitedDiffs.length} files (max: ${this.config.max_files})`);

      // Record file statistics
      const stats = getDiffStats(limitedDiffs);
      this.metricsCollector.recordFileStats({
        files_reviewed: limitedDiffs.length,
        files_excluded: fileDiffs.length - limitedDiffs.length,
        total_additions: stats.totalAdditions,
        total_deletions: stats.totalDeletions,
        total_hunks: stats.totalHunks
      });

      return limitedDiffs;
    } catch (error) {
      console.error('[pr-pilot] Failed to process diff:', error.message);
      throw new Error(`Failed to process diff: ${error.message}`);
    }
  }

  /**
   * Estimates review cost
   * @param {Array} fileDiffs - File diffs to review
   * @param {Object} prInfo - PR information
   * @returns {Promise<Object>} Cost estimate
   */
  async estimateReviewCost(fileDiffs, prInfo) {
    try {
      // Create prompts for cost estimation
      const systemPrompt = createSystemPrompt({
        teamRules: this.config.team_rules
      });
      const userPrompt = createUserPrompt({
        prInfo: prInfo,
        fileDiffs: fileDiffs,
        projectContext: this.config.project
      });

      // Calculate cost
      const costEstimate = estimateApiCost(systemPrompt, userPrompt);
      const costCheck = checkCostCap(costEstimate, this.config.cost_cap_usd);
      const exceedsCap = costCheck.exceedsCap;

      // Record cost metrics
      this.metricsCollector.recordCostStats({
        est_cost_usd: costEstimate.costUsd,
        tokens_used: costEstimate.totalTokens,
        truncated_due_to_limits: exceedsCap
      });

      return {
        ...costEstimate,
        exceedsCap: exceedsCap
      };
    } catch (error) {
      console.error('[pr-pilot] Failed to estimate cost:', error.message);
      throw new Error(`Failed to estimate cost: ${error.message}`);
    }
  }

  /**
   * Gets AI review for the changes
   * @param {Array} fileDiffs - File diffs to review
   * @param {Object} prInfo - PR information
   * @returns {Promise<Object>} AI review response
   */
  async getAIReview(fileDiffs, prInfo) {
    try {
      const startTime = Date.now();

      // Create prompts
      const systemPrompt = createSystemPrompt({
        teamRules: this.config.team_rules
      });
      const userPrompt = createUserPrompt({
        prInfo: prInfo,
        fileDiffs: fileDiffs,
        projectContext: this.config.project
      });

      // Get AI review
      const reviewResponse = await this.claudeClient.reviewCode(systemPrompt, userPrompt);

      // Record performance metrics
      const reviewTime = Date.now() - startTime;
      this.metricsCollector.recordPerformance({
        ai_review_ms: reviewTime
      });

      // Record issues
      this.metricsCollector.recordIssues(reviewResponse.issues);

      return reviewResponse;
    } catch (error) {
      console.error('[pr-pilot] Failed to get AI review:', error.message);
      throw new Error(`Failed to get AI review: ${error.message}`);
    }
  }

  /**
   * Posts comments to the PR
   * @param {Object} reviewResponse - AI review response
   * @param {number} prNumber - PR number
   * @param {string} repository - Repository name
   * @returns {Promise<Object>} Comment posting results
   */
  async postComments(reviewResponse, prNumber, repository) {
    try {
      if (this.options.dryRun) {
        console.log('[pr-pilot] Dry run mode - not posting comments');
        return { commentsPosted: 0, errors: [] };
      }

      const startTime = Date.now();
      let commentsPosted = 0;
      const errors = [];

      // Filter issues by confidence threshold
      const filteredIssues = reviewResponse.issues.filter(
        issue => issue.confidence >= this.config.comment_format.confidence_threshold
      );

      console.log(`[pr-pilot] Posting comments for ${filteredIssues.length} issues`);

      // Post inline comments for each issue
      for (const issue of filteredIssues) {
        try {
          const comment = this.commentFormatter.createLineComment(issue);
          const { owner, repo } = validateRepository(repository);
          await this.githubClient.postReviewComment(owner, repo, prNumber, comment);
          commentsPosted++;
        } catch (error) {
          console.warn(`[pr-pilot] Failed to post comment for issue: ${error.message}`);
          errors.push(error.message);
        }
      }

      // Post summary comment
      try {
        const summaryComment = this.commentFormatter.formatSummaryComment(
          reviewResponse,
          this.metricsCollector.getMetrics()
        );
        const { owner, repo } = validateRepository(repository);
        await this.githubClient.postReview(owner, repo, prNumber, {
          body: summaryComment,
          event: 'COMMENT'
        });
        commentsPosted++;
      } catch (error) {
        console.warn(`[pr-pilot] Failed to post summary comment: ${error.message}`);
        errors.push(error.message);
      }

      // Record comment metrics
      const commentTime = Date.now() - startTime;
      this.metricsCollector.recordCommentStats({
        num_comments_posted: commentsPosted,
        issues: filteredIssues
      });

      this.metricsCollector.recordPerformance({
        comment_posting_ms: commentTime
      });

      return { commentsPosted, errors };
    } catch (error) {
      console.error('[pr-pilot] Failed to post comments:', error.message);
      throw new Error(`Failed to post comments: ${error.message}`);
    }
  }

  /**
   * Records final metrics
   * @param {Object} reviewResponse - AI review response
   * @param {Array} fileDiffs - File diffs processed
   * @param {Object} costEstimate - Cost estimate
   * @param {Object} commentResults - Comment posting results
   */
  recordFinalMetrics(reviewResponse, fileDiffs, costEstimate, commentResults) {
    const stats = getDiffStats(fileDiffs);
    
    this.metricsCollector.recordCommentStats({
      num_comments_posted: commentResults.commentsPosted,
      issues: reviewResponse.issues
    });

    this.metricsCollector.recordCostStats({
      est_cost_usd: costEstimate.estCostUsd,
      tokens_used: costEstimate.inputTokens + costEstimate.outputTokens,
      truncated_due_to_limits: costEstimate.exceedsCap
    });
  }

  /**
   * Runs the complete review process
   * @param {Object} options - Review options
   * @returns {Promise<Object>} Review results
   */
  async run(options = {}) {
    try {
      // Merge options
      this.options = { ...this.options, ...options };

      // Initialize if not already done
      if (!this.config) {
        await this.initialize();
      }

      // Get PR number from environment if not provided
      if (!this.options.prNumber) {
        this.options.prNumber = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER, 10) : null;
      }

      // Get repository from environment if not provided
      if (!this.options.repository) {
        this.options.repository = process.env.REPOSITORY || null;
      }

      // Check if we have required information
      if (!this.options.prNumber || !this.options.repository) {
        throw new Error('PR number and repository must be provided either as options or environment variables');
      }

      // Run the review
      const result = await this.reviewPullRequest({
        prNumber: this.options.prNumber,
        repository: this.options.repository
      });
      
      console.log('[pr-pilot] Review completed successfully');
      console.log(`[pr-pilot] ${result.issuesFound} issues found, ${result.commentsPosted} comments posted`);
      console.log(`[pr-pilot] Cost: $${result.costUsd.toFixed(4)}`);

      return result;
    } catch (error) {
      console.error('[pr-pilot] Review failed:', error.message);
      throw error;
    }
  }

  /**
   * Gets current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Gets metrics collector
   * @returns {MetricsCollector} Metrics collector instance
   */
  getMetrics() {
    return this.metricsCollector;
  }
}

/**
 * Main entry point for the PR reviewer
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Review results
 */
export async function reviewPullRequest(options = {}) {
  const reviewer = new PRReviewer(options);
  return await reviewer.run();
}

/**
 * CLI entry point
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const options = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg.startsWith('--config=')) {
        options.configPath = arg.split('=')[1];
      } else if (arg === '--config' && i + 1 < args.length) {
        options.configPath = args[++i];
      } else if (arg.startsWith('--pr=')) {
        options.prNumber = parseInt(arg.split('=')[1], 10);
      } else if (arg === '--pr' && i + 1 < args.length) {
        options.prNumber = parseInt(args[++i], 10);
      } else if (arg.startsWith('--repo=')) {
        options.repository = arg.split('=')[1];
      } else if (arg === '--repo' && i + 1 < args.length) {
        options.repository = args[++i];
      }
    }

    console.log('[pr-pilot] Starting PR review...');
    const result = await reviewPullRequest(options);
    
    if (result.success) {
      console.log('[pr-pilot] Review completed successfully');
      process.exit(0);
    } else {
      console.log('[pr-pilot] Review completed with issues');
      process.exit(1);
    }
  } catch (error) {
    console.error('[pr-pilot] Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('[pr-pilot] Unhandled error:', error);
    process.exit(1);
  });
}
