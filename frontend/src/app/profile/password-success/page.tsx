import Link from "next/link";

import { MobileShell } from "@/components/MobileShell";

export default function PasswordSuccessPage() {
  return (
    <MobileShell contentClassName="work-success-page">
      <div className="work-success-top">
        <Link href="/profile">
          Закрыть
        </Link>
      </div>

      <div className="work-success-body">
        <div className="work-success-icon" aria-hidden="true">
          ✓
        </div>

        <h1>Успешно</h1>

        <p>Пароль успешно изменён</p>

        <Link
          className="work-outline-button"
          href="/profile"
        >
          Хорошо
        </Link>
      </div>
    </MobileShell>
  );
}
