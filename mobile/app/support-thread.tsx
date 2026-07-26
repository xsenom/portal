import { AppBackHeader } from "@/components/AppBackHeader";
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

type ThreadMessage = {
  id: number;
  senderUserId: number | null;
  senderType: "User" | "Admin";
  senderName: string;
  message: string;
  createdAt: string;
};

type ThreadDetail = {
  id: number;
  userId: number;
  subject: string;
  status:
    | "New"
    | "InProgress"
    | "Resolved"
    | "Closed";
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
};

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportThreadScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const threadId =
    Number(params.id ?? 0);

  const listRef =
    useRef<FlatList<ThreadMessage>>(null);

  const [thread, setThread] =
    useState<ThreadDetail | null>(null);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    if (!threadId) {
      setError("Диалог не найден");
      setLoading(false);
      return;
    }

    try {
      const result =
        await api<ThreadDetail>(
          `/support/threads/${threadId}`,
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

  async function send() {
    const text = message.trim();

    if (!text || sending || !threadId) {
      return;
    }

    try {
      setSending(true);
      setError("");

      await api(
        `/support/threads/${threadId}/messages`,
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
          : "Не удалось отправить сообщение",
      );
    } finally {
      setSending(false);
    }
  }

  return (
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

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
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
                  styles.messageRow,
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
                      : "Вы"}
                  </Text>

                  <Text style={styles.messageText}>
                    {item.message}
                  </Text>

                  <Text style={styles.messageDate}>
                    {formatTime(
                      item.createdAt,
                    )}
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
          placeholder="Введите сообщение"
          placeholderTextColor="#98a39e"
          textAlignVertical="center"
          inputAccessoryViewID={
            keyboardAccessoryId
          }
          onChangeText={setMessage}
        />

        <Pressable
          style={[
            styles.sendButton,
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
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  errorBox: {
    padding: 10,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
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
    paddingBottom: 20,
  },

  messageRow: {
    width: "100%",
    marginBottom: 9,
  },

  userRow: {
    alignItems: "flex-end",
  },

  adminRow: {
    alignItems: "flex-start",
  },

  bubble: {
    maxWidth: "83%",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 15,
  },

  userBubble: {
    backgroundColor: colors.primarySoft,
  },

  adminBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sender: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  messageText: {
    marginTop: 4,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },

  messageDate: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 9,
    textAlign: "right",
  },

  form: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  input: {
    minHeight: 44,
    maxHeight: 110,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
  },

  sendButton: {
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
