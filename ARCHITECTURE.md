# PR-Pilot Architecture

## System Overview

PR-Pilot is an AI-powered PR review agent that automatically reviews GitHub Pull Requests using Claude AI and posts actionable comments.

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                GitHub Repository                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐              │
│  │   Pull Request  │    │   File Changes  │    │   Review        │              │
│  │   (opened/      │───▶│   (Git Diff)    │───▶│   Comments      │              │
│  │   synchronize)  │    │                 │    │   (Inline +     │              │
│  └─────────────────┘    └─────────────────┘    │   Summary)      │              │
│                                                └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ GitHub API
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                            GitHub Actions Workflow                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  .github/workflows/pr-review.yml                                        │  │
│  │  • Trigger: pull_request (opened, synchronize)                          │  │
│  │  • Environment: ANTHROPIC_API_KEY, GITHUB_TOKEN                         │  │
│  │  • Run: node agent/reviewer.js                                          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Execute
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              Agent Entry Point                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  agent/reviewer.js                                                      │  │
│  │  • Parse CLI args (--pr-number, --dry-run)                              │  │
│  │  • Load configuration                                                   │  │
│  │  • Orchestrate review process                                           │  │
│  │  • Handle errors and exit codes                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Orchestrate
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Core Processing Pipeline                        │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Config    │    │   GitHub    │    │   Diff      │    │   Cost      │    │
│  │   Loader    │    │   Client    │    │   Parser    │    │ Estimator   │    │
│  │             │    │             │    │             │    │             │    │
│  │ • Load      │    │ • Fetch PR  │    │ • Parse     │    │ • Count     │    │
│  │   agent.yaml│    │   details   │    │   unified   │    │   tokens    │    │
│  │ • Validate  │    │ • Get diff  │    │   diff      │    │ • Calculate │    │
│  │   schema    │    │ • Filter    │    │ • Extract   │    │   cost      │    │
│  │             │    │   files     │    │   hunks     │    │ • Check cap │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                   │                   │                   │        │
│         └───────────────────┼───────────────────┼───────────────────┘        │
│                             │                   │                            │
│                             ▼                   ▼                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Prompt    │    │   Claude    │    │   Comment   │    │   Metrics   │    │
│  │  Templates  │    │   Client    │    │ Formatter   │    │  Collector  │    │
│  │             │    │             │    │             │    │             │    │
│  │ • System    │    │ • Send      │    │ • Format    │    │ • Track     │    │
│  │   prompt    │    │   request   │    │   inline    │    │   timing    │    │
│  │ • User      │    │ • Parse     │    │   comments  │    │ • Count     │    │
│  │   prompt    │    │   JSON      │    │ • Format    │    │   comments  │    │
│  │ • Enforce   │    │ • Retry on  │    │   summary   │    │ • Write     │    │
│  │   JSON      │    │   failure   │    │ • Post to   │    │   run.json  │    │
│  │   output    │    │             │    │   GitHub    │    │             │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ External APIs
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                              External Services                                 │
│                                                                                │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐    │
│  │         GitHub API              │    │        Anthropic API            │    │
│  │                                 │    │                                 │    │
│  │ • GET /repos/{owner}/{repo}/    │    │ • POST /v1/messages             │    │
│  │   pulls/{pull_number}           │    │ • Model: claude-sonnet-4-       │    │
│  │ • Accept: application/vnd.      │    │   20250514                      │    │
│  │   github.v3.diff                │    │ • Input: $3/M tokens            │    │
│  │ • POST /repos/{owner}/{repo}/   │    │ • Output: $15/M tokens          │    │
│  │   pulls/{pull_number}/reviews   │    │ • Max tokens: 4000              │    │
│  └─────────────────────────────────┘    └─────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```text
1. GitHub PR Event
   └── GitHub Actions Workflow
       └── agent/reviewer.js
           └── Load Configuration (config/agent.yaml)
               └── GitHub Client
                   └── Fetch PR Details & Diff
                       └── Diff Parser
                           └── Filter Files (exclude_patterns)
                               └── Cost Estimator
                                   └── Check Cost Cap
                                       └── Prompt Templates
                                           └── Claude Client
                                               └── Parse JSON Response
                                                   └── Comment Formatter
                                                       └── Post Comments to GitHub
                                                           └── Metrics Collector
                                                               └── Write /metrics/run.json
```

## File Structure

```text
pr-pilot/
├── .github/workflows/pr-review.yml     # CI/CD Pipeline
├── agent/
│   ├── reviewer.js                     # Main Entry Point
│   ├── lib/
│   │   ├── config.js                   # Configuration Loader
│   │   ├── github-client.js            # GitHub API Wrapper
│   │   ├── diff-parser.js              # Unified Diff Parser
│   │   ├── claude-client.js            # Anthropic API Wrapper
│   │   ├── cost-estimator.js           # Token Counting & Cost Calc
│   │   ├── comment-formatter.js        # Comment Formatting
│   │   └── metrics.js                  # Metrics Collection
│   └── prompts/
│       └── review-prompt.js            # Prompt Templates
├── config/
│   └── agent.yaml                      # Configuration
├── metrics/
│   └── run.json                        # Runtime Metrics
└── README.md                           # Documentation
```

## Key Components

### 1. GitHub Actions Workflow

- **Trigger**: `pull_request` events (opened, synchronize)
- **Environment**: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`
- **Action**: Execute `agent/reviewer.js`

### 2. Agent Entry Point (`agent/reviewer.js`)

- Parse command line arguments
- Load and validate configuration
- Orchestrate the review process
- Handle errors and exit codes

### 3. Core Libraries

- **Config Loader**: Load and validate `agent.yaml`
- **GitHub Client**: Fetch PR details and diffs
- **Diff Parser**: Parse unified diff format
- **Cost Estimator**: Calculate token costs and enforce limits
- **Claude Client**: Send requests to Anthropic API
- **Comment Formatter**: Format and post comments
- **Metrics Collector**: Track and write metrics

### 4. Configuration (`config/agent.yaml`)

- Model settings (Claude Sonnet 4)
- Cost limits and file limits
- File exclusion patterns
- Project metadata and team rules

### 5. Prompt Templates (`agent/prompts/review-prompt.js`)

- System prompt for Claude
- User prompt template
- JSON schema enforcement

## Security Considerations

- **Secret Management**: Environment variables for API keys
- **Input Validation**: Sanitize PR numbers and file paths
- **Fork Safety**: Document limitations for forked PRs
- **Prompt Injection**: Treat PR content as untrusted input

## Error Handling

- Invalid/missing environment variables → Exit with error
- GitHub API failures → Log and exit
- Anthropic API failures → Log and exit
- Invalid JSON from Claude → Retry once, then fail
- Cost cap exceeded → Log reason and exit
- No files to review → Log and exit successfully

## Metrics Collection

The system writes metrics to `/metrics/run.json` after each run:

- Timestamp and PR number
- Time to first feedback
- Number of comments posted
- Estimated cost
- Files reviewed and excluded
- Truncation status
