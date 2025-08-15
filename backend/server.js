const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Google Cloud Storage
let storage;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'glint-7e3c3',
      credentials: credentials
    });
    console.log('✅ Google Cloud Storage initialized with credentials');
  } else {
    console.log('❌ No Google Cloud credentials found');
    storage = null;
  }
} catch (error) {
  console.error('❌ Google Cloud Storage initialization error:', error);
  storage = null;
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Google Cloud Storage Backend',
    timestamp: new Date().toISOString(),
    storage: storage ? 'connected' : 'disconnected',
    project: process.env.GOOGLE_CLOUD_PROJECT_ID || 'not-set',
    bucket: process.env.GOOGLE_CLOUD_BUCKET || 'not-set'
  });
});

// Get signed upload URL for Google Cloud Storage
app.post('/upload/signed-url', async (req, res) => {
  try {
    if (!storage) {
      return res.status(500).json({ 
        error: 'Google Cloud Storage not initialized',
        details: 'Check environment variables'
      });
    }

    const { fileName, contentType } = req.body;
    const bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'glint-videos';
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(`videos/${Date.now()}-${fileName || 'video.mp4'}`);
    
    // Generate signed URL for upload
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType || 'video/mp4'
    });
    
    // Generate signed URL for reading (long-term)
    const [videoUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    });
    
    res.json({
      success: true,
      uploadUrl: uploadUrl,
      videoUrl: videoUrl,
      fileName: file.name,
      bucketName: bucketName,
      message: 'Google Cloud Storage upload URL generated'
    });

    console.log(`📤 Generated upload URL for: ${file.name}`);
    
  } catch (error) {
    console.error('❌ Upload URL generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate upload URL', 
      details: error.message,
      service: 'Google Cloud Storage'
    });
  }
});

// List videos in bucket
app.get('/videos', async (req, res) => {
  try {
    if (!storage) {
      return res.status(500).json({ error: 'Google Cloud Storage not initialized' });
    }

    const bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'glint-videos';
    const bucket = storage.bucket(bucketName);
    
    const [files] = await bucket.getFiles({ prefix: 'videos/' });
    
    const videos = files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      created: file.metadata.timeCreated,
      url: `https://storage.googleapis.com/${bucketName}/${file.name}`
    }));

    res.json({ videos, count: videos.length });
  } catch (error) {
    console.error('❌ List videos error:', error);
    res.status(500).json({ error: 'Failed to list videos', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Google Cloud Storage Backend running on port ${port}`);
  console.log(`📡 Health check: http://localhost:${port}/health`);
  console.log(`☁️ Using Google Cloud Project: ${process.env.GOOGLE_CLOUD_PROJECT_ID || 'not-set'}`);
  console.log(`🪣 Using Storage Bucket: ${process.env.GOOGLE_CLOUD_BUCKET || 'not-set'}`);
});
