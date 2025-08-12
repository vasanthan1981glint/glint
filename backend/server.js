// Complete Backend Server for Mux Integration
// Save this as server.js in your backend folder

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));
app.use(express.json());

// Initialize Mux with your credentials
const Mux = require('@mux/mux-node');
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    muxEnabled: !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET)
  });
});

// Also keep the old endpoint for compatibility
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mux_configured: !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET),
    muxEnabled: !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET)
  });
});

// ===== FIREBASE ADMIN SETUP =====

const admin = require('firebase-admin');
let db;

// Initialize Firebase Admin (optional - graceful fallback)
try {
  if (!admin.apps.length) {
    // Try to initialize with service account
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'glint-7e3c3',
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID || 'glint-7e3c3'}-default-rtdb.firebaseio.com/`
    });
    console.log('🔥 Firebase Admin initialized');
    db = admin.firestore();
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin initialization failed:', error.message);
  console.warn('📱 Save functionality will use client-side Firebase only');
  db = null;
}

// ===== SAVE ENDPOINTS =====

/**
 * POST /api/saves/toggle
 * Toggle save status for a video
 */
app.post('/api/saves/toggle', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Server-side Firebase not configured',
        fallback: 'Use client-side Firebase instead'
      });
    }

    const { videoId, userId } = req.body;

    if (!videoId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: videoId, userId' 
      });
    }

    console.log(`🔄 Toggling save for video ${videoId}, user ${userId}`);

    // Check if already saved
    const savedRef = db.collection('savedVideos');
    const existingQuery = await savedRef
      .where('videoId', '==', videoId)
      .where('userId', '==', userId)
      .get();

    if (!existingQuery.empty) {
      // Already saved - remove it
      const docToDelete = existingQuery.docs[0];
      await docToDelete.ref.delete();
      
      console.log(`✅ Video ${videoId} unsaved for user ${userId}`);
      res.json({ 
        saved: false, 
        message: 'Video removed from saved list',
        timestamp: new Date().toISOString()
      });
    } else {
      // Not saved - add it
      const saveData = {
        videoId,
        userId,
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      await savedRef.add(saveData);
      
      console.log(`✅ Video ${videoId} saved for user ${userId}`);
      res.json({ 
        saved: true, 
        message: 'Video added to saved list',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Save toggle error:', error);
    res.status(500).json({ 
      error: 'Failed to toggle save status',
      details: error.message,
      fallback: 'Use client-side Firebase instead'
    });
  }
});

/**
 * GET /api/saves/check/:videoId/:userId
 * Check if a video is saved by user
 */
app.get('/api/saves/check/:videoId/:userId', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Server-side Firebase not configured',
        fallback: 'Use client-side Firebase instead'
      });
    }

    const { videoId, userId } = req.params;

    console.log(`🔍 Checking save status for video ${videoId}, user ${userId}`);

    const savedRef = db.collection('savedVideos');
    const query = await savedRef
      .where('videoId', '==', videoId)
      .where('userId', '==', userId)
      .get();

    const isSaved = !query.empty;
    
    res.json({ 
      saved: isSaved,
      videoId,
      userId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Save check error:', error);
    res.status(500).json({ 
      error: 'Failed to check save status',
      details: error.message,
      fallback: 'Use client-side Firebase instead'
    });
  }
});

/**
 * GET /api/saves/user/:userId
 * Get all saved videos for a user
 */
app.get('/api/saves/user/:userId', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Server-side Firebase not configured',
        fallback: 'Use client-side Firebase instead'
      });
    }

    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    console.log(`📂 Getting saved videos for user ${userId}`);

    // Get saved video IDs with pagination
    const savedRef = db.collection('savedVideos');
    const query = savedRef
      .where('userId', '==', userId)
      .orderBy('savedAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const savedSnapshot = await query.get();
    
    if (savedSnapshot.empty) {
      return res.json({ 
        savedVideos: [], 
        total: 0,
        hasMore: false 
      });
    }

    // Extract video IDs
    const videoIds = savedSnapshot.docs.map(doc => ({
      id: doc.id,
      videoId: doc.data().videoId,
      savedAt: doc.data().savedAt,
      createdAt: doc.data().createdAt
    }));

    // Return simplified data (video fetching would happen client-side)
    res.json({ 
      savedVideos: videoIds,
      total: savedSnapshot.size,
      hasMore: (parseInt(offset) + parseInt(limit)) < savedSnapshot.size,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get saved videos error:', error);
    res.status(500).json({ 
      error: 'Failed to get saved videos',
      details: error.message,
      fallback: 'Use client-side Firebase instead'
    });
  }
});

/**
 * DELETE /api/saves/:videoId/:userId
 * Remove a specific save
 */
app.delete('/api/saves/:videoId/:userId', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Server-side Firebase not configured',
        fallback: 'Use client-side Firebase instead'
      });
    }

    const { videoId, userId } = req.params;

    console.log(`🗑️ Removing save for video ${videoId}, user ${userId}`);

    const savedRef = db.collection('savedVideos');
    const query = await savedRef
      .where('videoId', '==', videoId)
      .where('userId', '==', userId)
      .get();

    if (query.empty) {
      return res.status(404).json({ 
        error: 'Save not found' 
      });
    }

    // Delete the save record
    const docToDelete = query.docs[0];
    await docToDelete.ref.delete();

    res.json({ 
      message: 'Save removed successfully',
      videoId,
      userId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Remove save error:', error);
    res.status(500).json({ 
      error: 'Failed to remove save',
      details: error.message,
      fallback: 'Use client-side Firebase instead'
    });
  }
});

// ===== MUX ENDPOINTS =====

/**
 * POST /api/mux/create-upload
 * Creates a direct upload URL for video upload
 */
app.post('/api/mux/create-upload', async (req, res) => {
  try {
    console.log('Creating Mux upload...');
    
    const { metadata = {} } = req.body;

    // Create a direct upload using the correct Mux API
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: 'public', // Change to 'signed' for private videos
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
          source: 'mobile_app',
        },
      },
    });

    console.log('Mux upload created:', {
      id: upload.id,
      url: upload.url?.substring(0, 50) + '...',
      asset_id: upload.asset_id
    });

    // Return the upload info
    res.json({
      success: true,
      uploadUrl: upload.url,
      assetId: upload.asset_id,
      playbackId: null, // Will be available after processing
      uploadId: upload.id,
    });

  } catch (error) {
    console.error('Error creating Mux upload:', error);
    res.status(500).json({ 
      error: 'Failed to create upload URL',
      details: error.message,
      mux_configured: !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET)
    });
  }
});

/**
 * GET /api/mux/asset/:assetId
 * Gets asset information including playback IDs
 */
app.get('/api/mux/asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    console.log('📋 Fetching asset info for:', assetId);

    const asset = await mux.video.assets.retrieve(assetId);
    
    console.log('📊 Asset details:', {
      id: asset.id,
      status: asset.status,
      duration: asset.duration,
      playback_ids: asset.playback_ids?.length || 0,
      created_at: asset.created_at,
      errors: asset.errors?.length || 0
    });

    // Log any errors if they exist
    if (asset.errors && asset.errors.length > 0) {
      console.error('❌ Asset has errors:', asset.errors);
    }

    res.json({
      success: true,
      asset: {
        id: asset.id,
        status: asset.status,
        duration: asset.duration,
        aspect_ratio: asset.aspect_ratio,
        playback_ids: asset.playback_ids,
        playback_urls: asset.playback_ids,
        created_at: asset.created_at,
        metadata: asset.metadata,
        errors: asset.errors || []
      }
    });

  } catch (error) {
    console.error('❌ Error fetching asset:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch asset',
      details: error.message 
    });
  }
});

/**
 * GET /api/mux/videos
 * Lists all videos (with pagination)
 */
app.get('/api/mux/videos', async (req, res) => {
  try {
    const { limit = 25, page = 1 } = req.query;
    console.log('Listing videos:', { limit, page });
    
    const assets = await Video.Assets.list({
      limit: parseInt(limit),
      page: parseInt(page),
    });

    const videos = assets.data.map(asset => ({
      id: asset.id,
      status: asset.status,
      duration: asset.duration,
      aspect_ratio: asset.aspect_ratio,
      playback_ids: asset.playback_ids,
      created_at: asset.created_at,
      metadata: asset.metadata,
      // Generate URLs if playback ID exists
      playback_url: asset.playback_ids?.[0] 
        ? `https://stream.mux.com/${asset.playback_ids[0].id}.mp4`
        : null,
      thumbnail_url: asset.playback_ids?.[0]
        ? `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg?time=1&width=320&height=180&fit_mode=crop`
        : null,
    }));

    res.json({
      videos,
      pagination: {
        current_page: parseInt(page),
        limit: parseInt(limit),
        total_count: assets.total_count || 0,
      },
    });

  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ 
      error: 'Failed to list videos',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/mux/asset/:assetId
 * Deletes a video asset
 */
app.delete('/api/mux/asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    console.log('Deleting asset:', assetId);

    await Video.Assets.del(assetId);
    
    res.json({ 
      success: true, 
      message: 'Asset deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ 
      error: 'Failed to delete asset',
      details: error.message 
    });
  }
});

/**
 * POST /api/webhooks/mux
 * Webhook endpoint for Mux events
 */
app.post('/api/webhooks/mux', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Parse the webhook event
    const event = JSON.parse(req.body.toString());
    
    console.log('📡 Mux Webhook received:', {
      type: event.type,
      object: event.object?.type,
      id: event.data?.id
    });

    // Handle different event types
    switch (event.type) {
      case 'video.asset.ready':
        console.log('✅ Video ready:', event.data.id);
        // Here you could update your database, send notifications, etc.
        break;
        
      case 'video.asset.errored':
        console.error('❌ Video processing failed:', event.data.id, event.data.errors);
        break;
        
      case 'video.upload.asset_created':
        console.log('📤 Upload completed:', event.data.id);
        break;
        
      case 'video.asset.created':
        console.log('🎬 Asset created:', event.data.id);
        break;
        
      default:
        console.log('🔄 Unhandled event:', event.type);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mux backend server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Network access: http://192.168.1.159:${PORT}/health`);
  console.log(`🔑 Mux configured: ${!!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET)}`);
  
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    console.warn('⚠️  WARNING: Mux credentials not configured!');
    console.warn('   Please set MUX_TOKEN_ID and MUX_TOKEN_SECRET in your .env file');
  }
});

module.exports = app;
