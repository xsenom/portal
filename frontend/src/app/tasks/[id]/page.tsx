"use client";

import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { BottomNav } from "@/components/BottomNav";
import { MobileShell } from "@/components/MobileShell";

type TaskItem = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  plannedHours: number | null;
  actualHours: number | null;
  dueAt: string | null;
  approvedAt: string | null;
  submissionComment: string | null;
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Не указано";
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
  ).format(new Date(value));
}

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const taskId = Number(params.id);

  const [task, setTask] =
    useState<TaskItem | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadTask() {
      try {
        const response = await fetch(
          "/api/portal/tasks",
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
          return;
        }

        const tasks =
          (await response.json()) as TaskItem[];

        setTask(
          tasks.find(
            (item) => item.id === taskId,
          ) ?? null,
        );
      } finally {
        setLoading(false);
      }
    }

    void loadTask();
  }, [router, taskId]);

  return (
    <MobileShell contentClassName="work-page">
      <header className="work-header work-header-with-title">
        <Link
          className="work-back-link"
          href="/tasks"
        >
          ‹ Назад
        </Link>

        <h1>Детали</h1>
      </header>

      <div className="work-scroll task-details-page">
        {loading && (
          <div className="tasks-state">
            Загружаем задание…
          </div>
        )}

        {!loading && !task && (
          <div className="tasks-empty">
            <strong>
              Задание не найдено
            </strong>
          </div>
        )}

        {task && (
          <article>
            <div className="task-details-heading">
              <h2>Задание</h2>

              <span>
                {formatDate(task.dueAt)}
              </span>
            </div>

            <h3>{task.title}</h3>

            {task.description && (
              <p>{task.description}</p>
            )}

            <dl>
              <dt>Категория</dt>
              <dd>
                {task.category || "Не указана"}
              </dd>

              <dt>
                Предполагаемое время работы
              </dt>
              <dd>
                {task.plannedHours === null
                  ? "Не указано"
                  : `${task.plannedHours} ч`}
              </dd>

              <dt>
                Фактическое время выполнения
              </dt>
              <dd>
                {task.actualHours === null
                  ? "Не указано"
                  : `${task.actualHours} ч`}
              </dd>

              <dt>Дата выполнения</dt>
              <dd>
                {formatDate(task.approvedAt)}
              </dd>
            </dl>

            {task.submissionComment && (
              <section className="task-detail-comment">
                <strong>Комментарий</strong>
                <p>
                  {task.submissionComment}
                </p>
              </section>
            )}
          </article>
        )}
      </div>

      <BottomNav />
    </MobileShell>
  );
}
