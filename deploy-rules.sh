#!/bin/bash

# Script to deploy Firestore rules
echo "🔥 Deploying Firestore rules..."

# Try different ways to deploy
if command -v firebase &> /dev/null; then
    echo "Using firebase CLI..."
    firebase deploy --only firestore:rules
elif command -v npx &> /dev/null; then
    echo "Using npx firebase-tools..."
    npx firebase-tools deploy --only firestore:rules
else
    echo "❌ Firebase CLI not found. Please install firebase-tools:"
    echo "npm install -g firebase-tools"
    echo "Then run: firebase deploy --only firestore:rules"
fi
