# PR-Pilot Requirements Specification

## Project Overview

**Goal:** Build a minimal viable PR review agent that posts actionable code review comments on GitHub Pull Requests using Claude AI.

**Time Budget:** 3 hours (MVP scope)

**Tech Stack:** Node.js (ES Modules), GitHub Actions, Octokit, Anthropic SDK

---

## Core Functionality

### What the Agent Does

1. **Triggers** on GitHub PR events (opened, synchronize)
2. **Fetches** the git diff for all changed files in the PR
3. **Filters** files based on exclude patterns and limits
4. **Estimates** token cost and aborts if over budget
5. **Sends** diff + context to Claude API with strict JSON schema
6. **Parses** Claude's JSON response containing issues/suggestions
7. **Posts** inline review comments on specific lines + one summary comment
8. **Writes** metrics to `/metrics/run.json`

---

## Deliverables Checklist

- [ ] **CI Workflow File:** `.github/workflows/pr-review.yml`
- [ ] **Agent Script:** `agent/reviewer.js` (main entry point)
- [ ] **Configuration:** `config/agent.yaml` (model, limits, rules)
- [ ] **README.md:** Setup instructions, usage, examples
- [ ] **Sample PR:** Live demo with bot comments + CI run link
- [ ] **Metrics File:** `/metrics/run.json` written after each run

---

## JSON Response Contract

Claude must return **ONLY** valid JSON in this exact format:

```json
{
  "summary": "1-2 sentence overview of the PR",
  "issues": [
    {
      "path": "src/file.js",
      "line": 42,
      "category": "bug|style|security|perf|test",
      "severity": "low|med|high",
      "explanation": "Clear, actionable reason (1-2 sentences)",
      "fix_patch": "Suggested code fix (unified diff or code block)",
      "confidence": 0.85
    }
  ],
  "risks": [
    "Potential risk or concern about the changes"
  ]
}
```

**Validation Rules:**

- Must be valid JSON (no markdown, no code fences)
- All fields required except `fix_patch` (optional)
- `category` must be one of: bug, style, security, perf, test
- `severity` must be one of: low, med, high
- `confidence` must be 0.0-1.0
- `line` must be a positive integer
- `path` must match a file in the PR diff

---

## Must-Have Features

### 1. CI Trigger

- Trigger on `pull_request` events: `opened`, `synchronize`
- Run in GitHub Actions environment
- Access `ANTHROPIC_API_KEY` from repo secrets
- Access `GITHUB_TOKEN` (auto-provided by GitHub)

### 2. Diff Fetching & Filtering

- Fetch unified diff from GitHub API
- **Exclude files** matching glob patterns (from config):
  - `**/*.env`, `**/*.env.*`
  - `**/secrets/**`
  - `**/dist/**`, `**/build/**`
  - `**/node_modules/**`
  - `**/*.min.js`, `**/*.min.css`
  - `**/package-lock.json`, `**/yarn.lock`
- Respect `max_files` limit (default: 20)
- Send only changed hunks + minimal context (≤120 lines per file)

### 3. Cost Cap Enforcement

- Estimate input tokens before API call (chars/4 approximation)
- Calculate estimated cost using Claude Sonnet 4.5 pricing:
  - Input: $3 per million tokens
  - Output: $15 per million tokens
- **Abort** if estimated cost exceeds `cost_cap_usd` (default: $0.50)
- Log cost estimation to console

### 4. Claude API Integration

- Use model: `claude-sonnet-4-20250514`
- Max tokens: 4000 (configurable)
- Send structured prompt with:
  - System: Role as senior code reviewer
  - User: Project context + team rules + file diffs
- **Enforce JSON output** with explicit prompt instructions
- Retry once if JSON parsing fails

### 5. Comment Posting

- Post **inline comments** for each issue:
  - Map `line` number to GitHub API `position` in diff
  - Include category emoji (🐛 bug, 💅 style, 🔒 security, ⚡ perf, 🧪 test)
  - Format: `**[CATEGORY]** explanation\n\nSuggested fix:\n```\nfix_patch\n```\n\nConfidence: XX%`
- Post **one summary comment** on the PR:
  - Overall assessment from Claude's `summary`
  - List of risks (if any)
  - Total issues found by category

### 6. Dry-Run Mode

- Support `--dry-run` flag (or `DRY_RUN=true` env var)
- Print JSON response to console instead of posting
- Useful for local testing without API calls

### 7. Metrics Collection

Write to `/metrics/run.json` after each run:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "pr_number": 42,
  "time_to_first_feedback_sec": 12.4,
  "num_comments_posted": 5,
  "est_cost_usd": 0.03,
  "truncated_due_to_limits": false,
  "files_reviewed": 8,
  "files_excluded": 3
}
```

---

## Configuration Schema

**File:** `config/agent.yaml`

```yaml
# Claude model to use
model: claude-sonnet-4-20250514

# Maximum tokens per API request
max_tokens: 4000

# Cost cap in USD (abort if exceeded)
cost_cap_usd: 0.50

# Maximum files to review per PR
max_files: 20

# Lines of context around each change
context_lines: 60

# File exclusion patterns (glob format)
exclude_patterns:
  - "**/*.env"
  - "**/secrets/**"
  - "**/dist/**"
  - "**/node_modules/**"

# Project metadata
project:
  name: "Your Project Name"
  description: "Brief project description"

# Team coding rules (sent to Claude)
team_rules:
  - "No hardcoded secrets or API keys"
  - "Use async/await, not callbacks"
  - "Add JSDoc comments to exported functions"
  - "Prefer const over let"
  - "Handle errors explicitly"
```

---

## Prompt Engineering

### System Prompt Template

```text
You are a senior code reviewer. Your task is to review code changes and provide precise, brief, and actionable feedback.

CRITICAL RULES:
1. Return ONLY valid JSON matching the schema provided
2. No markdown formatting, no code fences, no explanations outside JSON
3. Start response with { and end with }
4. Be specific: reference exact line numbers and variable names
5. If unsure about an issue, set confidence < 0.7
6. Focus on: bugs, security, performance, and maintainability
7. Suggest concrete fixes when possible

If you cannot review the code, return:
{"summary": "Unable to review", "issues": [], "risks": []}
```

### User Prompt Template

```text
Project: {project.name}
Description: {project.description}

Team Rules:
{team_rules as bullet list}

Files to Review:
{for each file}
File: {path}
Changes:
{diff hunks with ±60 lines context}
{end for}

Return ONLY valid JSON with your review.
```

---

## Nice-to-Have Features (Optional)

**Choose ONE if time permits:**

1. **Retry with backoff** on transient API errors (rate limits, timeouts)
2. **Top-N files fallback** when PR is huge (review most critical files first)
3. **Few-shot examples** in prompt to improve fix suggestions
4. **Confidence threshold** to suppress comments with confidence < 0.6

---

## Error Handling Requirements

### Must Handle

- Invalid or missing environment variables → Exit with clear error
- GitHub API failures → Log and exit with error code
- Anthropic API failures → Log and exit with error code
- Invalid JSON from Claude → Retry once, then fail gracefully
- Cost cap exceeded → Log reason and exit (not a failure)
- No files to review (all excluded) → Log and exit successfully

### Logging Standards

- Prefix all logs with `[pr-pilot]`
- Use `console.log` for info
- Use `console.error` for errors
- Use `console.warn` for warnings
- Include timestamps in metrics

---

## Security Requirements

1. **Never log secrets:**
   - Redact `ANTHROPIC_API_KEY` in all logs
   - Redact `GITHUB_TOKEN` in all logs

2. **Validate inputs:**
   - Sanitize PR numbers (must be positive integers)
   - Validate file paths (no directory traversal)
   - Validate config schema on load

3. **Forked PR safety:**
   - Be aware that forks shouldn't have access to secrets
   - Document this limitation in README

4. **Prompt injection:**
   - Don't execute code from PR diffs
   - Treat all PR content as untrusted input

---

## Evaluation Criteria (100 points)

| Criteria | Points | Description |
|----------|--------|-------------|
| **End-to-End Works** | 40 | CI triggers, fetches diff, posts comments |
| **Comment Quality** | 25 | Specific, actionable, accurate (not hallucinated) |
| **Guardrails** | 15 | Cost cap, excludes, large-PR fallback work |
| **Metrics Present** | 10 | `/metrics/run.json` written with correct data |
| **README Clarity** | 10 | Clear setup, usage, examples |

**Pass Bar:** At least 3 useful comments on sample PR + metrics file present + within cost cap

---

## Testing Strategy

### Local Testing

```bash
# Test with dry-run
node agent/reviewer.js --pr-number=1 --dry-run

# Test with real PR (requires test repo)
node agent/reviewer.js --pr-number=1
```

### CI Testing

1. Create test PR with intentional issues:
   - Hardcoded API key (security)
   - Missing error handling (bug)
   - Console.log left in (style)
   - Inefficient loop (perf)
2. Push changes to trigger workflow
3. Verify comments appear on PR
4. Check CI logs for errors
5. Verify metrics file is generated

---

## Project Structure

```text
pr-pilot/
├── .github/
│   └── workflows/
│       └── pr-review.yml          # CI workflow
├── agent/
│   ├── reviewer.js                # Main entry point
│   ├── lib/
│   │   ├── config.js              # Config loader
│   │   ├── github-client.js       # GitHub API wrapper
│   │   ├── diff-parser.js         # Parse unified diffs
│   │   ├── claude-client.js       # Anthropic API wrapper
│   │   ├── cost-estimator.js      # Token counting
│   │   ├── comment-formatter.js   # Format comments
│   │   └── metrics.js             # Write metrics
│   └── prompts/
│       └── review-prompt.js       # Prompt templates
├── config/
│   └── agent.yaml                 # Configuration
├── metrics/
│   └── .gitkeep                   # Metrics output dir
├── .cursorrules                   # Cursor AI rules
├── .env.example                   # Environment template
├── .gitignore
├── package.json
├── README.md
└── REQUIREMENTS.md                # This file
```

---

## API Reference

### GitHub API

- **Docs:** <https://docs.github.com/en/rest/pulls>
- **Get PR:** `GET /repos/{owner}/{repo}/pulls/{pull_number}`
- **Get Diff:** Same endpoint with `Accept: application/vnd.github.v3.diff`
- **Create Review:** `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`

### Anthropic API

- **Docs:** <https://docs.anthropic.com/>
- **Model:** `claude-sonnet-4-20250514`
- **Endpoint:** `POST /v1/messages`
- **Pricing:** <https://anthropic.com/pricing>

---

## Out of Scope (for MVP)

❌ Multi-repo support
❌ GitLab/Bitbucket support  
❌ Web dashboard
❌ User authentication
❌ Historical review storage
❌ ML model for priority ranking
❌ Integration with Jira/Linear
❌ Custom review rules per file type
❌ Incremental reviews (only review new commits)
❌ Auto-fix via commits

---

## Success Metrics

**Minimum Viable Product:**

- ✅ Posts at least 3 relevant comments on test PR
- ✅ Comments are specific and actionable
- ✅ Stays within cost cap
- ✅ Metrics file generated
- ✅ No false positives (hallucinations)
- ✅ CI workflow runs successfully

**Bonus Points:**

- Comments include working code fixes
- Catches real security issues
- Response time < 30 seconds
- Cost < $0.10 per PR

---

## Submission Requirements

1. **GitHub Repository URL**
2. **Sample PR URL** with bot comments
3. **CI Run URL** showing successful execution
4. **README.md** with setup instructions
5. **(Optional) Screen recording** if repo is private (≤2 min)

---

## Timeline

### Total: 3 hours

| Phase | Time | Tasks |
|-------|------|-------|
| Setup | 15m | Project structure, dependencies, config |
| Core Utils | 20m | Config loader, cost estimator |
| GitHub | 30m | API client, diff fetching |
| Diff Parsing | 25m | Parse unified diffs, extract hunks |
| Claude | 35m | API client, prompt engineering |
| Orchestrator | 30m | Main logic, wire everything |
| CI/CD | 20m | GitHub Actions workflow |
| Testing | 25m | Create test PR, verify, document |

---

## Pro Tips

1. **Keep prompts short** - Don't dump entire files, just hunks
2. **Enforce JSON strictly** - Retry once with reminder if invalid
3. **Make comments tight** - Line number + 1-2 sentences + fix
4. **Show cost cap works** - Test with a PR that exceeds limit
5. **Use dry-run extensively** - Test locally before CI

---

## Common Pitfalls

⚠️ **Line numbers vs positions:** GitHub API uses "position" in diff, not line in file
⚠️ **Diff format parsing:** Handle edge cases (binary files, renames, empty diffs)
⚠️ **JSON validation:** Claude may return markdown-wrapped JSON
⚠️ **Rate limiting:** Don't parallelize requests, do them sequentially
⚠️ **Context window:** Don't exceed 200k tokens (estimate ~50k words)

---

## References

- GitHub REST API: <https://docs.github.com/en/rest>
- Anthropic API: <https://docs.anthropic.com/>
- Unified Diff Format: <https://www.gnu.org/software/diffutils/manual/html_node/Detailed-Unified.html>
- Octokit.js: <https://octokit.github.io/rest.js/>
