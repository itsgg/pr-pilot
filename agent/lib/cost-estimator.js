#!/usr/bin/env node

/**
 * Cost estimation utilities for PR-Pilot
 * Handles token counting and cost calculation for Claude API calls
 */

/**
 * Claude Sonnet 4.5 pricing (as of January 2025)
 * @type {Object}
 */
const CLAUDE_PRICING = {
  input: 3.0,    // $3 per million tokens
  output: 15.0   // $15 per million tokens
};

/**
 * Token estimation constants
 * @type {Object}
 */
const TOKEN_ESTIMATION = {
  // Rough approximation: 1 token ≈ 4 characters for English text
  CHARS_PER_TOKEN: 4,
  
  // Additional tokens for system prompt, JSON structure, etc.
  SYSTEM_OVERHEAD: 200,
  JSON_OVERHEAD: 100,
  
  // Minimum tokens for any meaningful response
  MIN_OUTPUT_TOKENS: 50,
  
  // Maximum reasonable output tokens for our use case
  MAX_OUTPUT_TOKENS: 2000
};

/**
 * Estimates the number of tokens in a text string
 * Uses a simple character-based approximation
 * @param {string} text - The text to count tokens for
 * @returns {number} Estimated number of tokens
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Basic token estimation: characters / 4
  const baseTokens = Math.ceil(text.length / TOKEN_ESTIMATION.CHARS_PER_TOKEN);
  
  // Add some overhead for special characters, whitespace, etc.
  const overhead = Math.ceil(baseTokens * 0.1);
  
  return baseTokens + overhead;
}

/**
 * Estimates tokens for a system prompt
 * @param {string} systemPrompt - The system prompt text
 * @returns {number} Estimated number of tokens
 */
export function estimateSystemTokens(systemPrompt) {
  return estimateTokens(systemPrompt) + TOKEN_ESTIMATION.SYSTEM_OVERHEAD;
}

/**
 * Estimates tokens for a user prompt
 * @param {string} userPrompt - The user prompt text
 * @returns {number} Estimated number of tokens
 */
export function estimateUserTokens(userPrompt) {
  return estimateTokens(userPrompt) + TOKEN_ESTIMATION.JSON_OVERHEAD;
}

/**
 * Estimates output tokens for Claude response
 * @param {number} inputTokens - Number of input tokens
 * @returns {number} Estimated number of output tokens
 */
export function estimateOutputTokens(inputTokens) {
  // Simple heuristic: output is typically 10-20% of input for code review
  const ratio = 0.15; // 15% of input tokens
  const estimated = Math.ceil(inputTokens * ratio);
  
  // Ensure we stay within reasonable bounds
  return Math.max(
    TOKEN_ESTIMATION.MIN_OUTPUT_TOKENS,
    Math.min(estimated, TOKEN_ESTIMATION.MAX_OUTPUT_TOKENS)
  );
}

/**
 * Calculates the cost in USD for a Claude API call
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Cost in USD
 */
export function calculateCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1_000_000) * CLAUDE_PRICING.input;
  const outputCost = (outputTokens / 1_000_000) * CLAUDE_PRICING.output;
  
  return inputCost + outputCost;
}

/**
 * Estimates the total cost for a Claude API call
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @returns {Object} Cost estimation details
 */
export function estimateApiCost(systemPrompt, userPrompt) {
  const systemTokens = estimateSystemTokens(systemPrompt);
  const userTokens = estimateUserTokens(userPrompt);
  const inputTokens = systemTokens + userTokens;
  
  const outputTokens = estimateOutputTokens(inputTokens);
  const totalCost = calculateCost(inputTokens, outputTokens);
  
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: totalCost,
    breakdown: {
      systemTokens,
      userTokens,
      inputCost: (inputTokens / 1_000_000) * CLAUDE_PRICING.input,
      outputCost: (outputTokens / 1_000_000) * CLAUDE_PRICING.output
    }
  };
}

/**
 * Checks if the estimated cost exceeds the cost cap
 * @param {Object} costEstimate - Cost estimation from estimateApiCost
 * @param {number} costCapUsd - Maximum allowed cost in USD
 * @returns {Object} Cost check result
 */
export function checkCostCap(costEstimate, costCapUsd) {
  const exceedsCap = costEstimate.costUsd > costCapUsd;
  
  return {
    exceedsCap,
    costUsd: costEstimate.costUsd,
    costCapUsd,
    remainingUsd: Math.max(0, costCapUsd - costEstimate.costUsd),
    percentage: (costEstimate.costUsd / costCapUsd) * 100
  };
}

/**
 * Estimates cost for reviewing multiple files
 * @param {Array<Object>} files - Array of file objects with diff content
 * @param {string} systemPrompt - The system prompt
 * @param {Object} config - Configuration object
 * @returns {Object} Cost estimation for multiple files
 */
export function estimateMultiFileCost(files, systemPrompt, config) {
  if (!files || files.length === 0) {
    return {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      files: [],
      exceedsCap: false
    };
  }

  const results = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  // Estimate cost for each file
  files.forEach((file, index) => {
    const userPrompt = buildUserPrompt(file, config);
    const costEstimate = estimateApiCost(systemPrompt, userPrompt);
    
    results.push({
      file: file.path || `file_${index}`,
      inputTokens: costEstimate.inputTokens,
      outputTokens: costEstimate.outputTokens,
      costUsd: costEstimate.costUsd
    });
    
    totalInputTokens += costEstimate.inputTokens;
    totalOutputTokens += costEstimate.outputTokens;
    totalCostUsd += costEstimate.costUsd;
  });

  const costCheck = checkCostCap(
    { costUsd: totalCostUsd },
    config.cost_cap_usd
  );

  return {
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    files: results,
    exceedsCap: costCheck.exceedsCap,
    costCheck
  };
}

/**
 * Builds a user prompt for a single file
 * @param {Object} file - File object with diff content
 * @param {Object} config - Configuration object
 * @returns {string} User prompt text
 */
function buildUserPrompt(file, config) {
  const projectInfo = `Project: ${config.project.name}
Description: ${config.project.description}

Team Rules:
${config.team_rules.map(rule => `- ${rule}`).join('\n')}

Files to Review:
File: ${file.path}
Changes:
${file.diff || 'No changes'}

Return ONLY valid JSON with your review.`;

  return projectInfo;
}

/**
 * Formats cost information for logging
 * @param {Object} costEstimate - Cost estimation object
 * @returns {string} Formatted cost string
 */
export function formatCost(costEstimate) {
  return `$${costEstimate.costUsd.toFixed(4)} (${costEstimate.inputTokens} input + ${costEstimate.outputTokens} output tokens)`;
}

/**
 * Formats cost breakdown for detailed logging
 * @param {Object} costEstimate - Cost estimation object
 * @returns {string} Formatted cost breakdown
 */
export function formatCostBreakdown(costEstimate) {
  const { breakdown } = costEstimate;
  
  return `Cost breakdown:
  System tokens: ${breakdown.systemTokens} ($${breakdown.inputCost.toFixed(4)})
  User tokens: ${breakdown.userTokens} ($${breakdown.outputCost.toFixed(4)})
  Total: ${formatCost(costEstimate)}`;
}

/**
 * Gets cost estimation constants for reference
 * @returns {Object} Cost estimation constants
 */
export function getCostConstants() {
  return {
    pricing: { ...CLAUDE_PRICING },
    estimation: { ...TOKEN_ESTIMATION }
  };
}

/**
 * Validates cost estimation parameters
 * @param {Object} params - Parameters to validate
 * @throws {Error} If parameters are invalid
 */
export function validateCostParams(params) {
  const { inputTokens, outputTokens, costCapUsd } = params;
  
  if (inputTokens !== undefined && (typeof inputTokens !== 'number' || inputTokens < 0)) {
    throw new Error('inputTokens must be a non-negative number');
  }
  
  if (outputTokens !== undefined && (typeof outputTokens !== 'number' || outputTokens < 0)) {
    throw new Error('outputTokens must be a non-negative number');
  }
  
  if (costCapUsd !== undefined && (typeof costCapUsd !== 'number' || costCapUsd <= 0)) {
    throw new Error('costCapUsd must be a positive number');
  }
}
