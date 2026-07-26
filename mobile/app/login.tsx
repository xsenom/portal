import { Linking as NativeLinking } from "react-native";
import { router as nativeRouter } from "expo-router";
import { AppShell } from "@/components/AppShell";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();

  const [loginValue, setLoginValue] =
    useState("");
  const [password, setPassword] =
    useState("");

  const [passwordVisible, setPasswordVisible] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [serverError, setServerError] =
    useState("");

  const loginError =
    submitted && loginValue.trim().length < 3
      ? "Введите корректный логин"
      : "";

  const passwordError =
    submitted && password.length < 6
      ? "Пароль должен содержать не менее 6 символов"
      : "";

  const valid =
    loginValue.trim().length >= 3 &&
    password.length >= 6;

  async function submit() {
    setSubmitted(true);
    setServerError("");

    if (!valid || busy) {
      return;
    }

    setBusy(true);

    try {
      await login(
        loginValue.trim(),
        password,
      );

      router.replace("/(tabs)/profile");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401
      ) {
        setServerError(
          "Неверный логин или пароль",
        );
      } else if (
        error instanceof ApiError &&
        error.status === 403
      ) {
        setServerError(
          error.message || "Аккаунт отключён",
        );
      } else {
        setServerError(
          error instanceof Error
            ? error.message
            : "Не удалось выполнить вход",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            Авторизация
          </Text>

          <View style={styles.form}>
            <Field
              label="Логин"
              value={loginValue}
              error={loginError}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => {
                setLoginValue(value);
                setServerError("");
              }}
            />

            <Field
              label="Пароль"
              value={password}
              error={passwordError}
              secureTextEntry={!passwordVisible}
              onChangeText={(value) => {
                setPassword(value);
                setServerError("");
              }}
              trailing={
                <Pressable
                  style={styles.eyeButton}
                  onPress={() =>
                    setPasswordVisible(
                      (current) => !current,
                    )
                  }
                >
                  <Text style={styles.eyeText}>
                    {passwordVisible ? "●" : "◉"}
                  </Text>
                </Pressable>
              }
            />

            <Pressable>
              <Text style={styles.forgot}>
                Забыли пароль?
              </Text>
            </Pressable>

            {!!serverError && (
              <View style={styles.serverError}>
                <Text
                  style={styles.serverErrorText}
                >
                  {serverError}
                </Text>
              </View>
            )}

            <Pressable
              style={[
                styles.primaryButton,
                (!valid || busy) &&
                  styles.primaryButtonDisabled,
              ]}
              disabled={!valid || busy}
              onPress={() => void submit()}
            >
              <Text style={styles.primaryButtonText}>
                {busy ? "Входим…" : "Войти"}
              </Text>
            </Pressable>

            <Text style={styles.switchText}>
              Нет аккаунта?{" "}
              <Text style={styles.linkText}
                onPress={() => nativeRouter.push("/register")}
>
                Зарегистрироваться
              </Text>
            </Text>

            <Text style={styles.legal}>
              Нажимая кнопку «Войти», вы принимаете{" "}
              <Text style={styles.legalLink}
                onPress={() => void NativeLinking.openURL('https://test.xsenom.ru/terms')}
>
                условия обработки персональных данных
              </Text>{" "}
              и даёте согласие на использование
              мессенджера.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

type FieldProps = {
  label: string;
  value: string;
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  trailing?: React.ReactNode;
  onChangeText: (value: string) => void;
};

function Field({
  label,
  value,
  error,
  trailing,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <View
        style={[
          styles.inputWrap,
          !!error && styles.inputWrapError,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          onChangeText={onChangeText}
        />

        {trailing}
      </View>

      {!!error && (
        <Text style={styles.fieldError}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 28,
    backgroundColor: colors.surface,
  },

  title: {
    marginBottom: 28,
    color: colors.text,
    fontSize: 32,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
  },

  form: {
    width: "100%",
    gap: 15,
  },

  field: {
    width: "100%",
    gap: 7,
  },

  label: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 15,
  },

  inputWrap: {
    width: "100%",
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },

  inputWrapError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },

  input: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 16,
  },

  eyeButton: {
    width: 42,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  eyeText: {
    color: colors.graphite,
    fontSize: 18,
  },

  fieldError: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 14,
  },

  forgot: {
    alignSelf: "flex-start",
    color: colors.primary,
    fontSize: 15,
    lineHeight: 16,
    fontWeight: "500",
  },

  serverError: {
    paddingHorizontal: 12,
    paddingVertical: 10,

    borderWidth: 1,
    borderColor: "#f2c8cc",
    borderRadius: 7,
    backgroundColor: colors.dangerSoft,
  },

  serverErrorText: {
    color: "#a52d36",
    fontSize: 13,
    lineHeight: 15,
  },

  primaryButton: {
    width: "100%",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
    paddingHorizontal: 18,
    paddingVertical: 12,

    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: colors.primary,

    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },

  primaryButtonDisabled: {
    borderColor: colors.disabled,
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "500",
  },

  switchText: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 18,
    textAlign: "center",
  },

  linkText: {
    color: colors.primary,
    fontWeight: "500",
  },

  legal: {
    marginTop: -2,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 14,
  },

  legalLink: {
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
