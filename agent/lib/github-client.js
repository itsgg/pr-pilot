#!/usr/bin/env node

/**
 * GitHub API client for PR-Pilot
 * Handles PR fetching, diff retrieval, and comment posting
 */

import { Octokit } from '@octokit/rest';

/**
 * GitHub client class for PR operations
 */
export class GitHubClient {
  /**
   * Creates a new GitHub client
   * @param {string} token - GitHub API token
   * @param {Object} config - Configuration object
   */
  constructor(token, config) {
    if (!token) {
      throw new Error('GitHub token is required');
    }

    this.octokit = new Octokit({
      auth: token,
      baseUrl: config?.github?.api_url || 'https://api.github.com',
      timeout: config?.github?.timeout || 30000,
      retry: {
        enabled: true,
        retryAfterBaseValue: config?.github?.retry_delay || 1000,
        doNotRetry: [400, 401, 403, 404, 422],
        retries: config?.github?.retries || 3
      }
    });

    this.config = config;
  }

  /**
   * Fetches PR details from GitHub
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - Pull request number
   * @returns {Promise<Object>} PR details
   * @throws {Error} If PR fetch fails
   */
  async getPullRequest(owner, repo, prNumber) {
    try {
      console.log(`[pr-pilot] Fetching PR #${prNumber} from ${owner}/${repo}`);

      const { data: pr } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      console.log(`[pr-pilot] PR found: "${pr.title}" by ${pr.user.login}`);
      console.log(`[pr-pilot] Status: ${pr.state}, Mergeable: ${pr.mergeable}`);

      return {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        user: pr.user.login,
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha
        },
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        mergeable: pr.mergeable,
        mergeable_state: pr.mergeable_state,
        draft: pr.draft
      };

    } catch (error) {
      console.error(`[pr-pilot] Failed to fetch PR #${prNumber}:`, error.message);
      
      if (error.status === 404) {
        throw new Error(`Pull request #${prNumber} not found in ${owner}/${repo}`);
      }
      
      if (error.status === 403) {
        throw new Error(`Access denied to ${owner}/${repo}. Check token permissions.`);
      }

      throw new Error(`Failed to fetch PR: ${error.message}`);
    }
  }

  /**
   * Fetches the diff for a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - Pull request number
   * @returns {Promise<string>} Unified diff content
   * @throws {Error} If diff fetch fails
   */
  async getPullRequestDiff(owner, repo, prNumber) {
    try {
      console.log(`[pr-pilot] Fetching diff for PR #${prNumber}`);

      const { data: diff } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: {
          format: 'diff'
        }
      });

      console.log(`[pr-pilot] Diff fetched: ${diff.length} characters`);

      return diff;

    } catch (error) {
      console.error(`[pr-pilot] Failed to fetch diff for PR #${prNumber}:`, error.message);
      throw new Error(`Failed to fetch PR diff: ${error.message}`);
    }
  }

  /**
   * Fetches the list of files changed in a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - Pull request number
   * @returns {Promise<Array>} List of changed files
   * @throws {Error} If file list fetch fails
   */
  async getPullRequestFiles(owner, repo, prNumber) {
    try {
      console.log(`[pr-pilot] Fetching changed files for PR #${prNumber}`);

      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      console.log(`[pr-pilot] Found ${files.length} changed files`);

      return files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        blob_url: file.blob_url,
        raw_url: file.raw_url,
        contents_url: file.contents_url
      }));

    } catch (error) {
      console.error(`[pr-pilot] Failed to fetch files for PR #${prNumber}:`, error.message);
      throw new Error(`Failed to fetch PR files: ${error.message}`);
    }
  }

  /**
   * Posts a review comment on a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - Pull request number
   * @param {Object} comment - Comment details
   * @returns {Promise<Object>} Posted comment
   * @throws {Error} If comment posting fails
   */
  async postReviewComment(owner, repo, prNumber, comment) {
    try {
      console.log(`[pr-pilot] Posting review comment on PR #${prNumber}`);

      const { data: reviewComment } = await this.octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        body: comment.body,
        path: comment.path,
        line: comment.line,
        side: comment.side || 'RIGHT',
        start_line: comment.start_line,
        start_side: comment.start_side || 'RIGHT'
      });

      console.log(`[pr-pilot] Review comment posted: ${reviewComment.html_url}`);

      return reviewComment;

    } catch (error) {
      console.error(`[pr-pilot] Failed to post review comment:`, error.message);
      throw new Error(`Failed to post review comment: ${error.message}`);
    }
  }

  /**
   * Posts a general review on a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - Pull request number
   * @param {Object} review - Review details
   * @returns {Promise<Object>} Posted review
   * @throws {Error} If review posting fails
   */
  async postReview(owner, repo, prNumber, review) {
    try {
      console.log(`[pr-pilot] Posting review on PR #${prNumber}`);

      const { data: prReview } = await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        body: review.body,
        event: review.event || 'COMMENT',
        comments: review.comments || []
      });

      console.log(`[pr-pilot] Review posted: ${prReview.html_url}`);

      return prReview;

    } catch (error) {
      console.error(`[pr-pilot] Failed to post review:`, error.message);
      throw new Error(`Failed to post review: ${error.message}`);
    }
  }

  /**
   * Gets the repository information
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository details
   * @throws {Error} If repository fetch fails
   */
  async getRepository(owner, repo) {
    try {
      console.log(`[pr-pilot] Fetching repository info: ${owner}/${repo}`);

      const { data: repository } = await this.octokit.rest.repos.get({
        owner,
        repo
      });

      console.log(`[pr-pilot] Repository: ${repository.full_name} (${repository.private ? 'private' : 'public'})`);

      return {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: repository.owner.login,
        private: repository.private,
        description: repository.description,
        default_branch: repository.default_branch,
        language: repository.language,
        created_at: repository.created_at,
        updated_at: repository.updated_at
      };

    } catch (error) {
      console.error(`[pr-pilot] Failed to fetch repository:`, error.message);
      throw new Error(`Failed to fetch repository: ${error.message}`);
    }
  }

  /**
   * Checks if the repository is accessible
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<boolean>} True if accessible
   */
  async isRepositoryAccessible(owner, repo) {
    try {
      await this.getRepository(owner, repo);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the current user information
   * @returns {Promise<Object>} User details
   * @throws {Error} If user fetch fails
   */
  async getCurrentUser() {
    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      
      console.log(`[pr-pilot] Authenticated as: ${user.login}`);
      
      return {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        type: user.type
      };

    } catch (error) {
      console.error(`[pr-pilot] Failed to get current user:`, error.message);
      throw new Error(`Failed to authenticate: ${error.message}`);
    }
  }

  /**
   * Validates the GitHub token and permissions
   * @returns {Promise<Object>} Validation result
   */
  async validateToken() {
    try {
      const user = await this.getCurrentUser();
      
      // Check if token has repo scope
      const { data: installations } = await this.octokit.rest.apps.listInstallations();
      
      return {
        valid: true,
        user: user.login,
        hasRepoAccess: true,
        installations: installations.length
      };

    } catch (error) {
      console.error(`[pr-pilot] Token validation failed:`, error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Gets the rate limit information
   * @returns {Promise<Object>} Rate limit details
   */
  async getRateLimit() {
    try {
      const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
      
      return {
        limit: rateLimit.rate.limit,
        remaining: rateLimit.rate.remaining,
        reset: new Date(rateLimit.rate.reset * 1000),
        used: rateLimit.rate.limit - rateLimit.rate.remaining
      };

    } catch (error) {
      console.error(`[pr-pilot] Failed to get rate limit:`, error.message);
      return null;
    }
  }

  /**
   * Parses repository string into owner and repo
   * @param {string} repository - Repository string (owner/repo)
   * @returns {Object} Parsed owner and repo
   * @throws {Error} If repository string is invalid
   */
  static parseRepository(repository) {
    if (!repository || typeof repository !== 'string') {
      throw new Error('Repository must be a string in format "owner/repo"');
    }

    const parts = repository.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Repository must be in format "owner/repo"');
    }

    return {
      owner: parts[0],
      repo: parts[1]
    };
  }

  /**
   * Creates a GitHub client from environment variables
   * @param {Object} config - Configuration object
   * @returns {GitHubClient} GitHub client instance
   * @throws {Error} If token is missing
   */
  static fromEnvironment(config) {
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    return new GitHubClient(token, config);
  }
}
