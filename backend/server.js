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
    console.log('Creating Mux upload with enhanced mobile compatibility settings...');
    
    const { metadata = {} } = req.body;

    // Create a direct upload using enhanced settings for mobile compatibility and quality
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: 'public',
        encoding_tier: 'smart',        // Use smart encoding for better quality/compatibility balance
        video_quality: 'plus',         // Higher quality while maintaining compatibility
        mp4_support: 'standard',       // Enable MP4 support for mobile compatibility
        normalize_audio: true,         // Fix audio level issues
        master_access: 'temporary',    // Allow access to master files
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
          source: 'mobile_app',
          high_quality_optimized: true,
          encoding_tier: 'smart'
        },
      },
      timeout: 7200, // 2 hours timeout instead of default 1 hour
      cors_origin: '*'  // Allow CORS for mobile uploads
    });

    console.log('Mux upload created with mobile-optimized settings:', {
      id: upload.id,
      url: upload.url?.substring(0, 50) + '...',
      asset_id: upload.asset_id,
      encoding_tier: 'baseline',
      timeout: '2 hours'
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
    
    // Provide more helpful error messages for mobile users
    let userMessage = 'Failed to create upload URL';
    let suggestion = 'Please try again';
    
    if (error.message?.includes('rate limit') || error.status === 429) {
      userMessage = 'Upload service temporarily busy';
      suggestion = 'Please wait a moment and try again';
    } else if (error.message?.includes('authentication') || error.status === 401) {
      userMessage = 'Service authentication issue';
      suggestion = 'Please contact support if this persists';
    }
    
    res.status(500).json({ 
      error: userMessage,
      suggestion: suggestion,
      details: error.message,
      mux_configured: !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET),
      mobile_compatibility_tips: [
        'Try recording video in "Most Compatible" format in iPhone Settings > Camera > Formats',
        'Keep videos under 30 seconds for better processing',
        'Ensure stable internet connection during upload'
      ]
    });
  }
});

/**
 * GET /api/mux/upload/:uploadId
 * Gets upload status and associated asset information
 */
app.get('/api/mux/upload/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    console.log('📋 Fetching upload info for:', uploadId);

    const upload = await mux.video.uploads.retrieve(uploadId);
    
    console.log('📊 Upload details:', {
      id: upload.id,
      status: upload.status,
      asset_id: upload.asset_id,
      created_at: upload.created_at,
      error: upload.error || null
    });

    let asset = null;
    let assetError = null;
    
    if (upload.asset_id) {
      try {
        asset = await mux.video.assets.retrieve(upload.asset_id);
        console.log('📊 Associated asset details:', {
          id: asset.id,
          status: asset.status,
          duration: asset.duration,
          playback_ids: asset.playbook_ids?.length || 0,
          errors: asset.errors ? Object.keys(asset.errors).length : 0
        });

        // Check for specific error types and provide helpful messages
        if (asset.status === 'errored' && asset.errors) {
          const errorType = asset.errors.type;
          const errorMessages = asset.errors.messages || [];
          
          console.error('🚨 Asset processing error:', {
            type: errorType,
            messages: errorMessages
          });
          
          // Provide specific guidance based on error type
          if (errorType === 'invalid_input') {
            assetError = {
              type: 'invalid_input',
              message: 'Video format not supported by Mux',
              suggestions: [
                'Try recording video in iPhone Settings > Camera > Formats > "Most Compatible"',
                'Keep videos under 30 seconds',
                'Record a new video instead of selecting from gallery',
                'Ensure stable internet connection during upload'
              ],
              technicalDetails: errorMessages
            };
          } else {
            assetError = {
              type: errorType,
              message: 'Video processing failed',
              suggestions: ['Try uploading again', 'Contact support if issue persists'],
              technicalDetails: errorMessages
            };
          }
        }
        
      } catch (assetRetrievalError) {
        console.warn('⚠️ Could not fetch associated asset:', assetRetrievalError.message);
        assetError = {
          type: 'retrieval_failed',
          message: 'Could not check video processing status',
          suggestions: ['Wait a moment and try again'],
          technicalDetails: [assetRetrievalError.message]
        };
      }
    }

    res.json({
      success: true,
      upload: {
        id: upload.id,
        status: upload.status,
        asset_id: upload.asset_id,
        created_at: upload.created_at,
        error: upload.error || null
      },
      asset: asset ? {
        id: asset.id,
        status: asset.status,
        duration: asset.duration,
        aspect_ratio: asset.aspect_ratio,
        playbook_ids: asset.playback_ids,
        created_at: asset.created_at,
        metadata: asset.metadata,
        errors: asset.errors || []
      } : null,
      // Include enhanced error information for mobile users
      assetError: assetError,
      mobileCompatibilityTips: assetError ? [
        'Change iPhone camera format to "Most Compatible" in Settings',
        'Record videos directly in the app instead of selecting from gallery',
        'Keep videos short (under 30 seconds) for better processing'
      ] : null
    });

  } catch (error) {
    console.error('❌ Error fetching upload:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch upload',
      details: error.message 
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
 * POST /api/mux/convert-asset-to-playback
 * Converts Asset ID to Playback ID for streaming
 */
app.post('/api/mux/convert-asset-to-playback', async (req, res) => {
  try {
    const { assetId } = req.body;
    
    if (!assetId) {
      return res.status(400).json({ 
        error: 'Missing assetId in request body' 
      });
    }

    console.log('🔄 Converting Asset ID to Playback ID:', assetId);

    // Get asset details from Mux
    const asset = await mux.video.assets.retrieve(assetId);
    
    if (!asset.playback_ids || asset.playback_ids.length === 0) {
      console.error('❌ No playback IDs found for asset:', assetId);
      return res.status(404).json({ 
        error: 'No playback IDs found for this asset',
        assetId,
        status: asset.status 
      });
    }

    // Find public playback ID
    const publicPlaybackId = asset.playback_ids.find(p => p.policy === 'public');
    const playbackId = publicPlaybackId || asset.playback_ids[0];

    const playbackUrl = `https://stream.mux.com/${playbackId.id}.m3u8`;
    
    console.log('✅ Asset ID converted:', {
      assetId,
      playbackId: playbackId.id,
      policy: playbackId.policy
    });

    res.json({
      success: true,
      assetId,
      playbackId: playbackId.id,
      playbackUrl,
      policy: playbackId.policy
    });

  } catch (error) {
    console.error('❌ Asset ID conversion failed:', error);
    
    if (error.type === 'not_found') {
      return res.status(404).json({ 
        error: 'Asset not found',
        assetId: req.body.assetId
      });
    }

    res.status(500).json({ 
      error: 'Failed to convert Asset ID to Playback ID',
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
        ? `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8`
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
 * PATCH /api/videos/:uploadId/fix-asset
 * Updates a video with correct asset information
 */
app.patch('/api/videos/:uploadId/fix-asset', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { correctAssetId, playbackId, playbackUrl } = req.body;
    
    console.log(`🔧 Fixing video ${uploadId} with asset ${correctAssetId}`);
    
    // Here you would update your database with the correct asset information
    // For this example, we'll just return success
    // In a real app, you'd update Firebase or your database
    
    res.json({
      success: true,
      message: `Video ${uploadId} updated with correct asset ${correctAssetId}`,
      data: {
        uploadId,
        correctAssetId,
        playbackId,
        playbackUrl
      }
    });

  } catch (error) {
    console.error('❌ Error fixing video asset:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fix video asset',
      details: error.message 
    });
  }
});

/**
 * POST /api/videos/:uploadId/recreate-asset
 * Creates a new asset for a video that failed processing
 */
app.post('/api/videos/:uploadId/recreate-asset', async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    console.log(`🆕 Recreating asset for upload ${uploadId}`);
    
    // In a real implementation, you would:
    // 1. Get the original video file from storage
    // 2. Create a new Mux upload
    // 3. Re-upload the video to Mux
    // 4. Return the new asset ID
    
    // For now, we'll simulate creating a new upload
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: 'public',
        metadata: {
          recreated_from: uploadId,
          created_at: new Date().toISOString(),
          source: 'asset_recreation',
        },
      },
    });

    res.json({
      success: true,
      message: `New asset creation initiated for ${uploadId}`,
      assetId: upload.asset_id,
      uploadUrl: upload.url,
      newUploadId: upload.id
    });

  } catch (error) {
    console.error('❌ Error recreating asset:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to recreate asset',
      details: error.message 
    });
  }
});

// ===== WEBHOOK HELPER FUNCTIONS =====

/**
 * Handle asset ready event - update Firestore with proper playback ID
 */
async function handleAssetReady(assetData) {
  try {
    const assetId = assetData.id;
    console.log(`🎯 Processing asset ready: ${assetId}`);
    
    // Get asset details from Mux to retrieve playback IDs
    const asset = await mux.video.assets.retrieve(assetId);
    
    if (!asset.playback_ids || asset.playback_ids.length === 0) {
      console.error(`❌ No playback IDs found for asset: ${assetId}`);
      return;
    }
    
    // Get the public playback ID
    const publicPlaybackId = asset.playback_ids.find(p => p.policy === 'public');
    
    if (!publicPlaybackId) {
      console.error(`❌ No public playback ID found for asset: ${assetId}`);
      return;
    }
    
    const playbackId = publicPlaybackId.id;
    console.log(`✅ Found playback ID: ${playbackId} for asset: ${assetId}`);
    
    // Search for Firestore documents that reference this asset
    // Check for documents with either assetId field or uploadId that maps to this asset
    if (db) {
      const videosRef = db.collection('videos');
      
      // Query for documents with this assetId
      const assetQuery = videosRef.where('assetId', '==', assetId);
      const assetSnapshot = await assetQuery.get();
      
      // Also search for uploadId in the upload_assets collection if we have one
      const uploadQuery = videosRef.where('uploadId', '==', assetData.upload_id || '');
      const uploadSnapshot = uploadQuery.size > 0 ? await uploadQuery.get() : { docs: [] };
      
      const documentsToUpdate = [...assetSnapshot.docs, ...uploadSnapshot.docs];
      
      if (documentsToUpdate.length === 0) {
        console.warn(`⚠️ No Firestore documents found for asset: ${assetId}`);
        return;
      }
      
      // Update all matching documents
      for (const doc of documentsToUpdate) {
        const docData = doc.data();
        const updates = {
          assetId: assetId,
          playbackId: playbackId,
          playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
          thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
          processed: true,
          status: 'ready',
          updatedAt: new Date().toISOString()
        };
        
        await doc.ref.update(updates);
        console.log(`✅ Updated Firestore document: ${doc.id} with playback ID: ${playbackId}`);
        
        // Also update posts collection if it exists
        try {
          const postRef = db.collection('posts').doc(doc.id);
          const postDoc = await postRef.get();
          if (postDoc.exists) {
            await postRef.update({
              playbackId: playbackId,
              playbackUrl: updates.playbackUrl,
              thumbnailUrl: updates.thumbnailUrl,
              processed: true,
              status: 'ready'
            });
            console.log(`✅ Updated posts document: ${doc.id}`);
          }
        } catch (postError) {
          console.warn(`⚠️ Could not update posts document: ${doc.id}`, postError.message);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error handling asset ready:`, error);
  }
}

/**
 * Handle asset errored event - mark video as failed
 */
async function handleAssetErrored(assetData) {
  try {
    const assetId = assetData.id;
    console.log(`💥 Processing asset error: ${assetId}`);
    
    if (db) {
      const videosRef = db.collection('videos');
      const query = videosRef.where('assetId', '==', assetId);
      const snapshot = await query.get();
      
      for (const doc of snapshot.docs) {
        await doc.ref.update({
          processed: false,
          status: 'error',
          error: assetData.errors || 'Processing failed',
          updatedAt: new Date().toISOString()
        });
        console.log(`❌ Marked video as errored: ${doc.id}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error handling asset errored:`, error);
  }
}

/**
 * Handle upload asset created event - link upload to asset
 */
async function handleUploadAssetCreated(uploadData) {
  try {
    const uploadId = uploadData.id;
    const assetId = uploadData.asset_id;
    
    console.log(`🔗 Linking upload ${uploadId} to asset ${assetId}`);
    
    if (db) {
      const videosRef = db.collection('videos');
      const query = videosRef.where('uploadId', '==', uploadId);
      const snapshot = await query.get();
      
      for (const doc of snapshot.docs) {
        await doc.ref.update({
          assetId: assetId,
          status: 'processing',
          updatedAt: new Date().toISOString()
        });
        console.log(`🔗 Linked upload to asset: ${doc.id} → ${assetId}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error handling upload asset created:`, error);
  }
}

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
        await handleAssetReady(event.data);
        break;
        
      case 'video.asset.errored':
        console.error('❌ Video processing failed:', event.data.id, event.data.errors);
        await handleAssetErrored(event.data);
        break;
        
      case 'video.upload.asset_created':
        console.log('📤 Upload completed:', event.data.id);
        await handleUploadAssetCreated(event.data);
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
