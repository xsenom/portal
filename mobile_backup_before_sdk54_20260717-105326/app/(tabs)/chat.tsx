import { colors } from "@/lib/theme";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ChatScreen() {
  const [message, setMessage] =
    useState("");

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Сообщить о
        </Text>
      </View>

      <View style={styles.messages}>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>
              ✉
            </Text>
          </View>

          <Text style={styles.emptyTitle}>
            Сообщений пока нет
          </Text>

          <Text style={styles.emptyText}>
            Здесь можно сообщить администратору
            о проблеме или задать вопрос.
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Pressable style={styles.attachButton}>
          <Text style={styles.attachText}>
            ＋
          </Text>
        </Pressable>

        <TextInput
          style={styles.input}
          value={message}
          placeholder="Введите сообщение"
          placeholderTextColor="#a2ada7"
          multiline
          onChangeText={setMessage}
        />

        <Pressable
          style={[
            styles.sendButton,
            !message.trim() &&
              styles.sendDisabled,
          ]}
          disabled={!message.trim()}
          onPress={() => setMessage("")}
        >
          <Text style={styles.sendText}>
            ➤
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
  },

  header: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },

  messages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  empty: {
    alignItems: "center",
  },

  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 15,
    backgroundColor: colors.primarySoft,
  },

  emptyIconText: {
    color: colors.primary,
    fontSize: 22,
  },

  emptyTitle: {
    marginTop: 13,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  emptyText: {
    maxWidth: 260,
    marginTop: 7,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },

  form: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 9,

    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  attachButton: {
    width: 30,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  attachText: {
    color: colors.textSecondary,
    fontSize: 23,
  },

  input: {
    minWidth: 0,
    maxHeight: 90,
    minHeight: 40,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,

    color: colors.text,
    fontSize: 12,
  },

  sendButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 19,
    backgroundColor: colors.primary,
  },

  sendDisabled: {
    backgroundColor: colors.disabled,
  },

  sendText: {
    color: colors.white,
    fontSize: 15,
  },
});
