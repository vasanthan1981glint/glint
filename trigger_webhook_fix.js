// Manually trigger the Mux webhook to fix the video
const axios = require('axios');

const RAILWAY_API_URL = 'https://glint-production-b62b.up.railway.app';

async function triggerWebhookFix() {
  console.log('🔗 MANUALLY TRIGGERING MUX WEBHOOK');
  console.log('==================================');
  
  try {
    // Create a mock Mux webhook event for the ready asset
    const webhookEvent = {
      type: 'video.asset.ready',
      object: {
        type: 'asset',
        id: 'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E'
      },
      data: {
        id: 'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E',
        upload_id: 'p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g',
        status: 'ready',
        playbook_ids: [
          {
            id: 'C5PVakKHdB00cX01pjiiEsLhyCctgKxxDtaCC7gQfe2ys',
            policy: 'public'
          }
        ]
      },
      created_at: '2025-08-13T19:00:00.000Z',
      environment: {
        name: 'Production',
        id: 'your-env-id'
      }
    };
    
    console.log('📡 Sending webhook event to Railway backend...');
    console.log('🎬 Asset ID:', webhookEvent.data.id);
    console.log('📤 Upload ID:', webhookEvent.data.upload_id);
    
    const response = await axios.post(`${RAILWAY_API_URL}/api/webhooks/mux`, webhookEvent, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Webhook processed successfully:', response.data);
    
    // Wait a moment then verify the fix
    console.log('\\n⏳ Waiting 2 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if Firebase was updated (indirectly by checking upload status)
    console.log('🔍 Checking if video was fixed...');
    const statusResponse = await axios.get(`${RAILWAY_API_URL}/api/mux/upload/p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g`);
    console.log('📊 Upload status after webhook:', statusResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status) {
      console.log(`\\n💡 HTTP ${error.response.status}: ${error.response.statusText}`);
    }
  }
}

triggerWebhookFix();
