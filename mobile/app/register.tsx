import {
  api,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
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

export default function RegisterScreen() {
  const { login } = useAuth();

  const [lastName, setLastName] =
    useState("");
  const [firstName, setFirstName] =
    useState("");
  const [middleName, setMiddleName] =
    useState("");
  const [loginValue, setLoginValue] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [passwordRepeat, setPasswordRepeat] =
    useState("");
  const [accepted, setAccepted] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [error, setError] =
    useState("");

  const emailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.trim(),
    );

  const formValid =
    lastName.trim().length >= 2 &&
    firstName.trim().length >= 2 &&
    loginValue.trim().length >= 3 &&
    emailValid &&
    password.length >= 6 &&
    passwordRepeat === password &&
    accepted;

  async function submit() {
    if (busy) {
      return;
    }

    setError("");

    if (!formValid) {
      if (lastName.trim().length < 2) {
        setError("Введите фамилию");
        return;
      }

      if (firstName.trim().length < 2) {
        setError("Введите имя");
        return;
      }

      if (loginValue.trim().length < 3) {
        setError(
          "Логин должен содержать не менее 3 символов",
        );
        return;
      }

      if (!emailValid) {
        setError("Введите корректный e-mail");
        return;
      }

      if (password.length < 6) {
        setError(
          "Пароль должен содержать не менее 6 символов",
        );
        return;
      }

      if (passwordRepeat !== password) {
        setError("Пароли не совпадают");
        return;
      }

      if (!accepted) {
        setError(
          "Необходимо принять условия обработки данных",
        );
        return;
      }
    }

    setBusy(true);

    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          login: loginValue.trim(),
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName:
            middleName.trim() || null,
          password,
        }),
      });

      await login(
        loginValue.trim(),
        password,
      );

      router.replace("/(tabs)/time");
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(
          caughtError.message ||
            "Не удалось зарегистрироваться",
        );
      } else if (
        caughtError instanceof Error
      ) {
        setError(caughtError.message);
      } else {
        setError(
          "Не удалось зарегистрироваться",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.replace("/login")
            }
          >
            <Text style={styles.backText}>
              ← Вернуться
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Регистрация
          </Text>

          <Field
            label="Фамилия"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          <Field
            label="Имя"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <Field
            label="Отчество"
            value={middleName}
            onChangeText={setMiddleName}
            autoCapitalize="words"
          />

          <Field
            label="Логин"
            value={loginValue}
            onChangeText={setLoginValue}
            autoCapitalize="none"
          />

          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Field
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Field
            label="Повторите пароль"
            value={passwordRepeat}
            onChangeText={setPasswordRepeat}
            secureTextEntry
          />

          <Pressable
            style={styles.acceptRow}
            onPress={() =>
              setAccepted(
                (current) => !current,
              )
            }
          >
            <View
              style={[
                styles.checkbox,
                accepted &&
                  styles.checkboxActive,
              ]}
            >
              {accepted ? (
                <Text
                  style={
                    styles.checkboxMark
                  }
                >
                  ✓
                </Text>
              ) : null}
            </View>

            <Text style={styles.acceptText}>
              Я принимаю условия обработки
              персональных данных
            </Text>
          </Pressable>

          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.button,
              (!formValid || busy) &&
                styles.buttonDisabled,
            ]}
            onPress={() => void submit()}
            disabled={!formValid || busy}
          >
            <Text style={styles.buttonText}>
              {busy
                ? "Регистрируем…"
                : "Зарегистрироваться"}
            </Text>
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginCaption}>
              Уже есть аккаунт?
            </Text>

            <Pressable
              onPress={() =>
                router.replace("/login")
              }
            >
              <Text style={styles.loginLink}>
                Войти
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (
    value: string,
  ) => void;
  secureTextEntry?: boolean;
  autoCapitalize?:
    | "none"
    | "sentences"
    | "words"
    | "characters";
  keyboardType?:
    | "default"
    | "email-address";
};

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  autoCapitalize = "sentences",
  keyboardType = "default",
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={
          secureTextEntry
        }
        autoCapitalize={
          autoCapitalize
        }
        keyboardType={keyboardType}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f8f6",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },

  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe8e3",
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },

  backText: {
    color: "#16a36a",
    fontSize: 15,
    fontWeight: "600",
  },

  title: {
    marginBottom: 22,
    color: "#1f2926",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },

  field: {
    marginBottom: 13,
  },

  label: {
    marginBottom: 6,
    color: "#58635e",
    fontSize: 14,
    fontWeight: "600",
  },

  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dfe8e3",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    color: "#1f2926",
    fontSize: 17,
  },

  acceptRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    marginBottom: 15,
  },

  checkbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#b7c6be",
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },

  checkboxActive: {
    borderColor: "#16a36a",
    backgroundColor: "#16a36a",
  },

  checkboxMark: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },

  acceptText: {
    flex: 1,
    color: "#75807b",
    fontSize: 13,
    lineHeight: 16,
  },

  error: {
    marginBottom: 12,
    color: "#dc4450",
    fontSize: 14,
    textAlign: "center",
  },

  button: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#16a36a",
  },

  buttonDisabled: {
    backgroundColor: "#b8c8c0",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },

  loginCaption: {
    marginRight: 5,
    color: "#75807b",
    fontSize: 14,
  },

  loginLink: {
    color: "#16a36a",
    fontSize: 14,
    fontWeight: "700",
  },
});
