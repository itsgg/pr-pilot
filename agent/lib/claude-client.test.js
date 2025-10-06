#!/usr/bin/env node

/**
 * Unit tests for claude-client.js
 * Tests Claude API integration and response parsing
 */

import { describe, it } from 'node:test';
import { ClaudeClient } from './claude-client.js';
import assert from 'node:assert';

describe('Claude Client', () => {
  const config = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    timeout: 60000,
    retries: 1,
    retry_delay: 1000
  };

  describe('constructor', () => {
    it('should create client with valid API key', () => {
      assert.doesNotThrow(() => {
        new ClaudeClient('test-api-key', config);
      });
    });

    it('should throw error for missing API key', () => {
      assert.throws(
        () => new ClaudeClient(null, config),
        /Anthropic API key is required/
      );
    });

    it('should throw error for empty API key', () => {
      assert.throws(
        () => new ClaudeClient('', config),
        /Anthropic API key is required/
      );
    });

    it('should merge provided configuration', () => {
      const customConfig = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        timeout: 30000
      };
      
      const client = new ClaudeClient('test-key', customConfig);
      
      assert.strictEqual(client.config.model, 'claude-3-5-sonnet-20241022');
      assert.strictEqual(client.config.max_tokens, 2000);
      assert.strictEqual(client.config.timeout, 30000);
    });
  });

  describe('fromEnvironment', () => {
    it('should create client from environment', () => {
      process.env.ANTHROPIC_API_KEY = 'env-api-key';
      
      assert.doesNotThrow(() => {
        ClaudeClient.fromEnvironment(config);
      });

      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should throw error when API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      assert.throws(
        () => ClaudeClient.fromEnvironment(config),
        /ANTHROPIC_API_KEY environment variable is required/
      );
    });
  });

  describe('parseReviewResponse', () => {
    it('should parse valid JSON response', () => {
      const client = new ClaudeClient('test-key', config);
      const responseText = `Here's my review:

{
  "summary": "Good changes overall, but needs some improvements",
  "issues": [
    {
      "path": "src/app.js",
      "line": 42,
      "category": "bug",
      "severity": "high",
      "explanation": "Missing error handling",
      "fix_patch": "try { ... } catch (error) { ... }",
      "confidence": 0.9
    }
  ],
  "risks": ["Potential security issue"]
}`;

      const result = client.parseReviewResponse(responseText);
      
      assert.strictEqual(result.summary, 'Good changes overall, but needs some improvements');
      assert.strictEqual(result.issues.length, 1);
      assert.strictEqual(result.issues[0].path, 'src/app.js');
      assert.strictEqual(result.issues[0].category, 'bug');
      assert.strictEqual(result.risks.length, 1);
    });

    it('should handle response without JSON', () => {
      const client = new ClaudeClient('test-key', config);
      const responseText = 'This is just plain text without JSON';
      
      const result = client.parseReviewResponse(responseText);
      
      assert.strictEqual(result.summary, 'Unable to parse Claude response');
      assert.strictEqual(result.issues.length, 0);
      assert.strictEqual(result.risks.length, 1);
      assert(result.risks[0].includes('Failed to parse'));
    });

    it('should handle malformed JSON', () => {
      const client = new ClaudeClient('test-key', config);
      const responseText = `{
        "summary": "Good changes",
        "issues": [
          {
            "path": "src/app.js",
            "line": 42,
            "category": "bug",
            "severity": "high",
            "explanation": "Missing error handling",
            "fix_patch": "try { ... } catch (error) { ... }",
            "confidence": 0.9
          }
        ],
        "risks": ["Potential security issue"]
      `; // Missing closing brace

      const result = client.parseReviewResponse(responseText);
      
      assert.strictEqual(result.summary, 'Unable to parse Claude response');
      assert.strictEqual(result.issues.length, 0);
    });
  });

  describe('validateReviewResponse', () => {
    it('should validate correct response', () => {
      const client = new ClaudeClient('test-key', config);
      const response = {
        summary: 'Good changes',
        issues: [
          {
            path: 'src/app.js',
            line: 42,
            category: 'bug',
            severity: 'high',
            explanation: 'Missing error handling',
            fix_patch: 'try { ... } catch (error) { ... }',
            confidence: 0.9
          }
        ],
        risks: ['Potential security issue']
      };

      assert.doesNotThrow(() => {
        client.validateReviewResponse(response);
      });
    });

    it('should reject response without summary', () => {
      const client = new ClaudeClient('test-key', config);
      const response = {
        issues: [],
        risks: []
      };

      assert.throws(
        () => client.validateReviewResponse(response),
        /Response must have a summary string/
      );
    });

    it('should reject response without issues array', () => {
      const client = new ClaudeClient('test-key', config);
      const response = {
        summary: 'Good changes',
        risks: []
      };

      assert.throws(
        () => client.validateReviewResponse(response),
        /Response must have an issues array/
      );
    });
  });

  describe('validateReviewIssue', () => {
    it('should validate correct issue', () => {
      const client = new ClaudeClient('test-key', config);
      const issue = {
        path: 'src/app.js',
        line: 42,
        category: 'bug',
        severity: 'high',
        explanation: 'Missing error handling',
        fix_patch: 'try { ... } catch (error) { ... }',
        confidence: 0.9
      };

      assert.doesNotThrow(() => {
        client.validateReviewIssue(issue, 0);
      });
    });

    it('should reject issue with invalid category', () => {
      const client = new ClaudeClient('test-key', config);
      const issue = {
        path: 'src/app.js',
        line: 42,
        category: 'invalid',
        severity: 'high',
        explanation: 'Missing error handling',
        confidence: 0.9
      };

      assert.throws(
        () => client.validateReviewIssue(issue, 0),
        /category must be one of/
      );
    });

    it('should reject issue with invalid confidence', () => {
      const client = new ClaudeClient('test-key', config);
      const issue = {
        path: 'src/app.js',
        line: 42,
        category: 'bug',
        severity: 'high',
        explanation: 'Missing error handling',
        confidence: 1.5
      };

      assert.throws(
        () => client.validateReviewIssue(issue, 0),
        /confidence must be a number between 0 and 1/
      );
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      const client = new ClaudeClient('test-key', config);
      const systemPrompt = 'You are a code reviewer.';
      const userPrompt = 'Please review this code.';
      
      const tokens = client.estimateTokens(systemPrompt, userPrompt);
      
      assert(typeof tokens === 'number');
      assert(tokens > 0);
    });

    it('should handle empty prompts', () => {
      const client = new ClaudeClient('test-key', config);
      const tokens = client.estimateTokens('', '');
      
      assert.strictEqual(tokens, 0);
    });
  });

  describe('createSystemPrompt', () => {
    it('should create system prompt without team rules', () => {
      const client = new ClaudeClient('test-key', config);
      const prompt = client.createSystemPrompt();
      
      assert(prompt.includes('senior code reviewer'));
      assert(prompt.includes('JSON'));
      assert(prompt.includes('summary'));
      assert(prompt.includes('issues'));
      assert(prompt.includes('risks'));
    });

    it('should create system prompt with team rules', () => {
      const client = new ClaudeClient('test-key', config);
      const teamRules = [
        'Use async/await, not callbacks',
        'Add JSDoc comments to exported functions'
      ];
      
      const prompt = client.createSystemPrompt(teamRules);
      
      assert(prompt.includes('senior code reviewer'));
      assert(prompt.includes('Team-specific rules'));
      assert(prompt.includes('Use async/await, not callbacks'));
      assert(prompt.includes('Add JSDoc comments to exported functions'));
    });
  });

  describe('createUserPrompt', () => {
    it('should create user prompt with file diffs', () => {
      const client = new ClaudeClient('test-key', config);
      const fileDiffs = [
        {
          path: 'src/app.js',
          status: 'modified',
          additions: 2,
          deletions: 1,
          binary: false,
          hunks: [
            {
              oldStart: 1,
              oldCount: 3,
              newStart: 1,
              newCount: 4,
              content: '@@ -1,3 +1,4 @@\n const express = require(\'express\');\n+const cors = require(\'cors\');\n'
            }
          ]
        }
      ];
      
      const prInfo = {
        title: 'Add CORS support',
        description: 'This PR adds CORS middleware to the Express app'
      };
      
      const prompt = client.createUserPrompt(fileDiffs, prInfo);
      
      assert(prompt.includes('Please review this pull request'));
      assert(prompt.includes('Title: Add CORS support'));
      assert(prompt.includes('Description: This PR adds CORS middleware'));
      assert(prompt.includes('--- src/app.js (modified) ---'));
      assert(prompt.includes('Changes: +2 -1'));
      assert(prompt.includes('@@ -1,3 +1,4 @@'));
    });

    it('should handle binary files', () => {
      const client = new ClaudeClient('test-key', config);
      const fileDiffs = [
        {
          path: 'image.png',
          status: 'added',
          additions: 0,
          deletions: 0,
          binary: true,
          hunks: []
        }
      ];
      
      const prInfo = {};
      const prompt = client.createUserPrompt(fileDiffs, prInfo);
      
      assert(prompt.includes('--- image.png (added) ---'));
      assert(prompt.includes('[Binary file - no content to review]'));
    });
  });

  describe('formatIssue', () => {
    it('should format issue correctly', () => {
      const client = new ClaudeClient('test-key', config);
      const issue = {
        path: 'src/app.js',
        line: 42,
        category: 'bug',
        severity: 'high',
        explanation: 'Missing error handling',
        fix_patch: 'try { ... } catch (error) { ... }',
        confidence: 0.9
      };
      
      const formatted = client.formatIssue(issue);
      
      assert(formatted.includes('**BUG**'));
      assert(formatted.includes('🐛'));
      assert(formatted.includes('Missing error handling'));
      assert(formatted.includes('Suggested fix:'));
      assert(formatted.includes('Confidence: 90%'));
    });

    it('should handle issue without fix patch', () => {
      const client = new ClaudeClient('test-key', config);
      const issue = {
        path: 'src/app.js',
        line: 42,
        category: 'style',
        severity: 'low',
        explanation: 'Inconsistent formatting',
        confidence: 0.7
      };
      
      const formatted = client.formatIssue(issue);
      
      assert(formatted.includes('**STYLE**'));
      assert(formatted.includes('💅'));
      assert(formatted.includes('Inconsistent formatting'));
      assert(!formatted.includes('Suggested fix:'));
      assert(formatted.includes('Confidence: 70%'));
    });
  });

  describe('getModelInfo', () => {
    it('should return model information', () => {
      const client = new ClaudeClient('test-key', config);
      const info = client.getModelInfo();
      
      assert.strictEqual(info.model, 'claude-3-5-sonnet-20241022');
      assert.strictEqual(info.max_tokens, 4000);
      assert.strictEqual(info.timeout, 60000);
    });
  });

  describe('createReviewPrompt', () => {
    it('should create complete review prompt', () => {
      const client = new ClaudeClient('test-key', config);
      const fileDiffs = [
        {
          path: 'src/app.js',
          status: 'modified',
          additions: 1,
          deletions: 0,
          binary: false,
          hunks: []
        }
      ];
      
      const prInfo = {
        title: 'Test PR',
        description: 'Test description'
      };
      
      const teamRules = ['Use const over let'];
      
      const result = client.createReviewPrompt(fileDiffs, prInfo, teamRules);
      
      assert(result.systemPrompt);
      assert(result.userPrompt);
      assert(typeof result.estimatedTokens === 'number');
      assert(result.estimatedTokens > 0);
    });
  });
});
