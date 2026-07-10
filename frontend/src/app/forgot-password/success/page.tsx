import Link from "next/link";

import { MobileShell } from "@/components/MobileShell";

export default function PasswordResetSuccessPage() {
  return (
    <MobileShell contentClassName="success-screen">
      <div className="success-top">
        <Link
          className="close-link"
          href="/login"
        >
          Закрыть
        </Link>
      </div>

      <div className="success-content">
        <div
          className="success-icon"
          aria-hidden="true"
        >
          ⌛
        </div>

        <h1 className="success-title">
          Успешно
        </h1>

        <p className="success-text">
          Мы выслали ссылку
          <br />
          для восстановления на вашу почту
        </p>

        <Link
          className="outline-button"
          href="/login"
        >
          Хорошо
        </Link>
      </div>
    </MobileShell>
  );
}
