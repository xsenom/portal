"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { MobileShell } from "@/components/MobileShell";
import {
  emptyProfile,
  readProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/profile-storage";

type CurrentUser = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  isActive: boolean;
  avatarUrl?: string | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<UserProfile>(emptyProfile);

  const [accessChecked, setAccessChecked] =
    useState(false);

  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch(
          "/api/portal/auth/me",
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          router.replace("/profile");
          return;
        }

        const user =
          (await response.json()) as CurrentUser;

        if (user.role !== "Admin") {
          router.replace("/profile");
          return;
        }

        const localProfile = readProfile();

        const middleName =
          user.middleName?.trim() ?? "";

        const updatedProfile: UserProfile = {
          ...localProfile,
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
          role: user.role,
          isActive: user.isActive,
          avatar:
            user.avatarUrl ||
            localProfile.avatar,
        };

        saveProfile(updatedProfile);
        setProfile(updatedProfile);
        setAccessChecked(true);
      } catch {
        router.replace("/login");
      }
    }

    void checkAccess();
  }, [router]);

  if (!accessChecked) {
    return (
      <MobileShell contentClassName="admin-page">
        <div className="admin-loading">
          Проверяем права доступа…
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell contentClassName="admin-page">
      <header className="admin-header">
        <Link href="/profile">
          ‹ Назад
        </Link>

        <h1>Админка</h1>
      </header>

      <div className="admin-content">
        <section className="admin-welcome">
          <span>Администратор</span>

          <strong>
            {profile.fullName}
          </strong>

          <small>
            Логин: {profile.login}
          </small>
        </section>

        <section className="admin-menu">
          <Link
            className="admin-menu-link"
            href="/admin/users"
          >
            <span className="admin-menu-icon">
              👥
            </span>

            <span>
              <strong>Пользователи</strong>

              <small>
                ФИО, логин, почта, должность
                и контакты
              </small>
            </span>

            <span>›</span>
          </Link>

          <Link
            className="admin-menu-link"
            href="/admin/tasks"
          >
            <span className="admin-menu-icon">
              ✅
            </span>

            <span>
              <strong>Задания</strong>

              <small>
                Назначение и контроль заданий
                сотрудников
              </small>
            </span>

            <span>›</span>
          </Link>

          <button
            type="button"
            disabled
          >
            <span className="admin-menu-icon">
              📊
            </span>

            <span>
              <strong>Показатели</strong>

              <small>
                Часы, штрафы, ставки
                и итоговая оплата
              </small>
            </span>

            <span>›</span>
          </button>

          <button
            type="button"
            disabled
          >
            <span className="admin-menu-icon">
              🔐
            </span>

            <span>
              <strong>Права доступа</strong>

              <small>
                Администраторы и активность
                аккаунтов
              </small>
            </span>

            <span>›</span>
          </button>
        </section>
      </div>
    </MobileShell>
  );
}
