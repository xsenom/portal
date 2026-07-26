import { AppBackHeader } from "@/components/AppBackHeader";
import { AppShell } from "@/components/AppShell";
import {
  KeyboardDoneBar,
  keyboardAccessoryId,
} from "@/components/KeyboardDoneBar";
import {
  api,
  ApiError,
} from "@/lib/api";
import { colors } from "@/lib/theme";
import {
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  useCallback,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Status =
  | "New"
  | "InProgress"
  | "Resolved"
  | "Closed";

type ThreadMessage = {
  id: number;
  senderType: "User" | "Admin";
  senderName: string;
  message: string;
  createdAt: string;
};

type AdminThreadDetail = {
  id: number;
  subject: string;
  status: Status;
  user: {
    login: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  messages: ThreadMessage[];
};

const statuses: Array<{
  value: Status;
  label: string;
}> = [
  {
    value: "New",
    label: "Новое",
  },
  {
    value: "InProgress",
    label: "В работе",
  },
  {
    value: "Resolved",
    label: "Решено",
  },
  {
    value: "Closed",
    label: "Закрыто",
  },
];

export default function AdminSupportThreadScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const threadId =
    Number(params.id ?? 0);

  const listRef =
    useRef<FlatList<ThreadMessage>>(null);

  const [thread, setThread] =
    useState<AdminThreadDetail | null>(null);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    try {
      const result =
        await api<AdminThreadDetail>(
          `/admin/support/threads/${threadId}`,
        );

      setThread(result);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось загрузить диалог",
      );
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useFocusEffect(
    useCallback(() => {
      void load();

      return () => {
        Keyboard.dismiss();
      };
    }, [load]),
  );

  async function changeStatus(
    status: Status,
  ) {
    if (!threadId) {
      return;
    }

    try {
      await api(
        `/admin/support/threads/${threadId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        },
      );

      await load();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось изменить статус",
      );
    }
  }

  async function send() {
    const text = message.trim();

    if (!text || sending) {
      return;
    }

    try {
      setSending(true);

      await api(
        `/admin/support/threads/${threadId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            message: text,
          }),
        },
      );

      setMessage("");
      Keyboard.dismiss();
      await load();

      setTimeout(() => {
        listRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось отправить ответ",
      );
    } finally {
      setSending(false);
    }
  }

  const fullName = thread
    ? [
        thread.user.lastName,
        thread.user.firstName,
        thread.user.middleName,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <AppShell>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <AppBackHeader
          title={thread?.subject ?? "Диалог"}
        />

        {!!thread && (
          <View style={styles.info}>
            <Text style={styles.userName}>
              {fullName}
            </Text>

            <Text style={styles.login}>
              @{thread.user.login}
            </Text>

            <View style={styles.statuses}>
              {statuses.map((item) => (
                <Pressable
                  key={item.value}
                  style={[
                    styles.statusButton,
                    thread.status ===
                      item.value &&
                      styles.statusActive,
                  ]}
                  onPress={() =>
                    void changeStatus(
                      item.value,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.statusText,
                      thread.status ===
                        item.value &&
                        styles.statusTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

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
            ref={listRef}
            data={thread?.messages ?? []}
            keyExtractor={(item) =>
              String(item.id)
            }
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            onContentSizeChange={() => {
              listRef.current?.scrollToEnd({
                animated: false,
              });
            }}
            renderItem={({ item }) => {
              const admin =
                item.senderType === "Admin";

              return (
                <View
                  style={[
                    styles.row,
                    admin
                      ? styles.adminRow
                      : styles.userRow,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      admin
                        ? styles.adminBubble
                        : styles.userBubble,
                    ]}
                  >
                    <Text style={styles.sender}>
                      {admin
                        ? "Администратор"
                        : fullName}
                    </Text>

                    <Text style={styles.messageText}>
                      {item.message}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={message}
            multiline
            maxLength={5000}
            placeholder="Ответить сотруднику"
            placeholderTextColor="#98a39e"
            inputAccessoryViewID={
              keyboardAccessoryId
            }
            onChangeText={setMessage}
          />

          <Pressable
            style={[
              styles.send,
              (!message.trim() || sending) &&
                styles.disabled,
            ]}
            disabled={
              !message.trim()
              || sending
            }
            onPress={() => void send()}
          >
            {sending ? (
              <ActivityIndicator
                size="small"
                color={colors.white}
              />
            ) : (
              <Text style={styles.sendText}>
                ➤
              </Text>
            )}
          </Pressable>
        </View>

        <KeyboardDoneBar />
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  info: {
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  userName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },

  login: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
  },

  statuses: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },

  statusButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },

  statusActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  statusText: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  statusTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },

  error: {
    padding: 10,
    color: colors.danger,
    textAlign: "center",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    flexGrow: 1,
    padding: 13,
  },

  row: {
    width: "100%",
    marginBottom: 9,
  },

  adminRow: {
    alignItems: "flex-end",
  },

  userRow: {
    alignItems: "flex-start",
  },

  bubble: {
    maxWidth: "84%",
    padding: 12,
    borderRadius: 14,
  },

  adminBubble: {
    backgroundColor: colors.primarySoft,
  },

  userBubble: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  sender: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },

  messageText: {
    marginTop: 4,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
  },

  form: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  input: {
    minHeight: 44,
    maxHeight: 110,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    color: colors.text,
  },

  send: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.primary,
  },

  sendText: {
    color: colors.white,
    fontSize: 18,
  },

  disabled: {
    opacity: 0.4,
  },
});
