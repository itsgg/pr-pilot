#!/usr/bin/env node

/**
 * Unit tests for cost-estimator.js
 * Tests token counting, cost calculation, and cost cap validation
 */

import { describe, it } from 'node:test';
import {
  estimateTokens,
  estimateSystemTokens,
  estimateUserTokens,
  estimateOutputTokens,
  calculateCost,
  estimateApiCost,
  checkCostCap,
  estimateMultiFileCost,
  formatCost,
  formatCostBreakdown,
  getCostConstants,
  validateCostParams
} from './cost-estimator.js';
import assert from 'node:assert';

describe('Cost Estimator', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello world!';
      const tokens = estimateTokens(text);
      
      // 12 characters / 4 + 10% overhead = 3 + 1 = 4 tokens
      assert.strictEqual(tokens, 4);
    });

    it('should handle empty text', () => {
      assert.strictEqual(estimateTokens(''), 0);
      assert.strictEqual(estimateTokens(null), 0);
      assert.strictEqual(estimateTokens(undefined), 0);
    });

    it('should handle long text', () => {
      const text = 'A'.repeat(1000); // 1000 characters
      const tokens = estimateTokens(text);
      
      // 1000 / 4 + 10% = 250 + 25 = 275 tokens
      assert.strictEqual(tokens, 275);
    });
  });

  describe('estimateSystemTokens', () => {
    it('should add system overhead to token count', () => {
      const prompt = 'You are a code reviewer.';
      const tokens = estimateSystemTokens(prompt);
      
      const baseTokens = estimateTokens(prompt);
      assert.strictEqual(tokens, baseTokens + 200); // +200 system overhead
    });
  });

  describe('estimateUserTokens', () => {
    it('should add JSON overhead to token count', () => {
      const prompt = 'Review this code.';
      const tokens = estimateUserTokens(prompt);
      
      const baseTokens = estimateTokens(prompt);
      assert.strictEqual(tokens, baseTokens + 100); // +100 JSON overhead
    });
  });

  describe('estimateOutputTokens', () => {
    it('should estimate output tokens based on input', () => {
      const inputTokens = 1000;
      const outputTokens = estimateOutputTokens(inputTokens);
      
      // 15% of 1000 = 150 tokens
      assert.strictEqual(outputTokens, 150);
    });

    it('should respect minimum output tokens', () => {
      const inputTokens = 100; // Very small input
      const outputTokens = estimateOutputTokens(inputTokens);
      
      // Should be at least 50 tokens
      assert(outputTokens >= 50);
    });

    it('should respect maximum output tokens', () => {
      const inputTokens = 50000; // Very large input
      const outputTokens = estimateOutputTokens(inputTokens);
      
      // Should be at most 2000 tokens
      assert(outputTokens <= 2000);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly', () => {
      const inputTokens = 1000;
      const outputTokens = 200;
      const cost = calculateCost(inputTokens, outputTokens);
      
      // Input: 1000/1M * $3 = $0.003
      // Output: 200/1M * $15 = $0.003
      // Total: $0.006
      assert.strictEqual(cost, 0.006);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost(0, 0);
      assert.strictEqual(cost, 0);
    });
  });

  describe('estimateApiCost', () => {
    it('should estimate complete API cost', () => {
      const systemPrompt = 'You are a code reviewer.';
      const userPrompt = 'Review this code: console.log("hello");';
      
      const estimate = estimateApiCost(systemPrompt, userPrompt);
      
      assert(typeof estimate.inputTokens, 'number');
      assert(typeof estimate.outputTokens, 'number');
      assert(typeof estimate.totalTokens, 'number');
      assert(typeof estimate.costUsd, 'number');
      assert(estimate.inputTokens > 0);
      assert(estimate.outputTokens > 0);
      assert(estimate.costUsd > 0);
    });

    it('should include breakdown information', () => {
      const systemPrompt = 'You are a code reviewer.';
      const userPrompt = 'Review this code.';
      
      const estimate = estimateApiCost(systemPrompt, userPrompt);
      
      assert(estimate.breakdown);
      assert(typeof estimate.breakdown.systemTokens, 'number');
      assert(typeof estimate.breakdown.userTokens, 'number');
      assert(typeof estimate.breakdown.inputCost, 'number');
      assert(typeof estimate.breakdown.outputCost, 'number');
    });
  });

  describe('checkCostCap', () => {
    it('should detect when cost exceeds cap', () => {
      const costEstimate = { costUsd: 0.75 };
      const costCapUsd = 0.50;
      
      const result = checkCostCap(costEstimate, costCapUsd);
      
      assert.strictEqual(result.exceedsCap, true);
      assert.strictEqual(result.costUsd, 0.75);
      assert.strictEqual(result.costCapUsd, 0.50);
      assert.strictEqual(result.remainingUsd, 0);
      assert.strictEqual(result.percentage, 150);
    });

    it('should detect when cost is within cap', () => {
      const costEstimate = { costUsd: 0.25 };
      const costCapUsd = 0.50;
      
      const result = checkCostCap(costEstimate, costCapUsd);
      
      assert.strictEqual(result.exceedsCap, false);
      assert.strictEqual(result.costUsd, 0.25);
      assert.strictEqual(result.costCapUsd, 0.50);
      assert.strictEqual(result.remainingUsd, 0.25);
      assert.strictEqual(result.percentage, 50);
    });
  });

  describe('estimateMultiFileCost', () => {
    it('should estimate cost for multiple files', () => {
      const files = [
        { path: 'file1.js', diff: 'console.log("hello");' },
        { path: 'file2.js', diff: 'const x = 42;' }
      ];
      const systemPrompt = 'You are a code reviewer.';
      const config = {
        project: { name: 'Test', description: 'Test project' },
        team_rules: ['Rule 1', 'Rule 2'],
        cost_cap_usd: 1.0
      };
      
      const result = estimateMultiFileCost(files, systemPrompt, config);
      
      assert(typeof result.totalCostUsd, 'number');
      assert(typeof result.totalInputTokens, 'number');
      assert(typeof result.totalOutputTokens, 'number');
      assert(Array.isArray(result.files));
      assert.strictEqual(result.files.length, 2);
      assert(typeof result.exceedsCap, 'boolean');
    });

    it('should handle empty files array', () => {
      const result = estimateMultiFileCost([], 'system', {});
      
      assert.strictEqual(result.totalCostUsd, 0);
      assert.strictEqual(result.totalInputTokens, 0);
      assert.strictEqual(result.totalOutputTokens, 0);
      assert.strictEqual(result.files.length, 0);
      assert.strictEqual(result.exceedsCap, false);
    });
  });

  describe('formatCost', () => {
    it('should format cost with 4 decimal places', () => {
      const costEstimate = {
        costUsd: 0.123456,
        inputTokens: 1000,
        outputTokens: 200
      };
      
      const formatted = formatCost(costEstimate);
      
      assert(formatted.includes('$0.1235'));
      assert(formatted.includes('1000 input'));
      assert(formatted.includes('200 output'));
    });
  });

  describe('formatCostBreakdown', () => {
    it('should format detailed cost breakdown', () => {
      const costEstimate = {
        costUsd: 0.123456,
        inputTokens: 1000,
        outputTokens: 200,
        breakdown: {
          systemTokens: 300,
          userTokens: 700,
          inputCost: 0.003,
          outputCost: 0.003
        }
      };
      
      const formatted = formatCostBreakdown(costEstimate);
      
      assert(formatted.includes('System tokens: 300'));
      assert(formatted.includes('User tokens: 700'));
      assert(formatted.includes('$0.1235'));
    });
  });

  describe('getCostConstants', () => {
    it('should return pricing and estimation constants', () => {
      const constants = getCostConstants();
      
      assert(constants.pricing);
      assert.strictEqual(constants.pricing.input, 3.0);
      assert.strictEqual(constants.pricing.output, 15.0);
      
      assert(constants.estimation);
      assert.strictEqual(constants.estimation.CHARS_PER_TOKEN, 4);
      assert.strictEqual(constants.estimation.SYSTEM_OVERHEAD, 200);
    });
  });

  describe('validateCostParams', () => {
    it('should validate correct parameters', () => {
      assert.doesNotThrow(() => {
        validateCostParams({
          inputTokens: 1000,
          outputTokens: 200,
          costCapUsd: 0.50
        });
      });
    });

    it('should throw error for invalid input tokens', () => {
      assert.throws(
        () => validateCostParams({ inputTokens: -1 }),
        /inputTokens must be a non-negative number/
      );
      
      assert.throws(
        () => validateCostParams({ inputTokens: 'invalid' }),
        /inputTokens must be a non-negative number/
      );
    });

    it('should throw error for invalid output tokens', () => {
      assert.throws(
        () => validateCostParams({ outputTokens: -1 }),
        /outputTokens must be a non-negative number/
      );
    });

    it('should throw error for invalid cost cap', () => {
      assert.throws(
        () => validateCostParams({ costCapUsd: 0 }),
        /costCapUsd must be a positive number/
      );
      
      assert.throws(
        () => validateCostParams({ costCapUsd: -1 }),
        /costCapUsd must be a positive number/
      );
    });
  });
});
