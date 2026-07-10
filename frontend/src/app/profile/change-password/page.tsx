"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

import { BottomNav } from "@/components/BottomNav";
import { MobileShell } from "@/components/MobileShell";
import { TextField } from "@/components/TextField";

function EyeIcon() {
  return (
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
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [oldVisible, setOldVisible] = useState(false);
  const [newVisible, setNewVisible] = useState(false);
  const [repeatVisible, setRepeatVisible] = useState(false);

  const oldError =
    submitted && oldPassword.length < 6
      ? "Введите старый пароль"
      : "";

  const newError =
    submitted && newPassword.length < 6
      ? "Новый пароль должен содержать не менее 6 символов"
      : "";

  const repeatError =
    submitted && repeatPassword !== newPassword
      ? "Пароли не совпадают"
      : "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (
      oldPassword.length < 6 ||
      newPassword.length < 6 ||
      repeatPassword !== newPassword
    ) {
      return;
    }

    router.push("/profile/password-success");
  }

  return (
    <MobileShell contentClassName="work-page">
      <header className="work-header work-header-with-title">
        <Link className="work-back-link" href="/profile/details">
          ‹ Назад
        </Link>

        <h1>Изменить пароль</h1>
      </header>

      <div className="work-scroll work-password-content">
        <form className="work-password-form" onSubmit={handleSubmit}>
          <div className="work-step-title">
            <strong>Шаг 1</strong>
          </div>

          <TextField
            label="Введите старый пароль"
            name="oldPassword"
            type={oldVisible ? "text" : "password"}
            value={oldPassword}
            error={oldError}
            onChange={(event) =>
              setOldPassword(event.target.value)
            }
            trailing={
              <button
                className="icon-button"
                type="button"
                aria-label="Показать старый пароль"
                onClick={() => setOldVisible((current) => !current)}
              >
                <EyeIcon />
              </button>
            }
          />

          <div className="work-step-title">
            <strong>Шаг 2</strong>
          </div>

          <TextField
            label="Придумайте новый пароль"
            name="newPassword"
            type={newVisible ? "text" : "password"}
            value={newPassword}
            error={newError}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            trailing={
              <button
                className="icon-button"
                type="button"
                aria-label="Показать новый пароль"
                onClick={() => setNewVisible((current) => !current)}
              >
                <EyeIcon />
              </button>
            }
          />

          <TextField
            label="Повторите новый пароль"
            name="repeatPassword"
            type={repeatVisible ? "text" : "password"}
            value={repeatPassword}
            error={repeatError}
            onChange={(event) =>
              setRepeatPassword(event.target.value)
            }
            trailing={
              <button
                className="icon-button"
                type="button"
                aria-label="Показать повторный пароль"
                onClick={() =>
                  setRepeatVisible((current) => !current)
                }
              >
                <EyeIcon />
              </button>
            }
          />

          <button className="primary-button" type="submit">
            Сохранить
          </button>
        </form>
      </div>

      <BottomNav />
    </MobileShell>
  );
}
