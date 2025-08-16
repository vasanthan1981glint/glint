#!/bin/bash

# Google Cloud Storage Permissions Setup for Glint
# This script helps you configure your GCS bucket for public video access

echo "🔧 Google Cloud Storage Setup for Glint Videos"
echo "=============================================="
echo ""

echo "📋 To fix the video playback issue (error -1102), you need to:"
echo ""
echo "1. 🌐 Make your Google Cloud Storage bucket publicly readable"
echo "   - Go to: https://console.cloud.google.com/"
echo "   - Navigate to: Cloud Storage > Buckets"
echo "   - Find bucket: 'glint-videos'"
echo "   - Go to: Permissions tab"
echo "   - Click: 'Add'"
echo "   - New principals: 'allUsers'"
echo "   - Role: 'Storage Object Viewer'"
echo "   - Click: 'Save'"
echo ""

echo "2. 🔥 Fix the current broken video in Firebase:"
echo "   - Go to: https://console.firebase.google.com/"
echo "   - Project: 'glint-7e3c3'"
echo "   - Navigate to: Firestore Database"
echo "   - Collection: 'videos'"
echo "   - Document: 'gcs_1755260936025_l5h5otvnk'"
echo "   - Update field 'videoUrl' to: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'"
echo "   - Update field 'playbackUrl' to: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'"
echo "   - Repeat for 'posts' collection with same document ID"
echo ""

echo "3. 📱 Restart your Expo app:"
echo "   - Press Ctrl+C in the terminal running 'npx expo start'"
echo "   - Run: 'npx expo start --clear'"
echo ""

echo "4. 🎯 Test the fix:"
echo "   - Open your app"
echo "   - Go to your profile"
echo "   - The video should now play without error -1102"
echo ""

echo "✅ After completing these steps, your videos should work properly!"
echo ""
echo "📝 For future reference:"
echo "   - All new videos uploaded will automatically work if step 1 is completed"
echo "   - The updated upload function now includes better error handling"
echo "   - Consider using a CDN or signed URLs for production"
echo ""

# Optional: If gcloud CLI is available, try to set the bucket permissions
if command -v gcloud &> /dev/null; then
    echo "🤖 Google Cloud CLI detected! Do you want to automatically set bucket permissions? (y/n)"
    read -r response
    
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        echo "🔧 Setting bucket permissions..."
        
        if gcloud storage buckets add-iam-policy-binding gs://glint-videos \
            --member=allUsers \
            --role=roles/storage.objectViewer; then
            echo "✅ Bucket permissions set successfully!"
        else
            echo "❌ Failed to set bucket permissions. Please do it manually via the console."
        fi
    fi
else
    echo "💡 To automate this in the future, install Google Cloud CLI:"
    echo "   curl https://sdk.cloud.google.com | bash"
fi

echo ""
echo "🎉 Setup instructions complete!"
