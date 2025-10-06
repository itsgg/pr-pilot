#!/usr/bin/env node

/**
 * Validate GitHub Workflows
 * Checks that all workflow files are valid YAML and have required structure
 */

import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const WORKFLOWS_DIR = '.github/workflows';
const REQUIRED_WORKFLOWS = ['pr-review.yml', 'test.yml'];

/**
 * Validates a single workflow file
 * @param {string} filePath - Path to workflow file
 * @returns {Object} Validation result
 */
function validateWorkflow(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const workflow = yaml.load(content);
    
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!workflow.name) {
      errors.push('Missing workflow name');
    }
    
    if (!workflow.on) {
      errors.push('Missing trigger configuration');
    }
    
    if (!workflow.jobs) {
      errors.push('Missing jobs configuration');
    }
    
    // Check for required jobs in main workflow
    if (filePath.includes('pr-review.yml')) {
      const requiredJobs = ['pr-review'];
      for (const job of requiredJobs) {
        if (!workflow.jobs[job]) {
          errors.push(`Missing required job: ${job}`);
        }
      }
    }
    
    // Check for Node.js setup
    const jobs = workflow.jobs || {};
    for (const [jobName, job] of Object.entries(jobs)) {
      if (job.steps) {
        const hasNodeSetup = job.steps.some(step => 
          step.uses && step.uses.includes('actions/setup-node')
        );
        if (!hasNodeSetup) {
          warnings.push(`Job ${jobName} doesn't setup Node.js`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      workflow
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`YAML parsing error: ${error.message}`],
      warnings: [],
      workflow: null
    };
  }
}

/**
 * Main validation function
 */
function main() {
  console.log('🔍 Validating GitHub Workflows...\n');
  
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    console.error('❌ Workflows directory not found:', WORKFLOWS_DIR);
    process.exit(1);
  }
  
  const workflowFiles = fs.readdirSync(WORKFLOWS_DIR)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
  
  if (workflowFiles.length === 0) {
    console.error('❌ No workflow files found');
    process.exit(1);
  }
  
  console.log(`Found ${workflowFiles.length} workflow files:`);
  workflowFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');
  
  let allValid = true;
  const results = {};
  
  // Validate each workflow
  for (const file of workflowFiles) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    console.log(`Validating ${file}...`);
    
    const result = validateWorkflow(filePath);
    results[file] = result;
    
    if (result.valid) {
      console.log(`  ✅ Valid`);
      if (result.warnings.length > 0) {
        console.log(`  ⚠️  Warnings:`);
        result.warnings.forEach(warning => console.log(`    - ${warning}`));
      }
    } else {
      console.log(`  ❌ Invalid`);
      result.errors.forEach(error => console.log(`    - ${error}`));
      allValid = false;
    }
    console.log('');
  }
  
  // Check for required workflows
  console.log('Checking required workflows...');
  for (const required of REQUIRED_WORKFLOWS) {
    if (workflowFiles.includes(required)) {
      console.log(`  ✅ ${required} found`);
    } else {
      console.log(`  ❌ ${required} missing`);
      allValid = false;
    }
  }
  console.log('');
  
  // Summary
  if (allValid) {
    console.log('🎉 All workflows are valid!');
    process.exit(0);
  } else {
    console.log('❌ Some workflows have errors. Please fix them before proceeding.');
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
