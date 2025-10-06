# PR-Pilot API Documentation

This document provides comprehensive API documentation for PR-Pilot, including all public interfaces, configuration options, and usage patterns.

## Table of Contents

- [Core Classes](#core-classes)
- [Configuration API](#configuration-api)
- [GitHub Client API](#github-client-api)
- [Claude Client API](#claude-client-api)
- [Diff Parser API](#diff-parser-api)
- [Cost Estimator API](#cost-estimator-api)
- [Comment Formatter API](#comment-formatter-api)
- [Metrics Collector API](#metrics-collector-api)
- [Prompt Templates API](#prompt-templates-api)
- [Main Reviewer API](#main-reviewer-api)
- [Error Handling](#error-handling)
- [Type Definitions](#type-definitions)

---

## Core Classes

### PRReviewer

The main class that orchestrates the complete PR review process.

```javascript
import { PRReviewer } from './agent/reviewer.js';

const reviewer = new PRReviewer({
  configPath: 'config/agent.yaml',
  dryRun: false,
  prNumber: 123,
  repository: 'owner/repo'
});

await reviewer.initialize();
const result = await reviewer.reviewPullRequest();
```

#### Constructor Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `configPath` | `string` | `'config/agent.yaml'` | Path to configuration file |
| `dryRun` | `boolean` | `false` | Run without posting comments |
| `prNumber` | `number` | `null` | PR number to review |
| `repository` | `string` | `null` | Repository (owner/repo) |

#### Methods

##### `initialize()`

Initializes the reviewer with configuration and clients.

```javascript
await reviewer.initialize();
```

**Returns**: `Promise<void>`

**Throws**: `Error` if initialization fails

##### `reviewPullRequest(options)`

Reviews a pull request.

```javascript
const result = await reviewer.reviewPullRequest({
  prNumber: 123,
  repository: 'owner/repo'
});
```

**Parameters**:

- `options.prNumber` (number): PR number to review
- `options.repository` (string): Repository name

**Returns**: `Promise<Object>`

```javascript
{
  success: boolean,
  issuesFound: number,
  commentsPosted: number,
  costUsd: number
}
```

##### `run(options)`

Runs the complete review process with environment variable support.

```javascript
const result = await reviewer.run({
  prNumber: 123,
  repository: 'owner/repo',
  dryRun: true
});
```

**Returns**: `Promise<Object>` - Same as `reviewPullRequest()`

---

## Configuration API

### `loadConfig(configPath)`

Loads and validates configuration from YAML file.

```javascript
import { loadConfig } from './agent/lib/config.js';

const config = await loadConfig('config/agent.yaml');
```

**Parameters**:

- `configPath` (string): Path to configuration file

**Returns**: `Promise<ConfigObject>`

**Throws**: `Error` if file not found or invalid

### `validateEnvironment()`

Validates required environment variables.

```javascript
import { validateEnvironment } from './agent/lib/config.js';

validateEnvironment();
```

**Throws**: `Error` if required variables missing

### Configuration Schema

```yaml
# AI Model Configuration
model: claude-sonnet-4-20250514
max_tokens: 4000
cost_cap_usd: 0.50

# Review Settings
max_files: 20
context_lines: 60
exclude_patterns:
  - "**/*.env"
  - "**/node_modules/**"
  - "**/*.min.js"

# Project Metadata
project:
  name: "Your Project Name"
  description: "Project description"

# Team Rules
team_rules:
  - "Use async/await, not callbacks"
  - "Add JSDoc comments to exported functions"
  - "Prefer const over let"

# Comment Formatting
comment_format:
  confidence_threshold: 0.6
  category_emojis:
    bug: "🐛"
    style: "💅"
    security: "🔒"
    perf: "⚡"
    test: "🧪"

# Metrics Configuration
metrics:
  enabled: true
  output_path: "metrics/run.json"
```

---

## GitHub Client API

### `GitHubClient`

Handles GitHub API interactions.

```javascript
import { GitHubClient } from './agent/lib/github-client.js';

const client = new GitHubClient('your-token', {
  timeout: 30000,
  retries: 3
});
```

#### Constructor

```javascript
new GitHubClient(token, options)
```

**Parameters**:

- `token` (string): GitHub personal access token
- `options` (Object): Client configuration
  - `timeout` (number): Request timeout in ms
  - `retries` (number): Number of retry attempts

#### Static Methods

##### `fromEnvironment(config)`

Creates client from environment variables.

```javascript
const client = GitHubClient.fromEnvironment(config);
```

**Returns**: `GitHubClient` instance

#### Instance Methods

##### `getPullRequest(prNumber, repository)`

Fetches pull request details.

```javascript
const pr = await client.getPullRequest(123, 'owner/repo');
```

**Returns**: `Promise<Object>` - GitHub PR object

##### `getPullRequestDiff(prNumber, repository)`

Fetches pull request diff.

```javascript
const diff = await client.getPullRequestDiff(123, 'owner/repo');
```

**Returns**: `Promise<string>` - Unified diff content

##### `postReviewComment(prNumber, repository, comment)`

Posts inline review comment.

```javascript
await client.postReviewComment(123, 'owner/repo', {
  body: 'Comment text',
  path: 'src/file.js',
  line: 42,
  side: 'RIGHT'
});
```

**Parameters**:

- `prNumber` (number): PR number
- `repository` (string): Repository name
- `comment` (Object): Comment data

##### `postReview(prNumber, repository, review)`

Posts PR review.

```javascript
await client.postReview(123, 'owner/repo', {
  body: 'Review summary',
  event: 'COMMENT'
});
```

---

## Claude Client API

### `ClaudeClient`

Handles Anthropic Claude API interactions.

```javascript
import { ClaudeClient } from './agent/lib/claude-client.js';

const client = new ClaudeClient('your-api-key', {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4000
});
```

#### Constructor

```javascript
new ClaudeClient(apiKey, config)
```

**Parameters**:

- `apiKey` (string): Anthropic API key
- `config` (Object): Client configuration

#### Static Methods

##### `fromEnvironment(config)`

Creates client from environment variables.

```javascript
const client = ClaudeClient.fromEnvironment(config);
```

#### Instance Methods

##### `reviewCode(systemPrompt, userPrompt)`

Sends code review request to Claude.

```javascript
const response = await client.reviewCode(systemPrompt, userPrompt);
```

**Returns**: `Promise<ReviewResponse>`

##### `estimateTokens(systemPrompt, userPrompt)`

Estimates token count for prompts.

```javascript
const tokens = client.estimateTokens(systemPrompt, userPrompt);
```

**Returns**: `number` - Estimated token count

---

## Diff Parser API

### `parseDiff(diffContent)`

Parses unified diff content into structured format.

```javascript
import { parseDiff } from './agent/lib/diff-parser.js';

const fileDiffs = parseDiff(diffContent);
```

**Parameters**:

- `diffContent` (string): Raw diff content

**Returns**: `Array<FileDiff>` - Parsed file diffs

### `filterFiles(fileDiffs, excludePatterns)`

Filters files based on exclude patterns.

```javascript
import { filterFiles } from './agent/lib/diff-parser.js';

const filtered = filterFiles(fileDiffs, ['**/*.env', '**/node_modules/**']);
```

**Parameters**:

- `fileDiffs` (Array): File diff objects
- `excludePatterns` (Array): Glob patterns to exclude

**Returns**: `Array<FileDiff>` - Filtered file diffs

### `limitFiles(fileDiffs, maxFiles)`

Limits number of files to review.

```javascript
import { limitFiles } from './agent/lib/diff-parser.js';

const limited = limitFiles(fileDiffs, 20);
```

**Parameters**:

- `fileDiffs` (Array): File diff objects
- `maxFiles` (number): Maximum number of files

**Returns**: `Array<FileDiff>` - Limited file diffs

### `getDiffStats(fileDiffs)`

Calculates diff statistics.

```javascript
import { getDiffStats } from './agent/lib/diff-parser.js';

const stats = getDiffStats(fileDiffs);
```

**Returns**: `Object`

```javascript
{
  totalAdditions: number,
  totalDeletions: number,
  totalHunks: number,
  totalFiles: number
}
```

---

## Cost Estimator API

### `estimateTokens(text)`

Estimates token count for text.

```javascript
import { estimateTokens } from './agent/lib/cost-estimator.js';

const tokens = estimateTokens('Hello world');
```

**Returns**: `number` - Estimated tokens

### `estimateApiCost(systemPrompt, userPrompt)`

Estimates complete API cost.

```javascript
import { estimateApiCost } from './agent/lib/cost-estimator.js';

const cost = estimateApiCost(systemPrompt, userPrompt);
```

**Returns**: `Object`

```javascript
{
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  costUsd: number,
  breakdown: {
    systemTokens: number,
    userTokens: number,
    inputCost: number,
    outputCost: number
  }
}
```

### `checkCostCap(estimatedCost, costCap)`

Checks if cost exceeds cap.

```javascript
import { checkCostCap } from './agent/lib/cost-estimator.js';

const exceeds = checkCostCap(0.75, 0.50);
```

**Returns**: `boolean` - True if exceeds cap

---

## Comment Formatter API

### `CommentFormatter`

Formats review comments for GitHub.

```javascript
import { CommentFormatter } from './agent/lib/comment-formatter.js';

const formatter = new CommentFormatter({
  confidence_threshold: 0.6,
  category_emojis: {
    bug: '🐛',
    security: '🔒'
  }
});
```

#### Methods

##### `formatIssue(issue)`

Formats individual issue comment.

```javascript
const comment = formatter.formatIssue({
  path: 'src/file.js',
  line: 42,
  category: 'bug',
  severity: 'high',
  explanation: 'Issue description',
  fix_patch: 'Suggested fix',
  confidence: 0.8
});
```

**Returns**: `string` - Formatted comment

##### `formatSummaryComment(reviewData, metrics)`

Formats summary comment.

```javascript
const summary = formatter.formatSummaryComment(reviewData, metrics);
```

**Returns**: `string` - Formatted summary

##### `createLineComment(issue)`

Creates GitHub line comment object.

```javascript
const comment = formatter.createLineComment(issue);
```

**Returns**: `Object` - GitHub comment object

---

## Metrics Collector API

### `MetricsCollector`

Collects and stores review metrics.

```javascript
import { MetricsCollector } from './agent/lib/metrics.js';

const metrics = new MetricsCollector({
  enabled: true,
  output_path: 'metrics/run.json'
});
```

#### Methods

##### `startReview(data)`

Starts metrics collection for a review.

```javascript
metrics.startReview({
  pr_number: 123,
  repository: 'owner/repo',
  model_used: 'claude-sonnet-4-20250514'
});
```

##### `recordFileStats(stats)`

Records file processing statistics.

```javascript
metrics.recordFileStats({
  files_reviewed: 5,
  files_excluded: 2,
  total_additions: 100,
  total_deletions: 50,
  total_hunks: 10
});
```

##### `recordCostStats(stats)`

Records cost statistics.

```javascript
metrics.recordCostStats({
  est_cost_usd: 0.05,
  tokens_used: 1000,
  truncated_due_to_limits: false
});
```

##### `recordIssues(issues)`

Records found issues.

```javascript
metrics.recordIssues([
  { category: 'bug', confidence: 0.8 },
  { category: 'security', confidence: 0.9 }
]);
```

##### `markSuccess()`

Marks review as successful.

```javascript
metrics.markSuccess();
```

##### `markError(errorMessage)`

Marks review as failed.

```javascript
metrics.markError('API timeout');
```

##### `getMetrics()`

Gets current metrics.

```javascript
const data = metrics.getMetrics();
```

**Returns**: `Object` - Current metrics data

---

## Prompt Templates API

### `createSystemPrompt(options)`

Creates system prompt for Claude.

```javascript
import { createSystemPrompt } from './agent/prompts/review-prompt.js';

const prompt = createSystemPrompt({
  teamRules: ['Use async/await', 'Add JSDoc comments']
});
```

**Returns**: `string` - System prompt

### `createUserPrompt(options)`

Creates user prompt for Claude.

```javascript
import { createUserPrompt } from './agent/prompts/review-prompt.js';

const prompt = createUserPrompt({
  prInfo: {
    title: 'Add feature',
    description: 'PR description'
  },
  fileDiffs: parsedDiffs,
  projectContext: {
    name: 'My Project',
    description: 'Project description'
  }
});
```

**Returns**: `string` - User prompt

### `createFocusedPrompt(options)`

Creates focused prompt for single file.

```javascript
import { createFocusedPrompt } from './agent/prompts/review-prompt.js';

const prompt = createFocusedPrompt({
  fileDiff: singleFileDiff,
  prInfo: prInfo
});
```

**Returns**: `string` - Focused prompt

---

## Main Reviewer API

### `reviewPullRequest(options)`

Main function to review a pull request.

```javascript
import { reviewPullRequest } from './agent/reviewer.js';

const result = await reviewPullRequest({
  prNumber: 123,
  repository: 'owner/repo',
  dryRun: false,
  configPath: 'config/agent.yaml'
});
```

**Parameters**:

- `options.prNumber` (number): PR number to review
- `options.repository` (string): Repository name
- `options.dryRun` (boolean): Run without posting comments
- `options.configPath` (string): Path to config file

**Returns**: `Promise<Object>`

```javascript
{
  success: boolean,
  issuesFound: number,
  commentsPosted: number,
  costUsd: number
}
```

---

## Error Handling

### Error Types

#### `ConfigurationError`

Thrown when configuration is invalid.

```javascript
try {
  const config = await loadConfig('invalid.yaml');
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Config error:', error.message);
  }
}
```

#### `APIError`

Thrown when API calls fail.

```javascript
try {
  const pr = await githubClient.getPullRequest(123, 'owner/repo');
} catch (error) {
  if (error instanceof APIError) {
    console.error('API error:', error.message);
  }
}
```

#### `ValidationError`

Thrown when data validation fails.

```javascript
try {
  formatter.formatIssue(invalidIssue);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  }
}
```

### Error Handling Patterns

```javascript
try {
  const result = await reviewPullRequest(options);
  console.log('Review completed:', result);
} catch (error) {
  console.error('Review failed:', error.message);
  
  // Handle specific error types
  if (error.code === 'COST_CAP_EXCEEDED') {
    console.log('Cost cap exceeded, review truncated');
  } else if (error.code === 'NO_FILES_TO_REVIEW') {
    console.log('No files to review after filtering');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Type Definitions

### FileDiff

```javascript
{
  path: string,           // File path
  additions: number,      // Number of additions
  deletions: number,      // Number of deletions
  hunks: Array<{          // Diff hunks
    oldStart: number,     // Old line start
    oldCount: number,     // Old line count
    newStart: number,     // New line start
    newCount: number,     // New line count
    lines: Array<string>  // Hunk lines
  }>
}
```

### ReviewIssue

```javascript
{
  path: string,           // File path
  line: number,           // Line number
  category: string,       // Issue category (bug|style|security|perf|test)
  severity: string,       // Severity level (low|med|high)
  explanation: string,    // Issue explanation
  fix_patch?: string,     // Suggested fix (optional)
  confidence: number      // Confidence level (0.0-1.0)
}
```

### ReviewResponse

```javascript
{
  summary: string,        // Review summary
  issues: Array<ReviewIssue>, // Found issues
  risks: Array<string>    // Identified risks
}
```

### MetricsData

```javascript
{
  timestamp: string,      // ISO timestamp
  pr_number: number,      // PR number
  repository: string,     // Repository name
  model_used: string,     // AI model used
  files_reviewed: number, // Files reviewed
  files_excluded: number, // Files excluded
  issues_found: number,   // Issues found
  comments_posted: number,// Comments posted
  est_cost_usd: number,  // Estimated cost
  time_to_first_feedback_sec: number, // Review time
  success: boolean,       // Success status
  error_message?: string  // Error message if failed
}
```

---

## Usage Examples

### Basic Usage

```javascript
import { reviewPullRequest } from './agent/reviewer.js';

// Review a PR
const result = await reviewPullRequest({
  prNumber: 123,
  repository: 'owner/repo'
});

console.log(`Found ${result.issuesFound} issues`);
console.log(`Posted ${result.commentsPosted} comments`);
console.log(`Cost: $${result.costUsd.toFixed(4)}`);
```

### Advanced Usage

```javascript
import { PRReviewer } from './agent/reviewer.js';

const reviewer = new PRReviewer({
  configPath: 'custom-config.yaml',
  dryRun: true
});

await reviewer.initialize();

// Custom review process
const prInfo = await reviewer.getPullRequestInfo(123, 'owner/repo');
const diff = await reviewer.getPullRequestDiff(123, 'owner/repo');
const fileDiffs = await reviewer.processDiff(diff);
const costEstimate = await reviewer.estimateReviewCost(fileDiffs, prInfo);

if (!costEstimate.exceedsCap) {
  const review = await reviewer.getAIReview(fileDiffs, prInfo);
  const comments = await reviewer.postComments(review, 123, 'owner/repo');
}
```

### CLI Usage

```bash
# Review a PR
node agent/reviewer.js --pr 123 --repo owner/repo

# Dry run
node agent/reviewer.js --dry-run --pr 123 --repo owner/repo

# Custom config
node agent/reviewer.js --config custom.yaml --pr 123 --repo owner/repo
```

### Environment Variables

```bash
export ANTHROPIC_API_KEY="your-api-key"
export GITHUB_TOKEN="your-token"
export PR_NUMBER="123"
export REPOSITORY="owner/repo"
export DRY_RUN="true"
export CONFIG_PATH="config/agent.yaml"
```

---

## Best Practices

### Error Handling

```javascript
try {
  const result = await reviewPullRequest(options);
} catch (error) {
  // Log error details
  console.error('[pr-pilot] Review failed:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  
  // Handle gracefully
  process.exit(1);
}
```

### Configuration Management

```javascript
// Load config with fallbacks
const config = await loadConfig(process.env.CONFIG_PATH || 'config/agent.yaml');

// Validate before use
if (!config.model || !config.cost_cap_usd) {
  throw new Error('Invalid configuration');
}
```

### Metrics Collection

```javascript
const metrics = new MetricsCollector();

// Always start metrics
metrics.startReview({ pr_number, repository, model_used });

try {
  // Review process
  const result = await reviewPullRequest(options);
  metrics.markSuccess();
} catch (error) {
  metrics.markError(error.message);
} finally {
  // Metrics are automatically written
}
```

---

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**

   ```
   Error: Missing required environment variables: ANTHROPIC_API_KEY, GITHUB_TOKEN
   ```

   Solution: Set the required environment variables.

2. **Configuration Not Found**

   ```
   Error: Configuration file not found: config/agent.yaml
   ```

   Solution: Ensure the config file exists or specify correct path.

3. **Cost Cap Exceeded**

   ```
   Error: Cost cap exceeded: $0.75 > $0.50
   ```

   Solution: Increase cost cap or reduce file count.

4. **API Rate Limits**

   ```
   Error: API rate limit exceeded
   ```

   Solution: Wait and retry, or check API quotas.

### Debug Mode

```javascript
// Enable debug logging
process.env.DEBUG = 'pr-pilot:*';

// Or specific modules
process.env.DEBUG = 'pr-pilot:github,pr-pilot:claude';
```

---

## Support

For additional help:

- 📖 [README.md](README.md) - Setup and usage guide
- 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- 🤝 [CONTRIBUTING.md](CONTRIBUTING.md) - Contributing guidelines
- 🐛 [GitHub Issues](https://github.com/your-username/pr-pilot/issues) - Bug reports
- 💬 [GitHub Discussions](https://github.com/your-username/pr-pilot/discussions) - Questions and discussions
