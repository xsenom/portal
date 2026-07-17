import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

type Task = { id: number; title: string; description: string | null; status: string; dueAt: string | null };

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Task[]>("/tasks").then(setTasks).catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить задания"));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Задания</Text>
      {!tasks && !error && <ActivityIndicator />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {tasks?.map((task) => (
        <View key={task.id} style={styles.card}>
          <Text style={styles.cardTitle}>{task.title}</Text>
          {!!task.description && <Text style={styles.description}>{task.description}</Text>}
          <Text style={styles.status}>{task.status}</Text>
        </View>
      ))}
      {tasks?.length === 0 && <Text style={styles.empty}>Заданий пока нет</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: "#f4f6f8", padding: 20, paddingTop: 56, gap: 14 },
  title: { fontSize: 28, fontWeight: "800", color: "#182028", marginBottom: 4 },
  card: { backgroundColor: "white", borderRadius: 18, padding: 18, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#182028" },
  description: { color: "#66717b", lineHeight: 20 },
  status: { color: "#1f7a55", fontWeight: "700" },
  error: { color: "#c93232" },
  empty: { color: "#66717b", textAlign: "center", marginTop: 30 },
});
