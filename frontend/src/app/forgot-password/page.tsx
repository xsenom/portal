"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

import { MobileShell } from "@/components/MobileShell";
import { TextField } from "@/components/TextField";

const emailPattern =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const emailError =
    touched && !emailPattern.test(email.trim())
      ? "Введите корректный e-mail"
      : "";

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setTouched(true);

    if (!emailPattern.test(email.trim())) {
      return;
    }

    router.push("/forgot-password/success");
  }

  return (
    <MobileShell contentClassName="auth-screen">
      <Link className="back-link" href="/login">
        <span aria-hidden="true">‹</span>
        Назад
      </Link>

      <h1 className="screen-title title-two-lines">
        Восстановление
        <br />
        пароля
      </h1>

      <p className="screen-description">
        Введите свою почту, и мы вышлем
        на неё ссылку для восстановления.
      </p>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="example@mail.ru"
          value={email}
          error={emailError}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          onBlur={() => setTouched(true)}
        />

        <button
          className="primary-button"
          type="submit"
        >
          Восстановить
        </button>
      </form>
    </MobileShell>
  );
}
