# PR-Pilot GitHub Workflows

This directory contains GitHub Actions workflows for the PR-Pilot project.

## Workflows

### 1. `pr-review.yml` - Main PR Review Workflow

**Triggers:**

- Pull request events: `opened`, `synchronize`, `reopened`
- Manual workflow dispatch

**Features:**

- Automated AI-powered PR reviews
- Dry-run mode support
- Comprehensive testing and validation
- Security scanning
- Performance testing
- Metrics collection and reporting
- Automatic PR comments with results

**Required Secrets:**

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude
- `GITHUB_TOKEN`: Automatically provided by GitHub

**Usage:**

- **Automatic**: Runs on every PR event
- **Manual**: Go to Actions → Manual Test PR-Pilot → Run workflow

### 2. `test.yml` - Basic Testing Workflow

**Triggers:**

- Push to main branch
- Pull request to main branch

**Features:**

- Unit test execution
- Configuration validation
- Basic functionality testing

**Usage:**

- Runs automatically on code changes
- No secrets required

### 3. `manual-test.yml` - Manual Testing Workflow

**Triggers:**

- Manual workflow dispatch only

**Features:**

- Test specific PR numbers
- Dry-run mode support
- Custom repository support
- Detailed logging and artifact upload

**Required Secrets:**

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude
- `GITHUB_TOKEN`: Automatically provided by GitHub

**Usage:**

1. Go to Actions → Manual Test PR-Pilot
2. Click "Run workflow"
3. Enter PR number and options
4. Click "Run workflow"

## Configuration

### Environment Variables

The workflows use the following environment variables:

- `NODE_VERSION`: Node.js version (default: 18)
- `ANTHROPIC_API_KEY`: Anthropic API key (from secrets)
- `GITHUB_TOKEN`: GitHub token (from secrets)
- `PR_NUMBER`: PR number to review (set automatically)
- `REPOSITORY`: Repository to review (set automatically)
- `DRY_RUN`: Whether to run in dry-run mode

### Secrets Setup

To use the PR-Pilot workflows, you need to set up the following secrets in your repository:

1. **ANTHROPIC_API_KEY**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key

2. **GITHUB_TOKEN**
   - This is automatically provided by GitHub
   - No manual setup required

## Workflow Steps

### Main Review Workflow (`pr-review.yml`)

1. **Checkout**: Get the latest code
2. **Setup Node.js**: Install Node.js and dependencies
3. **Install Dependencies**: Run `npm ci`
4. **Run Tests**: Execute unit tests
5. **Lint Code**: Check code formatting
6. **Validate Configuration**: Verify config files
7. **Check Environment**: Validate required variables
8. **Determine PR Info**: Get PR number and repository
9. **Run PR-Pilot**: Execute the review
10. **Upload Metrics**: Save review metrics
11. **Comment on PR**: Post results to PR
12. **Security Scan**: Check for vulnerabilities
13. **Performance Test**: Verify performance

### Test Workflow (`test.yml`)

1. **Checkout**: Get the latest code
2. **Setup Node.js**: Install Node.js and dependencies
3. **Install Dependencies**: Run `npm ci`
4. **Run Tests**: Execute unit tests
5. **Test Configuration**: Validate config loading
6. **Test Dry-run**: Verify dry-run mode

### Manual Test Workflow (`manual-test.yml`)

1. **Checkout**: Get the latest code
2. **Setup Node.js**: Install Node.js and dependencies
3. **Install Dependencies**: Run `npm ci`
4. **Run Tests**: Execute unit tests
5. **Test Configuration**: Validate config loading
6. **Test PR-Pilot**: Run with specified PR
7. **Upload Results**: Save test artifacts

## Troubleshooting

### Common Issues

1. **Missing Secrets**
   - Error: "Missing required environment variables"
   - Solution: Set up `ANTHROPIC_API_KEY` secret

2. **Invalid PR Number**
   - Error: "Failed to fetch PR"
   - Solution: Check PR number and repository format

3. **Configuration Errors**
   - Error: "Configuration validation failed"
   - Solution: Check `config/agent.yaml` syntax

4. **API Rate Limits**
   - Error: "API rate limit exceeded"
   - Solution: Wait and retry, or check API usage

### Debug Mode

To enable debug logging, add this to your workflow:

```yaml
- name: Run PR-Pilot Review
  env:
    DEBUG: 'pr-pilot:*'
  run: |
    node agent/reviewer.js --pr "${{ steps.pr-info.outputs.pr_number }}"
```

### Dry Run Mode

To test without posting comments:

```yaml
- name: Run PR-Pilot Review
  run: |
    node agent/reviewer.js --dry-run --pr "${{ steps.pr-info.outputs.pr_number }}"
```

## Customization

### Modifying Triggers

To change when workflows run, modify the `on` section:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
```

### Adding Steps

To add custom steps, insert them in the appropriate job:

```yaml
- name: Custom Step
  run: |
    echo "Running custom logic..."
    # Your custom commands here
```

### Environment Variables

To add custom environment variables:

```yaml
env:
  CUSTOM_VAR: 'value'
  NODE_VERSION: '18'
```

## Monitoring

### Workflow Status

- Check the Actions tab in your repository
- View workflow runs and their status
- Download artifacts for detailed logs

### Metrics

- Review metrics are saved to `metrics/run.json`
- Artifacts are uploaded for each run
- PR comments include summary statistics

### Notifications

- Workflow failures will show in the PR
- Success notifications are posted as comments
- Artifacts are available for download
