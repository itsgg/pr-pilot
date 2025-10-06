# PR-Pilot 🤖

> AI-powered Pull Request reviews using Claude

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

PR-Pilot is an intelligent code review agent that automatically analyzes pull requests and provides actionable feedback using Claude AI. It integrates seamlessly with GitHub Actions to provide consistent, thorough, and constructive code reviews.

## ✨ Features

- **🤖 AI-Powered Reviews**: Uses Claude Sonnet 4 for intelligent code analysis
- **🔍 Comprehensive Analysis**: Reviews bugs, security issues, performance problems, and code style
- **💰 Cost Management**: Built-in cost estimation and budget controls
- **📊 Rich Metrics**: Detailed reporting and analytics
- **🔒 Security First**: Secure handling of API keys and sensitive data
- **⚡ Fast & Reliable**: Optimized for speed and reliability
- **🎯 Focused Reviews**: Configurable file filtering and review scope
- **📝 Actionable Feedback**: Clear, constructive comments with suggested fixes
- **🔄 CI/CD Ready**: Full GitHub Actions integration
- **🧪 Well Tested**: Comprehensive unit test coverage

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- GitHub repository
- Anthropic API key
- GitHub token (for posting comments)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/pr-pilot.git
   cd pr-pilot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Configure the agent**

   ```bash
   # Edit config/agent.yaml with your preferences
   nano config/agent.yaml
   ```

5. **Test the installation**

   ```bash
   npm test
   ```

### Basic Usage

**Command Line:**

```bash
# Review a specific PR
node agent/reviewer.js --pr 123 --repo owner/repo

# Dry run (no comments posted)
node agent/reviewer.js --dry-run --pr 123 --repo owner/repo

# Use custom config
node agent/reviewer.js --config custom-config.yaml --pr 123
```

**GitHub Actions:**

```yaml
# .github/workflows/pr-review.yml
name: PR-Pilot Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: node agent/reviewer.js --pr ${{ github.event.pull_request.number }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 📖 Documentation

### Configuration

PR-Pilot uses a YAML configuration file (`config/agent.yaml`) to customize behavior:

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
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key for Claude |
| `GITHUB_TOKEN` | Yes | GitHub token for API access |
| `PR_NUMBER` | No | PR number to review (CLI override) |
| `REPOSITORY` | No | Repository to review (CLI override) |
| `DRY_RUN` | No | Set to 'true' for dry-run mode |
| `CONFIG_PATH` | No | Path to config file (default: config/agent.yaml) |

### Command Line Options

```bash
node agent/reviewer.js [options]

Options:
  --pr <number>        PR number to review
  --repo <owner/repo>  Repository to review
  --config <path>      Path to config file
  --dry-run           Run without posting comments
  --help              Show help information
```

## 🏗️ Architecture

PR-Pilot follows a modular architecture with clear separation of concerns:

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub API    │    │   Claude API    │    │   File System   │
│   (Octokit)     │    │  (Anthropic)    │    │   (Config)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ GitHub Client   │    │ Claude Client   │    │ Config Loader   │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     Main Reviewer         │
                    │   (Orchestration)         │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Comment Formatter       │
                    │   (Output Generation)     │
                    └───────────────────────────┘
```

### Core Components

- **Main Reviewer** (`agent/reviewer.js`): Orchestrates the entire review process
- **GitHub Client** (`agent/lib/github-client.js`): Handles GitHub API interactions
- **Claude Client** (`agent/lib/claude-client.js`): Manages Claude AI API calls
- **Diff Parser** (`agent/lib/diff-parser.js`): Parses and processes git diffs
- **Comment Formatter** (`agent/lib/comment-formatter.js`): Formats review comments
- **Cost Estimator** (`agent/lib/cost-estimator.js`): Manages API costs and budgets
- **Metrics Collector** (`agent/lib/metrics.js`): Tracks performance and usage
- **Config Loader** (`agent/lib/config.js`): Handles configuration management

## 🔧 Development

### Project Structure

```text
pr-pilot/
├── agent/                    # Main application code
│   ├── lib/                 # Core libraries
│   │   ├── config.js        # Configuration management
│   │   ├── github-client.js # GitHub API client
│   │   ├── claude-client.js # Claude AI client
│   │   ├── diff-parser.js   # Diff parsing utilities
│   │   ├── comment-formatter.js # Comment formatting
│   │   ├── cost-estimator.js # Cost management
│   │   └── metrics.js       # Metrics collection
│   ├── prompts/             # AI prompt templates
│   │   └── review-prompt.js # Review prompt generation
│   └── reviewer.js          # Main entry point
├── config/                  # Configuration files
│   └── agent.yaml          # Main configuration
├── .github/workflows/       # GitHub Actions workflows
│   ├── pr-review.yml       # Main review workflow
│   ├── test.yml            # Testing workflow
│   └── manual-test.yml     # Manual testing workflow
├── scripts/                 # Utility scripts
│   └── validate-workflows.js # Workflow validation
├── metrics/                 # Metrics output directory
├── tests/                   # Test files
└── docs/                    # Documentation
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test agent/lib/config.test.js

# Run with coverage
npm run test:coverage
```

### Development Workflow

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes** and add tests
4. **Run tests**: `npm test`
5. **Commit changes**: `git commit -m "Add your feature"`
6. **Push to your fork**: `git push origin feature/your-feature`
7. **Create a pull request**

### Code Style

PR-Pilot follows modern JavaScript/Node.js best practices:

- **ES Modules**: Use `import/export` syntax
- **Async/Await**: Prefer async/await over callbacks
- **Const over Let**: Use `const` by default, `let` only when needed
- **JSDoc Comments**: Document all exported functions
- **Error Handling**: Explicit error handling with try/catch
- **Testing**: Comprehensive unit test coverage

## 🚀 Deployment

### GitHub Actions Setup

1. **Add secrets to your repository**:
   - Go to Settings → Secrets and variables → Actions
   - Add `ANTHROPIC_API_KEY` with your Anthropic API key
   - `GITHUB_TOKEN` is automatically provided

2. **Copy workflow files**:

   ```bash
   cp .github/workflows/*.yml /path/to/your/repo/.github/workflows/
   ```

3. **Customize configuration**:

   ```bash
   cp config/agent.yaml /path/to/your/repo/config/
   # Edit the configuration for your needs
   ```

4. **Test the setup**:
   - Create a test pull request
   - Check the Actions tab for workflow execution
   - Verify comments are posted correctly

### Self-Hosted Deployment

For self-hosted environments:

1. **Install dependencies**:

   ```bash
   npm ci --production
   ```

2. **Set up environment**:

   ```bash
   export ANTHROPIC_API_KEY="your-key"
   export GITHUB_TOKEN="your-token"
   ```

3. **Run the agent**:

   ```bash
   node agent/reviewer.js --pr 123 --repo owner/repo
   ```

## 📊 Monitoring & Metrics

PR-Pilot collects comprehensive metrics for monitoring and optimization:

### Metrics Collected

- **Review Performance**: Time to complete reviews
- **Cost Tracking**: API usage and costs
- **Issue Detection**: Types and severity of issues found
- **File Coverage**: Number of files reviewed
- **Comment Activity**: Comments posted and engagement

### Metrics Output

Metrics are saved to `metrics/run.json` after each review:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "pr_number": 123,
  "repository": "owner/repo",
  "model_used": "claude-sonnet-4-20250514",
  "files_reviewed": 5,
  "files_excluded": 2,
  "issues_found": 3,
  "comments_posted": 4,
  "est_cost_usd": 0.05,
  "time_to_first_feedback_sec": 15.2,
  "success": true
}
```

## 🔒 Security

PR-Pilot is designed with security in mind:

- **No Code Execution**: Never executes code from PRs
- **Secret Protection**: Secure handling of API keys
- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: Respects API rate limits
- **Audit Logging**: Comprehensive logging for security monitoring

### Security Best Practices

- Store API keys as GitHub secrets
- Use least-privilege access tokens
- Regularly rotate API keys
- Monitor usage and costs
- Review generated comments before posting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. **Fork the repository**
2. **Clone your fork**: `git clone https://github.com/your-username/pr-pilot.git`
3. **Install dependencies**: `npm install`
4. **Create a branch**: `git checkout -b feature/your-feature`
5. **Make your changes** and add tests
6. **Run tests**: `npm test`
7. **Commit and push**: `git commit -m "Add feature" && git push`
8. **Create a pull request**

### Reporting Issues

Found a bug? Have a feature request? Please [open an issue](https://github.com/your-username/pr-pilot/issues) with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for the Claude AI API
- **GitHub** for the excellent API and Actions platform
- **Node.js** community for the robust ecosystem
- **Contributors** who help improve PR-Pilot

## 📞 Support

- **Documentation**: [Wiki](https://github.com/your-username/pr-pilot/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/pr-pilot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/pr-pilot/discussions)
- **Email**: <support@pr-pilot.dev>
