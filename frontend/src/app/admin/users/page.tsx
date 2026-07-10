"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { MobileShell } from "@/components/MobileShell";

type AdminUser = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  isActive: boolean;
  position?: string | null;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch(
          "/api/portal/admin/users",
          {
            credentials: "include",
          },
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          router.replace("/profile");
          return;
        }

        if (!response.ok) {
          setError(
            "Не удалось загрузить пользователей",
          );
          return;
        }

        setUsers(await response.json());
      } catch {
        setError("Сервер временно недоступен");
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [router]);

  const filteredUsers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const fullName = [
        user.lastName,
        user.firstName,
        user.middleName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        fullName.includes(query) ||
        user.login.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    });
  }, [search, users]);

  return (
    <MobileShell contentClassName="admin-page">
      <header className="admin-header">
        <Link href="/admin">
          ‹ Назад
        </Link>

        <h1>Пользователи</h1>
      </header>

      <div className="admin-content">
        <input
          className="admin-search"
          type="search"
          value={search}
          placeholder="Поиск по ФИО, логину или почте"
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        {loading && (
          <p className="admin-list-message">
            Загружаем пользователей…
          </p>
        )}

        {error && (
          <p className="admin-list-error">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="admin-users-list">
            {filteredUsers.map((user) => {
              const fullName = [
                user.lastName,
                user.firstName,
                user.middleName,
              ]
                .filter(Boolean)
                .join(" ");

              const initials =
                (
                  user.lastName.charAt(0) +
                  user.firstName.charAt(0)
                ).toUpperCase();

              return (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="admin-user-card"
                >
                  <span className="admin-user-avatar">
                    {initials || "П"}
                  </span>

                  <span className="admin-user-main">
                    <strong>{fullName}</strong>
                    <small>
                      @{user.login} · {user.email}
                    </small>

                    {user.position && (
                      <small>{user.position}</small>
                    )}
                  </span>

                  <span className="admin-user-meta">
                    <span
                      className={
                        user.role === "Admin"
                          ? "admin-role admin-role-admin"
                          : "admin-role"
                      }
                    >
                      {user.role === "Admin"
                        ? "Админ"
                        : "Пользователь"}
                    </span>

                    <span
                      className={
                        user.isActive
                          ? "admin-active"
                          : "admin-inactive"
                      }
                    >
                      {user.isActive
                        ? "Активен"
                        : "Отключён"}
                    </span>
                  </span>
                </Link>
              );
            })}

            {filteredUsers.length === 0 && (
              <p className="admin-list-message">
                Пользователи не найдены
              </p>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
