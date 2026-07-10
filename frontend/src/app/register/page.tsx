
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";

import { MobileShell } from "@/components/MobileShell";
import { TextField } from "@/components/TextField";
import {
  PROFILE_STORAGE_KEY,
  type UserProfile,
} from "@/lib/profile-storage";

const emailPattern =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const maxAvatarSize = 5 * 1024 * 1024;

export default function RegisterPage() {
  const router = useRouter();
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] =
    useState("");

  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] =
    useState("");

  const [avatar, setAvatar] = useState("");
  const [avatarError, setAvatarError] =
    useState("");

  const [passwordVisible, setPasswordVisible] =
    useState(false);

  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [serverError, setServerError] =
    useState("");

  const lastNameError =
    submitted && lastName.trim().length < 2
      ? "Введите фамилию"
      : "";

  const firstNameError =
    submitted && firstName.trim().length < 2
      ? "Введите имя"
      : "";

  const loginError =
    submitted && login.trim().length < 3
      ? "Логин должен содержать не менее 3 символов"
      : "";

  const emailError =
    submitted &&
    !emailPattern.test(email.trim())
      ? "Введите корректный e-mail"
      : "";

  const passwordError =
    submitted && password.length < 6
      ? "Пароль должен содержать не менее 6 символов"
      : "";

  const passwordRepeatError =
    passwordRepeat.length > 0 &&
    passwordRepeat !== password
      ? "Пароли не совпадают"
      : "";

  const acceptedError =
    submitted && !accepted
      ? "Необходимо принять условия"
      : "";

  const isFormValid =
    lastName.trim().length >= 2 &&
    firstName.trim().length >= 2 &&
    login.trim().length >= 3 &&
    emailPattern.test(email.trim()) &&
    password.length >= 6 &&
    passwordRepeat.length >= 6 &&
    passwordRepeat === password &&
    accepted;

  const initials =
    (
      lastName.trim().charAt(0) +
      firstName.trim().charAt(0)
    ).toUpperCase() || "ФИ";

  function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    setAvatarError("");

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarError(
        "Выберите изображение JPG, PNG или WebP",
      );
      event.target.value = "";
      return;
    }

    if (file.size > maxAvatarSize) {
      setAvatarError(
        "Размер изображения не должен превышать 5 МБ",
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
      }
    };

    reader.onerror = () => {
      setAvatarError(
        "Не удалось прочитать изображение",
      );
    };

    reader.readAsDataURL(file);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitted(true);
    setServerError("");

    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const registerResponse = await fetch(
        "/api/portal/auth/register",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            login: login.trim(),
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName:
              middleName.trim() || null,
            password,
          }),
        },
      );

      let registerResult: {
        id?: number;
        login?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        middleName?: string | null;
        role?: string;
        isActive?: boolean;
        message?: string;
      } | null = null;

      try {
        registerResult =
          await registerResponse.json();
      } catch {
        registerResult = null;
      }

      if (!registerResponse.ok) {
        setServerError(
          registerResult?.message ||
            "Не удалось создать аккаунт",
        );

        return;
      }

      const profile: UserProfile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim(),
        fullName: [
          lastName.trim(),
          firstName.trim(),
          middleName.trim(),
        ]
          .filter(Boolean)
          .join(" "),
        login: login.trim(),
        email: email.trim(),
        avatar,
      };

      window.localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(profile),
      );

      const loginResponse = await fetch(
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

      if (!loginResponse.ok) {
        router.replace(
          "/login?registered=1",
        );

        return;
      }

      router.replace("/profile");
    } catch {
      setServerError(
        "Сервер временно недоступен. Попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MobileShell contentClassName="auth-screen register-screen">
      <Link className="back-link" href="/login">
        <span aria-hidden="true">‹</span>
        Назад
      </Link>

      <h1 className="screen-title register-title">
        Регистрация
      </h1>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {serverError && (
          <div
            className="auth-server-error"
            role="alert"
          >
            {serverError}
          </div>
        )}

        <section className="register-avatar-section">
          <button
            className="register-avatar-button"
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <span className="register-avatar-preview">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Предпросмотр аватара"
                />
              ) : (
                <strong>{initials}</strong>
              )}

              <span
                className="register-avatar-camera"
                aria-hidden="true"
              >
                +
              </span>
            </span>

            <span className="register-avatar-text">
              <strong>
                {avatar
                  ? "Изменить фотографию"
                  : "Добавить фотографию"}
              </strong>

              <small>
                JPG, PNG или WebP, до 5 МБ
              </small>
            </span>
          </button>

          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
          />

          {avatarError && (
            <p className="field-error">
              {avatarError}
            </p>
          )}
        </section>

        <TextField
          label="Фамилия"
          name="lastName"
          type="text"
          autoComplete="family-name"
          value={lastName}
          error={lastNameError}
          onChange={(event) =>
            setLastName(event.target.value)
          }
        />

        <TextField
          label="Имя"
          name="firstName"
          type="text"
          autoComplete="given-name"
          value={firstName}
          error={firstNameError}
          onChange={(event) =>
            setFirstName(event.target.value)
          }
        />

        <TextField
          label="Отчество"
          name="middleName"
          type="text"
          autoComplete="additional-name"
          value={middleName}
          placeholder="Необязательно"
          onChange={(event) =>
            setMiddleName(event.target.value)
          }
        />

        <TextField
          label="Логин"
          name="login"
          type="text"
          autoComplete="username"
          value={login}
          error={loginError}
          onChange={(event) =>
            setLogin(event.target.value)
          }
        />

        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          error={emailError}
          onChange={(event) =>
            setEmail(event.target.value)
          }
        />

        <TextField
          label="Пароль"
          name="password"
          type={
            passwordVisible ? "text" : "password"
          }
          autoComplete="new-password"
          value={password}
          error={passwordError}
          onChange={(event) =>
            setPassword(event.target.value)
          }
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

        <TextField
          label="Повторите пароль"
          name="passwordRepeat"
          type={
            passwordVisible ? "text" : "password"
          }
          autoComplete="new-password"
          value={passwordRepeat}
          error={passwordRepeatError}
          onChange={(event) =>
            setPasswordRepeat(event.target.value)
          }
        />

        <label className="consent-row">
          <input
            className="consent-checkbox"
            type="checkbox"
            checked={accepted}
            onChange={(event) =>
              setAccepted(event.target.checked)
            }
          />

          <span>
            Я принимаю{" "}
            <Link href="/terms">
              условия обработки персональных данных
            </Link>
          </span>
        </label>

        {acceptedError && (
          <p className="field-error">
            {acceptedError}
          </p>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={!isFormValid || isSubmitting}
          aria-disabled={!isFormValid || isSubmitting}
        >
          Зарегистрироваться
        </button>

        <p className="auth-switch">
          Уже есть аккаунт?{" "}
          <Link href="/login">Войти</Link>
        </p>
      </form>
    </MobileShell>
  );
}
