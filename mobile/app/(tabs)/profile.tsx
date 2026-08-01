import {
  api,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import * as ImagePicker from "expo-image-picker";
import {
  type Href,
  router,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ProfileSummary = {
  month: number;
  year: number;
  workSeconds: number;
  hoursWorked: number;
  hoursNorm: number | null;
  hourlyRate: number;
  completedShifts: number;
  finesCount: number;
  finesAmount: number;
  activeRequests: number;
  completedRequests: number;
  archiveRequests: number;
  activeShift: {
    id: number;
    status: string;
    startedAt: string;
  } | null;
};

type ExtendedUser = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  serviceRole?: string | null;
  position?: string | null;
  category?: string | null;
  employmentDate?: string | null;
  avatarUrl?: string | null;
};

function avatarUri(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://")
    || value.startsWith("https://")
    || value.startsWith("data:")
  ) {
    return value;
  }

  return `https://test.xsenom.ru${value}`;
}

export default function ProfileScreen() {
  const {
    user: authUser,
    refresh,
    logout,
  } = useAuth();

  const user =
    authUser as ExtendedUser | null;

  const [summary, setSummary] =
    useState<ProfileSummary | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [avatarBusy, setAvatarBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const result =
        await api<ProfileSummary>(
          "/profile/summary",
        );

      setSummary(result);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось загрузить статистику",
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

  const fullName = [
    user?.lastName,
    user?.firstName,
    user?.middleName,
  ]
    .filter(Boolean)
    .join(" ");

  const initials =
    `${user?.lastName?.[0] ?? ""}${
      user?.firstName?.[0] ?? ""
    }`.toUpperCase() || "П";

  const imageUri = useMemo(
    () => avatarUri(
      user?.avatarUrl,
    ),
    [user?.avatarUrl],
  );

  async function chooseAvatar() {
    if (avatarBusy) {
      return;
    }

    try {
      setAvatarBusy(true);

      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Нет доступа",
          "Разрешите приложению доступ к фотографиям.",
        );

        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync({
            mediaTypes:
              ImagePicker
                .MediaTypeOptions
                .Images,

            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
            base64: true,
          });

      if (result.canceled) {
        return;
      }

      const asset =
        result.assets[0];

      if (!asset.base64) {
        throw new Error(
          "Не удалось прочитать фотографию",
        );
      }

      const mimeType =
        asset.mimeType
        ?? "image/jpeg";

      await api(
        "/profile/avatar",
        {
          method: "POST",
          body: JSON.stringify({
            dataUrl:
              `data:${mimeType};base64,`
              + asset.base64,
          }),
        },
      );

      await refresh();

      Alert.alert(
        "Готово",
        "Фото профиля обновлено.",
      );
    } catch (caughtError) {
      Alert.alert(
        "Ошибка",
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось обновить фото",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function leaveProfile() {
    await logout();

    router.replace(
      "/login" as unknown as Href,
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Профиль
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.profile}>
          <Pressable
            style={styles.avatar}
            disabled={avatarBusy}
            onPress={() =>
              void chooseAvatar()
            }
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {initials}
              </Text>
            )}

            <View style={styles.camera}>
              {avatarBusy ? (
                <ActivityIndicator
                  size="small"
                  color={colors.white}
                />
              ) : (
                <Text style={styles.cameraText}>
                  ◉
                </Text>
              )}
            </View>
          </Pressable>

          <View style={styles.profileMain}>
            <Text style={styles.fullName}>
              {fullName
                || user?.login
                || "Пользователь"}
            </Text>

            <Text style={styles.position}>
              {user?.position
                ?? user?.serviceRole
                ?? "Техник"}
            </Text>

            <Text style={styles.email}>
              {user?.email ?? ""}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.closedButton}
          onPress={() => {
            router.push(
              "/my-closed-requests"
                as unknown as Href,
            );
          }}
        >
          <View style={styles.closedIcon}>
            <Text style={styles.closedIconText}>
              ✓
            </Text>
          </View>

          <View style={styles.closedMain}>
            <Text style={styles.closedTitle}>
              Мои закрытые заявки
            </Text>

            <Text style={styles.closedCaption}>
              Просмотр выполненных и закрытых
              заявок
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              Моя статистика
            </Text>

            <Pressable
              onPress={() => void load()}
            >
              <Text style={styles.refresh}>
                Обновить
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator
              color={colors.primary}
            />
          ) : (
            <>
              <View style={styles.stats}>
                <Stat
                  value={
                    summary?.completedRequests
                    ?? 0
                  }
                  label="Выполнено"
                />

                <Stat
                  value={
                    summary?.activeRequests
                    ?? 0
                  }
                  label="В работе"
                  border
                />

                <Stat
                  value={
                    summary?.archiveRequests
                    ?? 0
                  }
                  label="В архиве"
                  border
                />
              </View>

              <View style={styles.statsSecond}>
                <Stat
                  value={
                    summary?.completedShifts
                    ?? 0
                  }
                  label="Смен"
                />

                <Stat
                  value={`${summary?.hoursWorked ?? 0}`}
                  label="Часов"
                  border
                />

                <Stat
                  value={
                    summary?.finesCount
                    ?? 0
                  }
                  label="Штрафов"
                  border
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Личные данные
          </Text>

          <DataRow
            label="Логин"
            value={user?.login ?? "—"}
          />

          <DataRow
            label="Должность"
            value={
              user?.position
              ?? "Не указана"
            }
          />

          <DataRow
            label="Категория"
            value={
              user?.category
              ?? "Не указана"
            }
          />

          <DataRow
            label="Роль"
            value={
              user?.serviceRole
              ?? (
                user?.role === "Admin"
                  ? "Администратор"
                  : "Техник"
              )
            }
          />
        </View>

        {user?.role === "Admin" && (
          <Pressable
            style={styles.adminButton}
            onPress={() => {
              router.push(
                "/admin"
                  as unknown as Href,
              );
            }}
          >
            <Text style={styles.adminIcon}>
              ⚙
            </Text>

            <View style={styles.adminMain}>
              <Text style={styles.adminTitle}>
                Админка
              </Text>

              <Text style={styles.adminCaption}>
                Пользователи, роли, заявки
                и сообщения
              </Text>
            </View>

            <Text style={styles.adminArrow}>
              ›
            </Text>
          </Pressable>
        )}

        <Pressable
          style={styles.linkRow}
          onPress={() => {
            router.push(
              "/data-processing"
                as unknown as Href,
            );
          }}
        >
          <Text style={styles.linkText}>
            Обработка данных и местоположения
          </Text>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>

        <Pressable
          style={styles.logout}
          onPress={() =>
            void leaveProfile()
          }
        >
          <Text style={styles.logoutText}>
            Выйти из профиля
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({
  value,
  label,
  border = false,
}: {
  value: string | number;
  label: string;
  border?: boolean;
}) {
  return (
    <View
      style={[
        styles.stat,
        border && styles.statBorder,
      ]}
    >
      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>
        {label}
      </Text>

      <Text style={styles.dataValue}>
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
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },

  content: {
    padding: 15,
    paddingBottom: 40,
  },

  errorBox: {
    marginBottom: 11,
    padding: 10,
    borderRadius: 9,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
  },

  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 17,
  },

  avatar: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
    backgroundColor: colors.graphite,
  },

  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },

  avatarText: {
    color: colors.white,
    fontSize: 21,
    fontWeight: "900",
  },

  camera: {
    width: 28,
    height: 28,
    position: "absolute",
    right: -1,
    bottom: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },

  cameraText: {
    color: colors.white,
    fontSize: 11,
  },

  profileMain: {
    flex: 1,
  },

  fullName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },

  position: {
    marginTop: 5,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  email: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 11,
  },

  closedButton: {
    minHeight: 75,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    padding: 13,
    borderRadius: 13,
    backgroundColor: colors.graphite,
  },

  closedIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.primary,
  },

  closedIconText: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "900",
  },

  closedMain: {
    flex: 1,
  },

  closedTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  closedCaption: {
    marginTop: 4,
    color: "#bbc5c0",
    fontSize: 10,
  },

  arrow: {
    color: colors.textSecondary,
    fontSize: 22,
  },

  card: {
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  refresh: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },

  stats: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },

  statsSecond: {
    flexDirection: "row",
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },

  stat: {
    minHeight: 65,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  statBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },

  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  statLabel: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 9,
  },

  dataRow: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  dataLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  dataValue: {
    maxWidth: "60%",
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },

  adminButton: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    padding: 13,
    borderRadius: 13,
    backgroundColor: colors.graphite,
  },

  adminIcon: {
    fontSize: 24,
  },

  adminMain: {
    flex: 1,
  },

  adminTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  adminCaption: {
    marginTop: 3,
    color: "#bbc5c0",
    fontSize: 10,
  },

  adminArrow: {
    color: colors.white,
    fontSize: 22,
  },

  linkRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  linkText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
  },

  logout: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  logoutText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
});
