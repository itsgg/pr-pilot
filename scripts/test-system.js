#!/usr/bin/env node

/**
 * PR-Pilot System Test Script
 * Tests the complete system functionality without requiring real API credentials
 */

import { PRReviewer } from '../agent/reviewer.js';
import { loadConfig } from '../agent/lib/config.js';
import { parseDiff } from '../agent/lib/diff-parser.js';
import { estimateApiCost } from '../agent/lib/cost-estimator.js';
import { createSystemPrompt, createUserPrompt } from '../agent/prompts/review-prompt.js';

/**
 * Mock sample diff for testing
 */
const SAMPLE_DIFF = `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,5 +1,6 @@
 const express = require('express');
 const app = express();
// Demo API key for testing purposes only - not used in production
const API_KEY = 'sk-demo-key-for-testing-only';
 
 app.get('/', (req, res) => {
   res.send('Hello World!');
@@ -10,6 +11,7 @@ app.listen(3000, () => {
   console.log('Server running on port 3000');
 });
 
+// TODO: Add error handling
 app.get('/api/users', (req, res) => {
   const users = [];
   for (let i = 0; i < 10000; i++) { // Performance issue: inefficient loop
@@ -18,6 +20,7 @@ app.get('/api/users', (req, res) => {
   res.json(users);
 });
 
+// Missing JSDoc comment
 function calculateTotal(items) {
   let total = 0;
   for (let i = 0; i < items.length; i++) {
@@ -25,6 +28,7 @@ function calculateTotal(items) {
   }
   return total;
 }
+
+module.exports = app;`;

/**
 * Mock sample PR information
 */
const SAMPLE_PR_INFO = {
  title: 'Add user management features',
  description: 'This PR adds basic user management functionality including user creation, listing, and deletion.',
  author: 'testuser',
  baseBranch: 'main',
  headBranch: 'feature/user-management',
  state: 'open',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z'
};

/**
 * Test configuration loading
 */
async function testConfigurationLoading() {
  console.log('\n🧪 Testing Configuration Loading...');
  
  try {
    const config = await loadConfig('config/agent.yaml');
    console.log('✅ Configuration loaded successfully');
    console.log(`   Model: ${config.model}`);
    console.log(`   Max tokens: ${config.max_tokens}`);
    console.log(`   Cost cap: $${config.cost_cap_usd}`);
    console.log(`   Max files: ${config.max_files}`);
    console.log(`   Exclude patterns: ${config.exclude_patterns.length}`);
    return config;
  } catch (error) {
    console.error('❌ Configuration loading failed:', error.message);
    throw error;
  }
}

/**
 * Test diff parsing
 */
function testDiffParsing() {
  console.log('\n🧪 Testing Diff Parsing...');
  
  try {
    const fileDiffs = parseDiff(SAMPLE_DIFF);
    console.log('✅ Diff parsed successfully');
    console.log(`   Files found: ${fileDiffs.length}`);
    
    if (fileDiffs.length > 0) {
      const file = fileDiffs[0];
      console.log(`   File: ${file.path}`);
      console.log(`   Hunks: ${file.hunks.length}`);
      console.log(`   Additions: ${file.additions}`);
      console.log(`   Deletions: ${file.deletions}`);
    }
    
    return fileDiffs;
  } catch (error) {
    console.error('❌ Diff parsing failed:', error.message);
    throw error;
  }
}

/**
 * Test cost estimation
 */
function testCostEstimation(fileDiffs, config) {
  console.log('\n🧪 Testing Cost Estimation...');
  
  try {
    // Create prompts for cost estimation
    const systemPrompt = createSystemPrompt({
      teamRules: config.team_rules
    });
    const userPrompt = createUserPrompt({
      prInfo: SAMPLE_PR_INFO,
      fileDiffs: fileDiffs,
      projectContext: config.project
    });
    
    // Estimate tokens (simplified)
    const inputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const outputTokens = config.max_tokens;
    
    // Calculate cost
    const costEstimate = estimateApiCost(systemPrompt, userPrompt);
    
    console.log('✅ Cost estimation completed');
    console.log(`   Input tokens: ${costEstimate.inputTokens.toLocaleString()}`);
    console.log(`   Output tokens: ${costEstimate.outputTokens.toLocaleString()}`);
    console.log(`   Estimated cost: $${costEstimate.costUsd.toFixed(4)}`);
    console.log(`   Within cost cap: ${costEstimate.costUsd <= config.cost_cap_usd ? 'Yes' : 'No'}`);
    
    return costEstimate;
  } catch (error) {
    console.error('❌ Cost estimation failed:', error.message);
    throw error;
  }
}

/**
 * Test prompt generation
 */
function testPromptGeneration(fileDiffs, config) {
  console.log('\n🧪 Testing Prompt Generation...');
  
  try {
    const systemPrompt = createSystemPrompt({
      teamRules: config.team_rules
    });
    const userPrompt = createUserPrompt({
      prInfo: SAMPLE_PR_INFO,
      fileDiffs: fileDiffs,
      projectContext: config.project
    });
    
    console.log('✅ Prompts generated successfully');
    console.log(`   System prompt length: ${systemPrompt.length} characters`);
    console.log(`   User prompt length: ${userPrompt.length} characters`);
    console.log(`   Total prompt length: ${(systemPrompt.length + userPrompt.length).toLocaleString()} characters`);
    
    // Show a preview of the prompts
    console.log('\n   System prompt preview:');
    console.log(`   ${systemPrompt.substring(0, 200)}...`);
    
    console.log('\n   User prompt preview:');
    console.log(`   ${userPrompt.substring(0, 200)}...`);
    
    return { systemPrompt, userPrompt };
  } catch (error) {
    console.error('❌ Prompt generation failed:', error.message);
    throw error;
  }
}

/**
 * Test PR reviewer initialization (without API calls)
 */
async function testPRReviewerInitialization(config) {
  console.log('\n🧪 Testing PR Reviewer Initialization...');
  
  try {
    const reviewer = new PRReviewer({
      configPath: 'config/agent.yaml',
      dryRun: true,
      prNumber: 1,
      repository: 'test/repo'
    });
    
    console.log('✅ PR Reviewer created successfully');
    console.log(`   Config path: ${reviewer.options.configPath}`);
    console.log(`   Dry run: ${reviewer.options.dryRun}`);
    console.log(`   PR number: ${reviewer.options.prNumber}`);
    console.log(`   Repository: ${reviewer.options.repository}`);
    
    return reviewer;
  } catch (error) {
    console.error('❌ PR Reviewer initialization failed:', error.message);
    throw error;
  }
}

/**
 * Test metrics collection
 */
async function testMetricsCollection() {
  console.log('\n🧪 Testing Metrics Collection...');
  
  try {
    const { MetricsCollector } = await import('../agent/lib/metrics.js');
    const metrics = new MetricsCollector();
    
    // Start a review
    metrics.startReview({
      pr_number: 1,
      repository: 'test/repo',
      model_used: 'claude-sonnet-4-20250514'
    });
    
    // Record some sample metrics
    metrics.recordFileStats({
      files_reviewed: 1,
      files_excluded: 0,
      total_additions: 10,
      total_deletions: 2,
      total_hunks: 3
    });
    
    metrics.recordCostStats({
      est_cost_usd: 0.05,
      tokens_used: 1000,
      truncated_due_to_limits: false
    });
    
    metrics.recordIssues([
      { category: 'security', confidence: 0.9 },
      { category: 'bug', confidence: 0.7 },
      { category: 'style', confidence: 0.6 }
    ]);
    
    metrics.recordTimeToFirstFeedback(15.5);
    metrics.markSuccess();
    
    const metricsData = metrics.getMetrics();
    
    console.log('✅ Metrics collection completed');
    console.log(`   PR number: ${metricsData.pr_number}`);
    console.log(`   Repository: ${metricsData.repository}`);
    console.log(`   Files reviewed: ${metricsData.files_reviewed}`);
    console.log(`   Issues found: ${metricsData.issues_found}`);
    console.log(`   Estimated cost: $${metricsData.est_cost_usd}`);
    console.log(`   Success: ${metricsData.success}`);
    
    return metricsData;
  } catch (error) {
    console.error('❌ Metrics collection failed:', error.message);
    throw error;
  }
}

/**
 * Test comment formatting
 */
async function testCommentFormatting() {
  console.log('\n🧪 Testing Comment Formatting...');
  
  try {
    const { CommentFormatter } = await import('../agent/lib/comment-formatter.js');
    const formatter = new CommentFormatter();
    
    const sampleIssue = {
      path: 'src/app.js',
      line: 4,
      category: 'security',
      severity: 'high',
      explanation: 'Hardcoded API key detected. This is a security risk.',
      fix_patch: 'const API_KEY = process.env.API_KEY;',
      confidence: 0.9
    };
    
    const formattedComment = formatter.formatIssue(sampleIssue);
    const summaryComment = formatter.formatSummaryComment({
      summary: 'This PR contains several issues that need attention.',
      issues: [sampleIssue],
      risks: ['Security vulnerability with hardcoded API key']
    }, {
      files_reviewed: 1,
      issues_found: 1,
      comments_posted: 1
    });
    
    console.log('✅ Comment formatting completed');
    console.log('   Inline comment preview:');
    console.log(`   ${formattedComment.substring(0, 150)}...`);
    
    console.log('\n   Summary comment preview:');
    console.log(`   ${summaryComment.substring(0, 150)}...`);
    
    return { formattedComment, summaryComment };
  } catch (error) {
    console.error('❌ Comment formatting failed:', error.message);
    throw error;
  }
}

/**
 * Run all system tests
 */
async function runSystemTests() {
  console.log('🚀 Starting PR-Pilot System Tests\n');
  console.log('This test verifies all core functionality without requiring real API credentials.\n');
  
  const results = {
    configuration: false,
    diffParsing: false,
    costEstimation: false,
    promptGeneration: false,
    prReviewer: false,
    metrics: false,
    commentFormatting: false
  };
  
  try {
    // Test 1: Configuration Loading
    const config = await testConfigurationLoading();
    results.configuration = true;
    
    // Test 2: Diff Parsing
    const fileDiffs = testDiffParsing();
    results.diffParsing = true;
    
    // Test 3: Cost Estimation
    const costEstimate = testCostEstimation(fileDiffs, config);
    results.costEstimation = true;
    
    // Test 4: Prompt Generation
    const prompts = testPromptGeneration(fileDiffs, config);
    results.promptGeneration = true;
    
    // Test 5: PR Reviewer Initialization
    const reviewer = await testPRReviewerInitialization(config);
    results.prReviewer = true;
    
    // Test 6: Metrics Collection
    const metricsData = await testMetricsCollection();
    results.metrics = true;
    
    // Test 7: Comment Formatting
    const comments = await testCommentFormatting();
    results.commentFormatting = true;
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 All system tests passed! PR-Pilot is ready for deployment.');
      console.log('\n📝 Next steps:');
      console.log('   1. Set up GitHub repository secrets (ANTHROPIC_API_KEY, GITHUB_TOKEN)');
      console.log('   2. Copy .github/workflows/*.yml to your repository');
      console.log('   3. Create a test PR to verify the complete workflow');
      console.log('   4. Monitor the metrics/run.json file for performance data');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 System test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
runSystemTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
