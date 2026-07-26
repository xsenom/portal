import { colors } from "@/lib/theme";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ACCESSORY_ID =
  "portal-keyboard-done-accessory";

export const keyboardAccessoryId =
  Platform.OS === "ios"
    ? ACCESSORY_ID
    : undefined;

export function KeyboardDoneBar() {
  if (Platform.OS !== "ios") {
    return null;
  }

  return (
    <InputAccessoryView nativeID={ACCESSORY_ID}>
      <View style={styles.bar}>
        <View />

        <Pressable
          style={styles.button}
          onPress={Keyboard.dismiss}
        >
          <Text style={styles.buttonText}>
            Готово
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  button: {
    minWidth: 70,
    minHeight: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  buttonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
