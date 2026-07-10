
"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { BottomNav } from "@/components/BottomNav";
import { MobileShell } from "@/components/MobileShell";
import {
  emptyProfile,
  readProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/profile-storage";

const maxAvatarSize = 5 * 1024 * 1024;

export default function ProfilePage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [profile, setProfile] =
    useState<UserProfile>(emptyProfile);

  const [avatarError, setAvatarError] =
    useState("");

  const isAdmin =
    profile.role === "Admin";

  useEffect(() => {
    const localProfile = readProfile();

    setProfile(localProfile);

    async function loadCurrentUser() {
      try {
        const response = await fetch(
          "/api/portal/auth/me",
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          return;
        }

        const user = await response.json();

        const middleName =
          user.middleName?.trim() ?? "";

        const updatedProfile = {
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

        setProfile(updatedProfile);
        saveProfile(updatedProfile);
      } catch {
        // Используем локальный профиль.
      }
    }

    void loadCurrentUser();
  }, []);

  const initials =
    (
      profile.lastName.charAt(0) +
      profile.firstName.charAt(0)
    ).toUpperCase() || "П";

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
        "Выберите файл изображения",
      );
      event.target.value = "";
      return;
    }

    if (file.size > maxAvatarSize) {
      setAvatarError(
        "Размер фотографии не должен превышать 5 МБ",
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        return;
      }

      const updatedProfile = {
        ...profile,
        avatar: reader.result,
      };

      setProfile(updatedProfile);
      saveProfile(updatedProfile);
    };

    reader.onerror = () => {
      setAvatarError(
        "Не удалось загрузить фотографию",
      );
    };

    reader.readAsDataURL(file);
  }

  return (
    <MobileShell contentClassName="work-page">
      <header className="work-header work-header-centered">
        <h1>Профиль</h1>
      </header>

      <div className="work-scroll">
        <section className="work-profile-summary">
          <div
            className={
              profile.avatar
                ? "work-avatar work-avatar-has-image"
                : "work-avatar"
            }
          >
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt="Аватар пользователя"
              />
            ) : (
              <span>{initials}</span>
            )}

            <button
              className="work-avatar-camera"
              type="button"
              aria-label="Добавить или изменить аватар"
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              ◉
            </button>

            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="work-profile-name">
            <strong>{profile.fullName}</strong>

            {profile.firstName ? (
              <Link href="/profile/details">
                Подробнее ›
              </Link>
            ) : (
              <Link href="/register">
                Заполнить профиль ›
              </Link>
            )}
          </div>
        </section>

        {avatarError && (
          <p className="profile-avatar-error">
            {avatarError}
          </p>
        )}

        <section className="work-hours-card">
          <div className="work-hours-icon">
            ◷
          </div>

          <div>
            <strong>Нет данных</strong>
            <span>показатели ещё не заполнены</span>
          </div>

          <div
            className="work-hours-pattern"
            aria-hidden="true"
          />
        </section>

        <section className="work-card">
          <div className="work-card-heading">
            <h2>Показатели</h2>

            <Link href="/indicators">
              Подробнее ›
            </Link>
          </div>

          <div className="work-indicator-columns">
            <div>
              <strong>—</strong>
              <span>штрафы</span>
            </div>

            <div>
              <strong>—</strong>
              <span>ЗП в час</span>
            </div>
          </div>
        </section>

        {isAdmin && (
          <Link
            className="profile-admin-button"
            href="/admin"
          >
            <span className="profile-admin-icon">
              ⚙
            </span>

            <span>
              <strong>Админка</strong>
              <small>
                Управление пользователями и показателями
              </small>
            </span>

            <span className="profile-admin-arrow">
              ›
            </span>
          </Link>
        )}

        <section className="work-link-list">
          <Link href="/login">
            <span>Выйти из профиля</span>

          </Link>

          <Link href="/terms">
            <span>
              Обработка данных и местоположения
            </span>
            <span>›</span>
          </Link>
        </section>
      </div>

      <BottomNav />
    </MobileShell>
  );
}
