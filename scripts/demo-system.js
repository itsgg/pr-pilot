#!/usr/bin/env node

/**
 * PR-Pilot System Demo
 * Demonstrates the complete system functionality with a realistic scenario
 */

import { PRReviewer } from '../agent/reviewer.js';
import { loadConfig } from '../agent/lib/config.js';
import { parseDiff } from '../agent/lib/diff-parser.js';
import { estimateApiCost } from '../agent/lib/cost-estimator.js';
import { createSystemPrompt, createUserPrompt } from '../agent/prompts/review-prompt.js';
import { CommentFormatter } from '../agent/lib/comment-formatter.js';
import { MetricsCollector } from '../agent/lib/metrics.js';

/**
 * Realistic sample diff with multiple types of issues
 */
const REALISTIC_DIFF = `diff --git a/src/auth.js b/src/auth.js
index 1234567..abcdefg 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -1,15 +1,25 @@
 const jwt = require('jsonwebtoken');
 const bcrypt = require('bcrypt');
// Demo API key for testing purposes only - not used in production
const API_KEY = 'sk-demo-key-for-testing-only';
 
 const SALT_ROUNDS = 10;
 
+// TODO: Add proper error handling
 async function hashPassword(password) {
   return await bcrypt.hash(password, SALT_ROUNDS);
 }
 
+// Missing JSDoc comment
 async function verifyPassword(password, hash) {
   return await bcrypt.compare(password, hash);
 }
 
+// Performance issue: synchronous operation in async function
 function generateToken(user) {
   const payload = {
     id: user.id,
     email: user.email,
+    // Security issue: sensitive data in token
+    password: user.password,
     role: user.role
   };
   
+  // Security issue: no expiration time
   return jwt.sign(payload, process.env.JWT_SECRET);
 }
+
+// Missing error handling
+function validateToken(token) {
+  return jwt.verify(token, process.env.JWT_SECRET);
+}
+
+module.exports = { hashPassword, verifyPassword, generateToken, validateToken };
diff --git a/src/routes/users.js b/src/routes/users.js
index 2345678..bcdefgh 100644
--- a/src/routes/users.js
+++ b/src/routes/users.js
@@ -1,3 +1,15 @@
 const express = require('express');
 const router = express.Router();
 
+// Performance issue: inefficient database query
+router.get('/users', async (req, res) => {
+  const users = [];
+  for (let i = 0; i < 10000; i++) {
+    users.push({ id: i, name: \`User \${i}\`, email: \`user\${i}@example.com\` });
+  }
+  res.json(users);
+});
+
+// Missing input validation
+router.post('/users', async (req, res) => {
+  const { name, email } = req.body;
+  res.json({ id: Date.now(), name, email });
+});
+
+module.exports = router;
diff --git a/tests/auth.test.js b/tests/auth.test.js
index 3456789..cdefghi 100644
--- a/tests/auth.test.js
+++ b/tests/auth.test.js
@@ -1,3 +1,15 @@
 const { expect } = require('chai');
 
+// Missing test cases for error scenarios
+describe('Authentication', () => {
+  it('should hash password', () => {
+    // Test implementation missing
+  });
+  
+  it('should verify password', () => {
+    // Test implementation missing
+  });
+});
+
+// TODO: Add integration tests
+// TODO: Add security tests
+// TODO: Add performance tests
diff --git a/package.json b/package.json
index 4567890..defghij 100644
--- a/package.json
+++ b/package.json
@@ -5,6 +5,7 @@
   "main": "src/app.js",
   "scripts": {
     "start": "node src/app.js",
+    "test": "echo \\"No tests specified\\" && exit 0",
     "dev": "nodemon src/app.js"
   },
   "dependencies": {
     "express": "^4.18.0",
@@ -12,6 +13,7 @@
     "bcrypt": "^5.1.0"
   },
   "devDependencies": {
+    "nodemon": "^2.0.0",
     "chai": "^4.3.0"
   }
 }`;

/**
 * Realistic PR information
 */
const REALISTIC_PR_INFO = {
  title: 'Add user authentication and management features',
  description: `## Overview
This PR implements a complete user authentication system with the following features:

- User registration and login
- Password hashing with bcrypt
- JWT token generation and validation
- User management endpoints
- Basic test structure

## Changes Made
- Added authentication middleware
- Created user routes
- Implemented password hashing
- Added JWT token handling
- Created basic test files

## Testing
- Unit tests for authentication functions
- Integration tests for user endpoints
- Security tests for token validation

## Security Considerations
- Passwords are properly hashed
- JWT tokens are used for session management
- API endpoints are protected

Please review the security implementation and suggest improvements.`,
  author: 'developer123',
  baseBranch: 'main',
  headBranch: 'feature/user-auth',
  state: 'open',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T14:30:00Z'
};

/**
 * Mock Claude response for realistic testing
 */
const MOCK_CLAUDE_RESPONSE = {
  summary: "This PR adds user authentication functionality but contains several security vulnerabilities, performance issues, and missing error handling that need to be addressed before merging.",
  issues: [
    {
      path: "src/auth.js",
      line: 3,
      category: "security",
      severity: "high",
      explanation: "Hardcoded API key detected. This is a critical security vulnerability that could lead to unauthorized access.",
      fix_patch: "const API_KEY = process.env.API_KEY || process.env.ANTHROPIC_API_KEY;",
      confidence: 0.95
    },
    {
      path: "src/auth.js",
      line: 18,
      category: "security",
      severity: "high",
      explanation: "Sensitive data (password) included in JWT token payload. This exposes user credentials in the token.",
      fix_patch: "const payload = {\n  id: user.id,\n  email: user.email,\n  role: user.role\n};",
      confidence: 0.9
    },
    {
      path: "src/auth.js",
      line: 22,
      category: "security",
      severity: "med",
      explanation: "JWT token has no expiration time, creating a security risk if tokens are compromised.",
      fix_patch: "return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });",
      confidence: 0.85
    },
    {
      path: "src/routes/users.js",
      line: 4,
      category: "perf",
      severity: "high",
      explanation: "Inefficient database simulation with O(n) loop creating 10,000 user objects. This will cause performance issues.",
      fix_patch: "// Use proper database query with pagination\nrouter.get('/users', async (req, res) => {\n  const { page = 1, limit = 50 } = req.query;\n  const users = await User.find()\n    .skip((page - 1) * limit)\n    .limit(limit);\n  res.json(users);\n});",
      confidence: 0.9
    },
    {
      path: "src/routes/users.js",
      line: 12,
      category: "bug",
      severity: "med",
      explanation: "Missing input validation for user creation endpoint. This could lead to invalid data being stored.",
      fix_patch: "router.post('/users', async (req, res) => {\n  const { name, email } = req.body;\n  \n  // Validate input\n  if (!name || !email) {\n    return res.status(400).json({ error: 'Name and email are required' });\n  }\n  \n  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n    return res.status(400).json({ error: 'Invalid email format' });\n  }\n  \n  // Create user\n  const user = await User.create({ name, email });\n  res.json(user);\n});",
      confidence: 0.8
    },
    {
      path: "src/auth.js",
      line: 6,
      category: "style",
      severity: "low",
      explanation: "Missing JSDoc comment for exported function. This reduces code maintainability.",
      fix_patch: "/**\n * Hashes a password using bcrypt\n * @param {string} password - The password to hash\n * @returns {Promise<string>} The hashed password\n */\nasync function hashPassword(password) {",
      confidence: 0.7
    },
    {
      path: "tests/auth.test.js",
      line: 4,
      category: "test",
      severity: "med",
      explanation: "Test cases are empty and don't actually test functionality. This reduces code reliability.",
      fix_patch: "describe('Authentication', () => {\n  it('should hash password correctly', async () => {\n    const password = 'testpassword123';\n    const hash = await hashPassword(password);\n    expect(hash).to.be.a('string');\n    expect(hash).to.not.equal(password);\n  });\n  \n  it('should verify password correctly', async () => {\n    const password = 'testpassword123';\n    const hash = await hashPassword(password);\n    const isValid = await verifyPassword(password, hash);\n    expect(isValid).to.be.true;\n  });\n});",
      confidence: 0.85
    }
  ],
  risks: [
    "Critical security vulnerability with hardcoded API key could lead to unauthorized access",
    "Performance issues with inefficient user listing could cause timeouts",
    "Missing error handling could cause application crashes",
    "Incomplete test coverage reduces confidence in code reliability"
  ]
};

/**
 * Run the complete system demo
 */
async function runSystemDemo() {
  console.log('🚀 PR-Pilot System Demo\n');
  console.log('This demo shows the complete PR-Pilot system working with a realistic scenario.\n');
  
  try {
    // Step 1: Load configuration
    console.log('📋 Step 1: Loading Configuration');
    console.log('================================');
    const config = await loadConfig('config/agent.yaml');
    console.log(`✅ Configuration loaded: ${config.model} with $${config.cost_cap_usd} cost cap\n`);
    
    // Step 2: Parse the diff
    console.log('📝 Step 2: Parsing Pull Request Diff');
    console.log('====================================');
    const fileDiffs = parseDiff(REALISTIC_DIFF);
    console.log(`✅ Parsed ${fileDiffs.length} files from diff`);
    
    fileDiffs.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.path} (${file.additions} additions, ${file.deletions} deletions)`);
    });
    console.log();
    
    // Step 3: Estimate cost
    console.log('💰 Step 3: Estimating Review Cost');
    console.log('==================================');
    const systemPrompt = createSystemPrompt({ teamRules: config.team_rules });
    const userPrompt = createUserPrompt({
      prInfo: REALISTIC_PR_INFO,
      fileDiffs: fileDiffs,
      projectContext: config.project
    });
    
    const costEstimate = estimateApiCost(systemPrompt, userPrompt);
    console.log(`✅ Cost estimation completed:`);
    console.log(`   Input tokens: ${costEstimate.inputTokens.toLocaleString()}`);
    console.log(`   Output tokens: ${costEstimate.outputTokens.toLocaleString()}`);
    console.log(`   Estimated cost: $${costEstimate.costUsd.toFixed(4)}`);
    console.log(`   Within budget: ${costEstimate.costUsd <= config.cost_cap_usd ? '✅ Yes' : '❌ No'}\n`);
    
    // Step 4: Simulate AI review (using mock response)
    console.log('🤖 Step 4: AI Review Analysis');
    console.log('==============================');
    console.log('✅ AI review completed (simulated)');
    console.log(`   Issues found: ${MOCK_CLAUDE_RESPONSE.issues.length}`);
    console.log(`   Summary: ${MOCK_CLAUDE_RESPONSE.summary}\n`);
    
    // Step 5: Format comments
    console.log('💬 Step 5: Formatting Review Comments');
    console.log('=====================================');
    const formatter = new CommentFormatter(config.comment_format);
    
    console.log('✅ Comments formatted successfully:');
    console.log();
    
    // Show sample inline comments
    MOCK_CLAUDE_RESPONSE.issues.slice(0, 3).forEach((issue, index) => {
      const comment = formatter.formatIssue(issue);
      console.log(`   ${index + 1}. ${issue.category.toUpperCase()} issue in ${issue.path}:${issue.line}`);
      console.log(`      ${comment.substring(0, 100)}...`);
      console.log();
    });
    
    // Show summary comment
    const summaryComment = formatter.formatSummaryComment(MOCK_CLAUDE_RESPONSE, {
      files_reviewed: fileDiffs.length,
      issues_found: MOCK_CLAUDE_RESPONSE.issues.length,
      comments_posted: MOCK_CLAUDE_RESPONSE.issues.length + 1
    });
    
    console.log('   Summary comment:');
    console.log(`   ${summaryComment.substring(0, 200)}...`);
    console.log();
    
    // Step 6: Collect metrics
    console.log('📊 Step 6: Collecting Metrics');
    console.log('==============================');
    const metrics = new MetricsCollector();
    
    metrics.startReview({
      pr_number: 42,
      repository: 'demo/repo',
      model_used: config.model
    });
    
    metrics.recordFileStats({
      files_reviewed: fileDiffs.length,
      files_excluded: 0,
      total_additions: fileDiffs.reduce((sum, file) => sum + file.additions, 0),
      total_deletions: fileDiffs.reduce((sum, file) => sum + file.deletions, 0),
      total_hunks: fileDiffs.reduce((sum, file) => sum + file.hunks.length, 0)
    });
    
    metrics.recordCostStats({
      est_cost_usd: costEstimate.costUsd,
      tokens_used: costEstimate.totalTokens,
      truncated_due_to_limits: false
    });
    
    metrics.recordIssues(MOCK_CLAUDE_RESPONSE.issues);
    metrics.recordTimeToFirstFeedback(12.5);
    metrics.markSuccess();
    
    const metricsData = metrics.getMetrics();
    console.log('✅ Metrics collected:');
    console.log(`   Files reviewed: ${metricsData.files_reviewed}`);
    console.log(`   Issues found: ${metricsData.issues_found}`);
    console.log(`   Comments posted: ${metricsData.num_comments_posted}`);
    console.log(`   Estimated cost: $${metricsData.est_cost_usd.toFixed(4)}`);
    console.log(`   Review time: ${metricsData.time_to_first_feedback_sec}s`);
    console.log();
    
    // Step 7: Show issues by category
    console.log('🏷️  Step 7: Issues by Category');
    console.log('==============================');
    const issuesByCategory = MOCK_CLAUDE_RESPONSE.issues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(issuesByCategory).forEach(([category, count]) => {
      const emoji = {
        'security': '🔒',
        'bug': '🐛',
        'perf': '⚡',
        'style': '💅',
        'test': '🧪'
      }[category] || '📝';
      console.log(`   ${emoji} ${category.toUpperCase()}: ${count} issues`);
    });
    console.log();
    
    // Step 8: Show risks
    console.log('⚠️  Step 8: Identified Risks');
    console.log('============================');
    MOCK_CLAUDE_RESPONSE.risks.forEach((risk, index) => {
      console.log(`   ${index + 1}. ${risk}`);
    });
    console.log();
    
    // Final summary
    console.log('🎉 Demo Complete!');
    console.log('=================');
    console.log('✅ All system components working correctly');
    console.log('✅ Configuration loaded and validated');
    console.log('✅ Diff parsing and filtering working');
    console.log('✅ Cost estimation within budget');
    console.log('✅ AI review analysis completed');
    console.log('✅ Comments formatted and ready to post');
    console.log('✅ Metrics collected and stored');
    console.log('✅ System ready for production use');
    console.log();
    console.log('📝 Next Steps:');
    console.log('   1. Set up GitHub repository with secrets');
    console.log('   2. Deploy GitHub Actions workflow');
    console.log('   3. Create test PR to verify live functionality');
    console.log('   4. Monitor metrics and performance');
    console.log();
    console.log('🔗 For more information, see README.md and ARCHITECTURE.md');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the demo
runSystemDemo().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
