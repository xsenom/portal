import { useAuth } from "@/lib/auth";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  return <Redirect href={user ? "/(tabs)/time" : "/login"} />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center" } });
