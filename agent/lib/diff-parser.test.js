#!/usr/bin/env node

/**
 * Unit tests for diff-parser.js
 * Tests diff parsing, filtering, and extraction functionality
 */

import { describe, it } from 'node:test';
import {
  parseDiff,
  filterFiles,
  limitFiles,
  extractHunksWithContext,
  formatFileDiff,
  getDiffStats,
  validateDiff,
  extractChangedLines
} from './diff-parser.js';
import assert from 'node:assert';

describe('Diff Parser', () => {
  const sampleDiff = `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 const express = require('express');
 const app = express();
+const cors = require('cors');
 
 app.listen(3000, () => {
@@ -5,6 +6,7 @@ app.listen(3000, () => {
   console.log('Server running on port 3000');
 });
 
+app.use(cors());
 app.get('/', (req, res) => {
   res.send('Hello World!');
 });`;

  const multiFileDiff = `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 const express = require('express');
+const cors = require('cors');
 
 app.listen(3000);
 
diff --git a/package.json b/package.json
index 9876543..fedcba9 100644
--- a/package.json
+++ b/package.json
@@ -5,6 +5,7 @@
   "dependencies": {
     "express": "^4.18.0",
+    "cors": "^2.8.5",
     "dotenv": "^8.2.0"
   }
 }`;

  describe('parseDiff', () => {
    it('should parse a simple diff', () => {
      const result = parseDiff(sampleDiff);
      
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].path, 'src/app.js');
      assert.strictEqual(result[0].status, 'modified');
      assert.strictEqual(result[0].hunks.length, 2);
      assert.strictEqual(result[0].additions, 2);
      assert.strictEqual(result[0].deletions, 0);
    });

    it('should parse multi-file diff', () => {
      const result = parseDiff(multiFileDiff);
      
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].path, 'src/app.js');
      assert.strictEqual(result[1].path, 'package.json');
    });

    it('should handle empty diff', () => {
      const result = parseDiff('');
      assert.strictEqual(result.length, 0);
    });

    it('should handle null/undefined diff', () => {
      assert.strictEqual(parseDiff(null).length, 0);
      assert.strictEqual(parseDiff(undefined).length, 0);
    });

    it('should parse hunk headers correctly', () => {
      const result = parseDiff(sampleDiff);
      const hunk = result[0].hunks[0];
      
      assert.strictEqual(hunk.oldStart, 1);
      assert.strictEqual(hunk.oldCount, 3);
      assert.strictEqual(hunk.newStart, 1);
      assert.strictEqual(hunk.newCount, 4);
    });

    it('should count additions and deletions correctly', () => {
      const diffWithDeletions = `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,4 +1,2 @@
 const a = 1;
-const b = 2;
-const c = 3;
 const d = 4;`;

      const result = parseDiff(diffWithDeletions);
      const fileDiff = result[0];
      
      assert.strictEqual(fileDiff.additions, 0);
      assert.strictEqual(fileDiff.deletions, 2);
    });
  });

  describe('filterFiles', () => {
    const fileDiffs = [
      { path: 'src/app.js', hunks: [] },
      { path: 'dist/bundle.js', hunks: [] },
      { path: 'node_modules/package/index.js', hunks: [] },
      { path: 'test/spec.js', hunks: [] }
    ];

    it('should filter files by pattern', () => {
      const patterns = ['dist/**', 'node_modules/**'];
      const result = filterFiles(fileDiffs, patterns);
      
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].path, 'src/app.js');
      assert.strictEqual(result[1].path, 'test/spec.js');
    });

    it('should handle empty patterns', () => {
      const result = filterFiles(fileDiffs, []);
      assert.strictEqual(result.length, 4);
    });

    it('should handle null patterns', () => {
      const result = filterFiles(fileDiffs, null);
      assert.strictEqual(result.length, 4);
    });
  });

  describe('limitFiles', () => {
    const fileDiffs = [
      { path: 'file1.js', hunks: [] },
      { path: 'file2.js', hunks: [] },
      { path: 'file3.js', hunks: [] },
      { path: 'file4.js', hunks: [] }
    ];

    it('should limit files to specified number', () => {
      const result = limitFiles(fileDiffs, 2);
      assert.strictEqual(result.length, 2);
    });

    it('should handle unlimited files', () => {
      const result = limitFiles(fileDiffs, 0);
      assert.strictEqual(result.length, 4);
    });

    it('should handle negative limit', () => {
      const result = limitFiles(fileDiffs, -1);
      assert.strictEqual(result.length, 4);
    });
  });

  describe('extractHunksWithContext', () => {
    it('should extract hunks with context', () => {
      const fileDiff = {
        hunks: [{
          lines: ['-old line 1', '+new line 1', ' context line'],
          content: '-old line 1\n+new line 1\n context line\n'
        }]
      };

      const result = extractHunksWithContext(fileDiff, 1);
      
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].lines.length, 3);
    });

    it('should handle empty hunks', () => {
      const fileDiff = { hunks: [] };
      const result = extractHunksWithContext(fileDiff);
      
      assert.strictEqual(result.length, 0);
    });
  });

  describe('formatFileDiff', () => {
    it('should format file diff correctly', () => {
      const fileDiff = {
        path: 'src/app.js',
        status: 'modified',
        additions: 2,
        deletions: 1,
        binary: false,
        hunks: [{
          oldStart: 1,
          oldCount: 3,
          newStart: 1,
          newCount: 4,
          content: '@@ -1,3 +1,4 @@\n const express = require(\'express\');\n+const cors = require(\'cors\');\n'
        }]
      };

      const result = formatFileDiff(fileDiff);
      
      assert(result.includes('File: src/app.js'));
      assert(result.includes('Status: modified'));
      assert(result.includes('Changes: +2 -1'));
      assert(result.includes('@@ -1,3 +1,4 @@'));
    });

    it('should handle binary files', () => {
      const fileDiff = {
        path: 'image.png',
        status: 'binary',
        binary: true,
        hunks: []
      };

      const result = formatFileDiff(fileDiff);
      
      assert(result.includes('File: image.png'));
      assert(result.includes('Binary file'));
    });
  });

  describe('getDiffStats', () => {
    it('should calculate correct statistics', () => {
      const fileDiffs = [
        {
          path: 'file1.js',
          status: 'modified',
          additions: 5,
          deletions: 2,
          hunks: [{ lines: [] }, { lines: [] }],
          binary: false
        },
        {
          path: 'file2.js',
          status: 'added',
          additions: 10,
          deletions: 0,
          hunks: [{ lines: [] }],
          binary: false
        },
        {
          path: 'image.png',
          status: 'binary',
          additions: 0,
          deletions: 0,
          hunks: [],
          binary: true
        }
      ];

      const stats = getDiffStats(fileDiffs);
      
      assert.strictEqual(stats.totalFiles, 3);
      assert.strictEqual(stats.totalAdditions, 15);
      assert.strictEqual(stats.totalDeletions, 2);
      assert.strictEqual(stats.totalHunks, 3);
      assert.strictEqual(stats.binaryFiles, 1);
      assert.strictEqual(stats.filesByStatus.modified, 1);
      assert.strictEqual(stats.filesByStatus.added, 1);
      assert.strictEqual(stats.filesByStatus.binary, 1);
    });

    it('should handle empty file diffs', () => {
      const stats = getDiffStats([]);
      
      assert.strictEqual(stats.totalFiles, 0);
      assert.strictEqual(stats.totalAdditions, 0);
      assert.strictEqual(stats.totalDeletions, 0);
    });
  });

  describe('validateDiff', () => {
    it('should validate correct diff', () => {
      const result = validateDiff(sampleDiff);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.error, null);
    });

    it('should reject empty diff', () => {
      const result = validateDiff('');
      
      assert.strictEqual(result.valid, false);
      assert(result.error.includes('empty'));
    });

    it('should reject null diff', () => {
      const result = validateDiff(null);
      
      assert.strictEqual(result.valid, false);
      assert(result.error.includes('string'));
    });

    it('should reject diff without file headers', () => {
      const invalidDiff = '@@ -1,3 +1,4 @@\n some content';
      const result = validateDiff(invalidDiff);
      
      assert.strictEqual(result.valid, false);
      assert(result.error.includes('file headers'));
    });

    it('should reject diff without hunk headers', () => {
      const invalidDiff = 'diff --git a/file b/file\nsome content';
      const result = validateDiff(invalidDiff);
      
      assert.strictEqual(result.valid, false);
      assert(result.error.includes('hunk headers'));
    });
  });

  describe('extractChangedLines', () => {
    it('should extract addition lines', () => {
      const hunk = {
        lines: ['-old line', '+new line 1', '+new line 2', ' context line'],
        newStart: 10
      };

      const result = extractChangedLines(hunk);
      
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].type, 'deletion');
      assert.strictEqual(result[0].line, 'old line');
      assert.strictEqual(result[1].type, 'addition');
      assert.strictEqual(result[1].line, 'new line 1');
      assert.strictEqual(result[2].type, 'addition');
      assert.strictEqual(result[2].line, 'new line 2');
    });

    it('should handle empty hunk', () => {
      const hunk = { lines: [] };
      const result = extractChangedLines(hunk);
      
      assert.strictEqual(result.length, 0);
    });
  });

  describe('edge cases', () => {
    it('should handle diff with only context lines', () => {
      const contextOnlyDiff = `diff --git a/file.js b/file.js
index 1234567..abcdefg 100644
--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 const a = 1;
 const b = 2;
-const c = 3;
+const c = 4;`;

      const result = parseDiff(contextOnlyDiff);
      
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].additions, 1);
      assert.strictEqual(result[0].deletions, 1);
    });

    it('should handle diff with new file', () => {
      const newFileDiff = `diff --git a/newfile.js b/newfile.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/newfile.js
@@ -0,0 +1,3 @@
+const express = require('express');
+const app = express();
+app.listen(3000);`;

      const result = parseDiff(newFileDiff);
      
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].status, 'added');
      assert.strictEqual(result[0].additions, 3);
      assert.strictEqual(result[0].deletions, 0);
    });
  });
});
