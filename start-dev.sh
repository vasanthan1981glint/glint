#!/bin/bash

# Glint Development Startup Script
echo "🚀 Starting Glint Development Environment..."

# Start Mux backend server in background
echo "📡 Starting Mux backend server..."
cd backend && node server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start Expo development server
echo "📱 Starting Expo development server..."
cd .. && npx expo start

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    kill $BACKEND_PID 2>/dev/null
    exit
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM
