import { AppShell } from "@/components/AppShell";
import {
  api,
  ApiError,
} from "@/lib/api";
import { colors } from "@/lib/theme";
import { router } from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type ServiceRole =
  | "Technician"
  | "CoTechnician"
  | "Dispatcher"
  | "Manager"
  | "Administrator";

type ServiceUser = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  role: string;
  serviceRole: ServiceRole;
  isActive: boolean;
  employmentDate: string | null;
  position: string | null;
  category: string | null;
  avatarUrl: string | null;
};

const roles: Array<{
  value: ServiceRole;
  label: string;
}> = [
  {
    value: "Technician",
    label: "Техник",
  },
  {
    value: "CoTechnician",
    label: "Соисполнитель",
  },
  {
    value: "Dispatcher",
    label: "Диспетчер",
  },
  {
    value: "Manager",
    label: "Руководитель",
  },
  {
    value: "Administrator",
    label: "Администратор",
  },
];

function roleLabel(
  value: ServiceRole,
): string {
  return (
    roles.find(
      (role) => role.value === value,
    )?.label ?? value
  );
}

export default function AdminUsersScreen() {
  const [users, setUsers] =
    useState<ServiceUser[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [selectedUser, setSelectedUser] =
    useState<ServiceUser | null>(null);

  const [selectedRole, setSelectedRole] =
    useState<ServiceRole>("Technician");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const result =
        await api<ServiceUser[]>(
          "/admin/service-users",
        );

      setUsers(result);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось загрузить пользователей",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useState(() => {
    void load();
    return true;
  });

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const name = [
        user.lastName,
        user.firstName,
        user.middleName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        name.includes(query) ||
        user.login
          .toLowerCase()
          .includes(query) ||
        user.email
          .toLowerCase()
          .includes(query)
      );
    });
  }, [search, users]);

  function openRole(user: ServiceUser) {
    setSelectedUser(user);
    setSelectedRole(user.serviceRole);
  }

  async function saveRole() {
    if (!selectedUser || saving) {
      return;
    }

    try {
      setSaving(true);

      await api(
        `/admin/users/${selectedUser.id}/service-role`,
        {
          method: "PUT",
          body: JSON.stringify({
            serviceRole: selectedRole,
          }),
        },
      );

      setSelectedUser(null);
      await load();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось сохранить роль",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
          >
            <Text style={styles.back}>
              ‹ Назад
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Пользователи
          </Text>

          <View style={styles.space} />
        </View>

        <View style={styles.content}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по ФИО, логину или почте"
            placeholderTextColor="#98a39e"
            autoCapitalize="none"
          />

          {!!error && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          {loading ? (
            <ActivityIndicator
              style={styles.loader}
              color={colors.primary}
            />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) =>
                String(item.id)
              }
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const fullName = [
                  item.lastName,
                  item.firstName,
                  item.middleName,
                ]
                  .filter(Boolean)
                  .join(" ");

                const initials =
                  `${item.lastName[0] ?? ""}${
                    item.firstName[0] ?? ""
                  }`.toUpperCase();

                return (
                  <Pressable
                    style={styles.userCard}
                    onPress={() =>
                      openRole(item)
                    }
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {initials || "П"}
                      </Text>
                    </View>

                    <View style={styles.userMain}>
                      <Text style={styles.userName}>
                        {fullName}
                      </Text>

                      <Text style={styles.userMeta}>
                        @{item.login}
                      </Text>

                      <Text style={styles.serviceRole}>
                        {roleLabel(
                          item.serviceRole,
                        )}
                      </Text>
                    </View>

                    <View style={styles.right}>
                      <Text
                        style={[
                          styles.active,
                          !item.isActive &&
                            styles.inactive,
                        ]}
                      >
                        {item.isActive
                          ? "Активен"
                          : "Отключён"}
                      </Text>

                      <Text style={styles.arrow}>
                        ›
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <Modal
          visible={selectedUser !== null}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setSelectedUser(null)
          }
        >
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                Назначить роль
              </Text>

              <Text style={styles.modalUser}>
                {selectedUser
                  ? `${selectedUser.lastName} ${selectedUser.firstName}`
                  : ""}
              </Text>

              {roles.map((role) => (
                <Pressable
                  key={role.value}
                  style={[
                    styles.roleOption,
                    selectedRole ===
                      role.value &&
                      styles.roleOptionSelected,
                  ]}
                  onPress={() =>
                    setSelectedRole(
                      role.value,
                    )
                  }
                >
                  <View style={styles.radio}>
                    {selectedRole ===
                      role.value && (
                      <View
                        style={styles.radioInner}
                      />
                    )}
                  </View>

                  <Text style={styles.roleText}>
                    {role.label}
                  </Text>
                </Pressable>
              ))}

              <View style={styles.actions}>
                <Pressable
                  style={styles.cancel}
                  disabled={saving}
                  onPress={() =>
                    setSelectedUser(null)
                  }
                >
                  <Text style={styles.cancelText}>
                    Отмена
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.save}
                  disabled={saving}
                  onPress={() =>
                    void saveRole()
                  }
                >
                  {saving ? (
                    <ActivityIndicator
                      color={colors.white}
                    />
                  ) : (
                    <Text style={styles.saveText}>
                      Сохранить
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </AppShell>
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
    flex: 1,
    padding: 14,
  },

  search: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
  },

  error: {
    marginTop: 10,
    color: colors.danger,
    textAlign: "center",
  },

  loader: {
    marginTop: 35,
  },

  list: {
    paddingTop: 12,
    paddingBottom: 35,
  },

  userCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },

  avatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
  },

  avatarText: {
    color: colors.primaryHover,
    fontWeight: "800",
  },

  userMain: {
    flex: 1,
  },

  userName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  userMeta: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
  },

  serviceRole: {
    marginTop: 5,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  right: {
    alignItems: "flex-end",
  },

  active: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },

  inactive: {
    color: colors.danger,
  },

  arrow: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 21,
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
    maxWidth: 390,
    padding: 18,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },

  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },

  modalUser: {
    marginTop: 4,
    marginBottom: 14,
    color: colors.textSecondary,
    fontSize: 13,
  },

  roleOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },

  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  radio: {
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 11,
  },

  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  roleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },

  cancel: {
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
    fontSize: 14,
  },

  save: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  saveText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
