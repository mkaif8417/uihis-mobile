import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DeptHome() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();

  const handleLogout = () => {
    router.replace('/department/DeptOfficialLogin');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="account-balance" size={32} color="#fff" />
          <Text style={styles.headerTitle}>Department Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Welcome, {username ?? 'Official'}!
          </Text>
        </View>

        {/* ...cards stay the same... */}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#1A4971' },
  scroll:        { flexGrow: 1, paddingBottom: 40 },

  header:        { backgroundColor: '#1A4971', alignItems: 'center', paddingVertical: 30, paddingHorizontal: 24 },
  headerTitle:   { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 10 },
  headerSubtitle:{ fontSize: 14, color: '#B8D4E8', marginTop: 4 },

  cardRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16 },
  card:          { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginHorizontal: 6, elevation: 4 },
  cardNumber:    { fontSize: 28, fontWeight: '900', color: '#1A4971', marginTop: 8 },
  cardLabel:     { fontSize: 13, color: '#666', marginTop: 4, fontWeight: '600' },

  logoutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#CC0000', margin: 24, padding: 16, borderRadius: 14, elevation: 4, gap: 8 },
  logoutText:    { color: '#fff', fontSize: 16, fontWeight: '800' },
});