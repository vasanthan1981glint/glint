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

// Configure bucket for public access
const configureBucket = async () => {
  try {
    if (!storage) {
      console.log('⚠️ Storage not initialized, skipping bucket configuration');
      return;
    }
    
    const bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'glint-videos';
    const bucket = storage.bucket(bucketName);
    
    // Make bucket publicly readable
    await bucket.iam.setPolicy({
      bindings: [
        {
          role: 'roles/storage.objectViewer',
          members: ['allUsers'],
        },
      ],
    });
    
    // Set CORS for web and mobile access
    await bucket.setCorsConfiguration([
      {
        maxAgeSeconds: 3600,
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        origin: ['*'],
        responseHeader: ['Content-Type', 'Access-Control-Allow-Origin'],
      },
    ]);
    
    console.log(`✅ Bucket ${bucketName} configured for public access with CORS`);
  } catch (error) {
    console.log(`⚠️ Bucket policy setup: ${error.message}`);
  }
};

// Call this when server starts
configureBucket();

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

    const { fileName, contentType, userId } = req.body;
    const bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'glint-videos';
    
    const bucket = storage.bucket(bucketName);
    const uniqueFileName = `videos/${userId || 'anonymous'}/${Date.now()}-${fileName || 'video.mp4'}`;
    const file = bucket.file(uniqueFileName);
    
    // Generate signed URL for upload (15 minutes)
    const uploadExpiry = new Date();
    uploadExpiry.setMinutes(uploadExpiry.getMinutes() + 15);
    
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: uploadExpiry,
      contentType: contentType || 'video/mp4',
      extensionHeaders: {},
    });
    
    // Return PUBLIC URL that NEVER expires
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueFileName}`;

    res.json({
      success: true,
      uploadUrl: uploadUrl,
      videoUrl: publicUrl,  // PUBLIC URL - works forever!
      playbackUrl: publicUrl, // Same as videoUrl
      fileName: uniqueFileName,
      bucketName: bucketName,
      message: 'Google Cloud Storage upload URL generated'
    });

    console.log(`📤 Generated upload URL for: ${uniqueFileName}`);
    console.log(`🌍 Public URL: ${publicUrl}`);
    
    // Make file public after a short delay (async)
    setTimeout(async () => {
      try {
        await file.makePublic();
        console.log(`✅ Made file public: ${uniqueFileName}`);
      } catch (error) {
        console.log(`⚠️ Could not make file public automatically: ${error.message}`);
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Upload URL generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate upload URL', 
      details: error.message,
      service: 'Google Cloud Storage'
    });
  }
});

// Make uploaded file public
app.post('/make-public', async (req, res) => {
  try {
    if (!storage) {
      return res.status(500).json({ error: 'Google Cloud Storage not initialized' });
    }

    const { fileName } = req.body;
    const bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'glint-videos';
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    // Make the file public
    await file.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    
    res.json({ 
      success: true,
      publicUrl: publicUrl,
      message: 'File made public successfully'
    });
    
    console.log(`🌍 File made public: ${publicUrl}`);
  } catch (error) {
    console.error('❌ Error making file public:', error);
    res.status(500).json({ 
      error: 'Failed to make file public', 
      details: error.message 
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
