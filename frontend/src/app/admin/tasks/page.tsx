"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
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

type TaskItem = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
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

type AdminTask = {
  task: TaskItem;
  userId: number;
  login: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
};

type TaskForm = {
  assignedUserId: string;
  title: string;
  description: string;
  category: string;
  plannedHours: string;
  rewardAmount: string;
  dueAt: string;
};

const emptyForm: TaskForm = {
  assignedUserId: "",
  title: "",
  description: "",
  category: "",
  plannedHours: "",
  rewardAmount: "",
  dueAt: "",
};

const taskCategories = [
  "Основная работа",
  "Дополнительная работа",
  "Обслуживание",
  "Документы",
  "Обучение",
  "Другое",
];

const statusOptions = [
  {
    value: "",
    label: "Все задания",
  },
  {
    value: "Assigned",
    label: "Новые",
  },
  {
    value: "InProgress",
    label: "В работе",
  },
  {
    value: "Submitted",
    label: "На проверке",
  },
  {
    value: "Approved",
    label: "Выполненные",
  },
  {
    value: "Rejected",
    label: "Возвращённые",
  },
  {
    value: "Cancelled",
    label: "Отказ",
  },
];

function statusLabel(
  status: string,
): string {
  const labels: Record<string, string> = {
    Assigned: "Новое",
    InProgress: "В работе",
    Submitted: "На проверке",
    Approved: "Выполнено",
    Rejected: "Возвращено",
    Cancelled: "Отказ",
  };

  return labels[status] ?? status;
}

function statusClass(
  status: string,
): string {
  const classes: Record<string, string> = {
    Assigned: "admin-task-status-new",
    InProgress: "admin-task-status-work",
    Submitted: "admin-task-status-review",
    Approved: "admin-task-status-approved",
    Rejected: "admin-task-status-rejected",
    Cancelled: "admin-task-status-cancelled",
  };

  return classes[status] ?? "";
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Без срока";
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
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

export default function AdminTasksPage() {
  const router = useRouter();

  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [tasks, setTasks] =
    useState<AdminTask[]>([]);

  const [statusFilter, setStatusFilter] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [form, setForm] =
    useState<TaskForm>(emptyForm);

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [reviewTask, setReviewTask] =
    useState<AdminTask | null>(null);

  const [initiativePoints, setInitiativePoints] =
    useState("3");

  const [executionPoints, setExecutionPoints] =
    useState("3");

  const [
    responsibilityPoints,
    setResponsibilityPoints,
  ] = useState("3");

  const [reviewComment, setReviewComment] =
    useState("");

  const [
    reviewRewardAmount,
    setReviewRewardAmount,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function loadTasks() {
    const response = await fetch(
      "/api/portal/admin/tasks",
      {
        credentials: "include",
        cache: "no-store",
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
      throw new Error(
        "Не удалось загрузить задания",
      );
    }

    const result =
      (await response.json()) as AdminTask[];

    setTasks(result);
  }

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      try {
        const [
          usersResponse,
          tasksResponse,
        ] = await Promise.all([
          fetch(
            "/api/portal/admin/users",
            {
              credentials: "include",
              cache: "no-store",
            },
          ),
          fetch(
            "/api/portal/admin/tasks",
            {
              credentials: "include",
              cache: "no-store",
            },
          ),
        ]);

        if (
          usersResponse.status === 401 ||
          tasksResponse.status === 401
        ) {
          router.replace("/login");
          return;
        }

        if (
          usersResponse.status === 403 ||
          tasksResponse.status === 403
        ) {
          router.replace("/profile");
          return;
        }

        if (
          !usersResponse.ok ||
          !tasksResponse.ok
        ) {
          setError(
            "Не удалось загрузить данные",
          );
          return;
        }

        const usersData =
          (await usersResponse.json()) as AdminUser[];

        const tasksData =
          (await tasksResponse.json()) as AdminTask[];

        const activeUsers = usersData.filter(
          (user) => user.isActive,
        );

        setUsers(activeUsers);
        setTasks(tasksData);

        if (activeUsers.length === 1) {
          setForm((current) => ({
            ...current,
            assignedUserId:
              activeUsers[0].id.toString(),
          }));
        }
      } catch {
        setError(
          "Сервер временно недоступен",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPage();
  }, [router]);

  const filteredTasks = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return tasks.filter((item) => {
      if (
        statusFilter &&
        item.task.status !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const userName = [
        item.lastName,
        item.firstName,
        item.middleName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        item.task.title
          .toLowerCase()
          .includes(query) ||
        userName.includes(query) ||
        item.login
          .toLowerCase()
          .includes(query)
      );
    });
  }, [
    search,
    statusFilter,
    tasks,
  ]);

  function updateForm(
    field: keyof TaskForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  }

  function closeForm() {
    setShowForm(false);
    setError("");
  }

  async function createTask(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const userId = Number(
      form.assignedUserId,
    );

    if (
      !Number.isFinite(userId) ||
      userId <= 0
    ) {
      setError(
        "Выберите сотрудника",
      );
      return;
    }

    if (
      form.title.trim().length < 2
    ) {
      setError(
        "Введите название задания",
      );
      return;
    }

    const plannedHours =
      form.plannedHours.trim()
        ? Number(
            form.plannedHours.replace(
              ",",
              ".",
            ),
          )
        : null;

    const rewardAmount =
      form.rewardAmount.trim()
        ? Number(
            form.rewardAmount.replace(
              ",",
              ".",
            ),
          )
        : null;

    if (
      rewardAmount === null ||
      !Number.isFinite(rewardAmount) ||
      rewardAmount <= 0
    ) {
      setError(
        "Укажите стоимость задания больше 0",
      );
      return;
    }

    if (
      plannedHours !== null &&
      (
        !Number.isFinite(
          plannedHours,
        ) ||
        plannedHours < 0
      )
    ) {
      setError(
        "Проверьте плановое время",
      );
      return;
    }

    if (
      rewardAmount !== null &&
      (
        !Number.isFinite(
          rewardAmount,
        ) ||
        rewardAmount < 0
      )
    ) {
      setError(
        "Проверьте сумму вознаграждения",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/portal/admin/tasks",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            assignedUserId: userId,
            title: form.title.trim(),
            description:
              form.description.trim() ||
              null,
            category:
              form.category.trim() ||
              null,
            plannedHours,
            rewardAmount,
            dueAt: form.dueAt
              ? new Date(
                  form.dueAt,
                ).toISOString()
              : null,
          }),
        },
      );

      let responseMessage = "";

      try {
        const data =
          (await response.json()) as {
            message?: string;
          };

        responseMessage =
          data.message ?? "";
      } catch {
        responseMessage = "";
      }

      if (!response.ok) {
        setError(
          responseMessage ||
            "Не удалось создать задание",
        );
        return;
      }

      const selectedUser =
        form.assignedUserId;

      setForm({
        ...emptyForm,
        assignedUserId:
          selectedUser,
      });

      setShowForm(false);
      setSuccess(
        "Задание успешно назначено",
      );

      await loadTasks();
    } catch {
      setError(
        "Сервер временно недоступен",
      );
    } finally {
      setSaving(false);
    }
  }

  function openReview(
    item: AdminTask,
  ) {
    setReviewTask(item);
    setInitiativePoints("3");
    setExecutionPoints("3");
    setResponsibilityPoints("3");
    setReviewComment("");

    setReviewRewardAmount(
      item.task.rewardAmount?.toString() ??
        "",
    );

    setError("");
    setSuccess("");
  }

  async function approveTask() {
    if (!reviewTask || saving) {
      return;
    }

    const rewardAmount = Number(
      reviewRewardAmount.replace(",", "."),
    );

    if (
      !Number.isFinite(rewardAmount) ||
      rewardAmount <= 0
    ) {
      setError(
        "Укажите стоимость задания больше 0",
      );
      return;
    }

    const initiative =
      Number(initiativePoints);

    const execution =
      Number(executionPoints);

    const responsibility =
      Number(responsibilityPoints);

    if (
      !Number.isInteger(initiative) ||
      !Number.isInteger(execution) ||
      !Number.isInteger(responsibility) ||
      initiative < 0 ||
      initiative > 5 ||
      execution < 0 ||
      execution > 5 ||
      responsibility < 0 ||
      responsibility > 5
    ) {
      setError(
        "Оценки должны быть от 0 до 5",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/portal/admin/tasks/${reviewTask.task.id}/approve`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            initiativePoints: initiative,
            executionPoints: execution,
            responsibilityPoints:
              responsibility,
            comment:
              reviewComment.trim() ||
              null,
          }),
        },
      );

      let responseMessage = "";

      try {
        const data =
          (await response.json()) as {
            message?: string;
          };

        responseMessage =
          data.message ?? "";
      } catch {
        responseMessage = "";
      }

      if (!response.ok) {
        setError(
          responseMessage ||
            "Не удалось подтвердить задание",
        );
        return;
      }

      setReviewTask(null);

      setSuccess(
        "Задание подтверждено",
      );

      await loadTasks();
    } catch {
      setError(
        "Сервер временно недоступен",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rejectTask() {
    if (!reviewTask || saving) {
      return;
    }

    if (reviewComment.trim().length < 2) {
      setError(
        "Укажите причину возврата задания",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/portal/admin/tasks/${reviewTask.task.id}/reject`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            comment: reviewComment.trim(),
          }),
        },
      );

      let responseMessage = "";

      try {
        const data =
          (await response.json()) as {
            message?: string;
          };

        responseMessage =
          data.message ?? "";
      } catch {
        responseMessage = "";
      }

      if (!response.ok) {
        setError(
          responseMessage ||
            "Не удалось вернуть задание",
        );
        return;
      }

      setReviewTask(null);

      setSuccess(
        "Задание возвращено сотруднику",
      );

      await loadTasks();
    } catch {
      setError(
        "Сервер временно недоступен",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell contentClassName="admin-page admin-tasks-page">
      <header className="admin-header">
        <Link href="/admin">
          ‹ Назад
        </Link>

        <h1>Задания</h1>

        <button
          className="admin-header-add"
          type="button"
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(true);
          }}
        >
          + Добавить
        </button>
      </header>

      <div className="admin-content">
        <div className="admin-task-filters">
          <input
            type="search"
            value={search}
            placeholder="Поиск задания или сотрудника"
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
          >
            {statusOptions.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </div>

        {success && (
          <div className="admin-task-success">
            {success}
          </div>
        )}

        {error && !showForm && (
          <div className="admin-task-error">
            {error}
          </div>
        )}

        {loading && (
          <div className="admin-list-message">
            Загружаем задания…
          </div>
        )}

        {!loading &&
          filteredTasks.length === 0 && (
            <section className="admin-tasks-empty">
              <span>✅</span>

              <strong>
                Заданий пока нет
              </strong>

              <p>
                Нажмите «Добавить», чтобы
                назначить первое задание.
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowForm(true)
                }
              >
                Добавить задание
              </button>
            </section>
          )}

        {!loading &&
          filteredTasks.length > 0 && (
            <div className="admin-task-list">
              {filteredTasks.map(
                (item) => {
                  const fullName = [
                    item.lastName,
                    item.firstName,
                    item.middleName,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <article
                      className="admin-task-card"
                      key={item.task.id}
                    >
                      <div className="admin-task-card-header">
                        <div>
                          <strong>
                            {item.task.title}
                          </strong>

                          <small>
                            {fullName}
                          </small>
                        </div>

                        <span
                          className={[
                            "admin-task-status",
                            statusClass(
                              item.task.status,
                            ),
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {statusLabel(
                            item.task.status,
                          )}
                        </span>
                      </div>

                      {item.task.description && (
                        <p>
                          {item.task.description}
                        </p>
                      )}

                      <dl>
                        <div>
                          <dt>Срок</dt>

                          <dd>
                            {formatDate(
                              item.task.dueAt,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Плановое время
                          </dt>

                          <dd>
                            {formatHours(
                              item.task
                                .plannedHours,
                            )}
                          </dd>
                        </div>

                        {item.task.category && (
                          <div>
                            <dt>Категория</dt>

                            <dd>
                              {
                                item.task
                                  .category
                              }
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt>
                            Стоимость
                          </dt>

                          <dd>
                            {item.task.rewardAmount ===
                            null
                              ? "Не указана"
                              : `${item.task.rewardAmount} ₽`}
                          </dd>
                        </div>
                      </dl>

                      {item.task.status ===
                        "Submitted" && (
                        <button
                          className="admin-task-review-button"
                          type="button"
                          onClick={() =>
                            openReview(item)
                          }
                        >
                          Проверить задание
                        </button>
                      )}
                    </article>
                  );
                },
              )}
            </div>
          )}
      </div>

      {showForm && (
        <div
          className="admin-task-modal-overlay"
          onClick={closeForm}
        >
          <form
            className="admin-task-modal"
            onSubmit={createTask}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin-task-modal-handle" />

            <div className="admin-task-modal-title">
              <div>
                <h2>
                  Новое задание
                </h2>

                <p>
                  Назначьте задание
                  сотруднику
                </p>
              </div>

              <button
                type="button"
                aria-label="Закрыть"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <div className="admin-task-form-scroll">
              <label>
                <span>Сотрудник</span>

                <select
                  value={
                    form.assignedUserId
                  }
                  onChange={(event) =>
                    updateForm(
                      "assignedUserId",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Выберите сотрудника
                  </option>

                  {users.map((user) => {
                    const fullName = [
                      user.lastName,
                      user.firstName,
                      user.middleName,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {fullName} —{" "}
                        {user.login}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                <span>
                  Название задания
                </span>

                <input
                  value={form.title}
                  placeholder="Например: проверить автомобиль"
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Описание</span>

                <textarea
                  value={form.description}
                  placeholder="Что необходимо сделать"
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Категория</span>

                <select
                  value={form.category}
                  onChange={(event) =>
                    updateForm(
                      "category",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Не выбрана
                  </option>

                  {taskCategories.map(
                    (category) => (
                      <option
                        key={category}
                      >
                        {category}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="admin-task-form-grid">
                <label>
                  <span>
                    Плановое время, ч
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={
                      form.plannedHours
                    }
                    placeholder="0"
                    onChange={(event) =>
                      updateForm(
                        "plannedHours",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Вознаграждение
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.rewardAmount
                    }
                    placeholder="0"
                    onChange={(event) =>
                      updateForm(
                        "rewardAmount",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <label>
                <span>
                  Срок выполнения
                </span>

                <input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) =>
                    updateForm(
                      "dueAt",
                      event.target.value,
                    )
                  }
                />
              </label>

              {error && (
                <div className="admin-task-error">
                  {error}
                </div>
              )}
            </div>

            <div className="admin-task-modal-actions">
              <button
                className="admin-task-cancel"
                type="button"
                onClick={closeForm}
              >
                Отмена
              </button>

              <button
                className="admin-task-create"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Создаём…"
                  : "Назначить"}
              </button>
            </div>
          </form>
        </div>
      )}

      {reviewTask && (
        <div
          className="admin-task-modal-overlay"
          onClick={() => {
            if (!saving) {
              setReviewTask(null);
            }
          }}
        >
          <section
            className="admin-task-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-review-title"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin-task-modal-handle" />

            <div className="admin-task-review-title">
              <div>
                <h2 id="task-review-title">
                  Проверка задания
                </h2>

                <p>
                  {reviewTask.task.title}
                </p>
              </div>

              <button
                type="button"
                aria-label="Закрыть"
                disabled={saving}
                onClick={() =>
                  setReviewTask(null)
                }
              >
                ×
              </button>
            </div>

            <section className="admin-task-review-result">
              <div>
                <span>Сотрудник</span>

                <strong>
                  {[
                    reviewTask.lastName,
                    reviewTask.firstName,
                    reviewTask.middleName,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </strong>
              </div>

              <div>
                <span>
                  Фактическое время
                </span>

                <strong>
                  {reviewTask.task.actualHours ===
                  null
                    ? "Не указано"
                    : `${reviewTask.task.actualHours} ч`}
                </strong>
              </div>

              <div>
                <span>
                  Комментарий сотрудника
                </span>

                <strong>
                  {reviewTask.task
                    .submissionComment ||
                    "Комментарий не оставлен"}
                </strong>
              </div>
            </section>

            <label className="admin-task-review-price">
              <span>
                Стоимость задания, ₽
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={reviewRewardAmount}
                placeholder="Укажите стоимость"
                onChange={(event) => {
                  setReviewRewardAmount(
                    event.target.value,
                  );

                  setError("");
                }}
              />
            </label>

            <div className="admin-task-review-scores">
              <label>
                <span>Инициативность</span>

                <select
                  value={initiativePoints}
                  onChange={(event) =>
                    setInitiativePoints(
                      event.target.value,
                    )
                  }
                >
                  {[0, 1, 2, 3, 4, 5].map(
                    (value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value} из 5
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Исполнительность</span>

                <select
                  value={executionPoints}
                  onChange={(event) =>
                    setExecutionPoints(
                      event.target.value,
                    )
                  }
                >
                  {[0, 1, 2, 3, 4, 5].map(
                    (value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value} из 5
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Ответственность</span>

                <select
                  value={responsibilityPoints}
                  onChange={(event) =>
                    setResponsibilityPoints(
                      event.target.value,
                    )
                  }
                >
                  {[0, 1, 2, 3, 4, 5].map(
                    (value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value} из 5
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <label className="admin-task-review-comment">
              <span>
                Комментарий администратора
              </span>

              <textarea
                value={reviewComment}
                placeholder="Комментарий или причина возврата"
                onChange={(event) => {
                  setReviewComment(
                    event.target.value,
                  );

                  setError("");
                }}
              />
            </label>

            {error && (
              <div className="admin-task-error">
                {error}
              </div>
            )}

            <div className="admin-task-review-actions">
              <button
                className="admin-task-reject-button"
                type="button"
                disabled={saving}
                onClick={() =>
                  void rejectTask()
                }
              >
                Вернуть
              </button>

              <button
                className="admin-task-approve-button"
                type="button"
                disabled={saving}
                onClick={() =>
                  void approveTask()
                }
              >
                {saving
                  ? "Сохраняем…"
                  : "Подтвердить"}
              </button>
            </div>
          </section>
        </div>
      )}

    </MobileShell>
  );
}
