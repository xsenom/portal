"use client";

import Link from "next/link";
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { MobileShell } from "@/components/MobileShell";

type Contact = {
  type: string;
  value: string;
};

export default function ProfileDetailsPage() {
  const [contacts, setContacts] = useState<Contact[]>([
    {
      type: "E-mail",
      value: "example@yandex.ru",
    },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [contactType, setContactType] = useState("Телефон");
  const [contactValue, setContactValue] = useState("");

  function addContact() {
    const value = contactValue.trim();

    if (!value) {
      return;
    }

    setContacts((current) => [
      ...current,
      {
        type: contactType,
        value,
      },
    ]);

    setContactValue("");
    setModalOpen(false);
  }

  return (
    <MobileShell contentClassName="work-page">
      <header className="work-header">
        <Link className="work-back-link" href="/profile">
          ‹ Назад
        </Link>
      </header>

      <div className="work-scroll">
        <section className="work-profile-summary work-profile-summary-details">
          <div className="work-avatar">
            <span>КС</span>

            <button
              className="work-avatar-camera"
              type="button"
              aria-label="Изменить фотографию"
            >
              ◉
            </button>
          </div>

          <div className="work-profile-name">
            <strong>
              Колопаки Сергей
              <br />
              Викторович
            </strong>
          </div>
        </section>

        <section className="work-data-list">
          <div className="work-data-row">
            <span>Дата трудоустройства</span>
            <strong>12.03.2022</strong>
          </div>

          <div className="work-data-row">
            <span>Стаж</span>
            <strong>5 лет</strong>
          </div>

          <div className="work-data-row">
            <span>Должность</span>
            <strong>Водитель</strong>
          </div>

          <div className="work-data-row">
            <span>Категории</span>
            <strong>Первая категория</strong>
          </div>

          {contacts.map((contact, index) => (
            <div className="work-data-row" key={contact.type + index}>
              <span>{contact.type}</span>
              <strong>{contact.value}</strong>
            </div>
          ))}
        </section>

        <div className="work-profile-actions">
          <button
            className="work-outline-button"
            type="button"
            onClick={() => setModalOpen(true)}
          >
            Добавить контакты
          </button>

          <Link
            className="work-secondary-button"
            href="/profile/change-password"
          >
            Изменить пароль
          </Link>
        </div>
      </div>

      <BottomNav />

      {modalOpen && (
        <div
          className="work-modal-backdrop"
          role="presentation"
          onMouseDown={() => setModalOpen(false)}
        >
          <section
            className="work-contact-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="work-sheet-handle" />

            <h2 id="contact-title">
              Выберите вид контакта
              <br />
              и введите его
            </h2>

            <label className="work-sheet-field">
              <span>Вид контакта</span>

              <select
                value={contactType}
                onChange={(event) =>
                  setContactType(event.target.value)
                }
              >
                <option>Телефон</option>
                <option>E-mail</option>
                <option>Telegram</option>
                <option>WhatsApp</option>
              </select>
            </label>

            <label className="work-sheet-field">
              <span>Контакт</span>

              <input
                type="text"
                value={contactValue}
                placeholder={
                  contactType === "Телефон"
                    ? "+7 (901) 271 45 24"
                    : "Введите значение"
                }
                onChange={(event) =>
                  setContactValue(event.target.value)
                }
              />
            </label>

            <div className="work-sheet-actions">
              <button
                className="work-primary-small"
                type="button"
                onClick={addContact}
              >
                Добавить
              </button>

              <button
                className="work-cancel-button"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Отмена
              </button>
            </div>
          </section>
        </div>
      )}
    </MobileShell>
  );
}
