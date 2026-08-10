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
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type AdminUser = {
  id: number;
  login: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  isActive: boolean;
  role: string;
};

function parseOptionalNumber(value: string) {
  const normalized = value
    .trim()
    .replace(",", ".")
    .replace(/\s+/g, "");

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}

export default function CreateTaskScreen() {
  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [selectedUserId, setSelectedUserId] =
    useState<number | null>(null);

  const [userSearch, setUserSearch] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [plannedHours, setPlannedHours] =
    useState("");

  const [rewardAmount, setRewardAmount] =
    useState("");

  const [dueAt, setDueAt] =
    useState("");

  const [loadingUsers, setLoadingUsers] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      try {
        const result =
          await api<AdminUser[]>(
            "/admin/users",
          );

        if (active) {
          setUsers(
            result.filter(
              (user) => user.isActive,
            ),
          );
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
            "Не удалось загрузить пользователей",
          );
        }
      } finally {
        if (active) {
          setLoadingUsers(false);
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = userSearch
      .trim()
      .toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const fullName = [
        user.lastName,
        user.firstName,
        user.middleName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        fullName.includes(query) ||
        user.login
          .toLowerCase()
          .includes(query)
      );
    });
  }, [userSearch, users]);

  async function createTask() {
    if (saving) {
      return;
    }

    if (!selectedUserId) {
      Alert.alert(
        "Выберите сотрудника",
        "Необходимо выбрать получателя задания.",
      );
      return;
    }

    if (title.trim().length < 2) {
      Alert.alert(
        "Введите название",
        "Название должно содержать минимум 2 символа.",
      );
      return;
    }

    const reward =
      parseOptionalNumber(rewardAmount);

    if (reward === null || reward <= 0) {
      Alert.alert(
        "Укажите стоимость",
        "Стоимость задания должна быть больше нуля.",
      );
      return;
    }

    const hours =
      parseOptionalNumber(plannedHours);

    if (
      plannedHours.trim() &&
      hours === null
    ) {
      Alert.alert(
        "Проверьте часы",
        "Плановые часы указаны неверно.",
      );
      return;
    }

    if (hours !== null && hours < 0) {
      Alert.alert(
        "Проверьте часы",
        "Количество часов не может быть отрицательным.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api("/admin/tasks", {
        method: "POST",
        body: JSON.stringify({
          assignedUserId: selectedUserId,
          title: title.trim(),
          description:
            description.trim() || null,
          category:
            category.trim() || null,
          plannedHours: hours,
          rewardAmount: reward,
          dueAt:
            dueAt.trim() || null,
        }),
      });

      Alert.alert(
        "Задание создано",
        "Задание назначено сотруднику.",
        [
          {
            text: "Готово",
            onPress: () =>
              router.replace(
                "/admin/tasks",
              ),
          },
        ],
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось создать задание";

      setError(message);

      Alert.alert(
        "Ошибка",
        message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
          >
            <Text style={styles.back}>
              ‹ Назад
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Новое задание
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          <Text style={styles.sectionTitle}>
            Сотрудник
          </Text>

          <TextInput
            style={styles.input}
            value={userSearch}
            onChangeText={setUserSearch}
            placeholder="Поиск по ФИО или логину"
            placeholderTextColor="#98a39e"
            autoCapitalize="none"
          />

          {loadingUsers ? (
            <ActivityIndicator
              style={styles.loader}
              color="#16a36a"
            />
          ) : null}

          <View style={styles.userList}>
            {filteredUsers.map((user) => {
              const fullName = [
                user.lastName,
                user.firstName,
                user.middleName,
              ]
                .filter(Boolean)
                .join(" ");

              const selected =
                selectedUserId === user.id;

              return (
                <Pressable
                  key={user.id}
                  style={[
                    styles.userCard,
                    selected &&
                      styles.userCardSelected,
                  ]}
                  onPress={() =>
                    setSelectedUserId(user.id)
                  }
                >
                  <View style={styles.radio}>
                    {selected ? (
                      <View
                        style={styles.radioInner}
                      />
                    ) : null}
                  </View>

                  <View style={styles.userMain}>
                    <Text
                      style={styles.userName}
                    >
                      {fullName || user.login}
                    </Text>

                    <Text
                      style={styles.userLogin}
                    >
                      @{user.login}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>
            Задание
          </Text>

          <Text style={styles.label}>
            Название *
          </Text>

          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Введите название"
            placeholderTextColor="#98a39e"
          />

          <Text style={styles.label}>
            Описание
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.multiline,
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Что необходимо выполнить"
            placeholderTextColor="#98a39e"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            Категория
          </Text>

          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="Например: монтаж"
            placeholderTextColor="#98a39e"
          />

          <Text style={styles.label}>
            Плановые часы
          </Text>

          <TextInput
            style={styles.input}
            value={plannedHours}
            onChangeText={setPlannedHours}
            placeholder="Например: 4"
            placeholderTextColor="#98a39e"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>
            Стоимость задания *
          </Text>

          <TextInput
            style={styles.input}
            value={rewardAmount}
            onChangeText={setRewardAmount}
            placeholder="Например: 5000"
            placeholderTextColor="#98a39e"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>
            Срок выполнения
          </Text>

          <TextInput
            style={styles.input}
            value={dueAt}
            onChangeText={setDueAt}
            placeholder="2026-07-20 18:00"
            placeholderTextColor="#98a39e"
            autoCapitalize="none"
          />

          <Text style={styles.hint}>
            Формат срока: ГГГГ-ММ-ДД ЧЧ:ММ
          </Text>

          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.saveButton,
              saving && styles.disabled,
            ]}
            disabled={saving}
            onPress={() =>
              void createTask()
            }
          >
            {saving ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={styles.saveButtonText}
              >
                Создать задание
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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

  headerTitle: {
    color: "#1f2926",
    fontSize: 19,
    fontWeight: "800",
  },

  headerSpace: {
    width: 54,
  },

  content: {
    padding: 16,
    paddingBottom: 60,
  },

  sectionTitle: {
    marginTop: 10,
    marginBottom: 10,
    color: "#1f2926",
    fontSize: 18,
    fontWeight: "800",
  },

  label: {
    marginTop: 13,
    marginBottom: 6,
    color: "#4f5d57",
    fontSize: 14,
    fontWeight: "700",
  },

  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dfe8e3",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    color: "#1f2926",
    fontSize: 15,
  },

  multiline: {
    minHeight: 110,
    paddingTop: 13,
  },

  loader: {
    marginVertical: 14,
  },

  userList: {
    gap: 8,
  },

  userCard: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8e3",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },

  userCardSelected: {
    borderColor: "#16a36a",
    backgroundColor: "#ecf8f2",
  },

  radio: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    borderWidth: 2,
    borderColor: "#16a36a",
    borderRadius: 11,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16a36a",
  },

  userMain: {
    flex: 1,
  },

  userName: {
    color: "#1f2926",
    fontSize: 15,
    fontWeight: "700",
  },

  userLogin: {
    marginTop: 3,
    color: "#77837e",
    fontSize: 13,
  },

  hint: {
    marginTop: 6,
    color: "#7a8781",
    fontSize: 12,
  },

  error: {
    marginTop: 14,
    color: "#c73737",
    fontSize: 14,
  },

  saveButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#16a36a",
  },

  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },

  disabled: {
    opacity: 0.6,
  },
});
