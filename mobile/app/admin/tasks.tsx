import { AppShell } from "@/components/AppShell";
import {
  api,
  ApiError,
} from "@/lib/api";
import { router } from "expo-router";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type TaskItem = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  plannedHours: number | null;
  actualHours: number | null;
  rewardAmount: number | null;
  dueAt: string | null;
  createdAt: string;
};

type AdminTask = {
  task: TaskItem;
  userId: number;
  login: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
};

const statuses = [
  { value: "", label: "Все" },
  { value: "Assigned", label: "Новые" },
  { value: "InProgress", label: "В работе" },
  { value: "Submitted", label: "На проверке" },
  { value: "Approved", label: "Выполненные" },
  { value: "Rejected", label: "Возвращённые" },
  { value: "Cancelled", label: "Отказ" },
];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    Assigned: "Новое",
    InProgress: "В работе",
    Submitted: "На проверке",
    Approved: "Выполнено",
    Rejected: "Возвращено",
    Cancelled: "Отказ",
  };

  return labels[status] ?? status;
}

export default function AdminTasksScreen() {
  const [tasks, setTasks] =
    useState<AdminTask[]>([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result =
          await api<AdminTask[]>(
            "/admin/tasks",
          );

        if (active) {
          setTasks(result);
        }
      } catch (caughtError) {
        if (
          caughtError instanceof ApiError &&
          caughtError.status === 401
        ) {
          router.replace("/login");
          return;
        }

        if (
          caughtError instanceof ApiError &&
          caughtError.status === 403
        ) {
          router.replace(
            "/(tabs)/profile",
          );
          return;
        }

        if (active) {
          setError(
            "Не удалось загрузить задания",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return tasks.filter((item) => {
      if (
        status &&
        item.task.status !== status
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const fullName = [
        item.lastName,
        item.firstName,
        item.middleName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        item.task.title
          .toLowerCase()
          .includes(query) ||
        fullName.includes(query) ||
        item.login
          .toLowerCase()
          .includes(query)
      );
    });
  }, [search, status, tasks]);

  return (
    <AppShell>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
          >
            <Text style={styles.back}>
              ‹ Назад
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Задания
          </Text>

          <Pressable
            style={styles.createButton}
            onPress={() =>
              router.push(
                "/admin/tasks/create",
              )
            }
          >
            <Text style={styles.createButtonText}>
              ＋
            </Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder={
              "Поиск задания или сотрудника"
            }
            placeholderTextColor="#98a39e"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.statuses
            }
          >
            {statuses.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.statusButton,
                  status === item.value &&
                    styles.statusButtonActive,
                ]}
                onPress={() =>
                  setStatus(item.value)
                }
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === item.value &&
                      styles.statusButtonTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator
                color="#16a36a"
              />
            </View>
          ) : null}

          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}

          {!loading && !error ? (
            <FlatList
              data={filtered}
              keyExtractor={(item) =>
                String(item.task.id)
              }
              contentContainerStyle={
                styles.list
              }
              renderItem={({ item }) => {
                const fullName = [
                  item.lastName,
                  item.firstName,
                  item.middleName,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <View style={styles.taskCard}>
                    <View
                      style={
                        styles.taskHeader
                      }
                    >
                      <View style={styles.taskMain}>
                        <Text
                          style={
                            styles.taskTitle
                          }
                        >
                          {item.task.title}
                        </Text>

                        <Text
                          style={
                            styles.employee
                          }
                        >
                          {fullName}
                        </Text>
                      </View>

                      <Text style={styles.badge}>
                        {statusLabel(
                          item.task.status,
                        )}
                      </Text>
                    </View>

                    {item.task.description ? (
                      <Text
                        style={
                          styles.description
                        }
                      >
                        {item.task.description}
                      </Text>
                    ) : null}

                    <View style={styles.meta}>
                      <Text style={styles.metaText}>
                        План:{" "}
                        {item.task.plannedHours ??
                          "—"}{" "}
                        ч
                      </Text>

                      <Text style={styles.metaText}>
                        Сумма:{" "}
                        {item.task.rewardAmount ??
                          "—"}{" "}
                        ₽
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  Заданий не найдено
                </Text>
              }
            />
          ) : null}
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f8f6",
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e9e4",
    backgroundColor: "#ffffff",
  },

  back: {
    color: "#16a36a",
    fontSize: 17,
    fontWeight: "600",
  },

  title: {
    color: "#1f2926",
    fontSize: 19,
    fontWeight: "800",
  },

  createButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#16a36a",
  },

  createButtonText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "500",
  },


  content: {
    flex: 1,
    padding: 14,
  },

  search: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dfe8e3",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    color: "#1f2926",
  },

  statuses: {
    gap: 7,
    paddingVertical: 11,
  },

  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#dfe8e3",
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },

  statusButtonActive: {
    borderColor: "#16a36a",
    backgroundColor: "#16a36a",
  },

  statusButtonText: {
    color: "#66736d",
    fontSize: 12,
    fontWeight: "700",
  },

  statusButtonTextActive: {
    color: "#ffffff",
  },

  loading: {
    paddingTop: 40,
  },

  error: {
    padding: 14,
    color: "#d83f4d",
    textAlign: "center",
  },

  list: {
    paddingBottom: 35,
  },

  taskCard: {
    marginBottom: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe8e3",
    borderRadius: 13,
    backgroundColor: "#ffffff",
  },

  taskHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  taskMain: {
    flex: 1,
  },

  taskTitle: {
    color: "#1f2926",
    fontSize: 16,
    fontWeight: "800",
  },

  employee: {
    marginTop: 3,
    color: "#78847e",
    fontSize: 12,
  },

  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "#e5f7ee",
    color: "#16885d",
    fontSize: 11,
    fontWeight: "700",
  },

  description: {
    marginTop: 11,
    color: "#59655f",
    fontSize: 13,
    lineHeight: 16,
  },

  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#edf2ef",
  },

  metaText: {
    color: "#78847e",
    fontSize: 12,
    fontWeight: "600",
  },

  empty: {
    paddingTop: 35,
    color: "#78847e",
    textAlign: "center",
  },
});
