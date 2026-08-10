import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { colors } from "@/lib/theme";
import { Redirect, Tabs } from "expo-router";
import {
  ActivityIndicator,
  type ColorValue,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TabIconProps = {
  symbol: string;
  color: ColorValue;
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
  const { user, loading } = useAuth();

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

  return (
    <AppShell>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,

          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: "#a6afaa",
          tabBarActiveBackgroundColor: colors.primarySoft,

          tabBarHideOnKeyboard: true,

          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="time"
          options={{
            title: "Время",
            tabBarIcon: ({ color }) => (
              <TabIcon
                symbol="◷"
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="tasks"
          options={{
            title: "Задания",
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
    fontSize: 11,
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
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "500",
  },

  icon: {
    fontSize: 20,
    lineHeight: 22,
  },
});
