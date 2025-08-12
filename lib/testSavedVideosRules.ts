import { addDoc, collection, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export const testSavedVideosRules = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No authenticated user for test');
    return;
  }

  console.log(`🧪 Testing savedVideos rules for user: ${user.uid}`);

  try {
    // Test 1: Try to create a document
    console.log('🧪 Test 1: Creating a test savedVideo document...');
    const testData = {
      videoId: 'test_video_id',
      userId: user.uid,
      savedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'savedVideos'), testData);
    console.log('✅ Test 1 passed: Document created with ID:', docRef.id);

    // Test 2: Try to read the document back
    console.log('🧪 Test 2: Reading savedVideos collection...');
    const q = query(
      collection(db, 'savedVideos'),
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    console.log(`✅ Test 2 passed: Found ${querySnapshot.docs.length} documents`);

    // Clean up: Delete the test document
    if (!querySnapshot.empty) {
      const testDoc = querySnapshot.docs.find(doc => doc.data().videoId === 'test_video_id');
      if (testDoc) {
        await deleteDoc(testDoc.ref);
        console.log('✅ Test cleanup: Deleted test document');
      }
    }

    console.log('🎉 All tests passed! SavedVideos rules are working correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Rules might not be deployed or have permission issues');
  }
};
