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
import {
  emptyProfile,
  readProfile,
  type UserProfile,
} from "@/lib/profile-storage";

type ActiveShift = {
  id: number;
  status: "Working" | "Paused";
  startedAt: string;
  workSeconds: number;
  pauseSeconds: number;
  currentSegmentStartedAt: string | null;
  currentPauseStartedAt: string | null;
  pausesCount: number;
};

type TimeDashboard = {
  year: number;
  month: number;
  activeShift: ActiveShift | null;
  monthlyWorkSeconds: number;
  monthlyHours: number;
  monthlyEarnings: number;
  tasksInWork: number;
  approvedTasksCount: number;
};

function formatTimer(
  seconds: number,
): string {
  const value = Math.max(
    0,
    Math.floor(seconds),
  );

  const hours = Math.floor(
    value / 3600,
  );

  const minutes = Math.floor(
    (value % 3600) / 60,
  );

  return `${hours
    .toString()
    .padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function formatDuration(
  seconds: number,
): string {
  const value = Math.max(
    0,
    Math.floor(seconds),
  );

  const hours = Math.floor(
    value / 3600,
  );

  const minutes = Math.floor(
    (value % 3600) / 60,
  );

  return `${hours} ч ${minutes} мин`;
}

function formatHours(
  value: number,
): string {
  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatMoney(
  value: number,
): string {
  return `${new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits: 2,
    },
  ).format(value)} ₽`;
}

export default function TimePage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<UserProfile>(emptyProfile);

  const [dashboard, setDashboard] =
    useState<TimeDashboard | null>(null);

  const [now, setNow] =
    useState(Date.now());

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showFinishModal, setShowFinishModal] =
    useState(false);

  async function loadDashboard() {
    try {
      const response = await fetch(
        "/api/portal/time/dashboard",
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
          "Не удалось загрузить рабочее время",
        );
        return;
      }

      setDashboard(
        (await response.json()) as TimeDashboard,
      );

      setError("");
    } catch {
      setError(
        "Сервер временно недоступен",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setProfile(readProfile());

    void loadDashboard();

    const refreshTimer =
      window.setInterval(() => {
        void loadDashboard();
      }, 30000);

    return () => {
      window.clearInterval(
        refreshTimer,
      );
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        setNow(Date.now());
      },
      1000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  async function runAction(
    action:
      | "start"
      | "pause"
      | "resume"
      | "finish",
  ) {
    if (actionLoading) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/portal/time/${action}`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      let message = "";

      try {
        const data =
          (await response.json()) as {
            message?: string;
          };

        message = data.message ?? "";
      } catch {
        message = "";
      }

      if (!response.ok) {
        setError(
          message ||
            "Не удалось выполнить действие",
        );
        return;
      }

      setShowFinishModal(false);

      await loadDashboard();
    } catch {
      setError(
        "Сервер временно недоступен",
      );
    } finally {
      setActionLoading(false);
    }
  }

  const shift =
    dashboard?.activeShift ?? null;

  const workSeconds = useMemo(() => {
    if (!shift) {
      return 0;
    }

    let value = shift.workSeconds;

    if (
      shift.status === "Working" &&
      shift.currentSegmentStartedAt
    ) {
      value += Math.max(
        0,
        Math.floor(
          (
            now -
            new Date(
              shift.currentSegmentStartedAt,
            ).getTime()
          ) / 1000,
        ),
      );
    }

    return value;
  }, [now, shift]);

  const pauseSeconds = useMemo(() => {
    if (!shift) {
      return 0;
    }

    let value = shift.pauseSeconds;

    if (
      shift.status === "Paused" &&
      shift.currentPauseStartedAt
    ) {
      value += Math.max(
        0,
        Math.floor(
          (
            now -
            new Date(
              shift.currentPauseStartedAt,
            ).getTime()
          ) / 1000,
        ),
      );
    }

    return value;
  }, [now, shift]);

  const initials = [
    profile.lastName.charAt(0),
    profile.firstName.charAt(0),
  ]
    .join("")
    .toUpperCase() || "П";

  return (
    <MobileShell contentClassName="work-page time-page">
      <header className="work-header time-header">
        <h1>Рабочее время</h1>
      </header>

      <div className="work-scroll time-scroll">
        {error && (
          <div className="time-page-error">
            {error}
          </div>
        )}

        <section className="time-main-card">
          <div className="time-user-row">
            <div className="time-avatar">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="time-user-name">
              <span>
                {profile.lastName ||
                  "Профиль"}{" "}
                {profile.firstName}
              </span>

              {profile.middleName && (
                <small>
                  {profile.middleName}
                </small>
              )}
            </div>
          </div>

          <div className="time-card-pattern" />

          <div className="time-card-metrics">
            <strong>
              {loading
                ? "—"
                : formatTimer(
                    workSeconds,
                  )}
            </strong>

            <Link href="/tasks">
              <b>
                {dashboard?.tasksInWork ??
                  0}
              </b>

              <span>
                заданий
                <small>В работе</small>
              </span>

              <i>›</i>
            </Link>
          </div>

          <div
            className={[
              "time-shift-status",
              shift?.status === "Working"
                ? "time-shift-status-active"
                : "",
              shift?.status === "Paused"
                ? "time-shift-status-paused"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span />

            {!shift &&
              "Вы не начали смену"}

            {shift?.status === "Working" &&
              "Вы начали смену"}

            {shift?.status === "Paused" &&
              "Смена на паузе"}
          </div>
        </section>

        <div className="time-summary-grid">
          <section className="time-month-card">
            <span className="time-summary-icon">
              ◷
            </span>

            <div>
              <strong>
                {loading
                  ? "—"
                  : `${formatHours(
                      dashboard?.monthlyHours ??
                        0,
                    )} ч`}
              </strong>

              <small>
                отработано за месяц
              </small>
            </div>
          </section>

          <section className="time-month-card">
            <span className="time-summary-icon">
              ₽
            </span>

            <div>
              <strong>
                {loading
                  ? "—"
                  : formatMoney(
                      dashboard
                        ?.monthlyEarnings ??
                        0,
                    )}
              </strong>

              <small>
                {dashboard
                  ?.approvedTasksCount ??
                  0}{" "}
                подтверждённых заданий
              </small>
            </div>
          </section>
        </div>

        {!shift && (
          <button
            className="time-start-button"
            type="button"
            disabled={actionLoading}
            onClick={() =>
              void runAction("start")
            }
          >
            <span>▷</span>
            Начать смену
          </button>
        )}

        {shift && (
          <>
            <section className="time-details-card">
              <h2>Детали по смене</h2>

              <div>
                <span>Количество пауз</span>

                <strong>
                  {shift.pausesCount}
                </strong>
              </div>

              <div>
                <span>
                  Общее время пауз
                </span>

                <strong>
                  {formatDuration(
                    pauseSeconds,
                  )}
                </strong>
              </div>
            </section>

            <div className="time-actions">
              {shift.status ===
                "Working" && (
                <button
                  className="time-pause-button"
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    void runAction("pause")
                  }
                >
                  <span>Ⅱ</span>
                  Пауза
                </button>
              )}

              {shift.status ===
                "Paused" && (
                <button
                  className="time-resume-button"
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    void runAction("resume")
                  }
                >
                  <span>▷</span>
                  Продолжить
                </button>
              )}

              <button
                className="time-finish-button"
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  setShowFinishModal(true)
                }
              >
                <span>×</span>
                Закончить смену
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav />

      {showFinishModal && (
        <div
          className="time-modal-overlay"
          onClick={() =>
            setShowFinishModal(false)
          }
        >
          <section
            className="time-finish-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="time-modal-handle" />

            <h2>Закончить смену?</h2>

            <p>
              Отработанное время сохранится
              в базе данных.
            </p>

            <div>
              <button
                className="time-confirm-finish"
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  void runAction("finish")
                }
              >
                Закончить
              </button>

              <button
                className="time-cancel-finish"
                type="button"
                onClick={() =>
                  setShowFinishModal(false)
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
