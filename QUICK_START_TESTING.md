# PR-Pilot Quick Start Testing

## 🚀 Fast Track to Real-World Testing

This guide gets you testing PR-Pilot in under 10 minutes.

## Prerequisites

- GitHub account
- Anthropic API key
- Git installed
- Node.js 18+ installed

## Option 1: Automated Setup (Recommended)

### Step 1: Run Setup Script

```bash
cd /path/to/pr-pilot
npm run setup:test-repo
```

This script will:
- Create a test repository
- Copy PR-Pilot files
- Set up git repository
- Push to GitHub

### Step 2: Set Up Secrets

1. Go to your test repository on GitHub
2. Settings → Secrets and variables → Actions
3. Add `ANTHROPIC_API_KEY` secret

### Step 3: Generate Test PR

```bash
cd /tmp/pr-pilot-test  # or wherever the script created it
npm run generate:test-pr
```

This creates a PR with intentional issues for testing.

### Step 4: Monitor Results

1. Go to your repository on GitHub
2. Check the Actions tab
3. Watch the PR-Pilot workflow run
4. Review comments on the PR

## Option 2: Manual Setup

### Step 1: Create Test Repository

```bash
# Create new repository on GitHub
gh repo create pr-pilot-test --public

# Clone and setup
git clone https://github.com/YOUR_USERNAME/pr-pilot-test.git
cd pr-pilot-test
```

### Step 2: Copy PR-Pilot Files

```bash
# Copy all PR-Pilot files
cp -r /path/to/pr-pilot/* ./
cp -r /path/to/pr-pilot/.* . 2>/dev/null || true

# Commit and push
git add .
git commit -m "Add PR-Pilot"
git push origin main
```

### Step 3: Set Up Secrets

Add `ANTHROPIC_API_KEY` in repository settings.

### Step 4: Create Test PR

```bash
# Create branch with test code
git checkout -b feature/test
# Add some code with issues (see examples below)
git add . && git commit -m "Add test code"
git push origin feature/test
# Create PR on GitHub
```

## Test Code Examples

### Security Issues

```javascript
// Hardcoded API key
const API_KEY = 'sk-1234567890abcdef';

// Sensitive data in token
const payload = {
  id: user.id,
  password: user.password  // Security risk!
};

// No token expiration
return jwt.sign(payload, secret);
```

### Performance Issues

```javascript
// Inefficient loop
for (let i = 0; i < 10000; i++) {
  result.push(data[i] * 2);
}

// Synchronous in async function
function processData(data) {
  return data.map(item => expensiveOperation(item));
}
```

### Bug Potential

```javascript
// Missing error handling
function getUser(id) {
  return database.find(user => user.id === id).name;
}

// No input validation
app.post('/users', (req, res) => {
  const { name, email } = req.body;
  // No validation!
  res.json({ name, email });
});
```

### Style Issues

```javascript
// Missing JSDoc
function calculateTotal(items) {
  // Implementation
}

// Inconsistent naming
function format_user_name(name) {  // snake_case
  return name.toLowerCase();
}
```

## Expected Results

### Successful Test Should Show:

1. **Workflow Execution**
   - ✅ All steps pass
   - ✅ Configuration validated
   - ✅ Environment checked
   - ✅ PR-Pilot runs successfully

2. **PR Comments**
   - 🐛 Bug issues (missing error handling)
   - 🔒 Security issues (hardcoded keys)
   - ⚡ Performance issues (inefficient loops)
   - 💅 Style issues (missing JSDoc)
   - 🧪 Test issues (incomplete tests)

3. **Comment Quality**
   - Specific line references
   - Clear explanations
   - Suggested fixes
   - Confidence levels

4. **Metrics**
   - Files reviewed
   - Issues found
   - Comments posted
   - Estimated cost
   - Review time

## Troubleshooting

### Workflow Not Running
- Check if `.github/workflows/pr-review.yml` exists
- Verify repository is public
- Check Actions are enabled

### No Comments Posted
- Verify `ANTHROPIC_API_KEY` is set
- Check workflow logs for errors
- Ensure not running in dry-run mode

### Configuration Errors
```bash
# Test configuration
npm run validate:config

# Test workflow
npm run test:workflow
```

### API Issues
- Verify Anthropic API key is valid
- Check API usage limits
- Test with dry-run first

## Quick Commands

```bash
# Test everything locally
npm run test:workflow

# Validate configuration
npm run validate:config

# Test system functionality
npm run test:system

# Run demo
npm run test:demo

# Test performance
npm run test:performance
```

## Success Criteria

- ✅ Workflow runs without errors
- ✅ Comments appear on PR
- ✅ Issues are correctly identified
- ✅ Suggested fixes are provided
- ✅ Cost stays within budget
- ✅ Performance is acceptable

## Next Steps

1. **Analyze Results**: Review comment quality
2. **Tune Settings**: Adjust configuration
3. **Deploy to Real Projects**: Use in production
4. **Monitor Performance**: Track costs and effectiveness

## Getting Help

- Check workflow logs for detailed errors
- Use `npm run test:workflow` to debug locally
- Review the full [Real-World Testing Guide](REAL_WORLD_TESTING_GUIDE.md)
- Check [API Documentation](API.md) for advanced usage

---

**Ready to test? Run `npm run setup:test-repo` and get started! 🚀**
