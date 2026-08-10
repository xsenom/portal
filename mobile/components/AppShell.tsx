import type { ReactNode } from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, layout } from "@/lib/theme";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const compact = width <= 480;

  return (
    <View
      style={[
        styles.viewport,
        compact && styles.viewportCompact,
      ]}
    >
      <View
        style={[
          styles.shell,
          compact && styles.shellCompact,
          compact && {
            paddingTop: insets.top,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: colors.background,
  },

  viewportCompact: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: colors.surface,
  },

  shell: {
    width: "100%",
    maxWidth: layout.maxWidth,
    flex: 1,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.surface,

    shadowColor: colors.graphite,
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 9,
  },

  shellCompact: {
    maxWidth: "100%",
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});
