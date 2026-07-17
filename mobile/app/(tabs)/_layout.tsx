import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#1f7a55" }}>
      <Tabs.Screen name="time" options={{ title: "Время" }} />
      <Tabs.Screen name="tasks" options={{ title: "Задания" }} />
      <Tabs.Screen name="profile" options={{ title: "Профиль" }} />
    </Tabs>
  );
}
