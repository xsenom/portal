import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

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
        <View style={styles.profileSummary}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials}
            </Text>

            <View style={styles.camera}>
              <Text style={styles.cameraText}>
                ◉
              </Text>
            </View>
          </View>

          <View style={styles.profileName}>
            <Text style={styles.fullName}>
              {fullName || user?.login || "Профиль"}
            </Text>

            <Text style={styles.detailsLink}>
              Подробнее ›
            </Text>
          </View>
        </View>

        <View style={styles.hoursCard}>
          <Text style={styles.hoursIcon}>
            ◷
          </Text>

          <View>
            <Text style={styles.hoursTitle}>
              Нет данных
            </Text>

            <Text style={styles.hoursText}>
              показатели ещё не заполнены
            </Text>
          </View>

          <View style={styles.hoursPattern}>
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                style={[
                  styles.hoursPatternLine,
                  {
                    left: index * 18,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <Text style={styles.cardTitle}>
              Показатели
            </Text>

            <Text style={styles.detailsLink}>
              Подробнее ›
            </Text>
          </View>

          <View style={styles.indicators}>
            <View style={styles.indicatorColumn}>
              <Text style={styles.indicatorValue}>
                —
              </Text>

              <Text style={styles.indicatorLabel}>
                штрафы
              </Text>
            </View>

            <View
              style={[
                styles.indicatorColumn,
                styles.indicatorColumnBorder,
              ]}
            >
              <Text style={styles.indicatorValue}>
                —
              </Text>

              <Text style={styles.indicatorLabel}>
                ЗП в час
              </Text>
            </View>
          </View>
        </View>

        {user?.role === "Admin" && (
          <Pressable style={styles.adminButton}>
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
                Управление пользователями и
                показателями
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
            onPress={() =>
              void handleLogout()
            }
          >
            <Text style={styles.logoutText}>
              Выйти из профиля
            </Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>
              Обработка данных и местоположения
            </Text>

            <Text style={styles.linkArrow}>
              ›
            </Text>
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: colors.surface,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  profileSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 15,
  },

  avatar: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 31,
    backgroundColor: "#56615d",
  },

  avatarText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
  },

  camera: {
    width: 25,
    height: 25,
    position: "absolute",
    right: -2,
    bottom: 2,
    alignItems: "center",
    justifyContent: "center",

    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 13,
    backgroundColor: colors.primary,
  },

  cameraText: {
    color: colors.white,
    fontSize: 10,
  },

  profileName: {
    minWidth: 0,
    flex: 1,
    gap: 5,
  },

  fullName: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "600",
  },

  detailsLink: {
    color: colors.primary,
    fontSize: 11,
  },

  hoursCard: {
    minHeight: 83,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 15,
    paddingHorizontal: 18,
    paddingVertical: 16,

    borderRadius: 10,
    backgroundColor: colors.graphite,
  },

  hoursIcon: {
    zIndex: 2,
    color: colors.white,
    fontSize: 29,
  },

  hoursTitle: {
    zIndex: 2,
    marginBottom: 5,
    color: colors.white,
    fontSize: 17,
    fontWeight: "500",
  },

  hoursText: {
    zIndex: 2,
    color: "#b7c1bc",
    fontSize: 10,
  },

  hoursPattern: {
    width: 105,
    height: 130,
    position: "absolute",
    top: -24,
    right: -26,
    overflow: "hidden",

    transform: [
      {
        rotate: "-35deg",
      },
    ],
  },

  hoursPatternLine: {
    width: 6,
    height: 150,
    position: "absolute",
    top: -10,
    backgroundColor: colors.primary,
  },

  card: {
    marginBottom: 14,
    padding: 14,

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,

    shadowColor: colors.graphite,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.05,
    shadowRadius: 11,
    elevation: 1,
  },

  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  indicators: {
    flexDirection: "row",

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
  },

  indicatorColumn: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },

  indicatorColumnBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },

  indicatorValue: {
    marginBottom: 5,
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },

  indicatorLabel: {
    color: colors.textSecondary,
    fontSize: 9,
  },

  adminButton: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,

    borderRadius: 9,
    backgroundColor: colors.graphite,
  },

  adminIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 8,
    backgroundColor: colors.primary,
  },

  adminIconText: {
    color: colors.white,
    fontSize: 19,
  },

  adminText: {
    minWidth: 0,
    flex: 1,
    gap: 4,
  },

  adminTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },

  adminCaption: {
    color: "#b8c2bd",
    fontSize: 9,
    lineHeight: 12,
  },

  adminArrow: {
    color: colors.white,
    fontSize: 21,
  },

  linkList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  linkRow: {
    minHeight: 41,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  linkText: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  logoutText: {
    color: colors.danger,
    fontSize: 11,
  },

  linkArrow: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
