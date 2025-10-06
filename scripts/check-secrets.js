#!/usr/bin/env node

/**
 * Enhanced Secret Detection Script
 * Checks for potential secrets in code with reduced false positives
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// Patterns that are likely to be real secrets
const SECRET_PATTERNS = [
  // API Keys with actual values (not variable names)
  /(?:api[_-]?key|apikey)\s*[:=]\s*['"`][a-zA-Z0-9]{20,}['"`]/gi,
  // GitHub tokens with actual values
  /(?:github[_-]?token|gh[_-]?token)\s*[:=]\s*['"`]gh[ps]_[a-zA-Z0-9]{36}['"`]/gi,
  // Anthropic keys with actual values
  /(?:anthropic[_-]?key|claude[_-]?key)\s*[:=]\s*['"`]sk-[a-zA-Z0-9]{48}['"`]/gi,
  // JWT secrets with actual values
  /(?:jwt[_-]?secret|secret[_-]?key)\s*[:=]\s*['"`][a-zA-Z0-9]{32,}['"`]/gi,
  // Database passwords with actual values
  /(?:db[_-]?password|database[_-]?password)\s*[:=]\s*['"`][a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;':",./<>?]{8,}['"`]/gi,
  // Private keys
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
  // AWS keys with actual values
  /(?:aws[_-]?access[_-]?key|aws[_-]?secret[_-]?key)\s*[:=]\s*['"`][A-Z0-9]{20,}['"`]/gi,
];

// Patterns that are likely false positives (legitimate uses)
const FALSE_POSITIVE_PATTERNS = [
  // Test files
  /\.test\.js$/,
  /\.spec\.js$/,
  // Documentation
  /\.md$/,
  // Package files
  /package\.json$/,
  /package-lock\.json$/,
  // Config files with examples
  /\.example$/,
  /\.sample$/,
  // Node modules
  /node_modules/,
  // GitHub workflows
  /\.github\/workflows/,
  // Comments with examples
  /\/\/.*(?:example|demo|test).*['"`]sk-/gi,
  /\/\*.*(?:example|demo|test).*['"`]sk-/gi,
  // Environment variable references
  /process\.env\./,
  // JSDoc comments
  /\/\*\*[\s\S]*?\*\//,
  // String literals in comments
  /\/\/.*['"`][^'"`]*['"`]/,
];

// Files to always exclude
const EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '*.log',
  '*.tmp',
  'dist/**',
  'build/**',
  '.next/**',
  '.nuxt/**',
];

function isFalsePositive(filePath, content, match) {
  // Check if file should be excluded
  for (const pattern of EXCLUDE_PATTERNS) {
    if (filePath.includes(pattern.replace('**', ''))) {
      return true;
    }
  }
  
  // Check if it's a test file
  if (FALSE_POSITIVE_PATTERNS.some(pattern => pattern.test(filePath))) {
    return true;
  }
  
  // Check if it's in a comment with example/demo/test context
  const lines = content.split('\n');
  const matchLine = lines.find(line => line.includes(match));
  if (matchLine) {
    const trimmed = matchLine.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      const lowerMatch = match.toLowerCase();
      if (lowerMatch.includes('example') || lowerMatch.includes('demo') || lowerMatch.includes('test')) {
        return true;
      }
    }
  }
  
  // Check if it's a variable assignment with a variable name (not a literal value)
  if (match.includes('=') && match.includes('API_KEY') && !match.includes("'") && !match.includes('"')) {
    return true;
  }
  
  // Check if it's an environment variable reference
  if (match.includes('process.env.') || match.includes('${') || match.includes('$')) {
    return true;
  }
  
  return false;
}

function checkForSecrets() {
  console.log('🔍 Checking for potential secrets in code...');
  
  let foundSecrets = false;
  const results = [];
  
  try {
    // Use git to find all tracked files
    const files = execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .filter(file => file.trim())
      .filter(file => {
        // Filter out excluded patterns
        return !EXCLUDE_PATTERNS.some(pattern => {
          const regex = new RegExp(pattern.replace('**', '.*').replace('*', '[^/]*'));
          return regex.test(file);
        });
      });
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        
        for (const pattern of SECRET_PATTERNS) {
          const matches = content.match(pattern);
          if (matches) {
            for (const match of matches) {
              if (!isFalsePositive(file, content, match)) {
                results.push({ file, match, pattern: pattern.source });
                foundSecrets = true;
              }
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    if (foundSecrets) {
      console.log('⚠️  Potential secrets found:');
      console.log('');
      results.forEach(({ file, match, pattern }) => {
        console.log(`   File: ${file}`);
        console.log(`   Pattern: ${pattern}`);
        console.log(`   Match: ${match}`);
        console.log('');
      });
      console.log('Please review these findings and remove any real secrets.');
      return 1;
    } else {
      console.log('✅ No obvious secrets found in code');
      return 0;
    }
  } catch (error) {
    console.error('❌ Error checking for secrets:', error.message);
    return 1;
  }
}

// Run the check
const exitCode = checkForSecrets();
process.exit(exitCode);
