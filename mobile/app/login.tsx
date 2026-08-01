import {
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import {
  type Href,
  Redirect,
  router,
} from "expo-router";
import {
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LoginScreen() {
  const {
    user,
    loading,
    login,
  } = useAuth();

  const [loginValue, setLoginValue] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [passwordVisible, setPasswordVisible] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (user) {
    return (
      <Redirect href="/(tabs)/time" />
    );
  }

  async function submit() {
    const cleanLogin =
      loginValue.trim();

    if (!cleanLogin) {
      setError(
        "Введите email, телефон или логин",
      );

      return;
    }

    if (!password) {
      setError("Введите пароль");
      return;
    }

    if (submitting) {
      return;
    }

    try {
      Keyboard.dismiss();
      setSubmitting(true);
      setError("");

      await login(
        cleanLogin,
        password,
      );

      router.replace(
        "/(tabs)/time" as unknown as Href,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : caughtError instanceof Error
            ? caughtError.message
            : "Не удалось выполнить вход",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <Pressable
          style={styles.page}
          onPress={Keyboard.dismiss}
        >
          <ScrollView
            contentContainerStyle={
              styles.content
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>
                  VS
                </Text>
              </View>

              <Text style={styles.title}>
                VolgaShield
              </Text>

              <Text style={styles.subtitle}>
                Техническое обслуживание
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Вход в приложение
              </Text>

              <Text style={styles.label}>
                Логин
              </Text>

              <TextInput
                style={styles.input}
                value={loginValue}
                onChangeText={setLoginValue}
                placeholder="Email, телефон или логин"
                placeholderTextColor="#98a39e"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                textContentType="username"
              />

              <Text style={styles.label}>
                Пароль
              </Text>

              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Введите пароль"
                  placeholderTextColor="#98a39e"
                  secureTextEntry={
                    !passwordVisible
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  textContentType="password"
                  onSubmitEditing={() =>
                    void submit()
                  }
                />

                <Pressable
                  style={styles.passwordButton}
                  hitSlop={8}
                  onPress={() =>
                    setPasswordVisible(
                      (value) => !value,
                    )
                  }
                >
                  <Text
                    style={
                      styles.passwordButtonText
                    }
                  >
                    {passwordVisible
                      ? "Скрыть"
                      : "Показать"}
                  </Text>
                </Pressable>
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.loginButton,
                  submitting &&
                    styles.disabled,
                ]}
                disabled={submitting}
                onPress={() => void submit()}
              >
                {submitting ? (
                  <ActivityIndicator
                    color={colors.white}
                  />
                ) : (
                  <Text
                    style={
                      styles.loginButtonText
                    }
                  >
                    Войти
                  </Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.authNote}>
              Сейчас используется авторизация
              сервера приложения. Подключение
              Bitrix24 будет выполнено отдельным
              провайдером без изменения этого
              экрана.
            </Text>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 32,
  },

  brand: {
    alignItems: "center",
    marginBottom: 26,
  },

  logo: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.primary,
  },

  logoText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "900",
  },

  title: {
    marginTop: 15,
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 13,
  },

  card: {
    padding: 19,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  cardTitle: {
    marginBottom: 18,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },

  label: {
    marginBottom: 7,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },

  input: {
    minHeight: 51,
    marginBottom: 15,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },

  passwordWrap: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },

  passwordInput: {
    minHeight: 49,
    flex: 1,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 15,
  },

  passwordButton: {
    minHeight: 49,
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  passwordButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  errorBox: {
    marginBottom: 13,
    padding: 10,
    borderRadius: 9,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },

  loginButton: {
    minHeight: 53,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  loginButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },

  disabled: {
    opacity: 0.55,
  },

  authNote: {
    marginTop: 18,
    paddingHorizontal: 12,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
