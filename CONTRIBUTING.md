# Contributing to PR-Pilot

Thank you for your interest in contributing to PR-Pilot! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

Before creating an issue, please:

1. **Search existing issues** to avoid duplicates
2. **Check the documentation** for solutions
3. **Use the issue templates** when available

When creating an issue, include:

- **Clear title** describing the problem
- **Detailed description** of the issue
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Environment details** (OS, Node.js version, etc.)
- **Screenshots or logs** if applicable

### Suggesting Features

We welcome feature suggestions! Please:

1. **Check existing feature requests** first
2. **Describe the use case** and benefits
3. **Provide examples** of how it would work
4. **Consider implementation complexity**

### Code Contributions

#### Getting Started

1. **Fork the repository**

   ```bash
   git clone https://github.com/itsgg/pr-pilot.git
   cd pr-pilot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes** and add tests

5. **Run tests**

   ```bash
   npm test
   ```

6. **Commit your changes**

   ```bash
   git commit -m "Add your feature"
   ```

7. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a pull request**

#### Development Guidelines

**Code Style:**

- Use ES modules (`import/export`)
- Prefer `async/await` over callbacks
- Use `const` by default, `let` only when needed
- Add JSDoc comments to exported functions
- Follow the existing code style

**Testing:**

- Write unit tests for new features
- Ensure all tests pass: `npm test`
- Aim for high test coverage
- Test edge cases and error conditions

**Documentation:**

- Update README.md if needed
- Add JSDoc comments for new functions
- Update configuration examples
- Include usage examples

**Error Handling:**

- Use try/catch blocks for async operations
- Provide meaningful error messages
- Log errors appropriately
- Handle edge cases gracefully

#### Pull Request Process

1. **Update documentation** if your changes affect user-facing features
2. **Add tests** for new functionality
3. **Ensure all tests pass** and code coverage is maintained
4. **Update CHANGELOG.md** with your changes
5. **Request review** from maintainers
6. **Address feedback** promptly

### Pull Request Guidelines

**Title:**

- Use clear, descriptive titles
- Start with a verb (Add, Fix, Update, etc.)
- Keep it under 50 characters

**Description:**

- Explain what the PR does
- Reference related issues
- Include screenshots for UI changes
- List breaking changes if any

**Code Quality:**

- Follow the coding standards
- Add appropriate tests
- Ensure CI passes
- Keep PRs focused and small

## 🏗️ Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Code editor (VS Code recommended)

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/itsgg/pr-pilot.git
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

4. **Run tests**

   ```bash
   npm test
   ```

### Project Structure

```text
pr-pilot/
├── agent/                    # Main application code
│   ├── lib/                 # Core libraries
│   ├── prompts/             # AI prompt templates
│   └── reviewer.js          # Main entry point
├── config/                  # Configuration files
├── .github/workflows/       # GitHub Actions workflows
├── scripts/                 # Utility scripts
├── tests/                   # Test files
└── docs/                    # Documentation
```

### Available Scripts

```bash
npm test              # Run all tests
npm run test:coverage # Run tests with coverage
npm start             # Start the application
npm run dry-run       # Run in dry-run mode
npm run lint          # Lint code
npm run format        # Format code
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test agent/lib/config.test.js

# Run with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Use Node.js built-in test runner
- Follow the existing test patterns
- Test both success and error cases
- Mock external dependencies
- Keep tests focused and isolated

### Test Structure

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { yourFunction } from './your-module.js';

describe('Your Module', () => {
  it('should handle success case', () => {
    const result = yourFunction('input');
    assert.strictEqual(result, 'expected');
  });

  it('should handle error case', () => {
    assert.throws(() => {
      yourFunction(null);
    }, /Error message/);
  });
});
```

## 📝 Documentation

### Code Documentation

- Add JSDoc comments to exported functions
- Include parameter types and descriptions
- Document return values and exceptions
- Provide usage examples

### User Documentation

- Update README.md for user-facing changes
- Add configuration examples
- Include troubleshooting guides
- Update API documentation

### Internal Documentation

- Document complex algorithms
- Explain design decisions
- Add inline comments for clarity
- Update architecture diagrams

## 🐛 Debugging

### Common Issues

**Tests failing:**

```bash
# Check test output
npm test -- --verbose

# Run specific test
node --test agent/lib/config.test.js
```

**Configuration errors:**

```bash
# Validate configuration
node -e "import { loadConfig } from './agent/lib/config.js'; loadConfig('config/agent.yaml').then(console.log)"
```

**API errors:**

```bash
# Check environment variables
echo $ANTHROPIC_API_KEY
echo $GITHUB_TOKEN

# Test API connectivity
node -e "import { ClaudeClient } from './agent/lib/claude-client.js'; console.log('API test')"
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=pr-pilot:* node agent/reviewer.js --pr 123
```

## 🔄 Release Process

### Version Bumping

We use semantic versioning (semver):

- **Patch** (1.0.1): Bug fixes
- **Minor** (1.1.0): New features
- **Major** (2.0.0): Breaking changes

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Release notes prepared
- [ ] Tag created and pushed

## 📞 Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: <contributors@pr-pilot.dev>
- **Discord**: [Join our community](https://discord.gg/pr-pilot)

## 📋 Code of Conduct

We are committed to providing a welcoming and inclusive experience for everyone. Please:

- Be respectful and inclusive
- Use welcoming and inclusive language
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

## 🙏 Recognition

Contributors will be recognized in:

- CONTRIBUTORS.md file
- Release notes
- Project documentation
- Community acknowledgments

Thank you for contributing to PR-Pilot! 🚀
