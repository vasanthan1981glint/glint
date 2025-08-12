// app/components/BlockButton.tsx

import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { auth, db } from '../firebaseConfig'; // ✅ adjust if your path is different

type Props = {
  targetUserId: string; // The UID of the user you want to block
};

export default function BlockButton({ targetUserId }: Props) {
  const handleBlock = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in.');
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        blocked: arrayUnion(targetUserId),
      });

      Alert.alert('User Blocked', 'This user has been added to your blocked list.');
    } catch (error) {
      console.error('Block failed:', error);
      Alert.alert('Error', 'Failed to block user.');
    }
  };

  return (
    <TouchableOpacity
      onPress={handleBlock}
      style={{
        backgroundColor: '#000',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 10,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Block</Text>
    </TouchableOpacity>
  );
}
