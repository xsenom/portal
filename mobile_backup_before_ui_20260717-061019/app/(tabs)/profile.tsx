import { useAuth } from "@/lib/auth";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const fullName = [user?.lastName, user?.firstName, user?.middleName].filter(Boolean).join(" ");

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Профиль</Text>
      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{`${user?.lastName?.[0] ?? ""}${user?.firstName?.[0] ?? ""}`.toUpperCase() || "П"}</Text></View>
        <Text style={styles.name}>{fullName || user?.login}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role === "Admin" ? "Администратор" : "Сотрудник"}</Text>
      </View>
      <Pressable style={styles.logout} onPress={() => void logout()}><Text style={styles.logoutText}>Выйти из профиля</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: "#f4f6f8", padding: 20, paddingTop: 56, gap: 16 },
  title: { fontSize: 28, fontWeight: "800", color: "#182028" },
  card: { backgroundColor: "white", borderRadius: 22, padding: 24, alignItems: "center", gap: 8 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#dcefe7", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarText: { color: "#1f7a55", fontSize: 30, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", color: "#182028", textAlign: "center" },
  meta: { color: "#66717b" },
  role: { color: "#1f7a55", fontWeight: "700" },
  logout: { backgroundColor: "white", borderRadius: 14, minHeight: 52, alignItems: "center", justifyContent: "center" },
  logoutText: { color: "#a52d2d", fontWeight: "700" },
});
