import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (loginValue.trim().length < 3 || password.length < 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      await login(loginValue, password);
      router.replace("/(tabs)/time");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Неверный логин или пароль" : e instanceof Error ? e.message : "Не удалось выполнить вход");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Авторизация</Text>
        <Text style={styles.label}>Логин</Text>
        <TextInput style={styles.input} value={loginValue} onChangeText={setLoginValue} autoCapitalize="none" />
        <Text style={styles.label}>Пароль</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Входим…" : "Войти"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f6f8", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 440, backgroundColor: "white", borderRadius: 24, padding: 24, gap: 10 },
  title: { fontSize: 30, fontWeight: "800", marginBottom: 16, color: "#182028" },
  label: { fontSize: 14, fontWeight: "600", color: "#4e5963" },
  input: { borderWidth: 1, borderColor: "#d9dee3", borderRadius: 14, paddingHorizontal: 16, minHeight: 52, fontSize: 16, marginBottom: 8 },
  error: { color: "#c93232", marginVertical: 4 },
  button: { backgroundColor: "#1f7a55", borderRadius: 14, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
  disabled: { opacity: 0.6 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "700" },
});
