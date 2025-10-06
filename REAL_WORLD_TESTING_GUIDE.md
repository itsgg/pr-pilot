# PR-Pilot Real-World Testing Guide

This guide walks you through setting up and testing PR-Pilot in a real GitHub environment.

## 🎯 Testing Objectives

- Verify GitHub Actions workflow execution
- Test PR-Pilot with real pull requests
- Validate AI review functionality
- Confirm comment posting works
- Check metrics collection
- Ensure cost management works

## 📋 Prerequisites

### Required Accounts & Tokens

1. **GitHub Account** with repository creation permissions
2. **Anthropic Account** with API access
3. **API Keys**:
   - `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com/)
   - `GITHUB_TOKEN` - Auto-provided by GitHub Actions

### Required Tools

- Git
- Node.js 18+
- GitHub CLI (optional, for easier setup)

## 🚀 Step-by-Step Testing Process

### Step 1: Create Test Repository

#### Option A: Using GitHub CLI (Recommended)

```bash
# Install GitHub CLI if not already installed
# brew install gh (macOS) or see: https://cli.github.com/

# Create new repository
gh repo create pr-pilot-test --public --description "Test repository for PR-Pilot"

# Clone the repository
git clone https://github.com/YOUR_USERNAME/pr-pilot-test.git
cd pr-pilot-test
```

#### Option B: Using GitHub Web Interface

1. Go to [GitHub](https://github.com) and click "New repository"
2. Name: `pr-pilot-test`
3. Description: "Test repository for PR-Pilot"
4. Make it **Public** (required for GitHub Actions)
5. Initialize with README
6. Clone the repository locally

### Step 2: Set Up PR-Pilot in Test Repository

```bash
# Copy PR-Pilot files to test repository
cp -r /path/to/pr-pilot/* ./pr-pilot-test/
cd pr-pilot-test

# Initialize git and commit
git add .
git commit -m "Initial PR-Pilot setup"
git push origin main
```

### Step 3: Configure Repository Secrets

#### In GitHub Web Interface:

1. Go to your test repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

```
Name: ANTHROPIC_API_KEY
Value: your-anthropic-api-key-here

Name: GITHUB_TOKEN
Value: (auto-provided by GitHub, but you can add a PAT if needed)
```

#### Using GitHub CLI:

```bash
# Set repository secrets
gh secret set ANTHROPIC_API_KEY --body "your-anthropic-api-key-here"
```

### Step 4: Test Configuration

```bash
# Test configuration loading
npm run validate:config

# Test workflow steps
npm run test:workflow

# Test system functionality
npm run test:system
```

### Step 5: Create Test Pull Request

#### Create a Branch with Intentional Issues

```bash
# Create feature branch
git checkout -b feature/test-pr-pilot

# Create a test file with intentional issues
cat > test-file.js << 'EOF'
const express = require('express');
const app = express();

// Security issue: hardcoded API key
const API_KEY = 'sk-1234567890abcdef';

// Performance issue: inefficient loop
function processData(data) {
  const result = [];
  for (let i = 0; i < 10000; i++) {
    result.push(data[i] * 2);
  }
  return result;
}

// Bug: missing error handling
function getUserData(userId) {
  const user = database.find(user => user.id === userId);
  return user.name; // Could throw if user is undefined
}

// Style issue: missing JSDoc
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}

// Missing tests
module.exports = { processData, getUserData, calculateTotal };
EOF

# Create package.json with issues
cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "main": "test-file.js",
  "scripts": {
    "start": "node test-file.js",
    "test": "echo 'No tests specified' && exit 0"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF

# Create README with issues
cat > README.md << 'EOF'
# Test Project

This is a test project for PR-Pilot.

## Features
- Data processing
- User management
- Price calculation

## Installation
npm install

## Usage
npm start

## TODO
- Add error handling
- Add tests
- Add documentation
EOF

# Commit and push
git add .
git commit -m "Add test features with intentional issues

- Add data processing functionality
- Add user management
- Add price calculation
- Add basic project structure"
git push origin feature/test-pr-pilot
```

### Step 6: Create Pull Request

#### Using GitHub CLI:

```bash
# Create PR
gh pr create --title "Add test features with intentional issues" \
  --body "This PR adds several features to test PR-Pilot:

## Changes Made
- Added data processing functionality
- Added user management features  
- Added price calculation
- Added basic project structure

## Testing
This PR contains intentional issues to test PR-Pilot's review capabilities:
- Security issues (hardcoded API key)
- Performance issues (inefficient loops)
- Bug potential (missing error handling)
- Style issues (missing JSDoc)
- Missing tests

Please review and provide feedback."
```

#### Using GitHub Web Interface:

1. Go to your repository on GitHub
2. Click **"Compare & pull request"** button
3. Title: "Add test features with intentional issues"
4. Description: Use the same description as above
5. Click **"Create pull request"**

### Step 7: Monitor GitHub Actions

1. Go to your repository on GitHub
2. Click **"Actions"** tab
3. You should see the **"PR-Pilot Review"** workflow running
4. Click on the workflow run to see detailed logs

### Step 8: Verify PR-Pilot Results

#### Check Workflow Execution

The workflow should:
- ✅ Install dependencies
- ✅ Run tests
- ✅ Validate configuration
- ✅ Check environment variables
- ✅ Run PR-Pilot review
- ✅ Post comments on the PR

#### Check PR Comments

Look for:
- **Inline comments** on specific lines with issues
- **Summary comment** with overall review
- **Category emojis** (🐛 bug, 🔒 security, ⚡ perf, 💅 style, 🧪 test)
- **Suggested fixes** for each issue
- **Confidence levels** for each finding

#### Check Metrics

1. Go to **Actions** → **Artifacts**
2. Download the **pr-pilot-metrics** artifact
3. Check `metrics/run.json` for:
   - Files reviewed
   - Issues found
   - Comments posted
   - Estimated cost
   - Review time

### Step 9: Test Different Scenarios

#### Test 1: Large PR (Cost Cap Test)

```bash
# Create a large PR to test cost limits
git checkout -b feature/large-pr
# Add many files with lots of changes
# This should trigger cost cap protection
```

#### Test 2: Clean PR (No Issues)

```bash
# Create a clean PR with good code
git checkout -b feature/clean-code
# Add well-written, clean code
# PR-Pilot should find minimal or no issues
```

#### Test 3: Security-Focused PR

```bash
# Create PR with security issues
git checkout -b feature/security-issues
# Add code with security vulnerabilities
# PR-Pilot should catch security issues
```

#### Test 4: Performance-Focused PR

```bash
# Create PR with performance issues
git checkout -b feature/performance-issues
# Add inefficient code
# PR-Pilot should catch performance issues
```

### Step 10: Test Manual Workflow

1. Go to **Actions** → **Manual Test PR-Pilot**
2. Click **"Run workflow"**
3. Enter PR number and repository
4. Choose dry-run or live mode
5. Click **"Run workflow"**

## 🔍 Troubleshooting

### Common Issues

#### 1. Workflow Not Triggering

**Problem**: PR created but workflow doesn't run
**Solution**: 
- Check if `.github/workflows/pr-review.yml` exists
- Verify PR is on the correct branch
- Check repository settings for Actions

#### 2. Configuration Errors

**Problem**: Workflow fails with config errors
**Solution**:
```bash
# Test config locally
npm run validate:config

# Check config file exists
ls -la config/agent.yaml
```

#### 3. API Key Issues

**Problem**: Authentication errors
**Solution**:
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check API key has proper permissions
- Test API key locally

#### 4. No Comments Posted

**Problem**: Workflow runs but no comments appear
**Solution**:
- Check if running in dry-run mode
- Verify GitHub token permissions
- Check workflow logs for errors

#### 5. Cost Cap Exceeded

**Problem**: Review truncated due to cost
**Solution**:
- Check `cost_cap_usd` in config
- Reduce `max_files` limit
- Use more specific file filtering

### Debug Commands

```bash
# Test configuration
npm run validate:config

# Test workflow steps
npm run test:workflow

# Test with dry-run
npm run dry-run -- --pr 1 --repo your-username/pr-pilot-test

# Check logs
gh run list --repo your-username/pr-pilot-test
gh run view [RUN_ID] --repo your-username/pr-pilot-test
```

## 📊 Expected Results

### Successful Test Results

1. **Workflow Execution**: All steps pass
2. **PR Comments**: 5-10 inline comments + 1 summary
3. **Issue Categories**: Mix of security, bug, perf, style, test
4. **Metrics**: Reasonable cost (< $0.10), good performance
5. **Comments Quality**: Actionable, specific, with fixes

### Sample Expected Comments

```
🐛 **BUG** 🔴 High

Missing error handling in getUserData function. This could cause runtime errors if user is not found.

**Suggested fix:**
```javascript
function getUserData(userId) {
  const user = database.find(user => user.id === userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }
  return user.name;
}
```

*Confidence: 85%*
```

## 🎉 Success Criteria

- ✅ Workflow runs without errors
- ✅ Comments are posted on PR
- ✅ Issues are correctly identified
- ✅ Suggested fixes are provided
- ✅ Metrics are collected
- ✅ Cost stays within budget
- ✅ Performance is acceptable (< 30 seconds)

## 📝 Next Steps After Testing

1. **Analyze Results**: Review comments and metrics
2. **Tune Configuration**: Adjust settings based on results
3. **Deploy to Production**: Use in real projects
4. **Monitor Performance**: Track costs and effectiveness
5. **Gather Feedback**: Get team input on comment quality

## 🆘 Getting Help

If you encounter issues:

1. **Check Workflow Logs**: Detailed error information
2. **Test Locally**: Use npm scripts to debug
3. **Review Configuration**: Ensure all settings are correct
4. **Check API Limits**: Verify Anthropic API usage
5. **GitHub Issues**: Report bugs or ask questions

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [PR-Pilot API Documentation](API.md)
- [PR-Pilot Architecture](ARCHITECTURE.md)

---

**Happy Testing! 🚀**

This guide should help you successfully test PR-Pilot in a real-world environment and verify all functionality works as expected.
