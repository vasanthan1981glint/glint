#!/usr/bin/env node

/**
 * Get Playback IDs for Ready Assets
 */

const RAILWAY_API_URL = 'https://glint-production-b62b.up.railway.app';

const readyAssets = [
  'JbJFNqmoj4hRA3vztqWywBqnBAJPRRdrgJ2oGiQpQHg',
  'Qp01gq5IymxDYbIkKDvKl23UbQgtx9xh9LbpYz4fuAuU',
  'bXML1S9tBCVfh3Z9vDp001DYP02rrTA60125ZIN2dAbUZI',
  '1AXB9N43Kk023BiH7hWQp7ifpkgka6WHqJ5sUZLTwys8',
  'YPJOk6GOw9TkMuQlMZlS01XCI00U3ybSPuetL18duF1qU',
  'Kc48B4IR02M01cKytTBwhUY26XMYD9ecSEsr02KFVWPURs',
  'XNQxOHk01ICC02PU6Ce8tRkyziVl9RAagf01x5mBmXc0102o',
  'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E',
  'h53kMVYT4TUi6A6Fnt4u5VjIQUJPULna3myYKIdQk7A'
];

async function getPlaybackIds() {
  console.log('🎬 Fetching playback IDs for ready assets...');
  
  for (const assetId of readyAssets) {
    try {
      const response = await fetch(`${RAILWAY_API_URL}/api/mux/asset/${assetId}`);
      
      if (response.ok) {
        const assetData = await response.json();
        
        if (assetData.playback_ids && assetData.playback_ids.length > 0) {
          const playbackId = assetData.playback_ids[0].id;
          console.log(`✅ Asset ${assetId} → Playback ID: ${playbackId}`);
        } else {
          console.log(`⚠️ Asset ${assetId} has no playback IDs yet`);
        }
      } else {
        console.log(`❌ Failed to fetch asset ${assetId}: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error fetching asset ${assetId}:`, error);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

getPlaybackIds();
