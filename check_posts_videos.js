/**
 * Check Posts Collection Videos
 * This script checks what videos exist in the posts collection and their URLs
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, orderBy, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAUs11-YDiNO7C9pv9UR_19bvrbLbJg91A",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "869525277131",
  appId: "1:869525277131:web:b75a03f20fc93f81da0e4e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkPostsVideos() {
  try {
    console.log('🔍 Checking posts collection for videos...\n');
    
    // Get all posts
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    
    console.log(`📊 Found ${postsSnapshot.docs.length} documents in posts collection\n`);
    
    postsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      
      console.log(`--- Document ${index + 1}: ${doc.id} ---`);
      console.log(`User ID: ${data.userId || 'N/A'}`);
      console.log(`Username: ${data.username || 'N/A'}`);
      console.log(`Processed: ${data.processed || false}`);
      console.log(`Status: ${data.status || 'N/A'}`);
      console.log(`Created: ${data.createdAt ? (data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : data.createdAt.toString()) : 'N/A'}`);
      console.log(`Video URL: ${data.playbackUrl || data.videoUrl || 'N/A'}`);
      console.log(`Thumbnail URL: ${data.thumbnailUrl || 'N/A'}`);
      console.log(`Caption: ${data.caption || 'N/A'}`);
      console.log('');
    });
    
    // Check specific query that the app uses (without indexes for now)
    console.log('🎯 Testing simple query from posts...\n');
    
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, 'posts'),
          where('processed', '==', true)
          // Removing orderBy and status filter to avoid index requirement
        )
      );
      
      console.log(`✅ Simple query returned ${querySnapshot.docs.length} processed videos`);
      
      querySnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ${doc.id} - Status: ${data.status} - URL: ${data.playbackUrl || data.videoUrl || 'NO URL'}`);
      });
    } catch (queryError) {
      console.error('❌ Query error:', queryError.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking posts:', error);
  }
}

checkPostsVideos();
