#!/bin/bash

# PR-Pilot Test Repository Setup Script
# This script helps set up a test repository for PR-Pilot

set -e

echo "🚀 PR-Pilot Test Repository Setup"
echo "=================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI not found. You'll need to create the repository manually."
    echo "   Install with: brew install gh (macOS) or see https://cli.github.com/"
    USE_GH=false
else
    echo "✅ GitHub CLI found"
    USE_GH=true
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Please run this from the PR-Pilot directory."
    exit 1
fi

echo "✅ Prerequisites check complete"
echo ""

# Get repository name
read -p "Enter test repository name (default: pr-pilot-test): " REPO_NAME
REPO_NAME=${REPO_NAME:-pr-pilot-test}

echo ""
echo "📁 Setting up test repository: $REPO_NAME"
echo ""

# Create temporary directory for test repo
TEMP_DIR="/tmp/$REPO_NAME"
echo "Creating temporary directory: $TEMP_DIR"

if [ -d "$TEMP_DIR" ]; then
    echo "⚠️  Directory exists, removing..."
    rm -rf "$TEMP_DIR"
fi

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Initialize git repository
echo "Initializing git repository..."
git init
git config user.name "PR-Pilot Test"
git config user.email "test@pr-pilot.dev"

# Copy PR-Pilot files
echo "Copying PR-Pilot files..."
cp -r /Users/gg/Play/pr-pilot/* ./
cp -r /Users/gg/Play/pr-pilot/.* . 2>/dev/null || true

# Remove git directory to start fresh
rm -rf .git

# Initialize new git repository
git init
git add .
git commit -m "Initial PR-Pilot setup"

# Create GitHub repository
if [ "$USE_GH" = true ]; then
    echo "Creating GitHub repository..."
    gh repo create "$REPO_NAME" --public --description "Test repository for PR-Pilot" --source=. --push
    echo "✅ Repository created: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
else
    echo "⚠️  Please create the repository manually:"
    echo "   1. Go to https://github.com/new"
    echo "   2. Repository name: $REPO_NAME"
    echo "   3. Make it public"
    echo "   4. Don't initialize with README"
    echo "   5. Create repository"
    echo ""
    read -p "Press Enter when repository is created..."
    
    # Get GitHub username
    read -p "Enter your GitHub username: " GITHUB_USERNAME
    REPO_URL="https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
    
    # Add remote
    git remote add origin "$REPO_URL"
    
    echo ""
    echo "🔑 Authentication required:"
    echo "GitHub no longer supports password authentication."
    echo "You need to use a Personal Access Token."
    echo ""
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Select scopes: repo, workflow, write:packages"
    echo "4. Copy the token"
    echo ""
    read -p "Enter your Personal Access Token: " GITHUB_TOKEN
    
    # Use token for authentication
    git push https://$GITHUB_USERNAME:$GITHUB_TOKEN@github.com/$GITHUB_USERNAME/$REPO_NAME.git main
    echo "✅ Repository setup complete: $REPO_URL"
fi

echo ""
echo "🔧 Next steps:"
echo "=============="
echo ""
echo "1. Set up repository secrets:"
echo "   - Go to: https://github.com/$(gh api user --jq .login 2>/dev/null || echo 'YOUR_USERNAME')/$REPO_NAME/settings/secrets/actions"
echo "   - Add ANTHROPIC_API_KEY secret"
echo ""
echo "2. Create a test PR:"
echo "   cd $TEMP_DIR"
echo "   git checkout -b feature/test-pr"
echo "   # Add some code with intentional issues"
echo "   git add . && git commit -m 'Add test code'"
echo "   git push origin feature/test-pr"
echo "   # Create PR on GitHub"
echo ""
echo "3. Monitor the workflow:"
echo "   - Go to Actions tab in your repository"
echo "   - Watch the PR-Pilot Review workflow"
echo "   - Check for comments on the PR"
echo ""
echo "4. Check metrics:"
echo "   - Download artifacts from workflow run"
echo "   - Review metrics/run.json"
echo ""
echo "📚 For detailed instructions, see: REAL_WORLD_TESTING_GUIDE.md"
echo ""
echo "🎉 Test repository setup complete!"
echo "Repository location: $TEMP_DIR"
