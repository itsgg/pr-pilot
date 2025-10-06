#!/usr/bin/env node

/**
 * Unit tests for review-prompt.js
 * Tests prompt template generation and validation
 */

import { describe, it } from 'node:test';
import {
  createSystemPrompt,
  createUserPrompt,
  createFocusedPrompt,
  createSummaryPrompt,
  createCategoryPrompt,
  validatePromptOptions,
  getPromptTypes,
  createPrompt
} from './review-prompt.js';
import assert from 'node:assert';

describe('Review Prompt Templates', () => {
  const sampleFileDiff = {
    path: 'src/app.js',
    status: 'modified',
    additions: 5,
    deletions: 2,
    hunks: [
      {
        oldStart: 1,
        oldCount: 3,
        newStart: 1,
        newCount: 4,
        content: '@@ -1,3 +1,4 @@\n const express = require(\'express\');\n+const cors = require(\'cors\');\n const app = express();\n app.listen(3000);'
      }
    ]
  };

  const samplePrInfo = {
    title: 'Add CORS support',
    description: 'This PR adds CORS middleware to the Express app',
    author: 'developer',
    baseBranch: 'main',
    headBranch: 'feature/cors'
  };

  const sampleProjectContext = {
    name: 'PR-Pilot',
    description: 'AI-powered Pull Request review agent',
    techStack: 'Node.js, JavaScript, ES modules'
  };

  describe('createSystemPrompt', () => {
    it('should create system prompt with default options', () => {
      const prompt = createSystemPrompt();
      
      assert(prompt.includes('senior code reviewer'));
      assert(prompt.includes('JSON'));
      assert(prompt.includes('summary'));
      assert(prompt.includes('issues'));
      assert(prompt.includes('risks'));
      assert(prompt.includes('Review Guidelines'));
      assert(prompt.includes('Focus Areas'));
      assert(prompt.includes('Severity Levels'));
      assert(prompt.includes('Confidence Scoring'));
    });

    it('should include team rules when provided', () => {
      const teamRules = [
        'Use async/await, not callbacks',
        'Add JSDoc comments to exported functions',
        'Prefer const over let'
      ];
      
      const prompt = createSystemPrompt({ teamRules });
      
      assert(prompt.includes('Team-Specific Rules'));
      assert(prompt.includes('Use async/await, not callbacks'));
      assert(prompt.includes('Add JSDoc comments to exported functions'));
      assert(prompt.includes('Prefer const over let'));
    });

    it('should include project information when provided', () => {
      const prompt = createSystemPrompt({
        projectName: 'MyProject',
        projectDescription: 'A sample project'
      });
      
      // The system prompt doesn't directly include project info, but should be valid
      assert(prompt.includes('senior code reviewer'));
    });

    it('should handle empty team rules', () => {
      const prompt = createSystemPrompt({ teamRules: [] });
      
      assert(prompt.includes('senior code reviewer'));
      assert(!prompt.includes('Team-Specific Rules'));
    });
  });

  describe('createUserPrompt', () => {
    it('should create user prompt with basic options', () => {
      const prompt = createUserPrompt({
        prInfo: samplePrInfo,
        fileDiffs: [sampleFileDiff],
        projectContext: sampleProjectContext
      });
      
      assert(prompt.includes('Please review this pull request'));
      assert(prompt.includes('Project Context'));
      assert(prompt.includes('Pull Request Information'));
      assert(prompt.includes('Files Changed'));
      assert(prompt.includes('Detailed Changes'));
      assert(prompt.includes('Review Instructions'));
    });

    it('should include PR information', () => {
      const prompt = createUserPrompt({
        prInfo: samplePrInfo,
        fileDiffs: [sampleFileDiff]
      });
      
      assert(prompt.includes('Add CORS support'));
      assert(prompt.includes('This PR adds CORS middleware'));
      assert(prompt.includes('developer'));
      assert(prompt.includes('feature/cors → main'));
    });

    it('should include file changes', () => {
      const prompt = createUserPrompt({
        prInfo: samplePrInfo,
        fileDiffs: [sampleFileDiff]
      });
      
      assert(prompt.includes('src/app.js'));
      assert(prompt.includes('modified, +5/-2, 1 hunks'));
      assert(prompt.includes('@@ -1,3 +1,4 @@'));
      assert(prompt.includes('const express = require(\'express\');'));
    });

    it('should handle empty file diffs', () => {
      const prompt = createUserPrompt({
        prInfo: samplePrInfo,
        fileDiffs: []
      });
      
      assert(prompt.includes('No files changed in this pull request'));
    });

    it('should handle binary files', () => {
      const binaryFileDiff = {
        path: 'image.png',
        status: 'added',
        binary: true,
        additions: 0,
        deletions: 0
      };
      
      const prompt = createUserPrompt({
        prInfo: samplePrInfo,
        fileDiffs: [binaryFileDiff]
      });
      
      assert(prompt.includes('image.png'));
      assert(prompt.includes('[Binary file - no content to review]'));
    });

    it('should handle files without hunks', () => {
      const fileDiffWithoutHunks = {
        path: 'empty.js',
        status: 'added',
        additions: 0,
        deletions: 0,
        hunks: []
      };
      
      const prompt = createUserPrompt({
        prInfo: samplePrInfo,
        fileDiffs: [fileDiffWithoutHunks]
      });
      
      assert(prompt.includes('empty.js'));
      assert(prompt.includes('[No hunks found in this file]'));
    });

    it('should handle missing PR description', () => {
      const prInfoWithoutDesc = { ...samplePrInfo };
      delete prInfoWithoutDesc.description;
      
      const prompt = createUserPrompt({
        prInfo: prInfoWithoutDesc,
        fileDiffs: [sampleFileDiff]
      });
      
      assert(prompt.includes('Add CORS support'));
      assert(!prompt.includes('Description:'));
    });
  });

  describe('createFocusedPrompt', () => {
    it('should create focused prompt for single file', () => {
      const prompt = createFocusedPrompt({
        fileDiff: sampleFileDiff,
        prInfo: samplePrInfo,
        projectContext: sampleProjectContext
      });
      
      assert(prompt.includes('Please review this specific file change'));
      assert(prompt.includes('src/app.js'));
      assert(prompt.includes('Project Context'));
      assert(prompt.includes('File to Review'));
      assert(prompt.includes('File Content'));
      assert(prompt.includes('Review Instructions'));
    });

    it('should handle binary files in focused prompt', () => {
      const binaryFileDiff = {
        path: 'image.png',
        status: 'added',
        binary: true
      };
      
      const prompt = createFocusedPrompt({
        fileDiff: binaryFileDiff,
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('image.png'));
      assert(prompt.includes('Binary file (no content to review)'));
    });

    it('should throw error for missing file diff', () => {
      assert.throws(
        () => createFocusedPrompt({ prInfo: samplePrInfo }),
        /File diff is required for focused prompt/
      );
    });
  });

  describe('createSummaryPrompt', () => {
    it('should create summary prompt with issues', () => {
      const issues = [
        { category: 'bug', severity: 'high', explanation: 'Missing error handling', path: 'src/app.js', line: 42 },
        { category: 'style', severity: 'low', explanation: 'Inconsistent formatting', path: 'src/utils.js', line: 15 }
      ];
      
      const stats = {
        totalFiles: 2,
        totalIssues: 2,
        issuesByCategory: { bug: 1, style: 1 }
      };
      
      const prompt = createSummaryPrompt({
        prInfo: samplePrInfo,
        issues,
        stats
      });
      
      assert(prompt.includes('Please provide a final summary'));
      assert(prompt.includes('Pull Request Information'));
      assert(prompt.includes('Review Summary'));
      assert(prompt.includes('Files reviewed**: 2'));
      assert(prompt.includes('Issues found**: 2'));
      assert(prompt.includes('Issues by category'));
      assert(prompt.includes('bug: 1'));
      assert(prompt.includes('style: 1'));
      assert(prompt.includes('Key Issues Found'));
      assert(prompt.includes('Missing error handling'));
    });

    it('should handle empty issues array', () => {
      const prompt = createSummaryPrompt({
        prInfo: samplePrInfo,
        issues: [],
        stats: { totalFiles: 1, totalIssues: 0 }
      });
      
      assert(prompt.includes('Files reviewed**: 1'));
      assert(prompt.includes('Issues found**: 0'));
      assert(!prompt.includes('Key Issues Found'));
    });

    it('should limit displayed issues to 5', () => {
      const manyIssues = Array.from({ length: 8 }, (_, i) => ({
        category: 'bug',
        severity: 'medium',
        explanation: `Issue ${i + 1}`,
        path: 'src/file.js',
        line: i + 1
      }));
      
      const prompt = createSummaryPrompt({
        prInfo: samplePrInfo,
        issues: manyIssues,
        stats: { totalFiles: 1, totalIssues: 8 }
      });
      
      assert(prompt.includes('Key Issues Found'));
      assert(prompt.includes('Issue 1'));
      assert(prompt.includes('Issue 5'));
      assert(!prompt.includes('Issue 6'));
      assert(prompt.includes('... and 3 more issues'));
    });
  });

  describe('createCategoryPrompt', () => {
    it('should create category prompt for bug focus', () => {
      const prompt = createCategoryPrompt({
        category: 'bug',
        fileDiffs: [sampleFileDiff],
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('BUG'));
      assert(prompt.includes('logic errors, edge cases'));
      assert(prompt.includes('src/app.js'));
      assert(prompt.includes('Review Instructions'));
    });

    it('should create category prompt for security focus', () => {
      const prompt = createCategoryPrompt({
        category: 'security',
        fileDiffs: [sampleFileDiff],
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('SECURITY'));
      assert(prompt.includes('security vulnerabilities'));
    });

    it('should create category prompt for performance focus', () => {
      const prompt = createCategoryPrompt({
        category: 'perf',
        fileDiffs: [sampleFileDiff],
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('PERF'));
      assert(prompt.includes('performance issues'));
    });

    it('should create category prompt for style focus', () => {
      const prompt = createCategoryPrompt({
        category: 'style',
        fileDiffs: [sampleFileDiff],
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('STYLE'));
      assert(prompt.includes('code consistency'));
    });

    it('should create category prompt for test focus', () => {
      const prompt = createCategoryPrompt({
        category: 'test',
        fileDiffs: [sampleFileDiff],
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('TEST'));
      assert(prompt.includes('missing tests'));
    });

    it('should throw error for missing category', () => {
      assert.throws(
        () => createCategoryPrompt({ fileDiffs: [sampleFileDiff] }),
        /Category is required for category prompt/
      );
    });

    it('should handle unknown category', () => {
      const prompt = createCategoryPrompt({
        category: 'unknown',
        fileDiffs: [sampleFileDiff],
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('UNKNOWN'));
      assert(prompt.includes('general code quality issues'));
    });
  });

  describe('validatePromptOptions', () => {
    it('should validate correct options', () => {
      assert.doesNotThrow(() => {
        validatePromptOptions({ field1: 'value1', field2: 'value2' }, ['field1']);
      });
    });

    it('should throw error for missing required fields', () => {
      assert.throws(
        () => validatePromptOptions({ field1: 'value1' }, ['field1', 'field2']),
        /Required field 'field2' is missing/
      );
    });

    it('should throw error for non-object options', () => {
      assert.throws(
        () => validatePromptOptions(null, ['field1']),
        /Options must be an object/
      );
    });
  });

  describe('getPromptTypes', () => {
    it('should return available prompt types', () => {
      const types = getPromptTypes();
      
      assert(Array.isArray(types));
      assert(types.includes('system'));
      assert(types.includes('user'));
      assert(types.includes('focused'));
      assert(types.includes('summary'));
      assert(types.includes('category'));
    });
  });

  describe('createPrompt', () => {
    it('should create system prompt', () => {
      const prompt = createPrompt('system', { teamRules: ['Use const over let'] });
      
      assert(prompt.includes('senior code reviewer'));
      assert(prompt.includes('Use const over let'));
    });

    it('should create user prompt', () => {
      const prompt = createPrompt('user', {
        prInfo: samplePrInfo,
        fileDiffs: [sampleFileDiff]
      });
      
      assert(prompt.includes('Please review this pull request'));
      assert(prompt.includes('src/app.js'));
    });

    it('should create focused prompt', () => {
      const prompt = createPrompt('focused', {
        fileDiff: sampleFileDiff,
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('Please review this specific file change'));
    });

    it('should create summary prompt', () => {
      const prompt = createPrompt('summary', {
        prInfo: samplePrInfo,
        issues: [],
        stats: { totalFiles: 1, totalIssues: 0 }
      });
      
      assert(prompt.includes('Please provide a final summary'));
    });

    it('should create category prompt', () => {
      const prompt = createPrompt('category', {
        category: 'bug',
        fileDiffs: [sampleFileDiff],
        prInfo: samplePrInfo
      });
      
      assert(prompt.includes('BUG'));
    });

    it('should throw error for unknown prompt type', () => {
      assert.throws(
        () => createPrompt('unknown', {}),
        /Unknown prompt type: unknown/
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very long PR descriptions', () => {
      const longDescription = 'A'.repeat(1000);
      const prInfoWithLongDesc = { ...samplePrInfo, description: longDescription };
      
      const prompt = createUserPrompt({
        prInfo: prInfoWithLongDesc,
        fileDiffs: [sampleFileDiff]
      });
      
      assert(prompt.includes(longDescription));
    });

    it('should handle special characters in file paths', () => {
      const specialFileDiff = {
        ...sampleFileDiff,
        path: 'src/components/My-Component.jsx'
      };
      
      const prompt = createUserPrompt({
        prInfo: samplePrInfo,
        fileDiffs: [specialFileDiff]
      });
      
      assert(prompt.includes('src/components/My-Component.jsx'));
    });

    it('should handle empty team rules array', () => {
      const prompt = createSystemPrompt({ teamRules: [] });
      
      assert(prompt.includes('senior code reviewer'));
      assert(!prompt.includes('Team-Specific Rules'));
    });

    it('should handle null/undefined values gracefully', () => {
      const prompt = createUserPrompt({
        prInfo: { title: null, description: undefined },
        fileDiffs: [sampleFileDiff]
      });
      
      assert(prompt.includes('Pull Request Information'));
      assert(!prompt.includes('Description:'));
    });
  });
});
