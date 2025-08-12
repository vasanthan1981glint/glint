import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* 🔙 Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* 📄 Content */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>1. Use of the App</Text>
        <Text style={styles.text}>
          You must be at least 13 years old to use Glint. Use the app lawfully and respectfully.
        </Text>

        <Text style={styles.sectionTitle}>2. User Accounts</Text>
        <Text style={styles.text}>
          You&apos;re responsible for keeping your account secure. We may suspend accounts for violations.
        </Text>

        <Text style={styles.sectionTitle}>3. Content Ownership</Text>
        <Text style={styles.text}>
          You own the content you post but grant Glint a license to use it in the app.
        </Text>

        <Text style={styles.sectionTitle}>4. Liability</Text>
        <Text style={styles.text}>
          We are not responsible for user content or damages from using Glint.
        </Text>

        <Text style={styles.sectionTitle}>5. Updates</Text>
        <Text style={styles.text}>
          These terms may be updated. Continued use means you agree to changes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
