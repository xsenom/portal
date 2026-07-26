import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import {
  Redirect,
  type Href,
  router,
} from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AdminScreen() {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <View style={styles.center}>
          <ActivityIndicator
            color={colors.primary}
          />
        </View>
      </AppShell>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== "Admin") {
    return (
      <Redirect href="/(tabs)/profile" />
    );
  }

  const fullName = [
    user.lastName,
    user.firstName,
    user.middleName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AppShell>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>
              ‹ Назад
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Админка
          </Text>

          <View style={styles.space} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
        >
          <View style={styles.welcome}>
            <Text style={styles.welcomeRole}>
              Администратор
            </Text>

            <Text style={styles.welcomeName}>
              {fullName || user.login}
            </Text>
          </View>

          <AdminCard
            icon="👥"
            title="Пользователи"
            description="Назначение ролей и управление сотрудниками"
            onPress={() => {
              router.push(
                "/admin/users" as Href,
              );
            }}
          />

          <AdminCard
            icon="✉"
            title="Сообщения"
            description="Обращения сотрудников и ответы администратора"
            onPress={() => {
              router.push(
                "/admin/messages" as Href,
              );
            }}
          />

          <AdminCard
            icon="✅"
            title="Задания"
            description="Назначение и контроль заданий"
            onPress={() => {
              router.push(
                "/admin/tasks" as Href,
              );
            }}
          />

          <AdminCard
            icon="🔐"
            title="Права доступа"
            description="Администраторы и активность аккаунтов"
            onPress={() => {
              router.push(
                "/admin/permissions" as Href,
              );
            }}
          />
        </ScrollView>
      </View>
    </AppShell>
  );
}

function AdminCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
    >
      <View style={styles.cardIcon}>
        <Text style={styles.cardIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.cardMain}>
        <Text style={styles.cardTitle}>
          {title}
        </Text>

        <Text style={styles.cardDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.arrow}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  back: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "600",
  },

  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },

  space: {
    width: 54,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  welcome: {
    marginBottom: 16,
    padding: 17,
    borderRadius: 13,
    backgroundColor: colors.graphite,
  },

  welcomeRole: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  welcomeName: {
    marginTop: 6,
    color: colors.white,
    fontSize: 19,
    fontWeight: "700",
  },

  card: {
    minHeight: 79,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  cardIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
  },

  cardIconText: {
    fontSize: 20,
  },

  cardMain: {
    flex: 1,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  cardDescription: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },

  arrow: {
    color: colors.textSecondary,
    fontSize: 23,
  },
});
