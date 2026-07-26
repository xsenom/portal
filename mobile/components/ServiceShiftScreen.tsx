import {
  api,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  deviceLabel,
  readCurrentGeo,
} from "@/lib/service-device";
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
  TextInput,
  View,
} from "react-native";

type PauseReason = {
  id: number;
  code: string;
  title: string;
};

type ActiveShift = {
  id: number;
  status: "Working" | "Paused";
  startedAt: string;
  workSeconds: number;
  pauseSeconds: number;
  currentSegmentStartedAt: string | null;
  currentPauseStartedAt: string | null;
  pausesCount: number;

  startLatitude?: number | null;
  startLongitude?: number | null;
  startAccuracy?: number | null;
  startDevice?: string | null;
  startPhotoUrl?: string | null;

  pauseReason?: PauseReason | null;
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
  serviceRequestsCount: number;
};

type ShiftAction =
  | "start"
  | "pause"
  | "resume"
  | "finish";

function formatTimer(seconds: number) {
  const value = Math.max(
    0,
    Math.floor(seconds),
  );

  const hours = Math.floor(value / 3600);

  const minutes = Math.floor(
    (value % 3600) / 60,
  );

  const remainingSeconds = value % 60;

  return [
    hours,
    minutes,
    remainingSeconds,
  ]
    .map((part) =>
      String(part).padStart(2, "0"),
    )
    .join(":");
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

export default function ServiceShiftScreen() {
  const { user } = useAuth();

  const [data, setData] =
    useState<Dashboard | null>(null);

  const [
    pauseReasons,
    setPauseReasons,
  ] = useState<PauseReason[]>([]);

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [now, setNow] =
    useState(Date.now());

  const [
    finishVisible,
    setFinishVisible,
  ] = useState(false);

  const [
    pauseVisible,
    setPauseVisible,
  ] = useState(false);

  const [
    selectedReasonId,
    setSelectedReasonId,
  ] = useState<number | null>(null);

  const [
    pauseComment,
    setPauseComment,
  ] = useState("");

  async function load() {
    try {
      const [
        dashboardResult,
        reasonsResult,
      ] = await Promise.all([
        api<Dashboard>(
          "/time/dashboard",
        ),
        api<PauseReason[]>(
          "/time/pause-reasons",
        ),
      ]);

      setData(dashboardResult);
      setPauseReasons(reasonsResult);
      setError("");

      if (
        selectedReasonId === null &&
        reasonsResult.length > 0
      ) {
        const defaultReason =
          reasonsResult.find(
            (reason) =>
              reason.code === "lunch",
          ) ?? reasonsResult[0];

        setSelectedReasonId(
          defaultReason.id,
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось загрузить смену",
      );
    }
  }

  async function action(
    name: ShiftAction,
    body?: Record<string, unknown>,
  ) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      let payload:
        | Record<string, unknown>
        | undefined = body;

      if (
        name === "start" ||
        name === "finish"
      ) {
        const geo =
          await readCurrentGeo();

        payload = {
          ...body,
          ...geo,
        };

        if (name === "start") {
          payload.device =
            deviceLabel();
        }
      }

      await api(
        `/time/${name}`,
        {
          method: "POST",
          body: payload
            ? JSON.stringify(payload)
            : undefined,
        },
      );

      setPauseVisible(false);
      setFinishVisible(false);
      setPauseComment("");

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

  async function pauseShift() {
    if (selectedReasonId === null) {
      setError(
        "Выберите причину паузы",
      );

      return;
    }

    await action("pause", {
      reasonId: selectedReasonId,
      comment: pauseComment.trim(),
    });
  }

  useEffect(() => {
    void load();

    const refresh = setInterval(
      () => void load(),
      30000,
    );

    return () => {
      clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      1000,
    );

    return () => {
      clearInterval(timer);
    };
  }, []);

  const shift =
    data?.activeShift ?? null;

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

  const selectedReason =
    pauseReasons.find(
      (reason) =>
        reason.id === selectedReasonId,
    ) ?? null;

  const selectedReasonNeedsComment =
    selectedReason?.code === "other";

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Рабочая смена
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
              <Text style={styles.userFullName}>
                {user?.lastName || "Профиль"}{" "}
                {user?.firstName ?? ""}
              </Text>

              <Text style={styles.userPosition}>
                {user?.position ||
                  "Технический специалист"}
              </Text>
            </View>
          </View>

          <View style={styles.metrics}>
            <View>
              <Text style={styles.timer}>
                {formatTimer(workSeconds)}
              </Text>

              <Text style={styles.timerCaption}>
                рабочее время
              </Text>
            </View>

            <Pressable
              style={styles.requestsMetric}
              onPress={() =>
                router.push(
                  "/(tabs)/tasks",
                )
              }
            >
              <Text style={styles.requestsCount}>
                {data?.serviceRequestsCount ??
                  0}
              </Text>

              <View>
                <Text
                  style={styles.requestsLabel}
                >
                  заявок
                </Text>

                <Text
                  style={styles.requestsSmall}
                >
                  назначено
                </Text>
              </View>

              <Text style={styles.requestsArrow}>
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
              {!shift && "Смена не начата"}

              {shift?.status === "Working" &&
                "Смена активна"}

              {shift?.status === "Paused" &&
                `Пауза${
                  shift.pauseReason
                    ? `: ${shift.pauseReason.title}`
                    : ""
                }`}
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
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

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatMoney(
                data?.monthlyEarnings ??
                  0,
              )}
            </Text>

            <Text style={styles.summaryCaption}>
              подтверждённые задания
            </Text>
          </View>
        </View>

        {!shift && (
          <ActionButton
            label={
              busy
                ? "Определяем местоположение…"
                : "▷  Начать смену"
            }
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
                Детали смены
              </Text>

              <DetailRow
                label="Количество пауз"
                value={String(
                  shift.pausesCount,
                )}
              />

              <DetailRow
                label="Общее время пауз"
                value={formatDuration(
                  pauseSeconds,
                )}
              />

              {!!shift.startDevice && (
                <DetailRow
                  label="Устройство"
                  value={shift.startDevice}
                />
              )}

              {shift.status === "Paused" &&
                shift.pauseReason && (
                  <DetailRow
                    label="Причина паузы"
                    value={
                      shift.pauseReason.title
                    }
                  />
                )}
            </View>

            <View style={styles.actions}>
              {shift.status === "Working" && (
                <ActionButton
                  label="Ⅱ  Поставить на паузу"
                  disabled={busy}
                  onPress={() =>
                    setPauseVisible(true)
                  }
                />
              )}

              {shift.status === "Paused" && (
                <ActionButton
                  label="▷  Продолжить смену"
                  disabled={busy}
                  onPress={() =>
                    void action("resume")
                  }
                />
              )}

              <Pressable
                style={[
                  styles.finishButton,
                  busy && styles.disabled,
                ]}
                disabled={busy}
                onPress={() =>
                  setFinishVisible(true)
                }
              >
                <Text
                  style={
                    styles.finishButtonText
                  }
                >
                  Завершить смену
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={pauseVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPauseVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              Причина паузы
            </Text>

            <Text style={styles.modalText}>
              Выберите причину. Она сохранится
              в истории смены.
            </Text>

            <ScrollView
              style={styles.reasonList}
            >
              {pauseReasons.map((reason) => {
                const selected =
                  selectedReasonId ===
                  reason.id;

                return (
                  <Pressable
                    key={reason.id}
                    style={[
                      styles.reasonButton,
                      selected &&
                        styles.reasonButtonSelected,
                    ]}
                    onPress={() =>
                      setSelectedReasonId(
                        reason.id,
                      )
                    }
                  >
                    <View
                      style={[
                        styles.radio,
                        selected &&
                          styles.radioSelected,
                      ]}
                    >
                      {selected && (
                        <View
                          style={
                            styles.radioDot
                          }
                        />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.reasonText,
                        selected &&
                          styles.reasonTextSelected,
                      ]}
                    >
                      {reason.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput
              style={styles.commentInput}
              value={pauseComment}
              onChangeText={setPauseComment}
              multiline
              placeholder={
                selectedReasonNeedsComment
                  ? "Комментарий обязателен"
                  : "Комментарий, необязательно"
              }
              placeholderTextColor={
                colors.textSecondary
              }
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                disabled={busy}
                onPress={() =>
                  setPauseVisible(false)
                }
              >
                <Text style={styles.cancelText}>
                  Отмена
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmButton,
                  busy && styles.disabled,
                ]}
                disabled={
                  busy ||
                  selectedReasonId === null ||
                  (
                    selectedReasonNeedsComment &&
                    pauseComment.trim() === ""
                  )
                }
                onPress={() =>
                  void pauseShift()
                }
              >
                <Text style={styles.confirmText}>
                  Начать паузу
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
              Приложение проверит активные
              заявки и сохранит текущее
              местоположение.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                disabled={busy}
                onPress={() =>
                  setFinishVisible(false)
                }
              >
                <Text style={styles.cancelText}>
                  Отмена
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.dangerButton,
                  busy && styles.disabled,
                ]}
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

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({
  label,
  value,
}: DetailRowProps) {
  return (
    <View style={styles.detailsRow}>
      <Text style={styles.detailsLabel}>
        {label}
      </Text>

      <Text style={styles.detailsValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontSize: 17,
    fontWeight: "700",
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 30,
    gap: 14,
  },

  error: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#f2c8cc",
    borderRadius: 9,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: "#a52d36",
    fontSize: 12,
    lineHeight: 17,
  },

  mainCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.graphite,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#505d58",
  },

  avatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },

  userName: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },

  userFullName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },

  userPosition: {
    color: "#aebbb5",
    fontSize: 12,
  },

  metrics: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },

  timer: {
    color: colors.white,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -1,
  },

  timerCaption: {
    marginTop: 3,
    color: "#aebbb5",
    fontSize: 10,
  },

  requestsMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  requestsCount: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "700",
  },

  requestsLabel: {
    color: colors.white,
    fontSize: 12,
  },

  requestsSmall: {
    color: "#aebbb5",
    fontSize: 10,
  },

  requestsArrow: {
    color: colors.white,
    fontSize: 22,
  },

  shiftStatus: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#35403c",
  },

  shiftStatusActive: {
    backgroundColor: "#214b3a",
  },

  shiftStatusPaused: {
    backgroundColor: "#51462e",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
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
    fontSize: 11,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },

  summaryCard: {
    minWidth: 0,
    flex: 1,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  summaryCaption: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
  },

  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },

  detailsCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  detailsTitle: {
    marginBottom: 7,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  detailsRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  detailsLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  detailsValue: {
    maxWidth: "58%",
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },

  actions: {
    gap: 10,
  },

  finishButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 9,
    backgroundColor: colors.surface,
  },

  finishButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.5,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(24,24,29,0.52)",
  },

  modal: {
    maxHeight: "86%",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.surface,
  },

  modalHandle: {
    width: 62,
    height: 4,
    alignSelf: "center",
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: colors.disabled,
  },

  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
  },

  modalText: {
    marginTop: 7,
    marginBottom: 14,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 17,
  },

  reasonList: {
    maxHeight: 300,
  },

  reasonButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
  },

  reasonButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.disabled,
    borderRadius: 10,
  },

  radioSelected: {
    borderColor: colors.primary,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  reasonText: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },

  reasonTextSelected: {
    color: colors.primaryHover,
    fontWeight: "600",
  },

  commentInput: {
    minHeight: 82,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: "top",
  },

  modalActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
  },

  cancelButton: {
    minHeight: 47,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
  },

  cancelText: {
    color: colors.text,
    fontSize: 13,
  },

  confirmButton: {
    minHeight: 47,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  dangerButton: {
    minHeight: 47,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.danger,
  },

  confirmText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
});
