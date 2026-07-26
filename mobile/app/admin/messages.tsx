import { AppBackHeader } from "@/components/AppBackHeader";
import { AppShell } from "@/components/AppShell";
import {
  api,
  ApiError,
} from "@/lib/api";
import { colors } from "@/lib/theme";
import {
  type Href,
  router,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";

type AdminThread = {
  id: number;
  userId: number;
  login: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  subject: string;
  status:
    | "New"
    | "InProgress"
    | "Resolved"
    | "Closed";
  lastMessage: string | null;
  lastSenderType:
    | "User"
    | "Admin"
    | null;
  lastMessageAt: string | null;
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
};

const statusLabels = {
  New: "Новое",
  InProgress: "В работе",
  Resolved: "Решено",
  Closed: "Закрыто",
} satisfies Record<
  AdminThread["status"],
  string
>;

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminMessagesScreen() {
  const [items, setItems] =
    useState<AdminThread[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const result =
        await api<AdminThread[]>(
          "/admin/support/threads",
        );

      setItems(result);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось загрузить диалоги",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <AppShell>
      <View style={styles.page}>
        <AppBackHeader title="Сообщения" />

        {!!error && (
          <Text style={styles.error}>
            {error}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator
              color={colors.primary}
            />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) =>
              String(item.id)
            }
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Диалогов пока нет
              </Text>
            }
            renderItem={({ item }) => {
              const name = [
                item.lastName,
                item.firstName,
                item.middleName,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <Pressable
                  style={styles.card}
                  onPress={() => {
                    router.push({
                      pathname:
                        "/admin/support-thread",
                      params: {
                        id: String(item.id),
                      },
                    } as unknown as Href);
                  }}
                >
                  <View style={styles.top}>
                    <Text
                      style={styles.subject}
                      numberOfLines={1}
                    >
                      {item.subject}
                    </Text>

                    <Text style={styles.status}>
                      {statusLabels[item.status]}
                    </Text>
                  </View>

                  <Text style={styles.user}>
                    {name} · @{item.login}
                  </Text>

                  <Text
                    style={styles.preview}
                    numberOfLines={2}
                  >
                    {item.lastSenderType ===
                    "Admin"
                      ? "Вы: "
                      : ""}
                    {item.lastMessage
                      ?? "Нет сообщений"}
                  </Text>

                  <View style={styles.bottom}>
                    <Text style={styles.date}>
                      {formatDate(
                        item.lastMessageAt
                        ?? item.updatedAt,
                      )}
                    </Text>

                    <Text style={styles.open}>
                      Открыть ›
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  error: {
    padding: 12,
    color: colors.danger,
    textAlign: "center",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    padding: 14,
    paddingBottom: 40,
  },

  empty: {
    marginTop: 40,
    color: colors.textSecondary,
    textAlign: "center",
  },

  card: {
    marginBottom: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  top: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },

  subject: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  status: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  user: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 12,
  },

  preview: {
    marginTop: 11,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },

  bottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 11,
  },

  date: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  open: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
