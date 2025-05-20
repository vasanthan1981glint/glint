import { StyleSheet, Text, View } from 'react-native';

export default function MyProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to your profile!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontSize: 18 },
});
