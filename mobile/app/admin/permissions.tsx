import { AppShell } from "@/components/AppShell";
import {
  api,
  ApiError,
} from "@/lib/api";
import { router } from "expo-router";
import {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type AdminUser = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  isActive: boolean;
  position?: string | null;
};

export default function PermissionsScreen() {
  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState<number | null>(null);

  const [error, setError] =
    useState("");

  async function loadUsers() {
    try {
      setError("");

      const result =
        await api<AdminUser[]>(
          "/admin/users",
        );

      setUsers(result);
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

      setError(
        "Не удалось загрузить пользователей",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function updateUser(
    user: AdminUser,
    changes: Partial<AdminUser>,
  ) {
    if (savingId !== null) {
      return;
    }

    const updated = {
      ...user,
      ...changes,
    };

    try {
      setSavingId(user.id);

      await api(
        `/admin/users/${user.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            login: updated.login,
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
            middleName:
              updated.middleName ?? "",
            role: updated.role,
            isActive: updated.isActive,
            position:
              updated.position ?? "",
          }),
        },
      );

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? updated
            : item,
        ),
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось изменить права";

      Alert.alert(
        "Ошибка",
        message,
      );
    } finally {
      setSavingId(null);
    }
  }

  function changeRole(user: AdminUser) {
    const nextRole =
      user.role === "Admin"
        ? "User"
        : "Admin";

    Alert.alert(
      "Изменение роли",
      nextRole === "Admin"
        ? `Сделать ${user.login} администратором?`
        : `Убрать права администратора у ${user.login}?`,
      [
        {
          text: "Отмена",
          style: "cancel",
        },
        {
          text: "Изменить",
          onPress: () =>
            void updateUser(
              user,
              {
                role: nextRole,
              },
            ),
        },
      ],
    );
  }

  function changeActivity(user: AdminUser) {
    Alert.alert(
      user.isActive
        ? "Отключить аккаунт"
        : "Включить аккаунт",
      user.isActive
        ? "Пользователь не сможет войти в приложение."
        : "Пользователь снова сможет войти в приложение.",
      [
        {
          text: "Отмена",
          style: "cancel",
        },
        {
          text: user.isActive
            ? "Отключить"
            : "Включить",
          style: user.isActive
            ? "destructive"
            : "default",
          onPress: () =>
            void updateUser(
              user,
              {
                isActive:
                  !user.isActive,
              },
            ),
        },
      ],
    );
  }

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
            Права доступа
          </Text>

          <View style={styles.headerSpace} />
        </View>

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
            data={users}
            keyExtractor={(item) =>
              String(item.id)
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

              const saving =
                savingId === item.id;

              return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.userMain}>
                      <Text style={styles.userName}>
                        {fullName || item.login}
                      </Text>

                      <Text style={styles.userLogin}>
                        @{item.login}
                      </Text>
                    </View>

                    {saving ? (
                      <ActivityIndicator
                        color="#16a36a"
                      />
                    ) : null}
                  </View>

                  <View style={styles.badges}>
                    <Text
                      style={[
                        styles.badge,
                        item.role === "Admin" &&
                          styles.badgeAdmin,
                      ]}
                    >
                      {item.role === "Admin"
                        ? "Администратор"
                        : "Пользователь"}
                    </Text>

                    <Text
                      style={[
                        styles.badge,
                        item.isActive
                          ? styles.badgeActive
                          : styles.badgeInactive,
                      ]}
                    >
                      {item.isActive
                        ? "Активен"
                        : "Отключён"}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionButton}
                      disabled={saving}
                      onPress={() =>
                        changeRole(item)
                      }
                    >
                      <Text
                        style={styles.actionText}
                      >
                        {item.role === "Admin"
                          ? "Убрать админа"
                          : "Сделать админом"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.actionButton,
                        item.isActive
                          ? styles.disableButton
                          : styles.enableButton,
                      ]}
                      disabled={saving}
                      onPress={() =>
                        changeActivity(item)
                      }
                    >
                      <Text
                        style={[
                          styles.actionText,
                          item.isActive &&
                            styles.disableText,
                        ]}
                      >
                        {item.isActive
                          ? "Отключить"
                          : "Включить"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        ) : null}
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

  headerSpace: {
    width: 54,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  error: {
    padding: 20,
    color: "#c73737",
    fontSize: 14,
  },

  list: {
    padding: 14,
    paddingBottom: 50,
  },

  card: {
    marginBottom: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#dfe8e3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  userMain: {
    flex: 1,
  },

  userName: {
    color: "#1f2926",
    fontSize: 16,
    fontWeight: "800",
  },

  userLogin: {
    marginTop: 3,
    color: "#77837e",
    fontSize: 13,
  },

  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },

  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#edf1ef",
    color: "#56635d",
    fontSize: 12,
    fontWeight: "700",
  },

  badgeAdmin: {
    backgroundColor: "#e9e5ff",
    color: "#5c47a3",
  },

  badgeActive: {
    backgroundColor: "#e4f7ed",
    color: "#08794b",
  },

  badgeInactive: {
    backgroundColor: "#fdeaea",
    color: "#b12b2b",
  },

  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 13,
  },

  actionButton: {
    minHeight: 42,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#16a36a",
    borderRadius: 11,
    backgroundColor: "#ffffff",
  },

  actionText: {
    color: "#118556",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  disableButton: {
    borderColor: "#d55454",
  },

  enableButton: {
    backgroundColor: "#16a36a",
  },

  disableText: {
    color: "#bd3939",
  },
});
