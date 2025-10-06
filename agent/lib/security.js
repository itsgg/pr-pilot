#!/usr/bin/env node

/**
 * Security utilities for PR-Pilot
 * Handles input validation, sanitization, and security measures
 */

/**
 * Validates and sanitizes file paths to prevent path traversal attacks
 * @param {string} path - File path to validate
 * @returns {string} Sanitized file path
 * @throws {Error} If path is invalid or contains traversal attempts
 */
export function validateFilePath(path) {
  if (!path || typeof path !== 'string') {
    throw new Error('File path must be a non-empty string');
  }

  // Remove null bytes and normalize path
  const sanitized = path.replace(/\0/g, '').trim();
  
  if (sanitized.length === 0) {
    throw new Error('File path cannot be empty');
  }

  // Check for path traversal attempts
  if (sanitized.includes('..') || sanitized.startsWith('/') || sanitized.includes('\\')) {
    throw new Error('Path traversal detected in file path');
  }

  // Check for suspicious patterns
  if (/[<>:"|?*]/.test(sanitized)) {
    throw new Error(`Invalid file path pattern detected: ${sanitized}`);
  }
  
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(sanitized)) {
    throw new Error(`Invalid file path pattern detected: ${sanitized}`);
  }
  
  if (/^\.+$/.test(sanitized)) {
    throw new Error(`Invalid file path pattern detected: ${sanitized}`);
  }

  return sanitized;
}

/**
 * Validates PR number to ensure it's a positive integer
 * @param {*} prNumber - PR number to validate
 * @returns {number} Validated PR number
 * @throws {Error} If PR number is invalid
 */
export function validatePRNumber(prNumber) {
  if (prNumber === null || prNumber === undefined) {
    throw new Error('PR number is required');
  }

  const num = parseInt(prNumber, 10);
  
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    throw new Error('PR number must be a positive integer');
  }

  if (num > 2147483647) { // Max safe integer for 32-bit systems
    throw new Error('PR number is too large');
  }

  return num;
}

/**
 * Validates repository string format
 * @param {string} repository - Repository string (owner/repo)
 * @returns {Object} Parsed owner and repo
 * @throws {Error} If repository format is invalid
 */
export function validateRepository(repository) {
  if (!repository || typeof repository !== 'string') {
    throw new Error('Repository must be a non-empty string');
  }

  const sanitized = repository.trim();
  
  if (sanitized.length === 0) {
    throw new Error('Repository cannot be empty');
  }

  // Check for valid format: owner/repo
  const parts = sanitized.split('/');
  if (parts.length !== 2) {
    throw new Error('Repository must be in format "owner/repo"');
  }

  const [owner, repo] = parts;
  
  if (!owner || !repo) {
    throw new Error('Repository owner and name cannot be empty');
  }

  // Validate owner and repo names
  const validNamePattern = /^[a-zA-Z0-9._-]+$/;
  
  if (!validNamePattern.test(owner)) {
    throw new Error('Repository owner contains invalid characters');
  }
  
  if (!validNamePattern.test(repo)) {
    throw new Error('Repository name contains invalid characters');
  }

  // Check length limits
  if (owner.length > 39) {
    throw new Error('Repository owner name too long (max 39 characters)');
  }
  
  if (repo.length > 100) {
    throw new Error('Repository name too long (max 100 characters)');
  }

  return { owner, repo };
}

/**
 * Sanitizes text content to prevent prompt injection
 * @param {string} text - Text to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized text
 */
export function sanitizeText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const {
    maxLength = 10000,
    removeNewlines = false,
    escapeSpecialChars = true,
    removeMarkdown = true
  } = options;

  let sanitized = text;

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove or escape potentially dangerous patterns
  if (escapeSpecialChars) {
    // Escape common prompt injection patterns
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /forget\s+everything/gi,
      /you\s+are\s+now/gi,
      /act\s+as\s+if/gi,
      /pretend\s+to\s+be/gi,
      /roleplay\s+as/gi,
      /system\s+prompt/gi,
      /override\s+instructions/gi,
      /new\s+instructions/gi,
      /disregard\s+previous/gi,
    ];

    for (const pattern of injectionPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
  }

  // Remove markdown formatting if requested
  if (removeMarkdown) {
    sanitized = sanitized
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Inline code
      .replace(/```[\s\S]*?```/g, '[CODE_BLOCK]') // Code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
  }

  // Remove excessive newlines
  if (removeNewlines) {
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  }

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 100) + '\n\n... [TRUNCATED]';
  }

  return sanitized.trim();
}

/**
 * Redacts sensitive information from text for logging
 * @param {string} text - Text to redact
 * @returns {string} Text with secrets redacted
 */
export function redactSecrets(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/ANTHROPIC_API_KEY[=:]\s*[^\s]+/gi, 'ANTHROPIC_API_KEY=***REDACTED***')
    .replace(/GITHUB_TOKEN[=:]\s*[^\s]+/gi, 'GITHUB_TOKEN=***REDACTED***')
    .replace(/sk-ant-[a-zA-Z0-9-]+/g, 'sk-ant-***REDACTED***')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***REDACTED***')
    .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_***REDACTED***')
    .replace(/ghu_[a-zA-Z0-9]{36}/g, 'ghu_***REDACTED***')
    .replace(/ghs_[a-zA-Z0-9]{36}/g, 'ghs_***REDACTED***')
    .replace(/ghr_[a-zA-Z0-9]{36}/g, 'ghr_***REDACTED***')
    .replace(/password[=:]\s*[^\s]+/gi, 'password=***REDACTED***')
    .replace(/secret[=:]\s*[^\s]+/gi, 'secret=***REDACTED***')
    .replace(/key[=:]\s*[^\s]+/gi, 'key=***REDACTED***')
    .replace(/\"token\":\s*\"[^\"]+\"/g, '"token": "***REDACTED***"')
    .replace(/\"api_key\":\s*\"[^\"]+\"/g, '"api_key": "***REDACTED***"');
}

/**
 * Validates JSON response from Claude to prevent injection
 * @param {Object} response - Response object to validate
 * @returns {Object} Validated response
 * @throws {Error} If response is invalid or contains injection attempts
 */
export function validateClaudeResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Response must be a valid object');
  }

  // Check for required fields
  const requiredFields = ['summary', 'issues', 'risks'];
  for (const field of requiredFields) {
    if (!(field in response)) {
      throw new Error(`Response missing required field: ${field}`);
    }
  }

  // Validate summary
  if (typeof response.summary !== 'string') {
    throw new Error('Summary must be a string');
  }

  // Sanitize summary
  response.summary = sanitizeText(response.summary, { maxLength: 500 });

  // Validate issues array
  if (!Array.isArray(response.issues)) {
    throw new Error('Issues must be an array');
  }

  // Validate each issue
  response.issues.forEach((issue, index) => {
    if (!issue || typeof issue !== 'object') {
      throw new Error(`Issue ${index} must be an object`);
    }

    // Validate required issue fields
    const requiredIssueFields = ['path', 'line', 'category', 'severity', 'explanation', 'confidence'];
    for (const field of requiredIssueFields) {
      if (!(field in issue)) {
        throw new Error(`Issue ${index} missing required field: ${field}`);
      }
    }

    // Validate and sanitize issue data
    issue.path = validateFilePath(issue.path);
    issue.explanation = sanitizeText(issue.explanation, { maxLength: 1000 });
    
    if (issue.fix_patch) {
      issue.fix_patch = sanitizeText(issue.fix_patch, { maxLength: 2000 });
    }

    // Validate line number
    const line = parseInt(issue.line, 10);
    if (isNaN(line) || !Number.isInteger(line) || line < 1) {
      throw new Error(`Issue ${index} line must be a positive integer`);
    }
    issue.line = line;

    // Validate category
    const validCategories = ['bug', 'style', 'security', 'perf', 'test'];
    if (!validCategories.includes(issue.category)) {
      throw new Error(`Issue ${index} category must be one of: ${validCategories.join(', ')}`);
    }

    // Validate severity
    const validSeverities = ['low', 'med', 'high'];
    if (!validSeverities.includes(issue.severity)) {
      throw new Error(`Issue ${index} severity must be one of: ${validSeverities.join(', ')}`);
    }

    // Validate confidence
    const confidence = parseFloat(issue.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new Error(`Issue ${index} confidence must be a number between 0 and 1`);
    }
    issue.confidence = confidence;
  });

  // Validate risks array
  if (!Array.isArray(response.risks)) {
    throw new Error('Risks must be an array');
  }

  // Sanitize risks
  response.risks = response.risks.map(risk => 
    sanitizeText(risk, { maxLength: 500 })
  ).filter(risk => risk.length > 0);

  return response;
}

/**
 * Rate limiter class to prevent API abuse
 */
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  /**
   * Checks if request is allowed and waits if necessary
   * @param {string} key - Unique key for rate limiting (e.g., API endpoint)
   * @returns {Promise<void>}
   */
  async waitIfNeeded(key = 'default') {
    const now = Date.now();
    const keyRequests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = keyRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = this.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`[pr-pilot] Rate limit reached for ${key}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
  }

  /**
   * Resets rate limit for a specific key
   * @param {string} key - Key to reset
   */
  reset(key = 'default') {
    this.requests.delete(key);
  }

  /**
   * Gets current request count for a key
   * @param {string} key - Key to check
   * @returns {number} Current request count
   */
  getRequestCount(key = 'default') {
    const now = Date.now();
    const keyRequests = this.requests.get(key) || [];
    return keyRequests.filter(time => now - time < this.windowMs).length;
  }
}

/**
 * Validates configuration for security issues
 * @param {Object} config - Configuration object
 * @throws {Error} If configuration has security issues
 */
export function validateConfigSecurity(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  // Check for hardcoded secrets (only actual secret patterns)
  const configStr = JSON.stringify(config).toLowerCase();
  const secretPatterns = [
    'sk-ant-',
    'ghp_',
    'gho_',
    'ghu_',
    'ghs_',
    'ghr_'
  ];

  for (const pattern of secretPatterns) {
    if (configStr.includes(pattern)) {
      throw new Error(`Potential hardcoded secret detected in configuration: ${pattern}`);
    }
  }

  // Validate numeric limits
  if (config.max_files !== undefined && (config.max_files < 1 || config.max_files > 1000)) {
    throw new Error('max_files must be between 1 and 1000');
  }

  if (config.cost_cap_usd !== undefined && (config.cost_cap_usd < 0.01 || config.cost_cap_usd > 100)) {
    throw new Error('cost_cap_usd must be between 0.01 and 100');
  }

  if (config.max_tokens !== undefined && (config.max_tokens < 100 || config.max_tokens > 100000)) {
    throw new Error('max_tokens must be between 100 and 100000');
  }
}
