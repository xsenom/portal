import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

export default function ProfileDetailsScreen() {
  const { user } = useAuth();

  const fullName = [
    user?.lastName,
    user?.firstName,
    user?.middleName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>
            ‹ Назад
          </Text>
        </Pressable>

        <Text style={styles.title}>
          Данные профиля
        </Text>

        <View style={styles.space} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Row
          label="ФИО"
          value={fullName || "Не указано"}
        />

        <Row
          label="Логин"
          value={user?.login ?? "Не указано"}
        />

        <Row
          label="Email"
          value={user?.email ?? "Не указано"}
        />

        <Row
          label="Системная роль"
          value={
            user?.role === "Admin"
              ? "Администратор"
              : "Пользователь"
          }
        />

        <Row
          label="Должность"
          value={user?.position ?? "Не указана"}
        />

        <Row
          label="Категория"
          value={user?.category ?? "Не указана"}
        />

        <Row
          label="Дата трудоустройства"
          value={
            user?.employmentDate ?? "Не указана"
          }
        />
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  back: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },

  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },

  space: {
    width: 55,
  },

  content: {
    padding: 16,
  },

  row: {
    minHeight: 65,
    marginBottom: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  label: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  value: {
    marginTop: 6,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
