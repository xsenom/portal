"use client";

import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import { MobileShell } from "@/components/MobileShell";

type Contact = {
  id?: number;
  type: string;
  value: string;
  isPrimary: boolean;
  sortOrder: number;
};

type UserForm = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  role: string;
  isActive: boolean;
  employmentDate: string;
  position: string;
  category: string;
  avatarUrl: string;
  newPassword: string;
};

const emptyUser: UserForm = {
  id: 0,
  login: "",
  email: "",
  firstName: "",
  lastName: "",
  middleName: "",
  role: "User",
  isActive: true,
  employmentDate: "",
  position: "",
  category: "",
  avatarUrl: "",
  newPassword: "",
};

export default function AdminUserEditPage() {
  const params = useParams();
  const router = useRouter();

  const userId = Number(params.id);

  const [user, setUser] =
    useState<UserForm>(emptyUser);

  const [contacts, setContacts] =
    useState<Contact[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch(
          `/api/portal/admin/users/${userId}`,
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
          setError("Пользователь не найден");
          return;
        }

        const data = await response.json();
        const item = data.user;

        setUser({
          id: item.id,
          login: item.login ?? "",
          email: item.email ?? "",
          firstName: item.firstName ?? "",
          lastName: item.lastName ?? "",
          middleName: item.middleName ?? "",
          role: item.role ?? "User",
          isActive: item.isActive ?? true,
          employmentDate:
            item.employmentDate ?? "",
          position: item.position ?? "",
          category: item.category ?? "",
          avatarUrl: item.avatarUrl ?? "",
          newPassword: "",
        });

        setContacts(data.contacts ?? []);
      } catch {
        setError("Сервер временно недоступен");
      } finally {
        setLoading(false);
      }
    }

    if (Number.isFinite(userId)) {
      void loadUser();
    }
  }, [router, userId]);

  function updateField(
    field: keyof UserForm,
    value: string | boolean,
  ) {
    setUser((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage("");
    setError("");
  }

  function addContact() {
    setContacts((current) => [
      ...current,
      {
        type: "Телефон",
        value: "",
        isPrimary: false,
        sortOrder: current.length,
      },
    ]);
  }

  function updateContact(
    index: number,
    field: keyof Contact,
    value: string | boolean | number,
  ) {
    setContacts((current) =>
      current.map((contact, currentIndex) =>
        currentIndex === index
          ? {
              ...contact,
              [field]: value,
            }
          : contact,
      ),
    );
  }

  function removeContact(index: number) {
    setContacts((current) =>
      current.filter(
        (_, currentIndex) =>
          currentIndex !== index,
      ),
    );
  }

  async function saveUser(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (
      user.login.trim().length < 3 ||
      user.firstName.trim().length < 2 ||
      user.lastName.trim().length < 2 ||
      !user.email.includes("@")
    ) {
      setError(
        "Проверьте логин, e-mail и ФИО",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/portal/admin/users/${userId}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            login: user.login.trim(),
            email: user.email.trim(),
            firstName: user.firstName.trim(),
            lastName: user.lastName.trim(),
            middleName:
              user.middleName.trim() || null,
            role: user.role,
            isActive: user.isActive,
            employmentDate:
              user.employmentDate || null,
            position:
              user.position.trim() || null,
            category:
              user.category.trim() || null,
            avatarUrl:
              user.avatarUrl.trim() || null,
            newPassword:
              user.newPassword || null,
            contacts: contacts.map(
              (contact, index) => ({
                type: contact.type,
                value: contact.value,
                isPrimary:
                  contact.isPrimary,
                sortOrder: index,
              }),
            ),
          }),
        },
      );

      let responseMessage = "";

      try {
        const responseData =
          await response.json();

        responseMessage =
          responseData.message ?? "";
      } catch {
        responseMessage = "";
      }

      if (!response.ok) {
        setError(
          responseMessage ||
            "Не удалось сохранить данные",
        );
        return;
      }

      setUser((current) => ({
        ...current,
        newPassword: "",
      }));

      setMessage("Данные сохранены");
    } catch {
      setError("Сервер временно недоступен");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MobileShell contentClassName="admin-page">
        <div className="admin-loading">
          Загружаем данные…
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell contentClassName="admin-page">
      <header className="admin-header">
        <Link href="/admin/users">
          ‹ Назад
        </Link>

        <h1>Пользователь</h1>
      </header>

      <form
        className="admin-edit-form"
        onSubmit={saveUser}
      >
        <section className="admin-form-section">
          <h2>Основные данные</h2>

          <label>
            <span>Фамилия</span>
            <input
              value={user.lastName}
              onChange={(event) =>
                updateField(
                  "lastName",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Имя</span>
            <input
              value={user.firstName}
              onChange={(event) =>
                updateField(
                  "firstName",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Отчество</span>
            <input
              value={user.middleName}
              onChange={(event) =>
                updateField(
                  "middleName",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Логин</span>
            <input
              value={user.login}
              onChange={(event) =>
                updateField(
                  "login",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>E-mail</span>
            <input
              type="email"
              value={user.email}
              onChange={(event) =>
                updateField(
                  "email",
                  event.target.value,
                )
              }
            />
          </label>
        </section>

        <section className="admin-form-section">
          <h2>Работа</h2>

          <label>
            <span>Дата трудоустройства</span>
            <input
              type="date"
              value={user.employmentDate}
              onChange={(event) =>
                updateField(
                  "employmentDate",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Должность</span>
            <input
              value={user.position}
              onChange={(event) =>
                updateField(
                  "position",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Категория</span>
            <input
              value={user.category}
              onChange={(event) =>
                updateField(
                  "category",
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Ссылка на аватар</span>
            <input
              value={user.avatarUrl}
              onChange={(event) =>
                updateField(
                  "avatarUrl",
                  event.target.value,
                )
              }
            />
          </label>
        </section>

        <section className="admin-form-section">
          <h2>Права доступа</h2>

          <label>
            <span>Роль</span>
            <select
              value={user.role}
              onChange={(event) =>
                updateField(
                  "role",
                  event.target.value,
                )
              }
            >
              <option value="User">
                Пользователь
              </option>
              <option value="Admin">
                Администратор
              </option>
            </select>
          </label>

          <label className="admin-check-row">
            <input
              type="checkbox"
              checked={user.isActive}
              onChange={(event) =>
                updateField(
                  "isActive",
                  event.target.checked,
                )
              }
            />

            <span>Аккаунт активен</span>
          </label>

          <label>
            <span>Новый пароль</span>
            <input
              type="password"
              value={user.newPassword}
              placeholder="Оставьте пустым без изменения"
              onChange={(event) =>
                updateField(
                  "newPassword",
                  event.target.value,
                )
              }
            />
          </label>
        </section>

        <section className="admin-form-section">
          <div className="admin-section-heading">
            <h2>Контакты</h2>

            <button
              type="button"
              onClick={addContact}
            >
              + Добавить
            </button>
          </div>

          {contacts.map((contact, index) => (
            <div
              className="admin-contact-editor"
              key={contact.id ?? index}
            >
              <select
                value={contact.type}
                onChange={(event) =>
                  updateContact(
                    index,
                    "type",
                    event.target.value,
                  )
                }
              >
                <option>Телефон</option>
                <option>E-mail</option>
                <option>Telegram</option>
                <option>WhatsApp</option>
              </select>

              <input
                value={contact.value}
                placeholder="Введите контакт"
                onChange={(event) =>
                  updateContact(
                    index,
                    "value",
                    event.target.value,
                  )
                }
              />

              <button
                type="button"
                aria-label="Удалить контакт"
                onClick={() =>
                  removeContact(index)
                }
              >
                ×
              </button>
            </div>
          ))}

          {contacts.length === 0 && (
            <p className="admin-empty-contacts">
              Контакты ещё не добавлены
            </p>
          )}
        </section>

        {error && (
          <p className="admin-save-error">
            {error}
          </p>
        )}

        {message && (
          <p className="admin-save-success">
            {message}
          </p>
        )}

        <button
          className="admin-save-button"
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Сохраняем…"
            : "Сохранить изменения"}
        </button>
      </form>
    </MobileShell>
  );
}
