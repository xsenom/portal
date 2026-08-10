import { colors } from "@/lib/theme";
import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppBackHeaderProps = {
  title: string;
  onBack?: () => void;
};

export function AppBackHeader({
  title,
  onBack,
}: AppBackHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop:
            Math.max(insets.top, 20) + 8,
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          style={styles.backButton}
          hitSlop={12}
          onPress={
            onBack ??
            (() => {
              router.back();
            })
          }
        >
          <Text style={styles.backText}>
            ‹ Назад
          </Text>
        </Pressable>

        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>

        <View style={styles.side} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    minWidth: 86,
    minHeight: 42,
    justifyContent: "center",
  },

  backText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },

  title: {
    flex: 1,
    marginHorizontal: 7,
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  side: {
    width: 86,
  },
});
