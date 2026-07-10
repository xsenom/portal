"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { MobileShell } from "@/components/MobileShell";

export default function TermsPage() {
  const router = useRouter();

  function handleAccept() {
    router.push("/login?terms=accepted");
  }

  return (
    <MobileShell contentClassName="terms-screen">
      <div className="terms-header">
        <Link className="back-link" href="/login">
          <span aria-hidden="true">‹</span>
          Назад
        </Link>
      </div>

      <div className="terms-scroll">
        <section className="terms-section">
          <h1 className="terms-title">
            Условия обработки
            <br />
            персональных данных
          </h1>

          <p>
            Каждый из нас понимает следующую
            вещь: граница обучения кадров играет
            важную роль в формировании распределения
            внутренних резервов и ресурсов.
          </p>

          <p>
            Но начало повседневной работы по
            формированию позиций обеспечивает
            широкому кругу специалистов участие
            в формировании прогресса
            профессионального сообщества.
          </p>
        </section>

        <section className="terms-section">
          <h2 className="terms-title">
            Согласие на использование
            <br />
            местоположения
          </h2>

          <p>
            Каждый из нас понимает следующую
            вещь: граница обучения кадров играет
            важную роль в формировании распределения
            внутренних резервов и ресурсов.
          </p>

          <p>
            Но начало повседневной работы по
            формированию позиций обеспечивает
            широкому кругу специалистов участие
            в формировании прогресса
            профессионального сообщества.
          </p>
        </section>
      </div>

      <div className="terms-footer">
        <button
          className="primary-button"
          type="button"
          onClick={handleAccept}
        >
          Принять
        </button>
      </div>
    </MobileShell>
  );
}
