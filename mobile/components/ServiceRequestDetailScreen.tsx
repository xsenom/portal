import {
  api,
  ApiError,
} from "@/lib/api";
import {
  readCurrentGeo,
} from "@/lib/service-device";
import {
  clampProgress,
  servicePriorityLabels,
  serviceStatusLabels,
  type ServiceRequestDetail,
  type ServiceRequestStatus,
} from "@/lib/service-requests";
import { colors } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from "expo-camera";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  type ReactNode,
  useCallback,
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
import {
SafeAreaView,
} from "react-native-safe-area-context";
import { ServiceRequestObjectDocuments } from "./ServiceRequestObjectDocuments";

type WaitReason = {
  id: number;
  code: string;
  title: string;
};

type ActionName =
  | "accept"
  | "arrive"
  | "start-work"
  | "wait"
  | "partial"
  | `item-${number}`;

export default function ServiceRequestDetailScreen() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const requestId = useMemo(() => {
    const value = Array.isArray(params.id)
      ? params.id[0]
      : params.id;

    const parsed = Number(value);

    return Number.isInteger(parsed) &&
      parsed > 0
      ? parsed
      : null;
  }, [params.id]);

  const [
    cameraPermission,
    requestCameraPermission,
  ] = useCameraPermissions();

  const [
    request,
    setRequest,
  ] = useState<ServiceRequestDetail | null>(
    null,
  );

  const [
    waitReasons,
    setWaitReasons,
  ] = useState<WaitReason[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    actionName,
    setActionName,
  ] = useState<ActionName | null>(null);

  const [error, setError] =
    useState("");

  const [
    scannerVisible,
    setScannerVisible,
  ] = useState(false);

  const [
    scannerLocked,
    setScannerLocked,
  ] = useState(false);

  const [
    manualBarcode,
    setManualBarcode,
  ] = useState("");

  const [
    waitVisible,
    setWaitVisible,
  ] = useState(false);

  const [
    selectedWaitReasonId,
    setSelectedWaitReasonId,
  ] = useState<number | null>(null);

  const [
    waitComment,
    setWaitComment,
  ] = useState("");

  const [
    partialVisible,
    setPartialVisible,
  ] = useState(false);

  const [
    partialComment,
    setPartialComment,
  ] = useState("");

  const busy = actionName !== null;

  const load = useCallback(
    async (
      showLoader = true,
    ) => {
      if (requestId === null) {
        setError(
          "Не удалось определить заявку",
        );
        setLoading(false);

        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      try {
        const [
          requestResult,
          waitReasonsResult,
        ] = await Promise.all([
          api<ServiceRequestDetail>(
            `/service-requests/${requestId}`,
          ),

          api<WaitReason[]>(
            "/service-requests/wait-reasons",
          ),
        ]);

        setRequest(requestResult);
        setWaitReasons(waitReasonsResult);
        setError("");

        setSelectedWaitReasonId(
          (current) => {
            if (
              current !== null &&
              waitReasonsResult.some(
                (reason) =>
                  reason.id === current,
              )
            ) {
              return current;
            }

            const defaultReason =
              waitReasonsResult.find(
                (reason) =>
                  reason.code === "parts",
              ) ??
              waitReasonsResult[0];

            return defaultReason?.id ??
              null;
          },
        );
      } catch (requestError) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Не удалось загрузить заявку",
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [requestId],
  );

  useFocusEffect(
    useCallback(() => {
      if (user) {
        void load();
      }
    }, [load, user]),
  );

  const selectedWaitReason =
    useMemo(
      () =>
        waitReasons.find(
          (reason) =>
            reason.id ===
            selectedWaitReasonId,
        ) ?? null,
      [
        selectedWaitReasonId,
        waitReasons,
      ],
    );

  async function runAction(
    name: ActionName,
    operation: () => Promise<unknown>,
  ) {
    if (busy) {
      return;
    }

    setActionName(name);
    setError("");

    try {
      await operation();
      await load(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось выполнить действие",
      );

      throw requestError;
    } finally {
      setActionName(null);
    }
  }

  async function acceptRequest() {
    if (requestId === null) {
      return;
    }

    try {
      await runAction(
        "accept",
        () =>
          api(
            `/service-requests/${requestId}/accept`,
            {
              method: "POST",
            },
          ),
      );
    } catch {
      // Ошибка уже отображена.
    }
  }

  async function openArrivalScanner() {
    let granted =
      cameraPermission?.granted ??
      false;

    if (!granted) {
      const result =
        await requestCameraPermission();

      granted = result.granted;
    }

    if (!granted) {
      setError(
        "Разрешите приложению доступ к камере",
      );

      return;
    }

    setManualBarcode("");
    setScannerLocked(false);
    setScannerVisible(true);
  }

  async function confirmArrival(
    barcodeValue: string,
    barcodeFormat: string | null,
  ) {
    if (
      requestId === null ||
      scannerLocked ||
      barcodeValue.trim().length < 2
    ) {
      return;
    }

    setScannerLocked(true);

    try {
      await runAction(
        "arrive",
        async () => {
          const geo =
            await readCurrentGeo();

          return api(
            `/service-requests/${requestId}/arrive`,
            {
              method: "POST",
              body: JSON.stringify({
                barcodeValue:
                  barcodeValue.trim(),

                barcodeFormat:
                  barcodeFormat ??
                  "unknown",

                ...geo,
              }),
            },
          );
        },
      );

      setScannerVisible(false);
      setManualBarcode("");
    } catch {
      setScannerLocked(false);
    }
  }

  function onBarcodeScanned(
    result: BarcodeScanningResult,
  ) {
    void confirmArrival(
      result.data,
      result.type,
    );
  }

  async function startWork() {
    if (requestId === null) {
      return;
    }

    try {
      await runAction(
        "start-work",
        () =>
          api(
            `/service-requests/${requestId}/start-work`,
            {
              method: "POST",
            },
          ),
      );
    } catch {
      // Ошибка уже отображена.
    }
  }

  async function completeWorkItem(
    itemId: number,
  ) {
    if (
      requestId === null ||
      request?.status !== "InProgress"
    ) {
      return;
    }

    try {
      await runAction(
        `item-${itemId}`,
        () =>
          api(
            `/service-requests/${requestId}/work-items/${itemId}/complete`,
            {
              method: "POST",
            },
          ),
      );
    } catch {
      // Ошибка уже отображена.
    }
  }

  async function startWaiting() {
    if (
      requestId === null ||
      selectedWaitReasonId === null
    ) {
      setError(
        "Выберите причину ожидания",
      );

      return;
    }

    if (
      selectedWaitReason?.code ===
        "other" &&
      waitComment.trim() === ""
    ) {
      setError(
        "Для причины «Иное» укажите комментарий",
      );

      return;
    }

    try {
      await runAction(
        "wait",
        () =>
          api(
            `/service-requests/${requestId}/wait`,
            {
              method: "POST",
              body: JSON.stringify({
                reasonId:
                  selectedWaitReasonId,
                comment:
                  waitComment.trim(),
              }),
            },
          ),
      );

      setWaitVisible(false);
      setWaitComment("");
    } catch {
      // Ошибка уже отображена.
    }
  }

  async function partialComplete() {
    if (requestId === null) {
      return;
    }

    try {
      await runAction(
        "partial",
        () =>
          api(
            `/service-requests/${requestId}/partial`,
            {
              method: "POST",
              body: JSON.stringify({
                comment:
                  partialComment.trim(),
              }),
            },
          ),
      );

      setPartialVisible(false);
      setPartialComment("");
    } catch {
      // Ошибка уже отображена.
    }
  }

  if (authLoading) {
    return (
      <LoadingScreen />
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const progress = clampProgress(
    request?.progressPercent ?? 0,
  );

  const canAccept =
    request !== null &&
    [
      "New",
      "Repeat",
      "Defect",
    ].includes(request.status) &&
    !request.isArchived;

  const canArrive =
    request?.status === "Accepted" &&
    !request.isArchived;

  const canStart =
    request !== null &&
    [
      "OnSite",
      "Waiting",
      "PartiallyCompleted",
    ].includes(request.status) &&
    !request.isArchived;

  const canWait =
    request?.status ===
      "InProgress" &&
    !request.isArchived;

  const canPartial =
    request?.status ===
      "InProgress" &&
    progress > 0 &&
    progress < 100 &&
    !request.isArchived;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom"]}
    >
      <View style={styles.shell}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() =>
              router.back()
            }
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              Заявка
            </Text>

            {!!request && (
              <Text
                style={styles.headerNumber}
              >
                № {request.requestNumber}
              </Text>
            )}
          </View>

          <Pressable
            style={styles.headerButton}
            disabled={loading || busy}
            onPress={() =>
              void load()
            }
          >
            <Text
              style={styles.reloadText}
            >
              ↻
            </Text>
          </Pressable>
        </View>

        {!!error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        {loading ? (
          <LoadingScreen />
        ) : request ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={
              styles.content
            }
          >
            {request.isArchived && (
              <View style={styles.archive}>
                <Text
                  style={
                    styles.archiveTitle
                  }
                >
                  Архивная заявка
                </Text>

                <Text
                  style={styles.archiveText}
                >
                  Карточка доступна только
                  для просмотра.
                </Text>
              </View>
            )}

            <View style={styles.mainCard}>
              <View style={styles.badges}>
                <StatusBadge
                  status={request.status}
                />

                {request.isRepeat && (
                  <View
                    style={
                      styles.repeatBadge
                    }
                  >
                    <Text
                      style={
                        styles.repeatText
                      }
                    >
                      ↻ Повтор
                    </Text>
                  </View>
                )}

                {request.isDefect && (
                  <View
                    style={
                      styles.defectBadge
                    }
                  >
                    <Text
                      style={
                        styles.defectText
                      }
                    >
                      ! Брак
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.title}>
                {request.title}
              </Text>

              {!!request.description && (
                <Text
                  style={
                    styles.description
                  }
                >
                  {request.description}
                </Text>
              )}

              <View
                style={
                  styles.progressHeading
                }
              >
                <Text
                  style={
                    styles.progressLabel
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

              <View
                style={styles.progressTrack}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        `${progress}%` as `${number}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.data}>
                <DataRow
                  label="Приоритет"
                  value={
                    servicePriorityLabels[
                      request.priority
                    ]
                  }
                />

                <DataRow
                  label="Тип проблемы"
                  value={
                    request.problemType ??
                    "Не указан"
                  }
                />

                <DataRow
                  label="SLA"
                  value={
                    request.slaDeadline
                      ? formatDateTime(
                          request.slaDeadline,
                        )
                      : "Не указан"
                  }
                />
              </View>
            </View>

            <ActionPanel
              canAccept={canAccept}
              canArrive={canArrive}
              canStart={canStart}
              canWait={canWait}
              canPartial={canPartial}
              status={request.status}
              busy={busy}
              actionName={actionName}
              onAccept={() =>
                void acceptRequest()
              }
              onArrive={() =>
                void openArrivalScanner()
              }
              onStart={() =>
                void startWork()
              }
              onWait={() =>
                setWaitVisible(true)
              }
              onPartial={() =>
                setPartialVisible(true)
              }
            />


            <Pressable
              style={styles.mediaButton}
              onPress={() =>
                router.push(
                  `/service-request-media?id=${request.id}` as never,
                )
              }
            >
              <View>
                <Text style={styles.mediaButtonTitle}>
                  Фото, комментарии и акт
                </Text>

                <Text style={styles.mediaButtonText}>
                  Материалы заявки и закрытие
                </Text>
              </View>

              <Text style={styles.mediaButtonArrow}>
                ›
              </Text>
            </Pressable>

            <Section title="Объект">
              <Text
                style={styles.objectName}
              >
                {request.object.name}
              </Text>

              <Text style={styles.address}>
                {request.object.address}
              </Text>

              {!!request.object
                .controlPanelNumbers && (
                <View style={styles.data}>
                  <DataRow
                    label="Пультовые номера"
                    value={
                      request.object
                        .controlPanelNumbers
                    }
                  />
                </View>
              )}

              {request.object.contacts.map(
                (contact) => (
                  <View
                    key={contact.id}
                    style={styles.contact}
                  >
                    <Text
                      style={
                        styles.contactName
                      }
                    >
                      {contact.fullName ??
                        "Контактное лицо"}
                    </Text>

                    {!!contact.position && (
                      <Text
                        style={
                          styles.contactText
                        }
                      >
                        {contact.position}
                      </Text>
                    )}

                    {!!contact.phone && (
                      <Text
                        style={
                          styles.contactText
                        }
                      >
                        {contact.phone}
                      </Text>
                    )}
                  </View>
                ),
              )}
            </Section>

            <Section title="Исполнители">
              {request.assignees.map(
                (assignee) => (
                  <View
                    key={`${assignee.userId}-${assignee.role}`}
                    style={styles.person}
                  >
                    <View
                      style={
                        styles.personAvatar
                      }
                    >
                      <Text
                        style={
                          styles.personAvatarText
                        }
                      >
                        {assignee.lastName[0] ??
                          ""}
                        {assignee.firstName[0] ??
                          ""}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.personContent
                      }
                    >
                      <Text
                        style={
                          styles.personName
                        }
                      >
                        {assignee.lastName}{" "}
                        {assignee.firstName}
                      </Text>

                      <Text
                        style={
                          styles.personRole
                        }
                      >
                        {assignee.role ===
                        "Primary"
                          ? "Основной техник"
                          : "Соисполнитель"}
                      </Text>
                    </View>
                  </View>
                ),
              )}
            </Section>

            <Section title="Перечень работ">
              {request.workItems.length ===
              0 ? (
                <Text style={styles.emptyText}>
                  Перечень работ не заполнен.
                </Text>
              ) : (
                request.workItems.map(
                  (item) => {
                    const itemBusy =
                      actionName ===
                      `item-${item.id}`;

                    const canComplete =
                      request.status ===
                        "InProgress" &&
                      !item.isCompleted &&
                      !request.isArchived &&
                      !busy;

                    return (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.workItem,
                          canComplete &&
                            styles.workItemActive,
                        ]}
                        disabled={
                          !canComplete
                        }
                        onPress={() =>
                          void completeWorkItem(
                            item.id,
                          )
                        }
                      >
                        <View
                          style={[
                            styles.checkbox,
                            item.isCompleted &&
                              styles.checkboxDone,
                          ]}
                        >
                          {itemBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={
                                colors.primary
                              }
                            />
                          ) : (
                            item.isCompleted && (
                              <Text
                                style={
                                  styles.checkboxText
                                }
                              >
                                ✓
                              </Text>
                            )
                          )}
                        </View>

                        <View
                          style={
                            styles.workItemContent
                          }
                        >
                          <Text
                            style={[
                              styles.workItemTitle,
                              item.isCompleted &&
                                styles.workItemDone,
                            ]}
                          >
                            {item.title}
                          </Text>

                          <Text
                            style={
                              styles.workItemWeight
                            }
                          >
                            Вес: {item.weight}%
                          </Text>
                        </View>

                        {canComplete && (
                          <Text
                            style={
                              styles.workItemAction
                            }
                          >
                            Выполнить
                          </Text>
                        )}
                      </Pressable>
                    );
                  },
                )
              )}
            </Section>

            <Section title="История">
              {request.statusHistory
                .slice(0, 10)
                .map((history) => (
                  <View
                    key={history.id}
                    style={styles.history}
                  >
                    <View
                      style={styles.historyDot}
                    />

                    <View
                      style={
                        styles.historyContent
                      }
                    >
                      <Text
                        style={
                          styles.historyTitle
                        }
                      >
                        {
                          serviceStatusLabels[
                            history.newStatus
                          ]
                        }
                      </Text>

                      {!!history.comment && (
                        <Text
                          style={
                            styles.historyComment
                          }
                        >
                          {history.comment}
                        </Text>
                      )}

                      <Text
                        style={
                          styles.historyDate
                        }
                      >
                        {formatDateTime(
                          history.createdAt,
                        )}
                      </Text>
                    </View>
                  </View>
                ))}
            </Section>
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>
              Заявка не найдена
            </Text>
          </View>
        )}
      </View>

      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() =>
          setScannerVisible(false)
        }
      >
        <SafeAreaView
          style={styles.scannerPage}
        >
          <View style={styles.scannerHeader}>
            <Pressable
              style={styles.headerButton}
              onPress={() =>
                setScannerVisible(false)
              }
            >
              <Text style={styles.closeText}>
                ×
              </Text>
            </Pressable>

            <Text
              style={styles.scannerTitle}
            >
              Штрих-код объекта
            </Text>

            <View
              style={styles.headerButton}
            />
          </View>

          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={
                scannerLocked
                  ? undefined
                  : onBarcodeScanned
              }
            />

            <View
              pointerEvents="none"
              style={styles.scanFrame}
            />

            {actionName === "arrive" && (
              <View
                style={styles.scannerBusy}
              >
                <ActivityIndicator
                  color={colors.white}
                />

                <Text
                  style={
                    styles.scannerBusyText
                  }
                >
                  Проверяем штрих-код…
                </Text>
              </View>
            )}
          </View>

          <View
            style={styles.manualBarcode}
          >
            <Text
              style={
                styles.manualBarcodeTitle
              }
            >
              Или введите код вручную
            </Text>

            <TextInput
              style={styles.input}
              value={manualBarcode}
              onChangeText={
                setManualBarcode
              }
              placeholder="Значение штрих-кода"
              placeholderTextColor={
                colors.textSecondary
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ActionButton
              label="Подтвердить прибытие"
              loading={
                actionName === "arrive"
              }
              disabled={
                manualBarcode.trim()
                  .length < 2 ||
                busy
              }
              onPress={() =>
                void confirmArrival(
                  manualBarcode,
                  "manual",
                )
              }
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={waitVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setWaitVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              Причина ожидания
            </Text>

            <Text style={styles.modalText}>
              Выберите, почему работы временно
              остановлены.
            </Text>

            <ScrollView
              style={styles.reasonList}
            >
              {waitReasons.map((reason) => {
                const selected =
                  reason.id ===
                  selectedWaitReasonId;

                return (
                  <Pressable
                    key={reason.id}
                    style={[
                      styles.reason,
                      selected &&
                        styles.reasonSelected,
                    ]}
                    onPress={() =>
                      setSelectedWaitReasonId(
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
            
        <ServiceRequestObjectDocuments
          request={request}
        />
</ScrollView>

            <TextInput
              style={styles.commentInput}
              value={waitComment}
              onChangeText={setWaitComment}
              multiline
              placeholder={
                selectedWaitReason?.code ===
                "other"
                  ? "Комментарий обязателен"
                  : "Комментарий, необязательно"
              }
              placeholderTextColor={
                colors.textSecondary
              }
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                label="Отмена"
                disabled={busy}
                onPress={() =>
                  setWaitVisible(false)
                }
              />

              <ActionButton
                label="Начать ожидание"
                loading={
                  actionName === "wait"
                }
                disabled={
                  busy ||
                  selectedWaitReasonId ===
                    null
                }
                onPress={() =>
                  void startWaiting()
                }
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={partialVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPartialVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              Частичное выполнение
            </Text>

            <Text style={styles.modalText}>
              Выполнено {Math.round(progress)}%.
              Заявку можно будет продолжить
              позднее.
            </Text>

            <TextInput
              style={styles.commentInput}
              value={partialComment}
              onChangeText={
                setPartialComment
              }
              multiline
              placeholder="Что осталось выполнить"
              placeholderTextColor={
                colors.textSecondary
              }
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                label="Отмена"
                disabled={busy}
                onPress={() =>
                  setPartialVisible(false)
                }
              />

              <ActionButton
                label="Сохранить"
                loading={
                  actionName === "partial"
                }
                disabled={busy}
                onPress={() =>
                  void partialComplete()
                }
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type ActionPanelProps = {
  canAccept: boolean;
  canArrive: boolean;
  canStart: boolean;
  canWait: boolean;
  canPartial: boolean;
  status: ServiceRequestStatus;
  busy: boolean;
  actionName: ActionName | null;
  onAccept: () => void;
  onArrive: () => void;
  onStart: () => void;
  onWait: () => void;
  onPartial: () => void;
};

function ActionPanel({
  canAccept,
  canArrive,
  canStart,
  canWait,
  canPartial,
  status,
  busy,
  actionName,
  onAccept,
  onArrive,
  onStart,
  onWait,
  onPartial,
}: ActionPanelProps) {
  if (
    !canAccept &&
    !canArrive &&
    !canStart &&
    !canWait &&
    !canPartial
  ) {
    return null;
  }

  return (
    <View style={styles.actionPanel}>
      <Text style={styles.actionPanelTitle}>
        Действия
      </Text>

      <View style={styles.actionList}>
        {canAccept && (
          <ActionButton
            label="Принять заявку"
            loading={
              actionName === "accept"
            }
            disabled={busy}
            onPress={onAccept}
          />
        )}

        {canArrive && (
          <ActionButton
            label="Сканировать прибытие"
            loading={
              actionName === "arrive"
            }
            disabled={busy}
            onPress={onArrive}
          />
        )}

        {canStart && (
          <ActionButton
            label={
              status === "OnSite"
                ? "Начать работы"
                : "Продолжить работы"
            }
            loading={
              actionName === "start-work"
            }
            disabled={busy}
            onPress={onStart}
          />
        )}

        {canWait && (
          <SecondaryButton
            label="Перевести в ожидание"
            disabled={busy}
            onPress={onWait}
          />
        )}

        {canPartial && (
          <SecondaryButton
            label="Завершить частично"
            disabled={busy}
            onPress={onPartial}
          />
        )}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.white}
        />
      ) : (
        <Text
          style={styles.actionButtonText}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.secondaryButton,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={styles.secondaryButtonText}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatusBadge({
  status,
}: {
  status: ServiceRequestStatus;
}) {
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusBadgeText}>
        {serviceStatusLabels[status]}
      </Text>
    </View>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.center}>
      <ActivityIndicator
        color={colors.primary}
      />

      <Text style={styles.loadingText}>
        Загружаем карточку…
      </Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {children}
    </View>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>
        {label}
      </Text>

      <Text style={styles.dataValue}>
        {value}
      </Text>
    </View>
  );
}

function formatDateTime(
  value: string,
): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.background,
  },

  shell: {
    width: "100%",
    maxWidth: 430,
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: colors.text,
    fontSize: 35,
    lineHeight: 36,
  },

  closeText: {
    color: colors.text,
    fontSize: 30,
  },

  headerCenter: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },

  headerNumber: {
    marginTop: 1,
    color: colors.textSecondary,
    fontSize: 10,
  },

  reloadText: {
    color: colors.primary,
    fontSize: 23,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 12,
    paddingBottom: 30,
    gap: 11,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  error: {
    margin: 12,
    marginBottom: 0,
    padding: 11,
    borderWidth: 1,
    borderColor: "#f3c7cb",
    borderRadius: 9,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: "#a52d36",
    fontSize: 12,
    lineHeight: 16,
  },

  archive: {
    padding: 12,
    borderRadius: 9,
    backgroundColor: "#fff8e4",
  },

  archiveTitle: {
    color: "#96680b",
    fontSize: 12,
    fontWeight: "700",
  },

  archiveText: {
    marginTop: 3,
    color: "#96680b",
    fontSize: 11,
  },

  mainCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
  },

  statusBadgeText: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "700",
  },

  repeatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#fff4dc",
  },

  repeatText: {
    color: "#a36512",
    fontSize: 10,
    fontWeight: "700",
  },

  defectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.dangerSoft,
  },

  defectText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "700",
  },

  title: {
    marginTop: 11,
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
  },

  description: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  progressHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },

  progressLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  progressValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  progressTrack: {
    height: 7,
    marginTop: 7,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: colors.border,
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },

  data: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  dataRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  dataLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  dataValue: {
    maxWidth: "62%",
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },

  actionPanel: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.graphite,
  },

  actionPanelTitle: {
    marginBottom: 10,
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  actionList: {
    gap: 8,
  },

  actionButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  actionButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },

  secondaryButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
  },

  secondaryButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },


  mediaButton: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },

  mediaButtonTitle: {
    color: colors.primaryHover,
    fontSize: 13,
    fontWeight: "700",
  },

  mediaButtonText: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 10,
  },

  mediaButtonArrow: {
    color: colors.primary,
    fontSize: 25,
  },

  section: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  sectionTitle: {
    marginBottom: 10,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  objectName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  address: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  contact: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
  },

  contactName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },

  contactText: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 10,
  },

  person: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  personAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
  },

  personAvatarText: {
    color: colors.primaryHover,
    fontSize: 11,
    fontWeight: "700",
  },

  personContent: {
    minWidth: 0,
    flex: 1,
  },

  personName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },

  personRole: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 10,
  },

  workItem: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 7,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderRadius: 7,
  },

  workItemActive: {
    backgroundColor: colors.primarySoft,
  },

  checkbox: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.disabled,
    borderRadius: 6,
  },

  checkboxDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  checkboxText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  workItemContent: {
    minWidth: 0,
    flex: 1,
  },

  workItemTitle: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },

  workItemDone: {
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },

  workItemWeight: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 10,
  },

  workItemAction: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "700",
  },

  history: {
    minHeight: 55,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  historyDot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  historyContent: {
    minWidth: 0,
    flex: 1,
  },

  historyTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },

  historyComment: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },

  historyDate: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 9,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },

  disabled: {
    opacity: 0.5,
  },

  scannerPage: {
    flex: 1,
    backgroundColor: colors.graphite,
  },

  scannerHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },

  scannerTitle: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  cameraWrap: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  scanFrame: {
    width: 250,
    height: 170,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 14,
  },

  scannerBusy: {
    position: "absolute",
    right: 25,
    bottom: 25,
    left: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(31,41,38,0.88)",
  },

  scannerBusyText: {
    color: colors.white,
    fontSize: 12,
  },

  manualBarcode: {
    gap: 10,
    padding: 16,
    backgroundColor: colors.surface,
  },

  manualBarcodeTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    color: colors.text,
    backgroundColor: colors.surfaceSoft,
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
    borderRadius: 4,
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
    fontSize: 12,
    lineHeight: 17,
  },

  reasonList: {
    maxHeight: 300,
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
    borderRadius: 9,
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
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 12,
  },

  reasonTextSelected: {
    color: colors.primaryHover,
    fontWeight: "600",
  },

  commentInput: {
    minHeight: 86,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    color: colors.text,
    fontSize: 12,
    textAlignVertical: "top",
  },

  modalActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
  },
});
