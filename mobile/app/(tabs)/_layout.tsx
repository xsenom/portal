import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import {
  Redirect,
  Tabs,
  usePathname,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  type ColorValue,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TabIconProps = {
  symbol: string;
  color: ColorValue;
};

type UnreadResponse = {
  unreadCount: number;
};

function TabIcon({
  symbol,
  color,
}: TabIconProps) {
  return (
    <Text
      style={[
        styles.icon,
        {
          color,
        },
      ]}
    >
      {symbol}
    </Text>
  );
}

export default function TabsLayout() {
  const {
    user,
    loading,
  } = useAuth();

  const pathname = usePathname();

  const [unreadCount, setUnreadCount] =
    useState(0);

  const loadUnread = useCallback(
    async () => {
      if (!user) {
        setUnreadCount(0);
        return;
      }

      try {
        const result =
          await api<UnreadResponse>(
            "/support/unread",
          );

        const nextCount = Number(
          result.unreadCount ?? 0,
        );

        setUnreadCount(
          Number.isFinite(nextCount)
            ? Math.max(0, nextCount)
            : 0,
        );
      } catch {
        /*
         * Ошибка счётчика не должна
         * блокировать остальные вкладки.
         */
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    void loadUnread();

    const timer = setInterval(() => {
      void loadUnread();
    }, 10000);

    const subscription =
      AppState.addEventListener(
        "change",
        (nextState) => {
          if (nextState === "active") {
            void loadUnread();
          }
        },
      );

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [
    user,
    loadUnread,
  ]);

  useEffect(() => {
    if (user) {
      void loadUnread();
    }
  }, [
    pathname,
    user,
    loadUnread,
  ]);

  if (loading) {
    return (
      <AppShell>
        <View style={styles.loading}>
          <ActivityIndicator
            size="small"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Загружаем данные…
          </Text>
        </View>
      </AppShell>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const badgeValue =
    unreadCount > 99
      ? "99+"
      : unreadCount > 0
        ? unreadCount
        : undefined;

  return (
    <AppShell>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,

          tabBarActiveTintColor:
            colors.primary,

          tabBarInactiveTintColor:
            "#a6afaa",

          tabBarActiveBackgroundColor:
            colors.primarySoft,

          tabBarHideOnKeyboard: true,

          tabBarStyle:
            styles.tabBar,

          tabBarItemStyle:
            styles.tabItem,

          tabBarLabelStyle:
            styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="time"
          options={{
            title: "Главная",

            tabBarIcon: ({ color }) => (
              <TabIcon
                symbol="⌂"
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="tasks"
          options={{
            title: "Заявки",

            tabBarIcon: ({ color }) => (
              <TabIcon
                symbol="☷"
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="chat"
          options={{
            title: "Сообщить о",

            tabBarBadge:
              badgeValue,

            tabBarBadgeStyle:
              styles.badge,

            tabBarAccessibilityLabel:
              unreadCount > 0
                ? `Сообщить о, новых ответов: ${unreadCount}`
                : "Сообщить о",

            tabBarIcon: ({ color }) => (
              <TabIcon
                symbol="✉"
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Профиль",

            tabBarIcon: ({ color }) => (
              <TabIcon
                symbol="○"
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.surface,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  tabBar: {
    height: 72,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,

    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,

    shadowOpacity: 0,
    elevation: 0,
  },

  tabItem: {
    minHeight: 50,
    marginHorizontal: 4,
    borderRadius: 12,
  },

  tabLabel: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 10,
    fontWeight: "500",
  },

  icon: {
    fontSize: 22,
    lineHeight: 22,
  },

  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,

    color: "#ffffff",
    backgroundColor: colors.danger,

    fontSize: 10,
    lineHeight: 16,
    fontWeight: "800",
  },
});
