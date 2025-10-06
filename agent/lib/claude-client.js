#!/usr/bin/env node

/**
 * Claude client for PR-Pilot
 * Handles Anthropic API integration for code review
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Represents a review issue found by Claude
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
 * Represents a complete review response from Claude
 * @typedef {Object} ReviewResponse
 * @property {string} summary - 1-2 sentence overview of the PR
 * @property {Array<ReviewIssue>} issues - Array of review issues
 * @property {Array<string>} risks - Potential risks or concerns
 */

/**
 * Claude client for code review
 */
export class ClaudeClient {
  /**
   * Creates a new Claude client
   * @param {string} apiKey - Anthropic API key
   * @param {Object} config - Configuration object
   */
  constructor(apiKey, config = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Anthropic API key is required');
    }

    this.apiKey = apiKey;
    this.config = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      timeout: 60000,
      retries: 1,
      retry_delay: 1000,
      ...config
    };

    this.anthropic = new Anthropic({
      apiKey: this.apiKey,
      timeout: this.config.timeout
    });
  }

  /**
   * Creates a Claude client from environment variables
   * @param {Object} config - Configuration object
   * @returns {ClaudeClient} New Claude client instance
   */
  static fromEnvironment(config = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    return new ClaudeClient(apiKey, config);
  }

  /**
   * Reviews code changes and returns structured feedback
   * @param {string} systemPrompt - System prompt for Claude
   * @param {string} userPrompt - User prompt with code changes
   * @param {Object} options - Additional options
   * @returns {Promise<ReviewResponse>} Structured review response
   */
  async reviewCode(systemPrompt, userPrompt, options = {}) {
    try {
      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.max_tokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ],
        ...options
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return this.parseReviewResponse(content.text);
    } catch (error) {
      console.error('[pr-pilot] Claude API error:', error.message);
      throw new Error(`Failed to get review from Claude: ${error.message}`);
    }
  }

  /**
   * Parses Claude's response into structured format
   * @param {string} responseText - Raw response text from Claude
   * @returns {ReviewResponse} Parsed review response
   */
  parseReviewResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate the response structure
      this.validateReviewResponse(parsed);

      return parsed;
    } catch (error) {
      console.error('[pr-pilot] Failed to parse Claude response:', error.message);
      console.error('[pr-pilot] Response text:', responseText);
      
      // Return a fallback response
      return {
        summary: 'Unable to parse Claude response',
        issues: [],
        risks: ['Failed to parse AI response - manual review recommended']
      };
    }
  }

  /**
   * Validates the structure of a review response
   * @param {Object} response - Response object to validate
   * @throws {Error} If response structure is invalid
   */
  validateReviewResponse(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('Response must be an object');
    }

    if (!response.summary || typeof response.summary !== 'string') {
      throw new Error('Response must have a summary string');
    }

    if (!Array.isArray(response.issues)) {
      throw new Error('Response must have an issues array');
    }

    if (!Array.isArray(response.risks)) {
      throw new Error('Response must have a risks array');
    }

    // Validate each issue
    response.issues.forEach((issue, index) => {
      this.validateReviewIssue(issue, index);
    });
  }

  /**
   * Validates a review issue
   * @param {Object} issue - Issue object to validate
   * @param {number} index - Issue index for error reporting
   * @throws {Error} If issue structure is invalid
   */
  validateReviewIssue(issue, index) {
    const requiredFields = ['path', 'line', 'category', 'severity', 'explanation', 'confidence'];
    
    for (const field of requiredFields) {
      if (!(field in issue)) {
        throw new Error(`Issue ${index} missing required field: ${field}`);
      }
    }

    // Validate field types and values
    if (typeof issue.path !== 'string') {
      throw new Error(`Issue ${index} path must be a string`);
    }

    if (typeof issue.line !== 'number' || issue.line < 1) {
      throw new Error(`Issue ${index} line must be a positive number`);
    }

    const validCategories = ['bug', 'style', 'security', 'perf', 'test'];
    if (!validCategories.includes(issue.category)) {
      throw new Error(`Issue ${index} category must be one of: ${validCategories.join(', ')}`);
    }

    const validSeverities = ['low', 'med', 'high'];
    if (!validSeverities.includes(issue.severity)) {
      throw new Error(`Issue ${index} severity must be one of: ${validSeverities.join(', ')}`);
    }

    if (typeof issue.explanation !== 'string' || issue.explanation.trim().length === 0) {
      throw new Error(`Issue ${index} explanation must be a non-empty string`);
    }

    if (typeof issue.confidence !== 'number' || issue.confidence < 0 || issue.confidence > 1) {
      throw new Error(`Issue ${index} confidence must be a number between 0 and 1`);
    }
  }

  /**
   * Estimates tokens for a prompt
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @returns {number} Estimated token count
   */
  estimateTokens(systemPrompt, userPrompt) {
    // Simple estimation: ~4 characters per token
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const userTokens = Math.ceil(userPrompt.length / 4);
    return systemTokens + userTokens;
  }

  /**
   * Checks if the API key is valid
   * @returns {Promise<boolean>} True if API key is valid
   */
  async validateApiKey() {
    try {
      await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      });
      return true;
    } catch (error) {
      console.error('[pr-pilot] API key validation failed:', error.message);
      return false;
    }
  }

  /**
   * Gets model information
   * @returns {Object} Model information
   */
  getModelInfo() {
    return {
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      timeout: this.config.timeout
    };
  }

  /**
   * Creates a review prompt for code changes
   * @param {Array<Object>} fileDiffs - Array of file diffs
   * @param {Object} prInfo - PR information
   * @param {Array<string>} teamRules - Team coding rules
   * @returns {Object} System and user prompts
   */
  createReviewPrompt(fileDiffs, prInfo, teamRules = []) {
    const systemPrompt = this.createSystemPrompt(teamRules);
    const userPrompt = this.createUserPrompt(fileDiffs, prInfo);
    
    return {
      systemPrompt,
      userPrompt,
      estimatedTokens: this.estimateTokens(systemPrompt, userPrompt)
    };
  }

  /**
   * Creates the system prompt for code review
   * @param {Array<string>} teamRules - Team coding rules
   * @returns {string} System prompt
   */
  createSystemPrompt(teamRules = []) {
    const basePrompt = `You are a senior code reviewer with expertise in modern software development practices. Your task is to review pull request changes and provide actionable feedback.

IMPORTANT: You must respond with ONLY valid JSON in this exact format:
{
  "summary": "1-2 sentence overview of the PR",
  "issues": [
    {
      "path": "src/file.js",
      "line": 42,
      "category": "bug|style|security|perf|test",
      "severity": "low|med|high",
      "explanation": "Clear, actionable reason (1-2 sentences)",
      "fix_patch": "Suggested code fix (unified diff or code block)",
      "confidence": 0.85
    }
  ],
  "risks": ["Potential risk or concern about the changes"]
}

Guidelines:
- Focus on bugs, security issues, performance problems, and code quality
- Be specific and actionable in your feedback
- Provide code fixes when possible
- Use appropriate severity levels (low/med/high)
- Set confidence scores realistically (0-1)
- Only flag issues you're confident about
- Consider the context and intent of the changes`;

    if (teamRules && teamRules.length > 0) {
      return basePrompt + `\n\nTeam-specific rules:\n${teamRules.map(rule => `- ${rule}`).join('\n')}`;
    }

    return basePrompt;
  }

  /**
   * Creates the user prompt with code changes
   * @param {Array<Object>} fileDiffs - Array of file diffs
   * @param {Object} prInfo - PR information
   * @returns {string} User prompt
   */
  createUserPrompt(fileDiffs, prInfo) {
    let prompt = `Please review this pull request:\n\n`;
    
    if (prInfo.title) {
      prompt += `Title: ${prInfo.title}\n`;
    }
    
    if (prInfo.description) {
      prompt += `Description: ${prInfo.description}\n`;
    }
    
    prompt += `\nFiles changed:\n`;
    
    fileDiffs.forEach(fileDiff => {
      prompt += `\n--- ${fileDiff.path} (${fileDiff.status}) ---\n`;
      prompt += `Changes: +${fileDiff.additions} -${fileDiff.deletions}\n\n`;
      
      if (fileDiff.binary) {
        prompt += `[Binary file - no content to review]\n`;
      } else {
        fileDiff.hunks.forEach(hunk => {
          prompt += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
          prompt += hunk.content;
        });
      }
    });
    
    prompt += `\n\nPlease provide your review in the required JSON format.`;
    
    return prompt;
  }

  /**
   * Formats a review issue for display
   * @param {ReviewIssue} issue - Review issue
   * @param {Object} formatConfig - Formatting configuration
   * @returns {string} Formatted issue string
   */
  formatIssue(issue, formatConfig = {}) {
    const emojis = {
      bug: '🐛',
      style: '💅',
      security: '🔒',
      perf: '⚡',
      test: '🧪'
    };

    const emoji = emojis[issue.category] || '📝';
    const confidence = Math.round(issue.confidence * 100);
    
    let formatted = `**${issue.category.toUpperCase()}** ${emoji} ${issue.explanation}\n\n`;
    
    if (issue.fix_patch) {
      formatted += `Suggested fix:\n\`\`\`\n${issue.fix_patch}\n\`\`\`\n\n`;
    }
    
    formatted += `Confidence: ${confidence}%`;
    
    return formatted;
  }

  /**
   * Retries an operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<any>} Operation result
   */
  async retryOperation(operation, maxRetries = this.config.retries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = this.config.retry_delay * Math.pow(2, attempt);
        console.log(`[pr-pilot] Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}
