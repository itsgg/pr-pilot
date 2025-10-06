# GitHub Workflow Fix

## Issue

The GitHub Actions workflow was failing with the following error:

```
SyntaxError: Cannot use import statement outside a module
```

This occurred because the workflow was using `node -e` (eval) with ES module syntax (`import` statements), which is not supported in the Node.js eval context.

## Root Cause

The problematic code in `.github/workflows/pr-review.yml`:

```yaml
- name: Validate configuration
  run: |
    node -e "
      import { loadConfig } from './agent/lib/config.js';
      // ... rest of the code
    "
```

Node.js `-e` (eval) context doesn't support ES modules, even when the project is configured with `"type": "module"`.

## Solution

### 1. Created Dedicated Validation Script

**File**: `scripts/validate-config.js`

```javascript
#!/usr/bin/env node

import { loadConfig } from '../agent/lib/config.js';

async function validateConfiguration() {
  try {
    console.log('Validating configuration...');
    
    const config = await loadConfig('config/agent.yaml');
    
    console.log('✅ Configuration is valid');
    console.log('Model:', config.model);
    console.log('Max tokens:', config.max_tokens);
    console.log('Cost cap: $' + config.cost_cap_usd);
    console.log('Max files:', config.max_files);
    console.log('Exclude patterns:', config.exclude_patterns.length);
    
    // Additional validation logic...
    
    console.log('✅ All configuration validations passed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    process.exit(1);
  }
}

validateConfiguration();
```

### 2. Updated GitHub Workflows

**Before**:
```yaml
- name: Validate configuration
  run: |
    node -e "
      import { loadConfig } from './agent/lib/config.js';
      // ... inline code
    "
```

**After**:
```yaml
- name: Validate configuration
  run: |
    node scripts/validate-config.js
```

### 3. Created Workflow Test Script

**File**: `scripts/test-workflow.js`

A comprehensive test script that validates all GitHub Actions workflow steps:

- Configuration loading
- Environment variable validation
- Dependency validation
- File structure validation
- Script execution

### 4. Added NPM Scripts

Updated `package.json` with new scripts:

```json
{
  "scripts": {
    "test:system": "node scripts/test-system.js",
    "test:demo": "node scripts/demo-system.js", 
    "test:workflow": "node scripts/test-workflow.js",
    "validate:config": "node scripts/validate-config.js"
  }
}
```

## Files Modified

1. **`.github/workflows/pr-review.yml`** - Updated configuration validation step
2. **`.github/workflows/manual-test.yml`** - Updated configuration validation step
3. **`scripts/validate-config.js`** - New validation script
4. **`scripts/test-workflow.js`** - New workflow test script
5. **`package.json`** - Added new npm scripts
6. **`README.md`** - Updated documentation with new scripts

## Testing

All scripts have been tested and verified to work correctly:

```bash
# Test configuration validation
npm run validate:config

# Test workflow steps
npm run test:workflow

# Test system functionality
npm run test:system

# Test demo
npm run test:demo
```

## Benefits

1. **Fixes GitHub Actions**: Workflows now run without ES module errors
2. **Better Error Handling**: Dedicated scripts provide better error messages
3. **Reusable Scripts**: Validation logic can be used in multiple contexts
4. **Comprehensive Testing**: Workflow test script validates all steps
5. **Developer Experience**: New npm scripts make testing easier

## Usage

### For GitHub Actions

The workflows now use the dedicated scripts automatically. No changes needed for existing workflows.

### For Local Development

```bash
# Validate configuration
npm run validate:config

# Test workflow steps
npm run test:workflow

# Run all tests
npm test
```

### For CI/CD

The scripts can be used in any CI/CD environment:

```bash
# In any CI environment
node scripts/validate-config.js
node scripts/test-workflow.js
```

## Verification

The fix has been verified by:

1. ✅ Running `npm run validate:config` - Configuration validation works
2. ✅ Running `npm run test:workflow` - All workflow steps pass
3. ✅ Running `npm test` - All unit tests still pass
4. ✅ Running `npm run test:system` - System tests still pass
5. ✅ Running `npm run test:demo` - Demo still works

The GitHub Actions workflows should now run successfully without the ES module import error.
