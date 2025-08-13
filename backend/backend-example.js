// Example Node.js/Express backend for Mux integration
// Save this as backend/routes/mux.js

const express = require('express');
const Mux = require('@mux/mux-node');
const router = express.Router();

// Initialize Mux Video API client
const { Video } = new Mux(
  process.env.MUX_TOKEN_ID,     // Your Mux Token ID
  process.env.MUX_TOKEN_SECRET  // Your Mux Token Secret
);

/**
 * POST /api/mux/create-upload
 * Creates a direct upload URL for video upload
 */
router.post('/create-upload', async (req, res) => {
  try {
    const { metadata = {} } = req.body;

    // Create a direct upload
    const upload = await Video.Uploads.create({
      new_asset_settings: {
        playback_policy: 'public', // or 'signed' for private videos
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
        },
        // Optional: Add webhook for processing notifications
        // webhook_url: `${process.env.BASE_URL}/api/webhooks/mux`,
      },
    });

    console.log('Created Mux upload:', upload);

    res.json({
      uploadUrl: upload.url,
      assetId: upload.asset_id,
      playbackId: upload.asset_id, // Will be updated when asset is ready
      uploadId: upload.id,
    });
  } catch (error) {
    console.error('Error creating Mux upload:', error);
    res.status(500).json({ 
      error: 'Failed to create upload URL',
      details: error.message 
    });
  }
});

/**
 * GET /api/mux/asset/:assetId
 * Gets asset information including playback IDs
 */
router.get('/asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;

    const asset = await Video.Assets.get(assetId);
    
    res.json({
      id: asset.id,
      status: asset.status,
      duration: asset.duration,
      aspect_ratio: asset.aspect_ratio,
      playback_ids: asset.playback_ids,
      created_at: asset.created_at,
      metadata: asset.metadata,
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ 
      error: 'Failed to fetch asset',
      details: error.message 
    });
  }
});

/**
 * GET /api/mux/videos
 * Lists all videos for a user (with pagination)
 */
router.get('/videos', async (req, res) => {
  try {
    const { limit = 25, page = 1 } = req.query;
    
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
      // Generate playback and thumbnail URLs
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
 * Deletes a video asset from Mux
 */
router.delete('/asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;

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
 * Webhook endpoint for Mux events (optional but recommended)
 */
router.post('/webhooks/mux', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['mux-signature'];
    
    // Verify webhook signature (recommended for security)
    // const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
    // const isValid = Mux.Webhooks.verifyHeader(req.body, signature, webhookSecret);
    // if (!isValid) {
    //   return res.status(400).json({ error: 'Invalid signature' });
    // }

    const event = JSON.parse(req.body.toString());
    
    console.log('Received Mux webhook:', event.type, event.data);

    // Handle different event types
    switch (event.type) {
      case 'video.asset.ready':
        // Video is processed and ready for playback
        console.log('Video ready:', event.data.id);
        // Update your database with the ready status
        break;
        
      case 'video.asset.errored':
        // Video processing failed
        console.error('Video processing failed:', event.data.id, event.data.errors);
        // Update your database with error status
        break;
        
      case 'video.upload.asset_created':
        // Upload completed and asset created
        console.log('Upload completed:', event.data.id);
        break;
        
      default:
        console.log('Unhandled webhook event:', event.type);
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

module.exports = router;
