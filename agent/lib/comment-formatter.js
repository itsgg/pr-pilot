#!/usr/bin/env node

/**
 * Comment formatter for PR-Pilot
 * Handles formatting and posting of review comments
 */

/**
 * Represents a review issue for formatting
 * @typedef {Object} ReviewIssue
 * @property {string} path - File path
 * @property {number} line - Line number
 * @property {string} category - Issue category (bug, style, security, perf, test)
 * @property {string} severity - Issue severity (low, med, high)
 * @property {string} explanation - Clear, actionable explanation
 * @property {string} fix_patch - Suggested code fix
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * Represents a review comment to be posted
 * @typedef {Object} ReviewComment
 * @property {string} path - File path
 * @property {number} line - Line number
 * @property {string} body - Comment body
 * @property {string} side - Comment side (LEFT or RIGHT)
 * @property {number} start_line - Start line for multi-line comments
 * @property {number} start_side - Start side for multi-line comments
 */

/**
 * Comment formatter for GitHub PR reviews
 */
export class CommentFormatter {
  /**
   * Creates a new comment formatter
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = {
      category_emojis: {
        bug: '🐛',
        style: '💅',
        security: '🔒',
        perf: '⚡',
        test: '🧪'
      },
      confidence_threshold: 0.6,
      max_explanation_sentences: 2,
      max_fix_patch_lines: 20,
      ...config
    };
  }

  /**
   * Formats a review issue into a GitHub comment
   * @param {ReviewIssue} issue - Review issue to format
   * @returns {string} Formatted comment body
   */
  formatIssue(issue) {
    if (!issue || typeof issue !== 'object') {
      throw new Error('Issue must be a valid object');
    }

    this.validateIssue(issue);

    const emoji = this.config.category_emojis[issue.category] || '📝';
    const confidence = Math.round(issue.confidence * 100);
    const severity = this.formatSeverity(issue.severity);
    
    let comment = `**${issue.category.toUpperCase()}** ${emoji} ${severity}\n\n`;
    comment += `${issue.explanation}\n\n`;

    if (issue.fix_patch && issue.fix_patch.trim()) {
      const fixPatch = this.formatFixPatch(issue.fix_patch);
      comment += `**Suggested fix:**\n\`\`\`\n${fixPatch}\n\`\`\`\n\n`;
    }

    comment += `*Confidence: ${confidence}%*`;

    return comment;
  }

  /**
   * Validates a review issue
   * @param {ReviewIssue} issue - Issue to validate
   * @throws {Error} If issue is invalid
   */
  validateIssue(issue) {
    const requiredFields = ['path', 'line', 'category', 'severity', 'explanation', 'confidence'];
    
    for (const field of requiredFields) {
      if (!(field in issue)) {
        throw new Error(`Issue missing required field: ${field}`);
      }
    }

    if (typeof issue.path !== 'string' || issue.path.trim().length === 0) {
      throw new Error('Issue path must be a non-empty string');
    }

    if (typeof issue.line !== 'number' || issue.line < 1) {
      throw new Error('Issue line must be a positive number');
    }

    const validCategories = ['bug', 'style', 'security', 'perf', 'test'];
    if (!validCategories.includes(issue.category)) {
      throw new Error(`Issue category must be one of: ${validCategories.join(', ')}`);
    }

    const validSeverities = ['low', 'med', 'high'];
    if (!validSeverities.includes(issue.severity)) {
      throw new Error(`Issue severity must be one of: ${validSeverities.join(', ')}`);
    }

    if (typeof issue.explanation !== 'string' || issue.explanation.trim().length === 0) {
      throw new Error('Issue explanation must be a non-empty string');
    }

    if (typeof issue.confidence !== 'number' || issue.confidence < 0 || issue.confidence > 1) {
      throw new Error('Issue confidence must be a number between 0 and 1');
    }
  }

  /**
   * Formats severity level
   * @param {string} severity - Severity level
   * @returns {string} Formatted severity
   */
  formatSeverity(severity) {
    const severityMap = {
      low: '🟢 Low',
      med: '🟡 Medium',
      high: '🔴 High'
    };
    
    return severityMap[severity] || '🟡 Medium';
  }

  /**
   * Formats fix patch for display
   * @param {string} fixPatch - Raw fix patch
   * @returns {string} Formatted fix patch
   */
  formatFixPatch(fixPatch) {
    if (!fixPatch || typeof fixPatch !== 'string') {
      return '';
    }

    const lines = fixPatch.split('\n');
    
    // Limit the number of lines
    const maxLines = this.config.max_fix_patch_lines;
    if (lines.length > maxLines) {
      const truncated = lines.slice(0, maxLines);
      truncated.push(`... (${lines.length - maxLines} more lines)`);
      return truncated.join('\n');
    }

    return fixPatch.trim();
  }

  /**
   * Formats a review summary comment
   * @param {Object} reviewData - Review data
   * @param {string} reviewData.summary - Review summary
   * @param {Array<ReviewIssue>} reviewData.issues - Array of issues
   * @param {Array<string>} reviewData.risks - Array of risks
   * @param {Object} stats - Review statistics
   * @returns {string} Formatted summary comment
   */
  formatSummaryComment(reviewData, stats = {}) {
    const { summary, issues, risks } = reviewData;
    
    let comment = `## 🤖 PR-Pilot Review\n\n`;
    comment += `**Summary:** ${summary}\n\n`;

    // Add statistics
    if (stats.totalFiles !== undefined) {
      comment += `**Files reviewed:** ${stats.totalFiles}\n`;
    }
    if (stats.totalIssues !== undefined) {
      comment += `**Issues found:** ${stats.totalIssues}\n`;
    }
    if (stats.estCostUsd !== undefined) {
      comment += `**Estimated cost:** $${stats.estCostUsd.toFixed(4)}\n`;
    }
    comment += `\n`;

    // Add issue breakdown by category
    if (issues && issues.length > 0) {
      const issuesByCategory = this.groupIssuesByCategory(issues);
      comment += `### Issues by Category\n\n`;
      
      for (const [category, categoryIssues] of Object.entries(issuesByCategory)) {
        const emoji = this.config.category_emojis[category] || '📝';
        comment += `- ${emoji} **${category.toUpperCase()}**: ${categoryIssues.length} issues\n`;
      }
      comment += `\n`;
    }

    // Add risks
    if (risks && risks.length > 0) {
      comment += `### ⚠️ Potential Risks\n\n`;
      risks.forEach(risk => {
        comment += `- ${risk}\n`;
      });
      comment += `\n`;
    }

    // Add footer
    comment += `---\n`;
    comment += `*This review was generated by [PR-Pilot](https://github.com/your-org/pr-pilot) using Claude AI.*`;

    return comment;
  }

  /**
   * Groups issues by category
   * @param {Array<ReviewIssue>} issues - Array of issues
   * @returns {Object} Issues grouped by category
   */
  groupIssuesByCategory(issues) {
    const grouped = {};
    
    issues.forEach(issue => {
      if (!grouped[issue.category]) {
        grouped[issue.category] = [];
      }
      grouped[issue.category].push(issue);
    });

    return grouped;
  }

  /**
   * Converts issues to GitHub review comments
   * @param {Array<ReviewIssue>} issues - Array of issues
   * @param {Object} options - Options for comment generation
   * @returns {Array<ReviewComment>} Array of review comments
   */
  convertToReviewComments(issues, options = {}) {
    const comments = [];
    const { minConfidence = this.config.confidence_threshold } = options;

    issues.forEach(issue => {
      // Filter by confidence threshold
      if (issue.confidence < minConfidence) {
        return;
      }

      try {
        const comment = {
          path: issue.path,
          line: issue.line,
          body: this.formatIssue(issue),
          side: 'RIGHT', // Always comment on the new version
          start_line: issue.line,
          start_side: 'RIGHT'
        };

        comments.push(comment);
      } catch (error) {
        console.warn(`[pr-pilot] Skipping invalid issue: ${error.message}`);
      }
    });

    return comments;
  }

  /**
   * Filters issues by confidence threshold
   * @param {Array<ReviewIssue>} issues - Array of issues
   * @param {number} threshold - Confidence threshold (0-1)
   * @returns {Array<ReviewIssue>} Filtered issues
   */
  filterIssuesByConfidence(issues, threshold = this.config.confidence_threshold) {
    return issues.filter(issue => issue.confidence >= threshold);
  }

  /**
   * Groups comments by file for batch processing
   * @param {Array<ReviewComment>} comments - Array of comments
   * @returns {Object} Comments grouped by file path
   */
  groupCommentsByFile(comments) {
    const grouped = {};
    
    comments.forEach(comment => {
      if (!grouped[comment.path]) {
        grouped[comment.path] = [];
      }
      grouped[comment.path].push(comment);
    });

    return grouped;
  }

  /**
   * Validates a review comment
   * @param {ReviewComment} comment - Comment to validate
   * @returns {boolean} True if comment is valid
   */
  validateComment(comment) {
    if (!comment || typeof comment !== 'object') {
      return false;
    }

    const requiredFields = ['path', 'line', 'body'];
    for (const field of requiredFields) {
      if (!(field in comment)) {
        return false;
      }
    }

    if (typeof comment.path !== 'string' || comment.path.trim().length === 0) {
      return false;
    }

    if (typeof comment.line !== 'number' || comment.line < 1) {
      return false;
    }

    if (typeof comment.body !== 'string' || comment.body.trim().length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Truncates comment body if too long
   * @param {string} body - Comment body
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated comment body
   */
  truncateCommentBody(body, maxLength = 65536) {
    if (!body || typeof body !== 'string') {
      return '';
    }

    if (body.length <= maxLength) {
      return body;
    }

    const truncated = body.substring(0, maxLength - 100);
    return truncated + '\n\n... (comment truncated due to length)';
  }

  /**
   * Creates a comment for a specific line range
   * @param {ReviewIssue} issue - Issue to create comment for
   * @param {Object} options - Options for comment creation
   * @returns {ReviewComment} Review comment
   */
  createLineComment(issue, options = {}) {
    const { startLine, endLine, side = 'RIGHT' } = options;
    
    const comment = {
      path: issue.path,
      line: endLine || issue.line,
      body: this.formatIssue(issue),
      side: side,
      start_line: startLine || issue.line,
      start_side: side
    };

    return comment;
  }

  /**
   * Creates a general review comment (not tied to specific lines)
   * @param {string} body - Comment body
   * @param {string} path - File path (optional)
   * @returns {ReviewComment} General review comment
   */
  createGeneralComment(body, path = null) {
    const comment = {
      body: this.truncateCommentBody(body)
    };

    if (path) {
      comment.path = path;
    }

    return comment;
  }

  /**
   * Formats multiple issues into a single comment
   * @param {Array<ReviewIssue>} issues - Array of issues
   * @param {string} filePath - File path
   * @returns {string} Formatted multi-issue comment
   */
  formatMultiIssueComment(issues, filePath) {
    if (!issues || issues.length === 0) {
      return '';
    }

    let comment = `## Issues found in \`${filePath}\`\n\n`;
    
    issues.forEach((issue, index) => {
      const emoji = this.config.category_emojis[issue.category] || '📝';
      const confidence = Math.round(issue.confidence * 100);
      
      comment += `### ${index + 1}. ${issue.category.toUpperCase()} ${emoji}\n`;
      comment += `**Line ${issue.line}** - ${issue.explanation}\n`;
      
      if (issue.fix_patch && issue.fix_patch.trim()) {
        comment += `\n**Suggested fix:**\n\`\`\`\n${this.formatFixPatch(issue.fix_patch)}\n\`\`\`\n`;
      }
      
      comment += `\n*Confidence: ${confidence}%*\n\n`;
    });

    return comment;
  }

  /**
   * Gets configuration for the formatter
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Updates configuration
   * @param {Object} newConfig - New configuration to merge
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}
