#!/bin/bash

# 🚂 Railway Deployment Script for Glint Mux Backend

echo "🚀 Preparing Glint Mux Backend for Railway deployment..."

# Check if we're in the right directory
if [ ! -f "backend/server.js" ]; then
    echo "❌ Error: Please run this script from your main glint directory"
    echo "   Current directory should contain the 'backend' folder"
    exit 1
fi

echo "✅ Backend directory found"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "🔧 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit with Mux backend"
else
    echo "✅ Git repository already initialized"
fi

# Add and commit backend changes
echo "📦 Adding backend files to git..."
git add backend/
git add RAILWAY_DEPLOYMENT_GUIDE.md
git add BACKEND_DEPLOYMENT_OPTIONS.md
git commit -m "Add Mux backend ready for Railway deployment"

echo ""
echo "🎉 Your backend is ready for Railway deployment!"
echo ""
echo "📋 Next steps:"
echo "1. Push to GitHub: git push origin main"
echo "2. Go to railway.app and create new project"
echo "3. Connect your GitHub repo"
echo "4. Set root directory to 'backend'"
echo "5. Add your Mux environment variables"
echo ""
echo "🔑 Environment variables to add in Railway:"
echo "   MUX_TOKEN_ID=660383c1-ab86-47b2-846a-7e132dae1545"
echo "   MUX_TOKEN_SECRET=Ke3t9JtAS3Qz2boZ6NEflHUbiChZZqNiIGvpqEHBGfQFUC7PfvJxyTtIfUZylLgJO8Je5O4R95Q"
echo "   NODE_ENV=production"
echo ""
echo "📖 Full guide: See RAILWAY_DEPLOYMENT_GUIDE.md"
