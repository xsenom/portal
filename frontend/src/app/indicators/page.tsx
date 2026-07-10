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

type MonthlyIndicators = {
  userId: number;
  year: number;
  month: number;

  hoursWorked: number | null;
  hoursNorm: number | null;

  finesCount: number | null;
  finesLimit: number | null;
  finesAmount: number | null;

  baseHourlyRate: number | null;
  tariffRate: number | null;
  tariffRateWithCoefficient: number | null;
  totalHourlyRate: number | null;

  multifunctional: boolean | null;
  accidentFree: boolean | null;
  hasFines: boolean | null;
  driverDowntime: boolean | null;

  responsibility: string | null;

  late: boolean | null;
  initiative: boolean | null;
  execution: boolean | null;

  completedCount: number | null;
  totalCount: number | null;

  updatedAt: string;
};

type StatusValue = {
  text: string;
  className: string;
};

function formatNumber(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return `${formatNumber(value)} ₽`;
}

function positiveStatus(
  value: boolean | null,
): StatusValue {
  if (value === null) {
    return {
      text: "—",
      className: "work-status-neutral",
    };
  }

  return value
    ? {
        text: "Да",
        className: "work-status-green",
      }
    : {
        text: "Нет",
        className: "work-status-red",
      };
}

function negativeStatus(
  value: boolean | null,
): StatusValue {
  if (value === null) {
    return {
      text: "—",
      className: "work-status-neutral",
    };
  }

  return value
    ? {
        text: "Да",
        className: "work-status-red",
      }
    : {
        text: "Нет",
        className: "work-status-green",
      };
}

function responsibilityStatus(
  value: string | null,
): StatusValue {
  if (!value) {
    return {
      text: "—",
      className: "work-status-neutral",
    };
  }

  if (value === "Высокая") {
    return {
      text: value,
      className: "work-status-green",
    };
  }

  if (value === "Низкая") {
    return {
      text: value,
      className: "work-status-red",
    };
  }

  return {
    text: value,
    className: "work-status-yellow",
  };
}

export default function IndicatorsPage() {
  const router = useRouter();

  const [period, setPeriod] = useState(
    () => {
      const now = new Date();

      return new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );
    },
  );

  const [data, setData] =
    useState<MonthlyIndicators | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const year = period.getFullYear();
  const month = period.getMonth() + 1;

  const periodTitle = useMemo(() => {
    return new Intl.DateTimeFormat(
      "ru-RU",
      {
        month: "long",
        year: "numeric",
      },
    )
      .format(period)
      .replace(" г.", "")
      .toUpperCase();
  }, [period]);

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadIndicators() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await fetch(
          `/api/portal/indicators/me?year=${year}&month=${month}`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 404) {
          setData(null);
          return;
        }

        if (!response.ok) {
          setError(
            "Не удалось загрузить показатели",
          );
          return;
        }

        const result =
          (await response.json()) as MonthlyIndicators;

        setData(result);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          "Сервер временно недоступен",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadIndicators();

    return () => {
      controller.abort();
    };
  }, [month, router, year]);

  function changeMonth(offset: number) {
    setPeriod((current) => {
      return new Date(
        current.getFullYear(),
        current.getMonth() + offset,
        1,
      );
    });
  }

  const multifunctional =
    positiveStatus(
      data?.multifunctional ?? null,
    );

  const accident =
    data?.accidentFree === null ||
    data?.accidentFree === undefined
      ? {
          text: "—",
          className:
            "work-status-neutral",
        }
      : data.accidentFree
        ? {
            text: "Нет",
            className:
              "work-status-green",
          }
        : {
            text: "Да",
            className:
              "work-status-red",
          };

  const fines = negativeStatus(
    data?.hasFines ?? null,
  );

  const downtime = negativeStatus(
    data?.driverDowntime ?? null,
  );

  const responsibility =
    responsibilityStatus(
      data?.responsibility ?? null,
    );

  const late = negativeStatus(
    data?.late ?? null,
  );

  const initiative = positiveStatus(
    data?.initiative ?? null,
  );

  const execution = positiveStatus(
    data?.execution ?? null,
  );

  return (
    <MobileShell contentClassName="work-page">
      <header className="work-header work-header-with-title">
        <Link
          className="work-back-link"
          href="/profile"
        >
          ‹ Назад
        </Link>

        <h1>Показатели</h1>
      </header>

      <div className="work-scroll manual-indicators-scroll">
        <section className="manual-period-navigation">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() =>
              changeMonth(-1)
            }
          >
            ‹
          </button>

          <h2>{periodTitle}</h2>

          <button
            type="button"
            aria-label="Следующий месяц"
            onClick={() =>
              changeMonth(1)
            }
          >
            ›
          </button>
        </section>

        {loading && (
          <section className="manual-indicators-state">
            Загружаем показатели…
          </section>
        )}

        {!loading && error && (
          <section className="manual-indicators-error">
            {error}
          </section>
        )}

        {!loading &&
          !error &&
          data === null && (
            <section className="manual-indicators-empty">
              <div className="manual-indicators-empty-icon">
                📊
              </div>

              <strong>
                Показатели пока не заполнены
              </strong>

              <p>
                Данные за выбранный месяц
                появятся после заполнения
                администратором.
              </p>
            </section>
          )}

        {!loading &&
          !error &&
          data !== null && (
            <>
              <section className="work-indicators-heading">
                <span>
                  {data.completedCount ?? 0}
                  {" из "}
                  {data.totalCount ?? 0} ✓
                </span>
              </section>

              <section className="work-indicators-list">
                <div className="work-indicators-row">
                  <span>
                    Отработано часов
                  </span>

                  <strong>
                    {formatNumber(
                      data.hoursWorked,
                    )}

                    {data.hoursNorm !== null
                      ? ` из ${formatNumber(
                          data.hoursNorm,
                        )}`
                      : ""}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Базовая ЗП по часам
                  </span>

                  <strong>
                    {formatMoney(
                      data.baseHourlyRate,
                    )}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Многофункциональность
                  </span>

                  <strong
                    className={
                      multifunctional.className
                    }
                  >
                    {multifunctional.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>Аварийность</span>

                  <strong
                    className={
                      accident.className
                    }
                  >
                    {accident.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>Штрафы</span>

                  <strong
                    className={
                      fines.className
                    }
                  >
                    {fines.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Простой не по вине водителя
                  </span>

                  <strong
                    className={
                      downtime.className
                    }
                  >
                    {downtime.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Ответственность
                  </span>

                  <strong
                    className={
                      responsibility.className
                    }
                  >
                    {responsibility.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>Опоздания</span>

                  <strong
                    className={
                      late.className
                    }
                  >
                    {late.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Инициативность
                  </span>

                  <strong
                    className={
                      initiative.className
                    }
                  >
                    {initiative.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Исполнительность
                  </span>

                  <strong
                    className={
                      execution.className
                    }
                  >
                    {execution.text}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Тарифная ставка
                  </span>

                  <strong>
                    {formatMoney(
                      data.tariffRate,
                    )}
                  </strong>
                </div>

                <div className="work-indicators-row">
                  <span>
                    Тарифная ставка с коэфф.
                  </span>

                  <strong>
                    {formatMoney(
                      data
                        .tariffRateWithCoefficient,
                    )}
                  </strong>
                </div>
              </section>

              <section className="work-total">
                <span>
                  Итоговая ставка в час
                </span>

                <strong>
                  {formatMoney(
                    data.totalHourlyRate,
                  )}
                </strong>
              </section>
            </>
          )}
      </div>

      <BottomNav />
    </MobileShell>
  );
}
