"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

import { MobileShell } from "@/components/MobileShell";
import { TextField } from "@/components/TextField";
import {
  readProfile,
  saveProfile,
} from "@/lib/profile-storage";

type LoginResponse = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  isActive: boolean;
};

export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [password, setPassword] =
    useState("");

  const [passwordVisible, setPasswordVisible] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [serverError, setServerError] =
    useState("");

  const loginError =
    submitted && login.trim().length < 3
      ? "Введите корректный логин"
      : "";

  const passwordError =
    submitted && password.length < 6
      ? "Пароль должен содержать не менее 6 символов"
      : "";

  const isFormValid =
    login.trim().length >= 3 &&
    password.length >= 6;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitted(true);
    setServerError("");

    if (!isFormValid || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        "/api/portal/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            login: login.trim(),
            password,
          }),
        },
      );

      let errorMessage = "";

      if (!response.ok) {
        try {
          const errorData =
            (await response.json()) as {
              message?: string;
            };

          errorMessage =
            errorData.message ?? "";
        } catch {
          errorMessage = "";
        }

        if (response.status === 401) {
          setServerError(
            "Неверный логин или пароль",
          );
          return;
        }

        if (response.status === 403) {
          setServerError(
            errorMessage || "Аккаунт отключён",
          );
          return;
        }

        setServerError(
          errorMessage ||
            "Не удалось выполнить вход",
        );

        return;
      }

      const user =
        (await response.json()) as LoginResponse;

      const previousProfile = readProfile();

      const middleName =
        user.middleName?.trim() ?? "";

      saveProfile({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName,
        fullName: [
          user.lastName,
          user.firstName,
          middleName,
        ]
          .filter(Boolean)
          .join(" "),
        login: user.login,
        email: user.email,
        avatar:
          previousProfile.login
            .toLowerCase() ===
          user.login.toLowerCase()
            ? previousProfile.avatar
            : "",
        role: user.role,
        isActive: user.isActive,
      });

      router.push("/profile");
      router.refresh();
    } catch {
      setServerError(
        "Сервер временно недоступен",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <MobileShell contentClassName="auth-screen">
      <h1 className="screen-title">
        Авторизация
      </h1>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <TextField
          label="Логин"
          name="login"
          type="text"
          autoComplete="username"
          value={login}
          error={loginError}
          onChange={(event) => {
            setLogin(event.target.value);
            setServerError("");
          }}
        />

        <TextField
          label="Пароль"
          name="password"
          type={
            passwordVisible
              ? "text"
              : "password"
          }
          autoComplete="current-password"
          value={password}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
            setServerError("");
          }}
          trailing={
            <button
              className="icon-button"
              type="button"
              aria-label={
                passwordVisible
                  ? "Скрыть пароль"
                  : "Показать пароль"
              }
              onClick={() =>
                setPasswordVisible(
                  (current) => !current,
                )
              }
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 12C4.8 7.9 8 6 12 6s7.2 1.9 9.5 6c-2.3 4.1-5.5 6-9.5 6s-7.2-1.9-9.5-6Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.8"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
              </svg>
            </button>
          }
        />

        <Link
          className="forgot-link"
          href="/forgot-password"
        >
          Забыли пароль?
        </Link>

        {serverError && (
          <p className="auth-server-error">
            {serverError}
          </p>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? "Входим…" : "Войти"}
        </button>

        <p className="auth-switch">
          Нет аккаунта?{" "}
          <Link href="/register">
            Зарегистрироваться
          </Link>
        </p>

        <p className="legal-caption">
          Нажимая кнопку «Войти», вы принимаете{" "}
          <Link href="/terms">
            условия обработки персональных данных
          </Link>{" "}
          и даёте согласие на использование
          мессенджера.
        </p>
      </form>
    </MobileShell>
  );
}
