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
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type SupportThread = {
  id: number;
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
  SupportThread["status"],
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

export default function SupportThreadsScreen() {
  const [items, setItems] =
    useState<SupportThread[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [subject, setSubject] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const result =
        await api<SupportThread[]>(
          "/support/threads",
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

      return () => {
        Keyboard.dismiss();
      };
    }, [load]),
  );

  async function createThread() {
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (
      !cleanSubject
      || !cleanMessage
      || creating
    ) {
      return;
    }

    try {
      Keyboard.dismiss();
      setCreating(true);
      setError("");

      const result = await api<{
        id: number;
      }>("/support/threads", {
        method: "POST",
        body: JSON.stringify({
          subject: cleanSubject,
          message: cleanMessage,
        }),
      });

      setSubject("");
      setMessage("");
      setModalVisible(false);

      router.push({
        pathname: "/support-thread",
        params: {
          id: String(result.id),
        },
      } as unknown as Href);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось создать диалог",
      );
    } finally {
      setCreating(false);
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
      <View style={styles.header}>
        <View style={styles.headerSide} />

        <Text style={styles.headerTitle}>
          Сообщения
        </Text>

        <Pressable
          style={styles.headerSide}
          hitSlop={10}
          onPress={() =>
            setModalVisible(true)
          }
        >
          <Text style={styles.plus}>
            ＋
          </Text>
        </Pressable>
      </View>

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
          data={items}
          keyExtractor={(item) =>
            String(item.id)
          }
          contentContainerStyle={
            items.length === 0
              ? styles.emptyList
              : styles.list
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>
                ✉
              </Text>

              <Text style={styles.emptyTitle}>
                Диалогов пока нет
              </Text>

              <Text style={styles.emptyText}>
                Нажмите «＋», укажите тему и напишите сообщение.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.thread}
              onPress={() => {
                router.push({
                  pathname:
                    "/support-thread",
                  params: {
                    id: String(item.id),
                  },
                } as unknown as Href);
              }}
            >
              <View style={styles.threadTop}>
                <Text
                  style={styles.subject}
                  numberOfLines={1}
                >
                  {item.subject}
                </Text>

                <Text style={styles.date}>
                  {formatDate(
                    item.lastMessageAt
                    ?? item.updatedAt,
                  )}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.status}>
                  {statusLabels[item.status]}
                </Text>

                <Text style={styles.count}>
                  {item.messagesCount} сообщ.
                </Text>
              </View>

              <Text
                style={styles.preview}
                numberOfLines={2}
              >
                {item.lastSenderType ===
                "Admin"
                  ? "Администратор: "
                  : ""}
                {item.lastMessage
                  ?? "Сообщений пока нет"}
              </Text>

              <Text style={styles.open}>
                Открыть диалог ›
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={styles.newButton}
        onPress={() =>
          setModalVisible(true)
        }
      >
        <Text style={styles.newButtonText}>
          Новый диалог
        </Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalPage}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <Pressable
            style={styles.overlay}
            onPress={Keyboard.dismiss}
          >
            <Pressable
              style={styles.modal}
              onPress={() => undefined}
            >
              <Text style={styles.modalTitle}>
                Новый диалог
              </Text>

              <Text style={styles.label}>
                Тема
              </Text>

              <TextInput
                style={styles.subjectInput}
                value={subject}
                maxLength={255}
                placeholder="Например: не открывается заявка"
                placeholderTextColor="#98a39e"
                inputAccessoryViewID={
                  keyboardAccessoryId
                }
                returnKeyType="next"
                onChangeText={setSubject}
              />

              <Text style={styles.label}>
                Сообщение
              </Text>

              <TextInput
                style={styles.messageInput}
                value={message}
                multiline
                maxLength={5000}
                placeholder="Опишите проблему"
                placeholderTextColor="#98a39e"
                textAlignVertical="top"
                inputAccessoryViewID={
                  keyboardAccessoryId
                }
                onChangeText={setMessage}
              />

              <View style={styles.actions}>
                <Pressable
                  style={styles.cancelButton}
                  disabled={creating}
                  onPress={() => {
                    Keyboard.dismiss();
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelText}>
                    Отмена
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.createButton,
                    (
                      !subject.trim()
                      || !message.trim()
                    ) &&
                      styles.disabled,
                  ]}
                  disabled={
                    creating
                    || !subject.trim()
                    || !message.trim()
                  }
                  onPress={() =>
                    void createThread()
                  }
                >
                  {creating ? (
                    <ActivityIndicator
                      color={colors.white}
                    />
                  ) : (
                    <Text style={styles.createText}>
                      Создать
                    </Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>

        <KeyboardDoneBar />
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  headerSide: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },

  plus: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "400",
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
    padding: 14,
    paddingBottom: 95,
  },

  emptyList: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  empty: {
    alignItems: "center",
  },

  emptyIcon: {
    fontSize: 32,
  },

  emptyTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },

  emptyText: {
    maxWidth: 280,
    marginTop: 7,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  thread: {
    marginBottom: 11,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },

  threadTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  subject: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  date: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },

  status: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  count: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  preview: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  open: {
    marginTop: 11,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  newButton: {
    minHeight: 50,
    position: "absolute",
    right: 16,
    bottom: 14,
    left: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.primary,
  },

  newButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },

  modalPage: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  modal: {
    width: "100%",
    maxWidth: 410,
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },

  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },

  label: {
    marginTop: 15,
    marginBottom: 7,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },

  subjectInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontSize: 14,
  },

  messageInput: {
    minHeight: 120,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontSize: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 18,
  },

  cancelButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },

  cancelText: {
    color: colors.text,
  },

  createButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  createText: {
    color: colors.white,
    fontWeight: "800",
  },

  disabled: {
    opacity: 0.45,
  },
});
