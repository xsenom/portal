"use client";

import Link from "next/link";
import {
  type FormEvent,
  useState,
} from "react";

import { BottomNav } from "@/components/BottomNav";
import { MobileShell } from "@/components/MobileShell";

type Message = {
  id: number;
  text: string;
  time: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  function sendMessage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const text = message.trim();

    if (!text) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        text,
        time: new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    setMessage("");
  }

  return (
    <MobileShell contentClassName="work-page work-chat-page">
      <header className="work-header work-header-with-title">
        <Link className="work-back-link" href="/profile">
          ‹ Назад
        </Link>

        <h1>Чат</h1>
      </header>

      <div className="work-chat-messages">
        {messages.map((item) => (
          <article
            key={item.id}
            className="work-message work-message-outgoing"
          >
            <p>{item.text}</p>
            <time>{item.time}</time>
          </article>
        ))}
      </div>

      <form
        className="work-chat-form"
        onSubmit={sendMessage}
      >
        <button
          className="work-attach-button"
          type="button"
          aria-label="Прикрепить файл"
        >
          +
        </button>

        <input
          type="text"
          value={message}
          placeholder="Сообщение"
          onChange={(event) =>
            setMessage(event.target.value)
          }
        />

        <button
          className="work-microphone-button"
          type="button"
          aria-label="Записать голосовое сообщение"
        >
          ♩
        </button>

        <button
          className="work-send-button"
          type="submit"
          aria-label="Отправить сообщение"
          disabled={!message.trim()}
        >
          ➤
        </button>
      </form>

      <BottomNav />
    </MobileShell>
  );
}
