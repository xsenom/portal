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

function avatarUri(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  return `https://test.xsenom.ru${value}`;
}

export default function ProfileScreen() {
  const {
    user,
    logout,
    refresh,
  } = useAuth();

  const [summary, setSummary] =
    useState<ProfileSummary | null>(null);

  const [loadingSummary, setLoadingSummary] =
    useState(true);

  const [avatarBusy, setAvatarBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const fullName = [
    user?.lastName,
    user?.firstName,
    user?.middleName,
  ]
    .filter(Boolean)
    .join(" ");

  const initials = `${user?.lastName?.[0] ?? ""}${
    user?.firstName?.[0] ?? ""
  }`.toUpperCase() || "П";

  const imageUri = useMemo(
    () => avatarUri(user?.avatarUrl),
    [user?.avatarUrl],
  );

  const loadSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);

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
          : "Не удалось загрузить показатели",
      );
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary]),
  );

  async function chooseAvatar() {
    if (avatarBusy) {
      return;
    }

    try {
      setAvatarBusy(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Нет доступа",
          "Разрешите доступ к фотографиям.",
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.55,
          base64: true,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.base64) {
        throw new Error(
          "Не удалось прочитать фотографию",
        );
      }

      const mimeType =
        asset.mimeType ?? "image/jpeg";

      await api("/profile/avatar", {
        method: "POST",
        body: JSON.stringify({
          dataUrl:
            `data:${mimeType};base64,`
            + asset.base64,
        }),
      });

      await refresh();

      Alert.alert(
        "Готово",
        "Аватар обновлён.",
      );
    } catch (caughtError) {
      Alert.alert(
        "Ошибка",
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось обновить аватар",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Профиль
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.profileSummary}>
          <Pressable
            style={styles.avatar}
            disabled={avatarBusy}
            onPress={() => void chooseAvatar()}
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

          <View style={styles.profileName}>
            <Text style={styles.fullName}>
              {fullName || user?.login || "Профиль"}
            </Text>

            <Pressable
              onPress={() => {
                router.push(
                  "/profile-details" as Href,
                );
              }}
            >
              <Text style={styles.detailsLink}>
                Подробнее ›
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hoursCard}>
          <Text style={styles.hoursIcon}>
            ◷
          </Text>

          <View style={styles.hoursMain}>
            {loadingSummary ? (
              <ActivityIndicator
                color={colors.white}
              />
            ) : (
              <>
                <Text style={styles.hoursTitle}>
                  {summary?.hoursWorked ?? 0} ч
                </Text>

                <Text style={styles.hoursText}>
                  Отработано в этом месяце
                  {summary?.hoursNorm !== null &&
                  summary?.hoursNorm !== undefined
                    ? ` из ${summary.hoursNorm} ч`
                    : ""}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <Text style={styles.cardTitle}>
              Показатели
            </Text>

            <Pressable
              onPress={() => void loadSummary()}
            >
              <Text style={styles.detailsLink}>
                Обновить
              </Text>
            </Pressable>
          </View>

          <View style={styles.indicators}>
            <Indicator
              value={summary?.completedShifts ?? 0}
              label="смен"
            />

            <Indicator
              value={summary?.finesCount ?? 0}
              label="штрафы"
              border
            />

            <Indicator
              value={`${summary?.hourlyRate ?? 0} ₽`}
              label="ставка/час"
              border
            />
          </View>

          <View style={styles.indicatorsSecond}>
            <Indicator
              value={summary?.activeRequests ?? 0}
              label="в работе"
            />

            <Indicator
              value={summary?.completedRequests ?? 0}
              label="выполнено"
              border
            />

            <Indicator
              value={summary?.archiveRequests ?? 0}
              label="в архиве"
              border
            />
          </View>
        </View>

        {user?.role === "Admin" && (
          <Pressable
            style={styles.adminButton}
            onPress={() => {
              router.push("/admin" as Href);
            }}
          >
            <View style={styles.adminIcon}>
              <Text style={styles.adminIconText}>
                ⚙
              </Text>
            </View>

            <View style={styles.adminText}>
              <Text style={styles.adminTitle}>
                Админка
              </Text>

              <Text style={styles.adminCaption}>
                Пользователи, роли, задания и сообщения
              </Text>
            </View>

            <Text style={styles.adminArrow}>
              ›
            </Text>
          </Pressable>
        )}

        <View style={styles.linkList}>
          <Pressable
            style={styles.linkRow}
            onPress={() => {
              router.push(
                "/data-processing" as Href,
              );
            }}
          >
            <Text style={styles.linkText}>
              Обработка данных и местоположения
            </Text>

            <Text style={styles.linkArrow}>
              ›
            </Text>
          </Pressable>

          <Pressable
            style={styles.linkRow}
            onPress={() => void handleLogout()}
          >
            <Text style={styles.logoutText}>
              Выйти из профиля
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Indicator({
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
        styles.indicatorColumn,
        border && styles.indicatorBorder,
      ]}
    >
      <Text style={styles.indicatorValue}>
        {value}
      </Text>

      <Text style={styles.indicatorLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  header: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 35,
  },

  errorBox: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 9,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: colors.danger,
    fontSize: 13,
  },

  profileSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 16,
  },

  avatar: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 33,
    backgroundColor: colors.graphite,
  },

  avatarImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },

  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
  },

  camera: {
    width: 27,
    height: 27,
    position: "absolute",
    right: -2,
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
    fontSize: 12,
  },

  profileName: {
    flex: 1,
    gap: 6,
  },

  fullName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "600",
  },

  detailsLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  hoursCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 15,
    padding: 18,
    borderRadius: 11,
    backgroundColor: colors.graphite,
  },

  hoursIcon: {
    color: colors.white,
    fontSize: 32,
  },

  hoursMain: {
    flex: 1,
  },

  hoursTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "700",
  },

  hoursText: {
    marginTop: 4,
    color: "#b7c1bc",
    fontSize: 12,
  },

  card: {
    marginBottom: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  cardHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },

  indicators: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },

  indicatorsSecond: {
    flexDirection: "row",
    marginTop: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },

  indicatorColumn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 5,
    alignItems: "center",
  },

  indicatorBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },

  indicatorValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  indicatorLabel: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: "center",
  },

  adminButton: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.graphite,
  },

  adminIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.primary,
  },

  adminIconText: {
    color: colors.white,
    fontSize: 21,
  },

  adminText: {
    flex: 1,
  },

  adminTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },

  adminCaption: {
    marginTop: 3,
    color: "#b8c2bd",
    fontSize: 11,
  },

  adminArrow: {
    color: colors.white,
    fontSize: 23,
  },

  linkList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  linkRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  linkText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
  },

  linkArrow: {
    color: colors.textSecondary,
    fontSize: 18,
  },

  logoutText: {
    color: colors.danger,
    fontSize: 13,
  },
});
