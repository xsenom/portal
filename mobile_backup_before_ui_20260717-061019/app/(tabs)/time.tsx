import { api, ApiError } from "@/lib/api";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Dashboard = {
  activeShift: null | { status: "Working" | "Paused"; workSeconds: number; pausesCount: number };
  monthlyHours: number;
  monthlyEarnings: number;
  tasksInWork: number;
};

export default function TimeScreen() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await api<Dashboard>("/time/dashboard"));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить данные");
    }
  }

  async function action(name: "start" | "pause" | "resume" | "finish") {
    setBusy(true);
    try {
      await api(`/time/${name}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить действие");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Рабочее время</Text>
      {!data && !error && <ActivityIndicator />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {data && <>
        <View style={styles.card}>
          <Text style={styles.metric}>{data.monthlyHours} ч</Text>
          <Text style={styles.caption}>отработано за месяц</Text>
          <Text style={styles.metric}>{data.monthlyEarnings} ₽</Text>
          <Text style={styles.caption}>{data.tasksInWork} заданий в работе</Text>
        </View>
        {!data.activeShift && <Pressable style={styles.primary} disabled={busy} onPress={() => action("start")}><Text style={styles.primaryText}>Начать смену</Text></Pressable>}
        {data.activeShift?.status === "Working" && <Pressable style={styles.primary} disabled={busy} onPress={() => action("pause")}><Text style={styles.primaryText}>Пауза</Text></Pressable>}
        {data.activeShift?.status === "Paused" && <Pressable style={styles.primary} disabled={busy} onPress={() => action("resume")}><Text style={styles.primaryText}>Продолжить</Text></Pressable>}
        {!!data.activeShift && <Pressable style={styles.secondary} disabled={busy} onPress={() => action("finish")}><Text style={styles.secondaryText}>Завершить смену</Text></Pressable>}
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: "#f4f6f8", padding: 20, paddingTop: 56, gap: 16 },
  title: { fontSize: 28, fontWeight: "800", color: "#182028" },
  card: { backgroundColor: "white", borderRadius: 22, padding: 22, gap: 4 },
  metric: { fontSize: 28, fontWeight: "800", color: "#1f7a55", marginTop: 8 },
  caption: { color: "#66717b" },
  error: { color: "#c93232" },
  primary: { backgroundColor: "#1f7a55", minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "white", fontWeight: "700" },
  secondary: { backgroundColor: "white", borderWidth: 1, borderColor: "#d9dee3", minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#a52d2d", fontWeight: "700" },
});
