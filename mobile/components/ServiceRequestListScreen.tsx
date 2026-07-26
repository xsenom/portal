import {
  api,
  ApiError,
} from "@/lib/api";
import {
  clampProgress,
  servicePriorityLabels,
  serviceStatusLabels,
  type ServiceRequestStatus,
  type ServiceRequestSummary,
} from "@/lib/service-requests";
import { colors } from "@/lib/theme";
import {
  router,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type TabName =
  | "current"
  | "new"
  | "completed"
  | "archive";

const currentStatuses:
  ServiceRequestStatus[] = [
    "Accepted",
    "OnSite",
    "InProgress",
    "Waiting",
    "PartiallyCompleted",
  ];

const newStatuses:
  ServiceRequestStatus[] = [
    "New",
    "Repeat",
    "Defect",
  ];

const completedStatuses:
  ServiceRequestStatus[] = [
    "Completed",
    "Closed",
  ];

export default function ServiceRequestListScreen() {
  const [active, setActive] =
    useState<ServiceRequestSummary[]>([]);

  const [archive, setArchive] =
    useState<ServiceRequestSummary[]>([]);

  const [activeTab, setActiveTab] =
    useState<TabName>("current");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [acceptingId, setAcceptingId] =
    useState<number | null>(null);

  const [error, setError] =
    useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [
          activeResult,
          archiveResult,
        ] = await Promise.all([
          api<ServiceRequestSummary[]>(
            "/service-requests",
          ),

          api<ServiceRequestSummary[]>(
            "/service-requests?archive=1",
          ),
        ]);

        setActive(activeResult);
        setArchive(archiveResult);
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Не удалось загрузить заявки",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const counts = useMemo(() => {
    return {
      current: active.filter((request) =>
        currentStatuses.includes(
          request.status,
        ),
      ).length,

      new: active.filter((request) =>
        newStatuses.includes(
          request.status,
        ),
      ).length,

      completed: active.filter((request) =>
        completedStatuses.includes(
          request.status,
        ),
      ).length,

      archive: archive.length,
    };
  }, [active, archive]);

  const visibleRequests = useMemo(() => {
    let source: ServiceRequestSummary[];

    if (activeTab === "archive") {
      source = archive;
    } else if (activeTab === "new") {
      source = active.filter((request) =>
        newStatuses.includes(
          request.status,
        ),
      );
    } else if (
      activeTab === "completed"
    ) {
      source = active.filter((request) =>
        completedStatuses.includes(
          request.status,
        ),
      );
    } else {
      source = active.filter((request) =>
        currentStatuses.includes(
          request.status,
        ),
      );
    }

    const normalizedSearch =
      search.trim().toLocaleLowerCase(
        "ru-RU",
      );

    if (normalizedSearch === "") {
      return source;
    }

    return source.filter((request) => {
      const value = [
        request.requestNumber,
        request.title,
        request.problemType ?? "",
        request.object.name,
        request.object.address,
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU");

      return value.includes(
        normalizedSearch,
      );
    });
  }, [
    active,
    activeTab,
    archive,
    search,
  ]);

  async function acceptRequest(
    request: ServiceRequestSummary,
  ) {
    if (acceptingId !== null) {
      return;
    }

    setAcceptingId(request.id);
    setError("");

    try {
      await api(
        `/service-requests/${request.id}/accept`,
        {
          method: "POST",
        },
      );

      await load(true);
      setActiveTab("current");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось принять заявку",
      );
    } finally {
      setAcceptingId(null);
    }
  }

  function openRequest(
    request: ServiceRequestSummary,
  ) {
    router.push(
      `/service-request?id=${request.id}` as never,
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            Заявки
          </Text>

          <Text style={styles.headerText}>
            Техническая служба
          </Text>
        </View>

        <Pressable
          style={styles.refreshButton}
          disabled={refreshing}
          onPress={() =>
            void load(true)
          }
        >
          {refreshing ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />
          ) : (
            <Text
              style={
                styles.refreshButtonText
              }
            >
              ↻
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>
            ⌕
          </Text>

          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Номер, объект или адрес"
            placeholderTextColor={
              colors.textSecondary
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {search !== "" && (
            <Pressable
              style={styles.clearSearch}
              onPress={() =>
                setSearch("")
              }
            >
              <Text
                style={
                  styles.clearSearchText
                }
              >
                ×
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton
          label="Текущие"
          count={counts.current}
          active={activeTab === "current"}
          onPress={() =>
            setActiveTab("current")
          }
        />

        <TabButton
          label="Новые"
          count={counts.new}
          active={activeTab === "new"}
          onPress={() =>
            setActiveTab("new")
          }
        />

        <TabButton
          label="Готовые"
          count={counts.completed}
          active={activeTab === "completed"}
          onPress={() =>
            setActiveTab("completed")
          }
        />

        <TabButton
          label="Архив"
          count={counts.archive}
          active={activeTab === "archive"}
          onPress={() =>
            setActiveTab("archive")
          }
        />
      </View>

      {!!error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Загружаем заявки…
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleRequests}
          keyExtractor={(item) =>
            String(item.id)
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                void load(true)
              }
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={[
            styles.list,
            visibleRequests.length === 0 &&
              styles.emptyList,
          ]}
          ItemSeparatorComponent={() => (
            <View
              style={styles.separator}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              tab={activeTab}
              search={search}
            />
          }
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              accepting={
                acceptingId === item.id
              }
              onOpen={() =>
                openRequest(item)
              }
              onAccept={() =>
                void acceptRequest(item)
              }
            />
          )}
        />
      )}
    </View>
  );
}

type TabButtonProps = {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
};

function TabButton({
  label,
  count,
  active,
  onPress,
}: TabButtonProps) {
  return (
    <Pressable
      style={[
        styles.tab,
        active && styles.tabActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.tabText,
          active && styles.tabTextActive,
        ]}
      >
        {label}
      </Text>

      {count > 0 && (
        <View
          style={[
            styles.tabCount,
            active &&
              styles.tabCountActive,
          ]}
        >
          <Text
            style={[
              styles.tabCountText,
              active &&
                styles.tabCountTextActive,
            ]}
          >
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

type RequestCardProps = {
  request: ServiceRequestSummary;
  accepting: boolean;
  onOpen: () => void;
  onAccept: () => void;
};

function RequestCard({
  request,
  accepting,
  onOpen,
  onAccept,
}: RequestCardProps) {
  const progress = clampProgress(
    request.progressPercent,
  );

  const canAccept = [
    "New",
    "Repeat",
    "Defect",
  ].includes(request.status);

  const sla = slaText(
    request.slaDeadline,
  );

  return (
    <Pressable
      style={styles.card}
      onPress={onOpen}
    >
      <View style={styles.cardTop}>
        <View style={styles.numberRow}>
          <Text style={styles.number}>
            № {request.requestNumber}
          </Text>

          <StatusBadge
            status={request.status}
          />
        </View>

        <Text style={styles.cardTitle}>
          {request.title}
        </Text>
      </View>

      {(request.isRepeat ||
        request.isDefect) && (
        <View style={styles.flags}>
          {request.isRepeat && (
            <View
              style={styles.repeatFlag}
            >
              <Text
                style={
                  styles.repeatFlagText
                }
              >
                ↻ Повторная
              </Text>
            </View>
          )}

          {request.isDefect && (
            <View
              style={styles.defectFlag}
            >
              <Text
                style={
                  styles.defectFlagText
                }
              >
                ! Брак
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.objectBlock}>
        <Text style={styles.objectName}>
          {request.object.name}
        </Text>

        <Text style={styles.address}>
          {request.object.address}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>
            Приоритет
          </Text>

          <Text
            style={[
              styles.infoValue,
              {
                color: priorityColor(
                  request.priority,
                ),
              },
            ]}
          >
            {
              servicePriorityLabels[
                request.priority
              ]
            }
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>
            SLA
          </Text>

          <Text
            style={[
              styles.infoValue,
              sla.expired &&
                styles.slaExpired,
            ]}
          >
            {sla.text}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>
            Роль
          </Text>

          <Text style={styles.infoValue}>
            {request.assignmentRole ===
            "Assistant"
              ? "Соисполнитель"
              : "Основной"}
          </Text>
        </View>
      </View>

      <View style={styles.progressHeading}>
        <Text style={styles.progressLabel}>
          Выполнение
        </Text>

        <Text style={styles.progressValue}>
          {Math.round(progress)}%
        </Text>
      </View>

      <View style={styles.progressTrack}>
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

      <View style={styles.cardBottom}>
        {canAccept ? (
          <Pressable
            style={[
              styles.acceptButton,
              accepting &&
                styles.disabled,
            ]}
            disabled={accepting}
            onPress={(event) => {
              event.stopPropagation();
              onAccept();
            }}
          >
            {accepting ? (
              <ActivityIndicator
                size="small"
                color={colors.white}
              />
            ) : (
              <Text
                style={
                  styles.acceptButtonText
                }
              >
                Принять заявку
              </Text>
            )}
          </Pressable>
        ) : (
          <Text style={styles.openText}>
            Открыть заявку
          </Text>
        )}

        <Text style={styles.arrow}>
          ›
        </Text>
      </View>
    </Pressable>
  );
}

function StatusBadge({
  status,
}: {
  status: ServiceRequestStatus;
}) {
  const appearance =
    statusAppearance(status);

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor:
            appearance.background,
        },
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          {
            color: appearance.text,
          },
        ]}
      >
        {serviceStatusLabels[status]}
      </Text>
    </View>
  );
}

function EmptyState({
  tab,
  search,
}: {
  tab: TabName;
  search: string;
}) {
  let title = "Заявок пока нет";
  let text =
    "Новые заявки появятся после назначения диспетчером.";

  if (search.trim() !== "") {
    title = "Ничего не найдено";
    text =
      "Попробуйте изменить поисковый запрос.";
  } else if (tab === "archive") {
    title = "Архив пуст";
    text =
      "Здесь появятся завершённые архивные заявки.";
  } else if (tab === "completed") {
    title = "Нет выполненных заявок";
    text =
      "Выполненные и закрытые заявки появятся здесь.";
  }

  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>
          ✓
        </Text>
      </View>

      <Text style={styles.emptyTitle}>
        {title}
      </Text>

      <Text style={styles.emptyText}>
        {text}
      </Text>
    </View>
  );
}

function priorityColor(
  priority: ServiceRequestSummary["priority"],
): string {
  if (priority === "Critical") {
    return colors.danger;
  }

  if (priority === "High") {
    return "#c77814";
  }

  if (priority === "Low") {
    return colors.textSecondary;
  }

  return colors.primaryHover;
}

function statusAppearance(
  status: ServiceRequestStatus,
) {
  if (status === "Defect") {
    return {
      background: colors.dangerSoft,
      text: colors.danger,
    };
  }

  if (status === "Repeat") {
    return {
      background: "#fff4dc",
      text: "#a36512",
    };
  }

  if (
    status === "Waiting" ||
    status === "PartiallyCompleted"
  ) {
    return {
      background: "#fff8e4",
      text: "#96680b",
    };
  }

  if (
    status === "Completed" ||
    status === "Closed"
  ) {
    return {
      background: colors.primarySoft,
      text: colors.primaryHover,
    };
  }

  if (
    status === "InProgress" ||
    status === "OnSite"
  ) {
    return {
      background: "#e8f2ff",
      text: "#2869a8",
    };
  }

  return {
    background: colors.surfaceSoft,
    text: colors.textSecondary,
  };
}

function slaText(
  deadline: string | null,
): {
  text: string;
  expired: boolean;
} {
  if (!deadline) {
    return {
      text: "Не указан",
      expired: false,
    };
  }

  const target =
    new Date(deadline).getTime();

  if (!Number.isFinite(target)) {
    return {
      text: "Не указан",
      expired: false,
    };
  }

  const difference =
    target - Date.now();

  const expired = difference < 0;
  const absolute = Math.abs(difference);

  const totalMinutes = Math.max(
    1,
    Math.floor(absolute / 60000),
  );

  const days = Math.floor(
    totalMinutes / 1440,
  );

  const hours = Math.floor(
    (totalMinutes % 1440) / 60,
  );

  const minutes = totalMinutes % 60;

  let value: string;

  if (days > 0) {
    value = `${days} д ${hours} ч`;
  } else if (hours > 0) {
    value = `${hours} ч ${minutes} мин`;
  } else {
    value = `${minutes} мин`;
  }

  return {
    text: expired
      ? `Просрочено ${value}`
      : `Осталось ${value}`,
    expired,
  };
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },

  headerText: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
  },

  refreshButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  refreshButtonText: {
    color: colors.primary,
    fontSize: 24,
    lineHeight: 25,
  },

  searchArea: {
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.surface,
  },

  searchBox: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
  },

  searchIcon: {
    marginRight: 8,
    color: colors.textSecondary,
    fontSize: 20,
  },

  searchInput: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },

  clearSearch: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  clearSearchText: {
    color: colors.textSecondary,
    fontSize: 23,
  },

  tabs: {
    minHeight: 54,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  tab: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },

  tabActive: {
    backgroundColor: colors.primarySoft,
  },

  tabText: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  tabTextActive: {
    color: colors.primaryHover,
    fontWeight: "700",
  },

  tabCount: {
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.surfaceSoft,
  },

  tabCountActive: {
    backgroundColor: colors.primary,
  },

  tabCountText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "700",
  },

  tabCountTextActive: {
    color: colors.white,
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

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  list: {
    padding: 12,
    paddingBottom: 24,
  },

  emptyList: {
    flexGrow: 1,
  },

  separator: {
    height: 10,
  },

  card: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },

  cardTop: {
    gap: 7,
  },

  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  number: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },

  statusBadge: {
    maxWidth: "54%",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },

  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },

  cardTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },

  flags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },

  repeatFlag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#fff4dc",
  },

  repeatFlagText: {
    color: "#a36512",
    fontSize: 10,
    fontWeight: "700",
  },

  defectFlag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.dangerSoft,
  },

  defectFlagText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "700",
  },

  objectBlock: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
  },

  objectName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  address: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },

  infoRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },

  infoItem: {
    minWidth: 0,
    flex: 1,
  },

  infoLabel: {
    color: colors.textSecondary,
    fontSize: 9,
  },

  infoValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
  },

  slaExpired: {
    color: colors.danger,
  },

  progressHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
  },

  progressLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  progressValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },

  progressTrack: {
    height: 6,
    marginTop: 6,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: colors.border,
  },

  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },

  cardBottom: {
    minHeight: 41,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  acceptButton: {
    minWidth: 145,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },

  acceptButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },

  openText: {
    color: colors.primaryHover,
    fontSize: 11,
    fontWeight: "600",
  },

  arrow: {
    color: colors.textSecondary,
    fontSize: 24,
  },

  disabled: {
    opacity: 0.5,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },

  emptyIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: colors.primarySoft,
  },

  emptyIconText: {
    color: colors.primary,
    fontSize: 23,
    fontWeight: "700",
  },

  emptyTitle: {
    marginTop: 14,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
