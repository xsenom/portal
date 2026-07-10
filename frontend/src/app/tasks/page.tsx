"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { BottomNav } from "@/components/BottomNav";
import { MobileShell } from "@/components/MobileShell";

type TaskStatus =
  | "Assigned"
  | "InProgress"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Cancelled";

type TaskItem = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  status: TaskStatus;
  plannedHours: number | null;
  actualHours: number | null;
  rewardAmount: number | null;
  dueAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  submissionComment: string | null;
  approvalComment: string | null;
  createdAt: string;
};

type TabName =
  | "current"
  | "new"
  | "completed";

const declineReasons = [
  "Поломка авто",
  "Плохое самочувствие",
  "Не могу выполнить в срок",
  "Нет необходимого оборудования",
  "Другая причина",
];

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Без срока";
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
  ).format(new Date(value));
}

function formatHours(
  value: number | null,
): string {
  if (value === null) {
    return "Не указано";
  }

  return `${value} ч`;
}

function statusLabel(
  status: TaskStatus,
): string {
  const labels: Record<
    TaskStatus,
    string
  > = {
    Assigned: "Новое",
    InProgress: "В работе",
    Submitted: "На проверке",
    Approved: "Выполнено",
    Rejected: "Нужно исправить",
    Cancelled: "Отказ",
  };

  return labels[status];
}

export default function TasksPage() {
  const router = useRouter();

  const [tasks, setTasks] =
    useState<TaskItem[]>([]);

  const [activeTab, setActiveTab] =
    useState<TabName>("current");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [declineTask, setDeclineTask] =
    useState<TaskItem | null>(null);

  const [declineReason, setDeclineReason] =
    useState(declineReasons[0]);

  const [completeTask, setCompleteTask] =
    useState<TaskItem | null>(null);

  const [actualHours, setActualHours] =
    useState("");

  const [completionComment, setCompletionComment] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function loadTasks() {
    setLoading(true);
    setError("");

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
        setError(
          "Не удалось загрузить задания",
        );
        return;
      }

      setTasks(await response.json());
    } catch {
      setError("Сервер временно недоступен");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const visibleTasks = useMemo(() => {
    if (activeTab === "new") {
      return tasks.filter(
        (task) => task.status === "Assigned",
      );
    }

    if (activeTab === "completed") {
      return tasks.filter((task) =>
        [
          "Approved",
          "Cancelled",
        ].includes(task.status),
      );
    }

    return tasks.filter((task) =>
      [
        "InProgress",
        "Submitted",
        "Rejected",
      ].includes(task.status),
    );
  }, [activeTab, tasks]);

  async function startTask(
    task: TaskItem,
  ) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/portal/tasks/${task.id}/start`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        setError(
          data.message ||
            "Не удалось принять задание",
        );
        return;
      }

      setActiveTab("current");
      await loadTasks();
    } catch {
      setError("Сервер временно недоступен");
    } finally {
      setSaving(false);
    }
  }

  async function declineSelectedTask() {
    if (!declineTask || saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/portal/tasks/${declineTask.id}/decline`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: declineReason,
          }),
        },
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        setError(
          data.message ||
            "Не удалось отказаться от задания",
        );
        return;
      }

      setDeclineTask(null);
      setActiveTab("completed");
      await loadTasks();
    } catch {
      setError("Сервер временно недоступен");
    } finally {
      setSaving(false);
    }
  }

  async function submitCompletedTask() {
    if (!completeTask || saving) {
      return;
    }

    const hours = Number(
      actualHours.replace(",", "."),
    );

    if (
      !Number.isFinite(hours) ||
      hours < 0
    ) {
      setError(
        "Введите фактическое количество часов",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/portal/tasks/${completeTask.id}/submit`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actualHours: hours,
            comment:
              completionComment.trim() ||
              null,
          }),
        },
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        setError(
          data.message ||
            "Не удалось отправить задание",
        );
        return;
      }

      setCompleteTask(null);
      setActualHours("");
      setCompletionComment("");
      await loadTasks();
    } catch {
      setError("Сервер временно недоступен");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell contentClassName="work-page tasks-page">
      <header className="tasks-header">
        <button
          className={
            activeTab === "current"
              ? "tasks-tab-active"
              : ""
          }
          type="button"
          onClick={() =>
            setActiveTab("current")
          }
        >
          Текущие
        </button>

        <button
          className={
            activeTab === "new"
              ? "tasks-tab-active"
              : ""
          }
          type="button"
          onClick={() =>
            setActiveTab("new")
          }
        >
          Новые
        </button>

        <button
          className={
            activeTab === "completed"
              ? "tasks-tab-active"
              : ""
          }
          type="button"
          onClick={() =>
            setActiveTab("completed")
          }
        >
          Выполненные
        </button>
      </header>

      <div className="work-scroll tasks-scroll">
        {loading && (
          <div className="tasks-state">
            Загружаем задания…
          </div>
        )}

        {error && (
          <div className="tasks-error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          visibleTasks.length === 0 && (
            <div className="tasks-empty">
              <span>✓</span>

              <strong>
                Здесь пока нет заданий
              </strong>

              <p>
                Новые задания появятся после
                назначения администратором.
              </p>
            </div>
          )}

        {!loading &&
          visibleTasks.map((task) => (
            <article
              className="task-card"
              key={task.id}
            >
              <div className="task-card-heading">
                <strong>{task.title}</strong>

                <span>
                  {formatDate(task.dueAt)}
                </span>
              </div>

              {task.description && (
                <p>{task.description}</p>
              )}

              <dl>
                {task.category && (
                  <>
                    <dt>Категория</dt>
                    <dd>{task.category}</dd>
                  </>
                )}

                <dt>
                  Предполагаемое время работы
                </dt>
                <dd>
                  {formatHours(
                    task.plannedHours,
                  )}
                </dd>

                <dt>
                  Стоимость задания
                </dt>
                <dd>
                  {task.rewardAmount === null
                    ? "Не указана"
                    : `${task.rewardAmount} ₽`}
                </dd>

                <dt>Статус</dt>
                <dd>
                  {statusLabel(task.status)}
                </dd>
              </dl>

              <div className="task-card-actions">
                {task.status ===
                  "Assigned" && (
                  <>
                    <button
                      className="task-primary-action"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void startTask(task)
                      }
                    >
                      Взять
                    </button>

                    <button
                      className="task-secondary-action"
                      type="button"
                      onClick={() => {
                        setDeclineTask(task);
                        setDeclineReason(
                          declineReasons[0],
                        );
                      }}
                    >
                      Отказаться
                    </button>
                  </>
                )}

                {[
                  "InProgress",
                  "Rejected",
                ].includes(task.status) && (
                  <>
                    <button
                      className="task-primary-action"
                      type="button"
                      onClick={() => {
                        setCompleteTask(task);
                        setActualHours(
                          task.plannedHours?.toString() ??
                            "",
                        );
                      }}
                    >
                      Завершить
                    </button>

                    <Link
                      className="task-secondary-action"
                      href={`/chat?taskId=${task.id}`}
                    >
                      Чат
                    </Link>
                  </>
                )}

                {task.status ===
                  "Submitted" && (
                  <div className="task-review-status">
                    Задание отправлено на проверку
                  </div>
                )}

                {[
                  "Approved",
                  "Cancelled",
                ].includes(task.status) && (
                  <Link
                    className="task-details-link"
                    href={`/tasks/${task.id}`}
                  >
                    Подробнее ›
                  </Link>
                )}
              </div>
            </article>
          ))}
      </div>

      <BottomNav />

      {declineTask && (
        <div
          className="task-modal-overlay"
          onClick={() =>
            setDeclineTask(null)
          }
        >
          <section
            className="task-bottom-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="task-modal-handle" />

            <h2>
              Выберите причину отказа от
              задания
            </h2>

            <select
              value={declineReason}
              onChange={(event) =>
                setDeclineReason(
                  event.target.value,
                )
              }
            >
              {declineReasons.map(
                (reason) => (
                  <option key={reason}>
                    {reason}
                  </option>
                ),
              )}
            </select>

            <div className="task-modal-actions">
              <button
                className="task-danger-action"
                type="button"
                disabled={saving}
                onClick={() =>
                  void declineSelectedTask()
                }
              >
                Отказаться
              </button>

              <button
                className="task-secondary-action"
                type="button"
                onClick={() =>
                  setDeclineTask(null)
                }
              >
                Отмена
              </button>
            </div>
          </section>
        </div>
      )}

      {completeTask && (
        <div
          className="task-modal-overlay"
          onClick={() =>
            setCompleteTask(null)
          }
        >
          <section
            className="task-bottom-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="task-modal-handle" />

            <h2>Завершить задание</h2>

            <label>
              <span>
                Фактически затрачено часов
              </span>

              <input
                type="number"
                min="0"
                step="0.25"
                value={actualHours}
                onChange={(event) =>
                  setActualHours(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Комментарий
              </span>

              <textarea
                value={completionComment}
                placeholder="Опишите выполненную работу"
                onChange={(event) =>
                  setCompletionComment(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="task-modal-actions">
              <button
                className="task-primary-action"
                type="button"
                disabled={saving}
                onClick={() =>
                  void submitCompletedTask()
                }
              >
                Отправить
              </button>

              <button
                className="task-secondary-action"
                type="button"
                onClick={() =>
                  setCompleteTask(null)
                }
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
