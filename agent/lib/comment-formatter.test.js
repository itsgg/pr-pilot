#!/usr/bin/env node

/**
 * Unit tests for comment-formatter.js
 * Tests comment formatting and validation functionality
 */

import { describe, it } from 'node:test';
import { CommentFormatter } from './comment-formatter.js';
import assert from 'node:assert';

describe('Comment Formatter', () => {
  const config = {
    category_emojis: {
      bug: '🐛',
      style: '💅',
      security: '🔒',
      perf: '⚡',
      test: '🧪'
    },
    confidence_threshold: 0.6,
    max_explanation_sentences: 2,
    max_fix_patch_lines: 20
  };

  const sampleIssue = {
    path: 'src/app.js',
    line: 42,
    category: 'bug',
    severity: 'high',
    explanation: 'Missing error handling for API call',
    fix_patch: 'try {\n  await apiCall();\n} catch (error) {\n  console.error(error);\n}',
    confidence: 0.9
  };

  describe('constructor', () => {
    it('should create formatter with default config', () => {
      const formatter = new CommentFormatter();
      
      assert(formatter.config);
      assert(formatter.config.category_emojis);
      assert.strictEqual(formatter.config.confidence_threshold, 0.6);
    });

    it('should merge provided configuration', () => {
      const customConfig = {
        confidence_threshold: 0.8,
        max_fix_patch_lines: 10
      };
      
      const formatter = new CommentFormatter(customConfig);
      
      assert.strictEqual(formatter.config.confidence_threshold, 0.8);
      assert.strictEqual(formatter.config.max_fix_patch_lines, 10);
      assert.strictEqual(formatter.config.category_emojis.bug, '🐛');
    });
  });

  describe('formatIssue', () => {
    it('should format issue correctly', () => {
      const formatter = new CommentFormatter(config);
      const result = formatter.formatIssue(sampleIssue);
      
      assert(result.includes('**BUG**'));
      assert(result.includes('🐛'));
      assert(result.includes('🔴 High'));
      assert(result.includes('Missing error handling for API call'));
      assert(result.includes('**Suggested fix:**'));
      assert(result.includes('try {'));
      assert(result.includes('*Confidence: 90%*'));
    });

    it('should handle issue without fix patch', () => {
      const formatter = new CommentFormatter(config);
      const issue = { ...sampleIssue };
      delete issue.fix_patch;
      
      const result = formatter.formatIssue(issue);
      
      assert(result.includes('**BUG**'));
      assert(result.includes('Missing error handling for API call'));
      assert(!result.includes('**Suggested fix:**'));
    });

    it('should handle different categories and severities', () => {
      const formatter = new CommentFormatter(config);
      
      const styleIssue = { ...sampleIssue, category: 'style', severity: 'low' };
      const styleResult = formatter.formatIssue(styleIssue);
      
      assert(styleResult.includes('**STYLE**'));
      assert(styleResult.includes('💅'));
      assert(styleResult.includes('🟢 Low'));
      
      const securityIssue = { ...sampleIssue, category: 'security', severity: 'high' };
      const securityResult = formatter.formatIssue(securityIssue);
      
      assert(securityResult.includes('**SECURITY**'));
      assert(securityResult.includes('🔒'));
      assert(securityResult.includes('🔴 High'));
    });

    it('should throw error for invalid issue', () => {
      const formatter = new CommentFormatter(config);
      
      assert.throws(
        () => formatter.formatIssue(null),
        /Issue must be a valid object/
      );
      
      assert.throws(
        () => formatter.formatIssue({}),
        /Issue missing required field/
      );
    });
  });

  describe('validateIssue', () => {
    it('should validate correct issue', () => {
      const formatter = new CommentFormatter(config);
      
      assert.doesNotThrow(() => {
        formatter.validateIssue(sampleIssue);
      });
    });

    it('should reject issue with missing fields', () => {
      const formatter = new CommentFormatter(config);
      
      const invalidIssue = { ...sampleIssue };
      delete invalidIssue.path;
      
      assert.throws(
        () => formatter.validateIssue(invalidIssue),
        /Issue missing required field: path/
      );
    });

    it('should reject issue with invalid category', () => {
      const formatter = new CommentFormatter(config);
      
      const invalidIssue = { ...sampleIssue, category: 'invalid' };
      
      assert.throws(
        () => formatter.validateIssue(invalidIssue),
        /Issue category must be one of/
      );
    });

    it('should reject issue with invalid severity', () => {
      const formatter = new CommentFormatter(config);
      
      const invalidIssue = { ...sampleIssue, severity: 'invalid' };
      
      assert.throws(
        () => formatter.validateIssue(invalidIssue),
        /Issue severity must be one of/
      );
    });

    it('should reject issue with invalid confidence', () => {
      const formatter = new CommentFormatter(config);
      
      const invalidIssue = { ...sampleIssue, confidence: 1.5 };
      
      assert.throws(
        () => formatter.validateIssue(invalidIssue),
        /Issue confidence must be a number between 0 and 1/
      );
    });

    it('should reject issue with negative line number', () => {
      const formatter = new CommentFormatter(config);
      
      const invalidIssue = { ...sampleIssue, line: -1 };
      
      assert.throws(
        () => formatter.validateIssue(invalidIssue),
        /Issue line must be a positive number/
      );
    });
  });

  describe('formatSeverity', () => {
    it('should format severity levels correctly', () => {
      const formatter = new CommentFormatter(config);
      
      assert.strictEqual(formatter.formatSeverity('low'), '🟢 Low');
      assert.strictEqual(formatter.formatSeverity('med'), '🟡 Medium');
      assert.strictEqual(formatter.formatSeverity('high'), '🔴 High');
      assert.strictEqual(formatter.formatSeverity('invalid'), '🟡 Medium');
    });
  });

  describe('formatFixPatch', () => {
    it('should format fix patch correctly', () => {
      const formatter = new CommentFormatter(config);
      const fixPatch = 'try {\n  await apiCall();\n} catch (error) {\n  console.error(error);\n}';
      
      const result = formatter.formatFixPatch(fixPatch);
      
      assert.strictEqual(result, fixPatch);
    });

    it('should truncate long fix patches', () => {
      const formatter = new CommentFormatter({ ...config, max_fix_patch_lines: 3 });
      const longFixPatch = 'line1\nline2\nline3\nline4\nline5';
      
      const result = formatter.formatFixPatch(longFixPatch);
      
      assert(result.includes('line1'));
      assert(result.includes('line2'));
      assert(result.includes('line3'));
      assert(result.includes('... (2 more lines)'));
      assert(!result.includes('line4'));
    });

    it('should handle empty fix patch', () => {
      const formatter = new CommentFormatter(config);
      
      assert.strictEqual(formatter.formatFixPatch(''), '');
      assert.strictEqual(formatter.formatFixPatch(null), '');
      assert.strictEqual(formatter.formatFixPatch(undefined), '');
    });
  });

  describe('formatSummaryComment', () => {
    it('should format summary comment correctly', () => {
      const formatter = new CommentFormatter(config);
      const reviewData = {
        summary: 'Good changes overall, but needs some improvements',
        issues: [sampleIssue],
        risks: ['Potential security issue']
      };
      const stats = {
        totalFiles: 5,
        totalIssues: 1,
        estCostUsd: 0.05
      };
      
      const result = formatter.formatSummaryComment(reviewData, stats);
      
      assert(result.includes('## 🤖 PR-Pilot Review'));
      assert(result.includes('**Summary:** Good changes overall'));
      assert(result.includes('**Files reviewed:** 5'));
      assert(result.includes('**Issues found:** 1'));
      assert(result.includes('**Estimated cost:** $0.0500'));
      assert(result.includes('### Issues by Category'));
      assert(result.includes('🐛 **BUG**: 1 issues'));
      assert(result.includes('### ⚠️ Potential Risks'));
      assert(result.includes('Potential security issue'));
    });

    it('should handle review data without stats', () => {
      const formatter = new CommentFormatter(config);
      const reviewData = {
        summary: 'Good changes',
        issues: [],
        risks: []
      };
      
      const result = formatter.formatSummaryComment(reviewData);
      
      assert(result.includes('## 🤖 PR-Pilot Review'));
      assert(result.includes('**Summary:** Good changes'));
      assert(!result.includes('**Files reviewed:**'));
    });
  });

  describe('groupIssuesByCategory', () => {
    it('should group issues by category', () => {
      const formatter = new CommentFormatter(config);
      const issues = [
        { ...sampleIssue, category: 'bug' },
        { ...sampleIssue, category: 'style' },
        { ...sampleIssue, category: 'bug' },
        { ...sampleIssue, category: 'security' }
      ];
      
      const grouped = formatter.groupIssuesByCategory(issues);
      
      assert.strictEqual(grouped.bug.length, 2);
      assert.strictEqual(grouped.style.length, 1);
      assert.strictEqual(grouped.security.length, 1);
    });

    it('should handle empty issues array', () => {
      const formatter = new CommentFormatter(config);
      const grouped = formatter.groupIssuesByCategory([]);
      
      assert.strictEqual(Object.keys(grouped).length, 0);
    });
  });

  describe('convertToReviewComments', () => {
    it('should convert issues to review comments', () => {
      const formatter = new CommentFormatter(config);
      const issues = [sampleIssue];
      
      const comments = formatter.convertToReviewComments(issues);
      
      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].path, 'src/app.js');
      assert.strictEqual(comments[0].line, 42);
      assert.strictEqual(comments[0].side, 'RIGHT');
      assert(comments[0].body.includes('**BUG**'));
    });

    it('should filter by confidence threshold', () => {
      const formatter = new CommentFormatter({ ...config, confidence_threshold: 0.8 });
      const issues = [
        { ...sampleIssue, confidence: 0.9 },
        { ...sampleIssue, confidence: 0.5 }
      ];
      
      const comments = formatter.convertToReviewComments(issues);
      
      assert.strictEqual(comments.length, 1);
      // The comment doesn't preserve the confidence field, just filters by it
      assert(comments[0].body.includes('**BUG**'));
    });

    it('should handle invalid issues gracefully', () => {
      const formatter = new CommentFormatter(config);
      const issues = [
        sampleIssue,
        { ...sampleIssue, path: '' }, // Invalid issue
        { ...sampleIssue, line: 0 }   // Invalid issue
      ];
      
      const comments = formatter.convertToReviewComments(issues);
      
      assert.strictEqual(comments.length, 1);
    });
  });

  describe('filterIssuesByConfidence', () => {
    it('should filter issues by confidence', () => {
      const formatter = new CommentFormatter(config);
      const issues = [
        { ...sampleIssue, confidence: 0.9 },
        { ...sampleIssue, confidence: 0.5 },
        { ...sampleIssue, confidence: 0.7 }
      ];
      
      const filtered = formatter.filterIssuesByConfidence(issues, 0.6);
      
      assert.strictEqual(filtered.length, 2);
      assert(filtered.every(issue => issue.confidence >= 0.6));
    });
  });

  describe('groupCommentsByFile', () => {
    it('should group comments by file', () => {
      const formatter = new CommentFormatter(config);
      const comments = [
        { path: 'src/app.js', line: 1, body: 'comment1' },
        { path: 'src/app.js', line: 2, body: 'comment2' },
        { path: 'src/utils.js', line: 1, body: 'comment3' }
      ];
      
      const grouped = formatter.groupCommentsByFile(comments);
      
      assert.strictEqual(grouped['src/app.js'].length, 2);
      assert.strictEqual(grouped['src/utils.js'].length, 1);
    });
  });

  describe('validateComment', () => {
    it('should validate correct comment', () => {
      const formatter = new CommentFormatter(config);
      const comment = {
        path: 'src/app.js',
        line: 42,
        body: 'This is a comment'
      };
      
      assert.strictEqual(formatter.validateComment(comment), true);
    });

    it('should reject invalid comments', () => {
      const formatter = new CommentFormatter(config);
      
      assert.strictEqual(formatter.validateComment(null), false);
      assert.strictEqual(formatter.validateComment({}), false);
      assert.strictEqual(formatter.validateComment({ path: 'src/app.js' }), false);
      assert.strictEqual(formatter.validateComment({ path: '', line: 42, body: 'comment' }), false);
      assert.strictEqual(formatter.validateComment({ path: 'src/app.js', line: 0, body: 'comment' }), false);
    });
  });

  describe('truncateCommentBody', () => {
    it('should truncate long comments', () => {
      const formatter = new CommentFormatter(config);
      const longBody = 'a'.repeat(1000);
      
      const result = formatter.truncateCommentBody(longBody, 100);
      
      assert(result.length <= 100);
      assert(result.includes('... (comment truncated due to length)'));
    });

    it('should not truncate short comments', () => {
      const formatter = new CommentFormatter(config);
      const shortBody = 'Short comment';
      
      const result = formatter.truncateCommentBody(shortBody, 100);
      
      assert.strictEqual(result, shortBody);
    });
  });

  describe('createLineComment', () => {
    it('should create line comment correctly', () => {
      const formatter = new CommentFormatter(config);
      const comment = formatter.createLineComment(sampleIssue, {
        startLine: 40,
        endLine: 45,
        side: 'LEFT'
      });
      
      assert.strictEqual(comment.path, 'src/app.js');
      assert.strictEqual(comment.line, 45);
      assert.strictEqual(comment.start_line, 40);
      assert.strictEqual(comment.side, 'LEFT');
      assert(comment.body.includes('**BUG**'));
    });
  });

  describe('createGeneralComment', () => {
    it('should create general comment correctly', () => {
      const formatter = new CommentFormatter(config);
      const comment = formatter.createGeneralComment('This is a general comment', 'src/app.js');
      
      assert.strictEqual(comment.body, 'This is a general comment');
      assert.strictEqual(comment.path, 'src/app.js');
    });

    it('should create general comment without path', () => {
      const formatter = new CommentFormatter(config);
      const comment = formatter.createGeneralComment('This is a general comment');
      
      assert.strictEqual(comment.body, 'This is a general comment');
      assert.strictEqual(comment.path, undefined);
    });
  });

  describe('formatMultiIssueComment', () => {
    it('should format multi-issue comment correctly', () => {
      const formatter = new CommentFormatter(config);
      const issues = [
        { ...sampleIssue, category: 'bug' },
        { ...sampleIssue, category: 'style', line: 50 }
      ];
      
      const result = formatter.formatMultiIssueComment(issues, 'src/app.js');
      
      assert(result.includes('## Issues found in `src/app.js`'));
      assert(result.includes('### 1. BUG 🐛'));
      assert(result.includes('### 2. STYLE 💅'));
      assert(result.includes('**Line 42**'));
      assert(result.includes('**Line 50**'));
    });

    it('should handle empty issues array', () => {
      const formatter = new CommentFormatter(config);
      const result = formatter.formatMultiIssueComment([], 'src/app.js');
      
      assert.strictEqual(result, '');
    });
  });

  describe('getConfig and updateConfig', () => {
    it('should get current configuration', () => {
      const formatter = new CommentFormatter(config);
      const currentConfig = formatter.getConfig();
      
      assert.strictEqual(currentConfig.confidence_threshold, 0.6);
      assert(currentConfig.category_emojis);
    });

    it('should update configuration', () => {
      const formatter = new CommentFormatter(config);
      
      formatter.updateConfig({ confidence_threshold: 0.8 });
      
      assert.strictEqual(formatter.config.confidence_threshold, 0.8);
      assert.strictEqual(formatter.config.max_fix_patch_lines, 20);
    });
  });
});
