import {
  api,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  deviceLabel,
  readCurrentGeo,
} from "@/lib/service-device";
import {
  serviceStatusLabels,
} from "@/lib/service-requests";
import { colors } from "@/lib/theme";
import {
  type Href,
  router,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type ShiftStatus =
  | "Working"
  | "Paused";

type ActiveShift = {
  id: number;
  status: ShiftStatus;
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

type PauseReason = {
  id: number;
  code: string;
  name?: string;
  title?: string;
  label?: string;
};

type RequestSummary = {
  id: number;
  requestNumber?: string;
  title?: string;
  status: string;
  progressPercent?: number;
  isRepeat?: boolean;
  isDefect?: boolean;
  isArchived?: boolean;
  objectAddress?: string | null;
  objectName?: string | null;
  slaDeadline?: string | null;
  object?: {
    address?: string | null;
    name?: string | null;
  } | null;
};

function formatDuration(seconds: number) {
  const value = Math.max(
    0,
    Math.floor(seconds),
  );

  const hours =
    Math.floor(value / 3600);

  const minutes =
    Math.floor(
      (value % 3600) / 60,
    );

  const secondsPart =
    value % 60;

  return [
    hours,
    minutes,
    secondsPart,
  ]
    .map((item) =>
      String(item).padStart(2, "0"),
    )
    .join(":");
}

function requestAddress(
  request: RequestSummary,
) {
  return (
    request.objectAddress
    ?? request.object?.address
    ?? request.objectName
    ?? request.object?.name
    ?? "Адрес не указан"
  );
}

function progressValue(
  request: RequestSummary,
) {
  const value = Number(
    request.progressPercent ?? 0,
  );

  return Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

function reasonTitle(
  reason: PauseReason,
) {
  return (
    reason.name
    ?? reason.title
    ?? reason.label
    ?? reason.code
  );
}

function statusTitle(status: string) {
  return (
    serviceStatusLabels[
      status as keyof typeof serviceStatusLabels
    ]
    ?? status
  );
}

export default function MainDashboardScreen() {
  const { user } = useAuth();

  const [dashboard, setDashboard] =
    useState<Dashboard | null>(null);

  const [requests, setRequests] =
    useState<RequestSummary[]>([]);

  const [pauseReasons, setPauseReasons] =
    useState<PauseReason[]>([]);

  const [pauseVisible, setPauseVisible] =
    useState(false);

  const [selectedReasonId, setSelectedReasonId] =
    useState<number | null>(null);

  const [pauseComment, setPauseComment] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [now, setNow] =
    useState(Date.now());

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        }

        const [
          dashboardResult,
          reasonsResult,
          requestsResult,
        ] = await Promise.all([
          api<Dashboard>("/time/dashboard"),
          api<PauseReason[]>(
            "/time/pause-reasons",
          ),
          api<RequestSummary[]>(
            "/service-requests",
          ),
        ]);

        setDashboard(dashboardResult);
        setPauseReasons(reasonsResult);

        const activeRequests =
          requestsResult
            .filter((request) => {
              return (
                request.isArchived !== true
                && ![
                  "Completed",
                  "Closed",
                ].includes(request.status)
              );
            })
            .slice(0, 5);

        setRequests(activeRequests);

        if (
          selectedReasonId === null
          && reasonsResult.length > 0
        ) {
          const defaultReason =
            reasonsResult.find(
              (reason) =>
                reason.code === "lunch",
            )
            ?? reasonsResult[0];

          setSelectedReasonId(
            defaultReason.id,
          );
        }

        setError("");
      } catch (caughtError) {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Не удалось загрузить рабочий стол",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedReasonId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();

      return undefined;
    }, [load]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void load();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [load]);

  const shift =
    dashboard?.activeShift ?? null;

  const currentWorkSeconds =
    useMemo(() => {
      if (!shift) {
        return 0;
      }

      let value =
        Number(shift.workSeconds ?? 0);

      if (
        shift.status === "Working"
        && shift.currentSegmentStartedAt
      ) {
        const segmentStarted =
          new Date(
            shift.currentSegmentStartedAt,
          ).getTime();

        if (
          Number.isFinite(segmentStarted)
        ) {
          value += Math.max(
            0,
            Math.floor(
              (now - segmentStarted) / 1000,
            ),
          );
        }
      }

      return value;
    }, [
      now,
      shift,
    ]);

  async function shiftAction(
    action:
      | "start"
      | "pause"
      | "resume"
      | "finish",
    body?: Record<string, unknown>,
  ) {
    if (busy) {
      return;
    }

    try {
      setBusy(true);
      setError("");

      let payload:
        | Record<string, unknown>
        | undefined = body;

      if (
        action === "start"
        || action === "finish"
      ) {
        const geo =
          await readCurrentGeo();

        payload = {
          ...body,
          geo,
        };

        if (action === "start") {
          payload.device =
            deviceLabel();
        }
      }

      await api(`/time/${action}`, {
        method: "POST",
        body: payload
          ? JSON.stringify(payload)
          : undefined,
      });

      setPauseVisible(false);
      setPauseComment("");

      await load();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось выполнить действие",
      );
    } finally {
      setBusy(false);
    }
  }

  function finishShift() {
    Alert.alert(
      "Завершить смену?",
      "Система проверит, что у вас нет заявок в статусе «В работе».",
      [
        {
          text: "Отмена",
          style: "cancel",
        },
        {
          text: "Завершить",
          style: "destructive",
          onPress: () => {
            void shiftAction("finish");
          },
        },
      ],
    );
  }

  async function pauseShift() {
    if (selectedReasonId === null) {
      setError(
        "Выберите причину паузы",
      );

      return;
    }

    await shiftAction("pause", {
      reasonId: selectedReasonId,
      comment: pauseComment.trim(),
    });
  }

  const initials = [
    user?.lastName?.[0],
    user?.firstName?.[0],
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "П";

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Загружаем рабочий стол…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerCaption}>
            Рабочий стол
          </Text>

          <Text style={styles.headerTitle}>
            {user?.firstName
              ? `Здравствуйте, ${user.firstName}`
              : "Главная"}
          </Text>
        </View>

        <Pressable
          style={styles.profileButton}
          onPress={() => {
            router.push(
              "/(tabs)/profile" as unknown as Href,
            );
          }}
        >
          <Text style={styles.profileText}>
            {initials}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() =>
              void load(true)
            }
          />
        }
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.shiftCard}>
          <View style={styles.shiftHeader}>
            <View>
              <Text style={styles.shiftCaption}>
                Текущий статус
              </Text>

              <Text style={styles.shiftStatus}>
                {!shift
                  ? "Не на смене"
                  : shift.status === "Paused"
                    ? "Пауза"
                    : "На смене"}
              </Text>
            </View>

            <View
              style={[
                styles.statusDot,
                !shift
                  ? styles.statusOff
                  : shift.status === "Paused"
                    ? styles.statusPause
                    : styles.statusWork,
              ]}
            />
          </View>

          <Text style={styles.timer}>
            {formatDuration(
              currentWorkSeconds,
            )}
          </Text>

          <Text style={styles.timerCaption}>
            Время работы за текущую смену
          </Text>

          {!shift && (
            <Pressable
              style={[
                styles.primaryButton,
                busy && styles.disabled,
              ]}
              disabled={busy}
              onPress={() =>
                void shiftAction("start")
              }
            >
              {busy ? (
                <ActivityIndicator
                  color={colors.white}
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Начать смену
                </Text>
              )}
            </Pressable>
          )}

          {shift?.status === "Working" && (
            <View style={styles.shiftActions}>
              <Pressable
                style={styles.pauseButton}
                disabled={busy}
                onPress={() =>
                  setPauseVisible(true)
                }
              >
                <Text
                  style={
                    styles.pauseButtonText
                  }
                >
                  Пауза
                </Text>
              </Pressable>

              <Pressable
                style={styles.finishButton}
                disabled={busy}
                onPress={finishShift}
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
          )}

          {shift?.status === "Paused" && (
            <Pressable
              style={[
                styles.primaryButton,
                busy && styles.disabled,
              ]}
              disabled={busy}
              onPress={() =>
                void shiftAction("resume")
              }
            >
              {busy ? (
                <ActivityIndicator
                  color={colors.white}
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Возобновить работу
                </Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.quickActions}>
          <Pressable
            style={styles.quickCard}
            onPress={() => {
              router.push(
                "/(tabs)/tasks" as unknown as Href,
              );
            }}
          >
            <Text style={styles.quickIcon}>
              ☷
            </Text>

            <Text style={styles.quickTitle}>
              Все заявки
            </Text>

            <Text style={styles.quickCaption}>
              Открыть список
            </Text>
          </Pressable>

          <Pressable
            style={styles.quickCard}
            onPress={() => {
              router.push(
                "/archive" as unknown as Href,
              );
            }}
          >
            <Text style={styles.quickIcon}>
              ▣
            </Text>

            <Text style={styles.quickTitle}>
              Архив
            </Text>

            <Text style={styles.quickCaption}>
              Закрытые заявки
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Активные заявки
            </Text>

            <Text style={styles.sectionCaption}>
              Последние назначенные заявки
            </Text>
          </View>

          <Pressable
            onPress={() => {
              router.push(
                "/(tabs)/tasks" as unknown as Href,
              );
            }}
          >
            <Text style={styles.allLink}>
              Все заявки ›
            </Text>
          </Pressable>
        </View>

        {requests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Активных заявок нет
            </Text>

            <Text style={styles.emptyText}>
              Новые назначения появятся
              на этом экране автоматически.
            </Text>
          </View>
        ) : (
          requests.map((request) => {
            const progress =
              progressValue(request);

            return (
              <Pressable
                key={request.id}
                style={styles.requestCard}
                onPress={() => {
                  router.push({
                    pathname:
                      "/service-request",
                    params: {
                      id: String(request.id),
                    },
                  } as unknown as Href);
                }}
              >
                <View style={styles.requestTop}>
                  <Text style={styles.requestNumber}>
                    {request.requestNumber
                      ?? `Заявка №${request.id}`}
                  </Text>

                  <Text style={styles.requestStatus}>
                    {statusTitle(
                      request.status,
                    )}
                  </Text>
                </View>

                <Text
                  style={styles.requestAddress}
                  numberOfLines={2}
                >
                  {requestAddress(request)}
                </Text>

                <View style={styles.tags}>
                  {(request.isDefect
                    || request.status ===
                      "Defect") && (
                    <View style={styles.defectTag}>
                      <Text
                        style={
                          styles.defectTagText
                        }
                      >
                        Брак
                      </Text>
                    </View>
                  )}

                  {(request.isRepeat
                    || request.status ===
                      "Repeat") && (
                    <View style={styles.repeatTag}>
                      <Text
                        style={
                          styles.repeatTagText
                        }
                      >
                        ↻ Повтор
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.progressHeader}>
                  <Text
                    style={
                      styles.progressCaption
                    }
                  >
                    Выполнение
                  </Text>

                  <Text
                    style={
                      styles.progressValue
                    }
                  >
                    {Math.round(progress)}%
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width:
                          `${progress}%`,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })
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
        <Pressable
          style={styles.overlay}
          onPress={() =>
            setPauseVisible(false)
          }
        >
          <Pressable
            style={styles.modal}
            onPress={() => undefined}
          >
            <Text style={styles.modalTitle}>
              Причина паузы
            </Text>

            <ScrollView
              style={styles.reasonList}
            >
              {pauseReasons.map(
                (reason) => {
                  const selected =
                    selectedReasonId
                    === reason.id;

                  return (
                    <Pressable
                      key={reason.id}
                      style={[
                        styles.reason,
                        selected
                          && styles.reasonSelected,
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
                          selected
                            && styles.radioSelected,
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
                        style={
                          styles.reasonText
                        }
                      >
                        {reasonTitle(reason)}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </ScrollView>

            <TextInput
              style={styles.pauseComment}
              value={pauseComment}
              onChangeText={setPauseComment}
              placeholder="Комментарий к паузе"
              placeholderTextColor="#98a39e"
              multiline
              maxLength={500}
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
                style={styles.confirmButton}
                disabled={busy}
                onPress={() =>
                  void pauseShift()
                }
              >
                {busy ? (
                  <ActivityIndicator
                    color={colors.white}
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmText
                    }
                  >
                    Начать паузу
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.background,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  header: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  headerCaption: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  headerTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },

  profileButton: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.graphite,
  },

  profileText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  content: {
    padding: 14,
    paddingBottom: 35,
  },

  errorBox: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },

  shiftCard: {
    padding: 17,
    borderRadius: 17,
    backgroundColor: colors.graphite,
  },

  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  shiftCaption: {
    color: "#aeb9b3",
    fontSize: 11,
  },

  shiftStatus: {
    marginTop: 4,
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
  },

  statusDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },

  statusOff: {
    backgroundColor: "#8d9691",
  },

  statusWork: {
    backgroundColor: "#55c77c",
  },

  statusPause: {
    backgroundColor: "#f0b44c",
  },

  timer: {
    marginTop: 23,
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1,
  },

  timerCaption: {
    marginTop: 4,
    marginBottom: 18,
    color: "#aeb9b3",
    fontSize: 11,
  },

  primaryButton: {
    minHeight: 51,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },

  shiftActions: {
    flexDirection: "row",
    gap: 9,
  },

  pauseButton: {
    minHeight: 49,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#77827c",
    borderRadius: 12,
  },

  pauseButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  finishButton: {
    minHeight: 49,
    flex: 1.3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.danger,
  },

  finishButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },

  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 13,
  },

  quickCard: {
    minHeight: 105,
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  quickIcon: {
    color: colors.primary,
    fontSize: 22,
  },

  quickTitle: {
    marginTop: 9,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },

  quickCaption: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 10,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 11,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },

  sectionCaption: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 10,
  },

  allLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  empty: {
    padding: 25,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

  requestCard: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  requestTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  requestNumber: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },

  requestStatus: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },

  requestAddress: {
    marginTop: 7,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  tags: {
    flexDirection: "row",
    gap: 6,
    marginTop: 9,
  },

  defectTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.dangerSoft,
  },

  defectTagText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "800",
  },

  repeatTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.primarySoft,
  },

  repeatTagText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 13,
  },

  progressCaption: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  progressValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },

  progressTrack: {
    height: 6,
    marginTop: 6,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: colors.border,
  },

  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(0,0,0,0.44)",
  },

  modal: {
    width: "100%",
    maxWidth: 410,
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },

  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },

  reasonList: {
    maxHeight: 280,
    marginTop: 14,
  },

  reason: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },

  reasonSelected: {
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
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },

  pauseComment: {
    minHeight: 80,
    marginTop: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
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
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },

  cancelText: {
    color: colors.text,
    fontSize: 13,
  },

  confirmButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  confirmText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },

  disabled: {
    opacity: 0.5,
  },
});
