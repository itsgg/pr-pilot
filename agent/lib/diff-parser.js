#!/usr/bin/env node

/**
 * Diff parser for PR-Pilot
 * Parses unified diffs and extracts hunks for review
 */

/**
 * Represents a parsed diff hunk
 * @typedef {Object} DiffHunk
 * @property {string} file - File path
 * @property {number} oldStart - Starting line number in old file
 * @property {number} oldCount - Number of lines in old file
 * @property {number} newStart - Starting line number in new file
 * @property {number} newCount - Number of lines in new file
 * @property {Array<string>} lines - Lines in the hunk
 * @property {string} content - Raw hunk content
 */

/**
 * Represents a parsed file diff
 * @typedef {Object} FileDiff
 * @property {string} path - File path
 * @property {string} status - File status (added, modified, deleted, renamed)
 * @property {Array<DiffHunk>} hunks - Array of hunks in the file
 * @property {string} rawDiff - Raw diff content for the file
 * @property {number} additions - Number of additions
 * @property {number} deletions - Number of deletions
 */

/**
 * Parses a unified diff string and extracts file diffs
 * @param {string} diffContent - Raw unified diff content
 * @returns {Array<FileDiff>} Array of parsed file diffs
 */
export function parseDiff(diffContent) {
  if (!diffContent || typeof diffContent !== 'string') {
    return [];
  }

  const lines = diffContent.split('\n');
  const fileDiffs = [];
  let currentFile = null;
  let currentHunk = null;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      // Save previous file if exists
      if (currentFile) {
        fileDiffs.push(currentFile);
      }

      // Start new file
      currentFile = createNewFileDiff(line);
      inHunk = false;
      continue;
    }

    // Index header: index hash1..hash2 mode
    if (line.startsWith('index ')) {
      if (currentFile) {
        currentFile.index = line;
      }
      continue;
    }

    // Binary file indicator
    if (line.startsWith('Binary files')) {
      if (currentFile) {
        currentFile.binary = true;
        currentFile.status = 'binary';
      }
      continue;
    }

    // File mode changes
    if (line.startsWith('new file mode') || line.startsWith('deleted file mode')) {
      if (currentFile) {
        if (line.includes('new file')) {
          currentFile.status = 'added';
        } else if (line.includes('deleted file')) {
          currentFile.status = 'deleted';
        }
      }
      continue;
    }

    // Rename detection
    if (line.startsWith('rename from') || line.startsWith('rename to')) {
      if (currentFile) {
        currentFile.status = 'renamed';
        if (line.startsWith('rename from')) {
          currentFile.oldPath = line.replace('rename from ', '');
        } else if (line.startsWith('rename to')) {
          currentFile.newPath = line.replace('rename to ', '');
        }
      }
      continue;
    }

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith('@@')) {
      if (currentFile) {
        // Save previous hunk if exists
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }

        // Parse hunk header
        currentHunk = parseHunkHeader(line, i);
        inHunk = true;
      }
      continue;
    }

    // Hunk content lines
    if (inHunk && currentHunk && currentFile) {
      currentHunk.lines.push(line);
      currentHunk.content += line + '\n';

      // Count additions and deletions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentFile.additions++;
        currentHunk.additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentFile.deletions++;
        currentHunk.deletions++;
      }
    }
  }

  // Save last hunk and file
  if (currentHunk && currentFile) {
    currentFile.hunks.push(currentHunk);
  }
  if (currentFile) {
    fileDiffs.push(currentFile);
  }

  return fileDiffs;
}

/**
 * Creates a new file diff object
 * @param {string} diffLine - The diff --git line
 * @returns {FileDiff} New file diff object
 */
function createNewFileDiff(diffLine) {
  // Extract file paths from: diff --git a/path b/path
  const match = diffLine.match(/diff --git a\/(.+) b\/(.+)/);
  const oldPath = match ? match[1] : '';
  const newPath = match ? match[2] : '';

  return {
    path: newPath || oldPath,
    oldPath: oldPath,
    newPath: newPath,
    status: 'modified',
    hunks: [],
    rawDiff: diffLine + '\n',
    additions: 0,
    deletions: 0,
    binary: false,
    index: null
  };
}

/**
 * Parses a hunk header line
 * @param {string} hunkLine - The @@ line
 * @param {number} lineNumber - Line number in the diff
 * @returns {DiffHunk} Parsed hunk object
 */
function parseHunkHeader(hunkLine, lineNumber) {
  // Parse: @@ -oldStart,oldCount +newStart,newCount @@ optional context
  const match = hunkLine.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
  
  if (!match) {
    throw new Error(`Invalid hunk header at line ${lineNumber}: ${hunkLine}`);
  }

  const oldStart = parseInt(match[1], 10);
  const oldCount = match[2] ? parseInt(match[2], 10) : 1;
  const newStart = parseInt(match[3], 10);
  const newCount = match[4] ? parseInt(match[4], 10) : 1;
  const context = match[5] ? match[5].trim() : '';

  return {
    file: '', // Will be set by the caller
    oldStart,
    oldCount,
    newStart,
    newCount,
    lines: [],
    content: hunkLine + '\n',
    additions: 0,
    deletions: 0,
    context: context
  };
}

/**
 * Filters file diffs based on exclude patterns
 * @param {Array<FileDiff>} fileDiffs - Array of file diffs
 * @param {Array<string>} excludePatterns - Array of glob patterns to exclude
 * @returns {Array<FileDiff>} Filtered file diffs
 */
export function filterFiles(fileDiffs, excludePatterns = []) {
  if (!excludePatterns || excludePatterns.length === 0) {
    return fileDiffs;
  }

  return fileDiffs.filter(fileDiff => {
    return !excludePatterns.some(pattern => {
      return matchesPattern(fileDiff.path, pattern);
    });
  });
}

/**
 * Checks if a file path matches a glob pattern
 * @param {string} filePath - File path to check
 * @param {string} pattern - Glob pattern
 * @returns {boolean} True if file matches pattern
 */
function matchesPattern(filePath, pattern) {
  // Simple glob matching (can be enhanced with minimatch later)
  if (pattern.includes('**')) {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(filePath);
  }
  
  if (pattern.includes('*')) {
    const regex = new RegExp(pattern.replace(/\*/g, '[^/]*'));
    return regex.test(filePath);
  }
  
  return filePath === pattern || filePath.startsWith(pattern + '/');
}

/**
 * Limits the number of files to process
 * @param {Array<FileDiff>} fileDiffs - Array of file diffs
 * @param {number} maxFiles - Maximum number of files
 * @returns {Array<FileDiff>} Limited file diffs
 */
export function limitFiles(fileDiffs, maxFiles = 20) {
  if (!maxFiles || maxFiles <= 0) {
    return fileDiffs;
  }

  return fileDiffs.slice(0, maxFiles);
}

/**
 * Extracts hunks with context around changes
 * @param {FileDiff} fileDiff - File diff object
 * @param {number} contextLines - Number of context lines around changes
 * @returns {Array<DiffHunk>} Hunks with context
 */
export function extractHunksWithContext(fileDiff, contextLines = 60) {
  if (!fileDiff || !fileDiff.hunks) {
    return [];
  }

  return fileDiff.hunks.map(hunk => {
    const lines = hunk.lines;
    const contextStart = Math.max(0, 0 - contextLines);
    const contextEnd = Math.min(lines.length, lines.length + contextLines);
    
    return {
      ...hunk,
      lines: lines.slice(contextStart, contextEnd),
      content: lines.slice(contextStart, contextEnd).join('\n')
    };
  });
}

/**
 * Formats a file diff for display
 * @param {FileDiff} fileDiff - File diff object
 * @returns {string} Formatted diff string
 */
export function formatFileDiff(fileDiff) {
  if (!fileDiff) {
    return '';
  }

  let output = `File: ${fileDiff.path}\n`;
  output += `Status: ${fileDiff.status}\n`;
  
  if (fileDiff.binary) {
    output += 'Binary file\n';
    return output;
  }

  output += `Changes: +${fileDiff.additions} -${fileDiff.deletions}\n\n`;

  fileDiff.hunks.forEach((hunk, index) => {
    output += `Hunk ${index + 1}:\n`;
    output += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
    output += hunk.content;
    output += '\n';
  });

  return output;
}

/**
 * Gets statistics about a diff
 * @param {Array<FileDiff>} fileDiffs - Array of file diffs
 * @returns {Object} Diff statistics
 */
export function getDiffStats(fileDiffs) {
  const stats = {
    totalFiles: fileDiffs.length,
    totalAdditions: 0,
    totalDeletions: 0,
    totalHunks: 0,
    filesByStatus: {},
    binaryFiles: 0
  };

  fileDiffs.forEach(fileDiff => {
    stats.totalAdditions += fileDiff.additions;
    stats.totalDeletions += fileDiff.deletions;
    stats.totalHunks += fileDiff.hunks.length;
    
    if (fileDiff.binary) {
      stats.binaryFiles++;
    }

    const status = fileDiff.status;
    stats.filesByStatus[status] = (stats.filesByStatus[status] || 0) + 1;
  });

  return stats;
}

/**
 * Validates a diff content
 * @param {string} diffContent - Raw diff content
 * @returns {Object} Validation result
 */
export function validateDiff(diffContent) {
  if (!diffContent || typeof diffContent !== 'string') {
    return {
      valid: false,
      error: 'Diff content must be a non-empty string'
    };
  }

  if (diffContent.trim().length === 0) {
    return {
      valid: false,
      error: 'Diff content is empty'
    };
  }

  // Check for basic diff structure
  const lines = diffContent.split('\n');
  const hasFileHeader = lines.some(line => line.startsWith('diff --git'));
  const hasHunkHeader = lines.some(line => line.startsWith('@@'));

  if (!hasFileHeader) {
    return {
      valid: false,
      error: 'Diff does not contain file headers (diff --git)'
    };
  }

  if (!hasHunkHeader) {
    return {
      valid: false,
      error: 'Diff does not contain hunk headers (@@)'
    };
  }

  return {
    valid: true,
    error: null
  };
}

/**
 * Extracts only the changed lines from a hunk
 * @param {DiffHunk} hunk - Hunk object
 * @returns {Array<Object>} Array of changed lines with metadata
 */
export function extractChangedLines(hunk) {
  const changedLines = [];
  
  hunk.lines.forEach((line, index) => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      changedLines.push({
        type: 'addition',
        line: line.substring(1),
        lineNumber: hunk.newStart + index,
        hunkIndex: index
      });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      changedLines.push({
        type: 'deletion',
        line: line.substring(1),
        lineNumber: hunk.oldStart + index,
        hunkIndex: index
      });
    }
  });

  return changedLines;
}
