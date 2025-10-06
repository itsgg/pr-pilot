#!/usr/bin/env node

/**
 * Test PR Generator
 * Creates a test pull request with intentional issues for PR-Pilot testing
 */

import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const TEST_FILES = {
  'src/auth.js': `const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Security issue: hardcoded API key
const API_KEY = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';

const SALT_ROUNDS = 10;

// Missing JSDoc comment
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Performance issue: synchronous operation in async function
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    // Security issue: sensitive data in token
    password: user.password,
    role: user.role
  };
  
  // Security issue: no expiration time
  return jwt.sign(payload, process.env.JWT_SECRET);
}

// Missing error handling
function validateToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { hashPassword, generateToken, validateToken };`,

  'src/routes/users.js': `const express = require('express');
const router = express.Router();

// Performance issue: inefficient database query simulation
router.get('/users', async (req, res) => {
  const users = [];
  for (let i = 0; i < 10000; i++) {
    users.push({ 
      id: i, 
      name: \`User \${i}\`, 
      email: \`user\${i}@example.com\`,
      // Performance issue: unnecessary data processing
      processed: i * Math.random() * 1000
    });
  }
  res.json(users);
});

// Missing input validation
router.post('/users', async (req, res) => {
  const { name, email } = req.body;
  // Bug: no validation
  const user = { id: Date.now(), name, email };
  res.json(user);
});

// Security issue: no authentication
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  // Bug: no error handling
  const deleted = await deleteUser(id);
  res.json({ deleted });
});

module.exports = router;`,

  'src/utils/helpers.js': `// Missing JSDoc comments
function calculateTotal(items) {
  let total = 0;
  // Performance issue: inefficient loop
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}

// Bug: missing error handling
function parseJSON(jsonString) {
  return JSON.parse(jsonString);
}

// Style issue: inconsistent naming
function format_user_name(name) {
  return name.toLowerCase().replace(/\\s+/g, '_');
}

// Security issue: potential XSS
function renderHTML(content) {
  return \`<div>\${content}</div>\`;
}

module.exports = { 
  calculateTotal, 
  parseJSON, 
  format_user_name, 
  renderHTML 
};`,

  'tests/auth.test.js': `const { expect } = require('chai');

// Missing test cases for error scenarios
describe('Authentication', () => {
  it('should hash password', () => {
    // Test implementation missing
  });
  
  it('should verify password', () => {
    // Test implementation missing
  });
});

// TODO: Add integration tests
// TODO: Add security tests
// TODO: Add performance tests`,

  'package.json': `{
  "name": "test-project",
  "version": "1.0.0",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "test": "echo \\"No tests specified\\" && exit 0",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.0",
    "chai": "^4.3.0"
  }
}`,

  'README.md': `# Test Project

This is a test project for PR-Pilot.

## Features
- User authentication
- User management
- Data processing
- Price calculation

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`bash
npm start
\`\`\`

## API Endpoints
- GET /users - Get all users
- POST /users - Create user
- DELETE /users/:id - Delete user

## TODO
- Add error handling
- Add comprehensive tests
- Add API documentation
- Add security middleware
- Add input validation
- Add rate limiting

## Security Notes
- Passwords are hashed with bcrypt
- JWT tokens are used for authentication
- API endpoints are protected

## Performance Notes
- User listing is optimized for small datasets
- Database queries are efficient
- Caching is implemented where needed`
};

function generateTestPR() {
  console.log('🚀 Generating test PR with intentional issues...\n');

  try {
    // Create directories
    mkdirSync('src', { recursive: true });
    mkdirSync('src/routes', { recursive: true });
    mkdirSync('src/utils', { recursive: true });
    mkdirSync('tests', { recursive: true });

    // Write test files
    console.log('📝 Creating test files with intentional issues:');
    Object.entries(TEST_FILES).forEach(([filePath, content]) => {
      writeFileSync(filePath, content);
      console.log(`   ✅ ${filePath}`);
    });

    // Create git branch
    console.log('\n🌿 Creating feature branch...');
    execSync('git checkout -b feature/test-pr-pilot', { stdio: 'inherit' });

    // Add and commit files
    console.log('\n📦 Committing changes...');
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Add test features with intentional issues

- Add user authentication with security issues
- Add user management with performance issues  
- Add utility functions with bugs
- Add incomplete test structure
- Add project configuration

This PR contains intentional issues to test PR-Pilot:
- Security vulnerabilities (hardcoded keys, XSS)
- Performance issues (inefficient loops)
- Bug potential (missing error handling)
- Style issues (inconsistent naming, missing JSDoc)
- Missing tests and documentation"', { stdio: 'inherit' });

    // Push branch
    console.log('\n🚀 Pushing branch...');
    execSync('git push origin feature/test-pr-pilot', { stdio: 'inherit' });

    console.log('\n✅ Test PR generated successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to your GitHub repository');
    console.log('2. Click "Compare & pull request"');
    console.log('3. Add the following description:');
    console.log('\n---');
    console.log('## Test PR for PR-Pilot');
    console.log('');
    console.log('This PR contains intentional issues to test PR-Pilot\'s review capabilities:');
    console.log('');
    console.log('### Security Issues');
    console.log('- Hardcoded API key in auth.js');
    console.log('- Sensitive data in JWT token');
    console.log('- No token expiration');
    console.log('- Potential XSS vulnerability');
    console.log('- Missing authentication on delete endpoint');
    console.log('');
    console.log('### Performance Issues');
    console.log('- Inefficient loops in user listing');
    console.log('- Synchronous operations in async functions');
    console.log('- Unnecessary data processing');
    console.log('');
    console.log('### Bug Potential');
    console.log('- Missing error handling in multiple functions');
    console.log('- No input validation on API endpoints');
    console.log('- Unsafe JSON parsing');
    console.log('');
    console.log('### Style Issues');
    console.log('- Missing JSDoc comments');
    console.log('- Inconsistent naming conventions');
    console.log('- Incomplete test structure');
    console.log('');
    console.log('### Missing Features');
    console.log('- Comprehensive test coverage');
    console.log('- API documentation');
    console.log('- Security middleware');
    console.log('- Input validation');
    console.log('');
    console.log('Please review and provide feedback on these issues.');
    console.log('---');
    console.log('\n4. Create the pull request');
    console.log('5. Monitor the Actions tab for PR-Pilot workflow');
    console.log('6. Check for review comments on the PR');

  } catch (error) {
    console.error('❌ Error generating test PR:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateTestPR();
