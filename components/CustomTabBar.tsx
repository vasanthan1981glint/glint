import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Image, TouchableOpacity, View } from 'react-native';

export default function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (route: string) => pathname === `/${route}`;

  return (
    <View style={{
      height: 60,
      backgroundColor: '#000',
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      borderTopWidth: 0,
    }}>
      <TouchableOpacity onPress={() => router.push('/home')}>
        <Ionicons name="home-outline" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/plus')}>
        <Ionicons name="star-outline" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/upload')}>
        <View style={{
          width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="add" size={22} color="#000" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/search')}>
        <Ionicons name="search-outline" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/me')}>
        <Image
          source={{ uri: 'https://via.placeholder.com/40' }} // replace with user image
          style={{
            width: 26, height: 26, borderRadius: 13,
            borderWidth: isActive('me') ? 2 : 0,
            borderColor: '#fff',
          }}
        />
      </TouchableOpacity>
    </View>
  );
}
