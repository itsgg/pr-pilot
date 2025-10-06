#!/usr/bin/env node

/**
 * Prompt templates for PR-Pilot
 * Contains system and user prompt templates for code review
 */

import { sanitizeText } from '../lib/security.js';

/**
 * Creates the system prompt for code review
 * @param {Object} options - Options for prompt generation
 * @param {Array<string>} options.teamRules - Team-specific coding rules
 * @param {string} options.projectName - Project name
 * @param {string} options.projectDescription - Project description
 * @returns {string} System prompt
 */
export function createSystemPrompt(options = {}) {
  const {
    teamRules = [],
    projectName = 'PR-Pilot',
    projectDescription = 'AI-powered Pull Request review agent using Claude'
  } = options;

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

## Review Guidelines

### Focus Areas
- **Bugs**: Logic errors, edge cases, potential runtime failures
- **Security**: Vulnerabilities, unsafe practices, data exposure
- **Performance**: Inefficient algorithms, memory leaks, blocking operations
- **Style**: Code consistency, readability, maintainability
- **Tests**: Missing tests, inadequate coverage, test quality

### Severity Levels
- **High**: Critical issues that must be fixed (security vulnerabilities, bugs that will cause failures)
- **Medium**: Important issues that should be addressed (performance problems, code quality issues)
- **Low**: Minor issues that could be improved (style inconsistencies, minor optimizations)

### Confidence Scoring
- **0.9-1.0**: Very confident (obvious issues, clear violations)
- **0.7-0.9**: Confident (likely issues, good evidence)
- **0.5-0.7**: Somewhat confident (possible issues, some evidence)
- **0.0-0.5**: Low confidence (uncertain, weak evidence)

### Code Fix Suggestions
- Provide specific, actionable fixes
- Use unified diff format when possible
- Include context around the change
- Explain why the fix is better
- Keep fixes concise and focused

### Review Principles
1. **Be constructive**: Focus on helping improve the code
2. **Be specific**: Point to exact lines and explain the issue clearly
3. **Be actionable**: Provide concrete suggestions for improvement
4. **Be fair**: Consider the context and intent of the changes
5. **Be thorough**: Look for patterns and related issues
6. **Be efficient**: Focus on the most important issues first

### Common Issues to Look For
- **Security**: Hardcoded secrets, SQL injection, XSS vulnerabilities, unsafe deserialization
- **Performance**: N+1 queries, inefficient algorithms, memory leaks, blocking operations
- **Bugs**: Null pointer exceptions, race conditions, off-by-one errors, type mismatches
- **Style**: Inconsistent formatting, unclear variable names, overly complex functions
- **Tests**: Missing edge cases, inadequate assertions, flaky tests

### Response Format
- Always return valid JSON
- Include a clear summary of the overall changes
- List specific issues with file paths and line numbers
- Provide actionable explanations and fixes
- Include any potential risks or concerns
- Be concise but comprehensive`;

  // Add team-specific rules if provided
  if (teamRules && teamRules.length > 0) {
    const teamRulesSection = `

## Team-Specific Rules
${teamRules.map(rule => `- ${rule}`).join('\n')}`;
    return basePrompt + teamRulesSection;
  }

  return basePrompt;
}

/**
 * Creates the user prompt with PR and diff information
 * @param {Object} options - Options for prompt generation
 * @param {Object} options.prInfo - PR information
 * @param {string} options.prInfo.title - PR title
 * @param {string} options.prInfo.description - PR description
 * @param {string} options.prInfo.author - PR author
 * @param {string} options.prInfo.baseBranch - Base branch
 * @param {string} options.prInfo.headBranch - Head branch
 * @param {Array<Object>} options.fileDiffs - Array of file diffs
 * @param {Object} options.projectContext - Project context
 * @param {string} options.projectContext.name - Project name
 * @param {string} options.projectContext.description - Project description
 * @param {string} options.projectContext.techStack - Technology stack
 * @returns {string} User prompt
 */
export function createUserPrompt(options = {}) {
  const {
    prInfo = {},
    fileDiffs = [],
    projectContext = {}
  } = options;

  const {
    title = '',
    description = '',
    author = '',
    baseBranch = 'main',
    headBranch = 'feature-branch'
  } = prInfo;

  const {
    name = 'PR-Pilot',
    description: projectDesc = 'AI-powered Pull Request review agent using Claude',
    techStack = 'Node.js, JavaScript, ES modules'
  } = projectContext;

  // Sanitize all user inputs to prevent prompt injection
  const sanitizedTitle = sanitizeText(title, { maxLength: 200 });
  const sanitizedDescription = sanitizeText(description, { maxLength: 1000 });
  const sanitizedAuthor = sanitizeText(author, { maxLength: 100 });
  const sanitizedBaseBranch = sanitizeText(baseBranch, { maxLength: 100 });
  const sanitizedHeadBranch = sanitizeText(headBranch, { maxLength: 100 });
  const sanitizedProjectName = sanitizeText(name, { maxLength: 100 });
  const sanitizedProjectDesc = sanitizeText(projectDesc, { maxLength: 500 });
  const sanitizedTechStack = sanitizeText(techStack, { maxLength: 200 });

  let prompt = `Please review this pull request for the ${sanitizedProjectName} project.

## Project Context
**Name**: ${sanitizedProjectName}
**Description**: ${sanitizedProjectDesc}
**Tech Stack**: ${sanitizedTechStack}

## Pull Request Information
**Title**: ${sanitizedTitle}
**Author**: ${sanitizedAuthor}
**Branch**: ${sanitizedHeadBranch} → ${sanitizedBaseBranch}`;

  if (sanitizedDescription) {
    prompt += `\n**Description**: ${sanitizedDescription}`;
  }

  prompt += `\n\n## Files Changed\n`;

  if (fileDiffs.length === 0) {
    prompt += `No files changed in this pull request.`;
    return prompt;
  }

  // Add file summary
  const fileSummary = fileDiffs.map(fileDiff => {
    const status = fileDiff.status || 'modified';
    const additions = fileDiff.additions || 0;
    const deletions = fileDiff.deletions || 0;
    const hunks = fileDiff.hunks ? fileDiff.hunks.length : 0;
    
    return `- \`${fileDiff.path}\` (${status}, +${additions}/-${deletions}, ${hunks} hunks)`;
  }).join('\n');

  prompt += fileSummary;
  prompt += `\n\n## Detailed Changes\n`;

  // Add detailed file diffs
  fileDiffs.forEach((fileDiff, index) => {
    prompt += `\n--- File ${index + 1}: \`${fileDiff.path}\` (${fileDiff.status || 'modified'}) ---\n`;
    
    if (fileDiff.binary) {
      prompt += `[Binary file - no content to review]\n`;
      return;
    }

    const additions = fileDiff.additions || 0;
    const deletions = fileDiff.deletions || 0;
    prompt += `Changes: +${additions} -${deletions}\n\n`;

    if (fileDiff.hunks && fileDiff.hunks.length > 0) {
      fileDiff.hunks.forEach((hunk, hunkIndex) => {
        prompt += `### Hunk ${hunkIndex + 1}\n`;
        prompt += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
        prompt += hunk.content || '';
        prompt += `\n`;
      });
    } else {
      prompt += `[No hunks found in this file]\n`;
    }
  });

  prompt += `\n\n## Review Instructions
Please provide your review in the required JSON format. Focus on:
1. **Critical issues** that must be fixed
2. **Security vulnerabilities** or unsafe practices
3. **Performance problems** or inefficiencies
4. **Code quality issues** that affect maintainability
5. **Missing tests** or inadequate test coverage

Be specific, actionable, and constructive in your feedback.`;

  return prompt;
}

/**
 * Creates a focused prompt for specific file changes
 * @param {Object} options - Options for focused prompt
 * @param {Object} options.fileDiff - Single file diff to review
 * @param {Object} options.prInfo - PR information
 * @param {Object} options.projectContext - Project context
 * @returns {string} Focused user prompt
 */
export function createFocusedPrompt(options = {}) {
  const {
    fileDiff,
    prInfo = {},
    projectContext = {}
  } = options;

  if (!fileDiff) {
    throw new Error('File diff is required for focused prompt');
  }

  const {
    title = '',
    description = ''
  } = prInfo;

  const {
    name = 'PR-Pilot',
    techStack = 'Node.js, JavaScript, ES modules'
  } = projectContext;

  let prompt = `Please review this specific file change for the ${name} project.

## Project Context
**Name**: ${name}
**Tech Stack**: ${techStack}

## Pull Request Information
**Title**: ${title}`;

  if (description) {
    prompt += `\n**Description**: ${description}`;
  }

  prompt += `\n\n## File to Review
**Path**: \`${fileDiff.path}\`
**Status**: ${fileDiff.status || 'modified'}
**Changes**: +${fileDiff.additions || 0} -${fileDiff.deletions || 0}`;

  if (fileDiff.binary) {
    prompt += `\n**Type**: Binary file (no content to review)`;
  } else {
    prompt += `\n\n## File Content\n`;
    
    if (fileDiff.hunks && fileDiff.hunks.length > 0) {
      fileDiff.hunks.forEach((hunk, index) => {
        prompt += `\n### Hunk ${index + 1}\n`;
        prompt += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
        prompt += hunk.content || '';
        prompt += `\n`;
      });
    } else {
      prompt += `[No hunks found in this file]\n`;
    }
  }

  prompt += `\n\n## Review Instructions
Please provide your review in the required JSON format. Focus on this specific file and look for:
1. **Bugs** or logic errors
2. **Security issues** or vulnerabilities
3. **Performance problems** or inefficiencies
4. **Code style** and consistency issues
5. **Missing error handling** or edge cases

Be specific about line numbers and provide actionable suggestions.`;

  return prompt;
}

/**
 * Creates a summary prompt for overall PR assessment
 * @param {Object} options - Options for summary prompt
 * @param {Object} options.prInfo - PR information
 * @param {Array<Object>} options.issues - Array of issues found
 * @param {Object} options.stats - Review statistics
 * @returns {string} Summary prompt
 */
export function createSummaryPrompt(options = {}) {
  const {
    prInfo = {},
    issues = [],
    stats = {}
  } = options;

  const {
    title = '',
    description = ''
  } = prInfo;

  const {
    totalFiles = 0,
    totalIssues = 0,
    issuesByCategory = {}
  } = stats;

  let prompt = `Please provide a final summary for this pull request review.

## Pull Request Information
**Title**: ${title}`;

  if (description) {
    prompt += `\n**Description**: ${description}`;
  }

  prompt += `\n\n## Review Summary
**Files reviewed**: ${totalFiles}
**Issues found**: ${totalIssues}`;

  if (Object.keys(issuesByCategory).length > 0) {
    prompt += `\n**Issues by category**:`;
    Object.entries(issuesByCategory).forEach(([category, count]) => {
      prompt += `\n- ${category}: ${count}`;
    });
  }

  if (issues.length > 0) {
    prompt += `\n\n## Key Issues Found
${issues.slice(0, 5).map((issue, index) => {
      return `${index + 1}. **${issue.category.toUpperCase()}** (${issue.severity}): ${issue.explanation} - Line ${issue.line} in \`${issue.path}\``;
    }).join('\n')}`;

    if (issues.length > 5) {
      prompt += `\n... and ${issues.length - 5} more issues`;
    }
  }

  prompt += `\n\n## Summary Instructions
Please provide a final summary in the required JSON format that includes:
1. **Overall assessment** of the PR quality
2. **Key concerns** or risks
3. **Recommendations** for improvement
4. **Approval status** (if applicable)

Focus on the most important issues and provide actionable next steps.`;

  return prompt;
}

/**
 * Creates a prompt for specific issue categories
 * @param {Object} options - Options for category prompt
 * @param {string} options.category - Issue category to focus on
 * @param {Array<Object>} options.fileDiffs - Array of file diffs
 * @param {Object} options.prInfo - PR information
 * @returns {string} Category-focused prompt
 */
export function createCategoryPrompt(options = {}) {
  const {
    category,
    fileDiffs = [],
    prInfo = {}
  } = options;

  if (!category) {
    throw new Error('Category is required for category prompt');
  }

  const categoryFocus = {
    bug: 'Focus on logic errors, edge cases, potential runtime failures, and code that might not work as intended.',
    security: 'Focus on security vulnerabilities, unsafe practices, data exposure, and potential attack vectors.',
    perf: 'Focus on performance issues, inefficient algorithms, memory leaks, and blocking operations.',
    style: 'Focus on code consistency, readability, maintainability, and adherence to coding standards.',
    test: 'Focus on missing tests, inadequate test coverage, test quality, and test reliability.'
  };

  const focusDescription = categoryFocus[category] || 'Focus on general code quality issues.';

  let prompt = `Please review this pull request with a focus on **${category.toUpperCase()}** issues.

## Review Focus
${focusDescription}

## Pull Request Information
**Title**: ${prInfo.title || 'Untitled PR'}
**Description**: ${prInfo.description || 'No description provided'}

## Files to Review
${fileDiffs.map(fileDiff => `- \`${fileDiff.path}\` (${fileDiff.status || 'modified'}, +${fileDiff.additions || 0}/-${fileDiff.deletions || 0})`).join('\n')}

## Detailed Changes
${fileDiffs.map(fileDiff => {
    if (fileDiff.binary) {
      return `\n--- \`${fileDiff.path}\` (Binary file) ---\n[Binary file - no content to review]`;
    }
    
    let content = `\n--- \`${fileDiff.path}\` (${fileDiff.status || 'modified'}) ---\n`;
    if (fileDiff.hunks && fileDiff.hunks.length > 0) {
      fileDiff.hunks.forEach((hunk, index) => {
        content += `\n### Hunk ${index + 1}\n`;
        content += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
        content += hunk.content || '';
        content += `\n`;
      });
    }
    return content;
  }).join('\n')}

## Review Instructions
Please provide your review in the required JSON format, focusing specifically on **${category}** issues. Look for:
- Issues that fall into the ${category} category
- Patterns or recurring problems
- Specific examples with line numbers
- Actionable suggestions for improvement

Be thorough but focused on the ${category} category.`;

  return prompt;
}

/**
 * Validates prompt options
 * @param {Object} options - Options to validate
 * @param {Array<string>} requiredFields - Required field names
 * @throws {Error} If validation fails
 */
export function validatePromptOptions(options, requiredFields = []) {
  if (!options || typeof options !== 'object') {
    throw new Error('Options must be an object');
  }

  for (const field of requiredFields) {
    if (!(field in options)) {
      throw new Error(`Required field '${field}' is missing from options`);
    }
  }
}

/**
 * Gets available prompt types
 * @returns {Array<string>} Available prompt types
 */
export function getPromptTypes() {
  return [
    'system',
    'user',
    'focused',
    'summary',
    'category'
  ];
}

/**
 * Creates a prompt based on type
 * @param {string} type - Prompt type
 * @param {Object} options - Options for prompt generation
 * @returns {string} Generated prompt
 */
export function createPrompt(type, options = {}) {
  switch (type) {
    case 'system':
      return createSystemPrompt(options);
    case 'user':
      return createUserPrompt(options);
    case 'focused':
      return createFocusedPrompt(options);
    case 'summary':
      return createSummaryPrompt(options);
    case 'category':
      return createCategoryPrompt(options);
    default:
      throw new Error(`Unknown prompt type: ${type}. Available types: ${getPromptTypes().join(', ')}`);
  }
}
