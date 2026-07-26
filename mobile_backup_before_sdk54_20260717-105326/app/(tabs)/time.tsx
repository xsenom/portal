import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { router } from "expo-router";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

type Dashboard = {
  year: number;
  month: number;
  activeShift: ActiveShift | null;
  monthlyWorkSeconds: number;
  monthlyHours: number;
  monthlyEarnings: number;
  tasksInWork: number;
  approvedTasksCount: number;
};

function formatTimer(seconds: number) {
  const value = Math.max(
    0,
    Math.floor(seconds),
  );

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(
    (value % 3600) / 60,
  );

  return `${String(hours).padStart(
    2,
    "0",
  )}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  const value = Math.max(
    0,
    Math.floor(seconds),
  );

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(
    (value % 3600) / 60,
  );

  return `${hours} ч ${minutes} мин`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(value: number) {
  return `${formatNumber(value)} ₽`;
}

export default function TimeScreen() {
  const { user } = useAuth();

  const [data, setData] =
    useState<Dashboard | null>(null);
  const [error, setError] =
    useState("");
  const [busy, setBusy] =
    useState(false);
  const [now, setNow] =
    useState(Date.now());

  const [finishVisible, setFinishVisible] =
    useState(false);

  async function load() {
    try {
      const result =
        await api<Dashboard>(
          "/time/dashboard",
        );

      setData(result);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось загрузить рабочее время",
      );
    }
  }

  async function action(
    name:
      | "start"
      | "pause"
      | "resume"
      | "finish",
  ) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(`/time/${name}`, {
        method: "POST",
      });

      setFinishVisible(false);
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось выполнить действие",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();

    const refresh = setInterval(
      () => void load(),
      30000,
    );

    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      1000,
    );

    return () => clearInterval(timer);
  }, []);

  const shift = data?.activeShift ?? null;

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

  const initials =
    `${user?.lastName?.[0] ?? ""}${
      user?.firstName?.[0] ?? ""
    }`.toUpperCase() || "П";

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Рабочее время
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {!!error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        {!data && !error && (
          <ActivityIndicator
            color={colors.primary}
          />
        )}

        <View style={styles.mainCard}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initials}
              </Text>
            </View>

            <View style={styles.userName}>
              <Text style={styles.userLastName}>
                {user?.lastName || "Профиль"}{" "}
                {user?.firstName ?? ""}
              </Text>

              {!!user?.middleName && (
                <Text style={styles.userMiddleName}>
                  {user.middleName}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.pattern}>
            {[0, 1, 2, 3, 4].map(
              (index) => (
                <View
                  key={index}
                  style={[
                    styles.patternLine,
                    {
                      left: index * 18,
                    },
                  ]}
                />
              ),
            )}
          </View>

          <View style={styles.metrics}>
            <Text style={styles.timer}>
              {formatTimer(workSeconds)}
            </Text>

            <Pressable
              style={styles.tasksMetric}
              onPress={() =>
                router.push("/(tabs)/tasks")
              }
            >
              <Text style={styles.tasksCount}>
                {data?.tasksInWork ?? 0}
              </Text>

              <View>
                <Text style={styles.tasksLabel}>
                  заданий
                </Text>

                <Text style={styles.tasksSmall}>
                  В работе
                </Text>
              </View>

              <Text style={styles.tasksArrow}>
                ›
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.shiftStatus,
              shift?.status === "Working" &&
                styles.shiftStatusActive,
              shift?.status === "Paused" &&
                styles.shiftStatusPaused,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                shift?.status === "Working" &&
                  styles.statusDotActive,
                shift?.status === "Paused" &&
                  styles.statusDotPaused,
              ]}
            />

            <Text style={styles.shiftStatusText}>
              {!shift && "Вы не начали смену"}
              {shift?.status === "Working" &&
                "Вы начали смену"}
              {shift?.status === "Paused" &&
                "Смена на паузе"}
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.monthCard}>
            <View style={styles.summaryIcon}>
              <Text style={styles.summaryIconText}>
                ◷
              </Text>
            </View>

            <View style={styles.summaryText}>
              <Text style={styles.summaryValue}>
                {formatNumber(
                  data?.monthlyHours ?? 0,
                )}{" "}
                ч
              </Text>

              <Text style={styles.summaryCaption}>
                отработано за месяц
              </Text>
            </View>
          </View>

          <View style={styles.monthCard}>
            <View style={styles.summaryIcon}>
              <Text style={styles.summaryIconText}>
                ₽
              </Text>
            </View>

            <View style={styles.summaryText}>
              <Text style={styles.summaryValue}>
                {formatMoney(
                  data?.monthlyEarnings ?? 0,
                )}
              </Text>

              <Text style={styles.summaryCaption}>
                {data?.approvedTasksCount ?? 0}{" "}
                подтверждённых заданий
              </Text>
            </View>
          </View>
        </View>

        {!shift && (
          <ActionButton
            label="▷  Начать смену"
            disabled={busy}
            onPress={() =>
              void action("start")
            }
          />
        )}

        {!!shift && (
          <>
            <View style={styles.detailsCard}>
              <Text style={styles.detailsTitle}>
                Детали по смене
              </Text>

              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>
                  Количество пауз
                </Text>

                <Text style={styles.detailsValue}>
                  {shift.pausesCount}
                </Text>
              </View>

              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>
                  Общее время пауз
                </Text>

                <Text style={styles.detailsValue}>
                  {formatDuration(pauseSeconds)}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              {shift.status === "Working" && (
                <ActionButton
                  label="Ⅱ  Пауза"
                  disabled={busy}
                  onPress={() =>
                    void action("pause")
                  }
                />
              )}

              {shift.status === "Paused" && (
                <ActionButton
                  label="▷  Продолжить"
                  disabled={busy}
                  onPress={() =>
                    void action("resume")
                  }
                />
              )}

              <Pressable
                style={styles.finishButton}
                disabled={busy}
                onPress={() =>
                  setFinishVisible(true)
                }
              >
                <Text style={styles.finishButtonText}>
                  Завершить смену
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={finishVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setFinishVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              Завершить смену?
            </Text>

            <Text style={styles.modalText}>
              После завершения смены рабочее
              время будет сохранено.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() =>
                  setFinishVisible(false)
                }
              >
                <Text style={styles.cancelText}>
                  Отмена
                </Text>
              </Pressable>

              <Pressable
                style={styles.confirmButton}
                disabled={busy}
                onPress={() =>
                  void action("finish")
                }
              >
                <Text style={styles.confirmText}>
                  Завершить
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function ActionButton({
  label,
  disabled,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      style={[
        styles.primaryButton,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  header: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 14,
  },

  error: {
    paddingHorizontal: 12,
    paddingVertical: 10,

    borderWidth: 1,
    borderColor: "#f2c8cc",
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: "#a52d36",
    fontSize: 10,
  },

  mainCard: {
    position: "relative",
    overflow: "hidden",
    padding: 16,

    borderRadius: 12,
    backgroundColor: colors.graphite,
  },

  userRow: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  avatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 23,
    backgroundColor: "#505d58",
  },

  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  userName: {
    gap: 3,
  },

  userLastName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },

  userMiddleName: {
    color: "#aebbb5",
    fontSize: 10,
  },

  pattern: {
    position: "absolute",
    top: -22,
    right: -28,
    width: 110,
    height: 120,
    overflow: "hidden",
    transform: [
      {
        rotate: "-32deg",
      },
    ],
  },

  patternLine: {
    width: 6,
    height: 150,
    position: "absolute",
    top: -10,
    backgroundColor: colors.primary,
  },

  metrics: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
  },

  timer: {
    color: colors.white,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -1,
  },

  tasksMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  tasksCount: {
    color: colors.primary,
    fontSize: 23,
    fontWeight: "700",
  },

  tasksLabel: {
    color: colors.white,
    fontSize: 10,
  },

  tasksSmall: {
    color: "#aebbb5",
    fontSize: 8,
  },

  tasksArrow: {
    color: colors.white,
    fontSize: 20,
  },

  shiftStatus: {
    zIndex: 2,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,

    borderRadius: 7,
    backgroundColor: "#35403c",
  },

  shiftStatusActive: {
    backgroundColor: "#214b3a",
  },

  shiftStatusPaused: {
    backgroundColor: "#51462e",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#9aa7a1",
  },

  statusDotActive: {
    backgroundColor: colors.primary,
  },

  statusDotPaused: {
    backgroundColor: colors.warning,
  },

  shiftStatusText: {
    color: "#dce4e0",
    fontSize: 9,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },

  monthCard: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  summaryIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },

  summaryIconText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },

  summaryText: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },

  summaryValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  summaryCaption: {
    color: colors.textSecondary,
    fontSize: 8,
    lineHeight: 11,
  },

  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 8,
    backgroundColor: colors.primary,

    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.55,
  },

  detailsCard: {
    padding: 14,

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  detailsTitle: {
    marginBottom: 9,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },

  detailsRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  detailsLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  detailsValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "600",
  },

  actions: {
    gap: 9,
  },

  finishButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },

  finishButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(24, 24, 29, 0.48)",
  },

  modal: {
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 20,

    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: colors.surface,
  },

  modalHandle: {
    width: 64,
    height: 4,
    alignSelf: "center",
    marginBottom: 16,

    borderRadius: 10,
    backgroundColor: colors.disabled,
  },

  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },

  modalText: {
    marginTop: 8,
    marginBottom: 32,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  modalActions: {
    flexDirection: "row",
    gap: 9,
  },

  cancelButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },

  cancelText: {
    color: colors.text,
    fontSize: 11,
  },

  confirmButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 8,
    backgroundColor: colors.danger,
  },

  confirmText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "600",
  },
});
