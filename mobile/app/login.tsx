import {
  ApiError,
} from "@/lib/api";
import {
  useAuth,
} from "@/lib/auth";
import {
  colors,
} from "@/lib/theme";
import {
  type Href,
  Redirect,
  router,
} from "expo-router";
import {
  useEffect,
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

type LoginStep =
  | "email"
  | "code";

export default function LoginScreen() {
  const {
    user,
    loading,
    requestCode,
    login,
  } = useAuth();

  const [step, setStep] =
    useState<LoginStep>("email");

  const [email, setEmail] =
    useState("");

  const [code, setCode] =
    useState("");

  const [ttl, setTtl] =
    useState(0);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      step !== "code" ||
      ttl <= 0
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        setTtl(
          (value) =>
            Math.max(
              0,
              value - 1,
            ),
        );
      }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [
    step,
    ttl,
  ]);

  if (loading) {
    return (
      <SafeAreaView
        style={styles.page}
      >
        <View
          style={styles.center}
        >
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
      <Redirect
        href="/(tabs)/time"
      />
    );
  }

  function errorMessage(
    caughtError: unknown,
    fallback: string,
  ): string {
    if (
      caughtError
      instanceof ApiError
    ) {
      return caughtError.message;
    }

    if (
      caughtError
      instanceof Error
    ) {
      return caughtError.message;
    }

    return fallback;
  }

  async function sendCode() {
    const cleanEmail =
      email.trim();

    if (
      !cleanEmail ||
      !cleanEmail.includes("@")
    ) {
      setError(
        "Введите корректный e-mail",
      );

      return;
    }

    if (submitting) {
      return;
    }

    try {
      Keyboard.dismiss();

      setSubmitting(true);
      setError("");

      const result =
        await requestCode(
          cleanEmail,
        );

      setEmail(cleanEmail);

      setTtl(
        Math.max(
          0,
          Number(result.ttl) || 0,
        ),
      );

      setCode("");
      setStep("code");
    } catch (caughtError) {
      setError(
        errorMessage(
          caughtError,
          "Не удалось отправить код",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCode() {
    const cleanCode =
      code.trim();

    if (
      !cleanCode ||
      !/^\d+$/.test(cleanCode)
    ) {
      setError(
        "Введите код из письма",
      );

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
        email,
        cleanCode,
      );

      router.replace(
        "/(tabs)/time" as Href,
      );
    } catch (caughtError) {
      setError(
        errorMessage(
          caughtError,
          "Не удалось выполнить вход",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (
      submitting ||
      ttl > 0
    ) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const result =
        await requestCode(
          email,
        );

      setTtl(
        Math.max(
          0,
          Number(result.ttl) || 0,
        ),
      );
    } catch (caughtError) {
      setError(
        errorMessage(
          caughtError,
          "Не удалось отправить код повторно",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setTtl(0);
    setError("");
  }

  return (
    <SafeAreaView
      style={styles.page}
    >
      <KeyboardAvoidingView
        style={styles.page}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Pressable
            style={styles.dismissArea}
            onPress={Keyboard.dismiss}
          >
            <View
              style={styles.brand}
            >
              <View
                style={styles.logo}
              >
                <Text
                  style={styles.logoText}
                >
                  VS
                </Text>
              </View>

              <Text
                style={styles.title}
              >
                VolgaShield
              </Text>

              <Text
                style={styles.subtitle}
              >
                Техническое обслуживание
              </Text>
            </View>

            <View
              style={styles.card}
            >
              {step === "email" ? (
                <>
                  <Text
                    style={styles.cardTitle}
                  >
                    Вход
                  </Text>

                  <Text
                    style={styles.description}
                  >
                    Укажите электронную
                    почту. Мы отправим
                    код для входа.
                  </Text>

                  <Text
                    style={styles.label}
                  >
                    Электронная почта
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={
                      setEmail
                    }
                    placeholder="name@example.com"
                    placeholderTextColor="#98a39e"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="go"
                    textContentType="emailAddress"
                    autoFocus
                    onSubmitEditing={() =>
                      void sendCode()
                    }
                  />

                  {!!error && (
                    <View
                      style={
                        styles.errorBox
                      }
                    >
                      <Text
                        style={
                          styles.errorText
                        }
                      >
                        {error}
                      </Text>
                    </View>
                  )}

                  <Pressable
                    style={[
                      styles.primaryButton,
                      submitting &&
                        styles.disabled,
                    ]}
                    disabled={submitting}
                    onPress={() =>
                      void sendCode()
                    }
                  >
                    {submitting ? (
                      <ActivityIndicator
                        color={
                          colors.white
                        }
                      />
                    ) : (
                      <Text
                        style={
                          styles.primaryButtonText
                        }
                      >
                        Получить код
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text
                    style={styles.cardTitle}
                  >
                    Введите код
                  </Text>

                  <Text
                    style={styles.description}
                  >
                    Код отправлен на
                  </Text>

                  <Text
                    style={styles.emailValue}
                  >
                    {email}
                  </Text>

                  <Text
                    style={styles.label}
                  >
                    Код подтверждения
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      styles.codeInput,
                    ]}
                    value={code}
                    onChangeText={(
                      value,
                    ) =>
                      setCode(
                        value.replace(
                          /\D/g,
                          "",
                        ),
                      )
                    }
                    placeholder="Код из письма"
                    placeholderTextColor="#98a39e"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    textContentType="oneTimeCode"
                    autoFocus
                    onSubmitEditing={() =>
                      void submitCode()
                    }
                  />

                  {!!error && (
                    <View
                      style={
                        styles.errorBox
                      }
                    >
                      <Text
                        style={
                          styles.errorText
                        }
                      >
                        {error}
                      </Text>
                    </View>
                  )}

                  <Pressable
                    style={[
                      styles.primaryButton,
                      submitting &&
                        styles.disabled,
                    ]}
                    disabled={submitting}
                    onPress={() =>
                      void submitCode()
                    }
                  >
                    {submitting ? (
                      <ActivityIndicator
                        color={
                          colors.white
                        }
                      />
                    ) : (
                      <Text
                        style={
                          styles.primaryButtonText
                        }
                      >
                        Войти
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={
                      styles.secondaryButton
                    }
                    disabled={
                      submitting ||
                      ttl > 0
                    }
                    onPress={() =>
                      void resendCode()
                    }
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        ttl > 0 &&
                          styles.mutedText,
                      ]}
                    >
                      {ttl > 0
                        ? `Отправить повторно через ${ttl} сек.`
                        : "Отправить код повторно"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={
                      styles.changeEmailButton
                    }
                    disabled={submitting}
                    onPress={
                      changeEmail
                    }
                  >
                    <Text
                      style={
                        styles.changeEmailText
                      }
                    >
                      Изменить почту
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            <Text
              style={styles.authNote}
            >
              После входа приложение
              сохранит авторизацию на
              устройстве.
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        colors.background,
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

    dismissArea: {
      flexGrow: 1,
      justifyContent: "center",
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
      backgroundColor:
        colors.primary,
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
      color:
        colors.textSecondary,
      fontSize: 13,
    },

    card: {
      padding: 19,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      backgroundColor:
        colors.surface,
    },

    cardTitle: {
      marginBottom: 7,
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
    },

    description: {
      marginBottom: 18,
      color:
        colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },

    emailValue: {
      marginTop: -13,
      marginBottom: 20,
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
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
      borderColor:
        colors.border,
      borderRadius: 12,
      color: colors.text,
      fontSize: 15,
      backgroundColor:
        colors.background,
    },

    codeInput: {
      fontSize: 22,
      fontWeight: "700",
      letterSpacing: 4,
      textAlign: "center",
    },

    errorBox: {
      marginBottom: 13,
      padding: 10,
      borderRadius: 9,
      backgroundColor:
        colors.dangerSoft,
    },

    errorText: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 17,
    },

    primaryButton: {
      minHeight: 53,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor:
        colors.primary,
    },

    primaryButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: "800",
    },

    secondaryButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },

    secondaryButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },

    changeEmailButton: {
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
    },

    changeEmailText: {
      color:
        colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },

    mutedText: {
      color:
        colors.textSecondary,
    },

    disabled: {
      opacity: 0.55,
    },

    authNote: {
      marginTop: 18,
      paddingHorizontal: 12,
      color:
        colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
    },
  });
