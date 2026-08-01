import { AppBackHeader } from "@/components/AppBackHeader";
import {
  api,
  ApiError,
} from "@/lib/api";
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
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type ListMode =
  | "active"
  | "new"
  | "completed"
  | "archive";

type DateFilter =
  | "all"
  | "today"
  | "7days"
  | "30days";

type SortMode =
  | "newest"
  | "oldest"
  | "object";

type RequestItem = {
  id: number;
  requestNumber?: string | null;
  title?: string | null;
  problemType?: string | null;
  priority?: string | null;
  status: string;
  progressPercent?: number | null;
  isRepeat?: boolean;
  isDefect?: boolean;
  isArchived?: boolean;
  slaDeadline?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  objectName?: string | null;
  objectAddress?: string | null;
  primaryTechnicianName?: string | null;
  technicianName?: string | null;
  object?: {
    name?: string | null;
    address?: string | null;
  } | null;
};

type ServiceRequestListScreenProps = {
  initialMode?: ListMode;
  showBack?: boolean;
  title?: string;
};

const modes: Array<{
  value: ListMode;
  label: string;
}> = [
  {
    value: "active",
    label: "В работе",
  },
  {
    value: "new",
    label: "Новые",
  },
  {
    value: "completed",
    label: "Выполненные",
  },
  {
    value: "archive",
    label: "Архив",
  },
];

const statuses = [
  "all",
  "New",
  "Accepted",
  "OnSite",
  "InProgress",
  "Waiting",
  "PartiallyCompleted",
  "Completed",
  "Closed",
  "Defect",
  "Repeat",
] as const;

const dateFilters: Array<{
  value: DateFilter;
  label: string;
}> = [
  {
    value: "all",
    label: "За всё время",
  },
  {
    value: "today",
    label: "Сегодня",
  },
  {
    value: "7days",
    label: "7 дней",
  },
  {
    value: "30days",
    label: "30 дней",
  },
];

const sortModes: Array<{
  value: SortMode;
  label: string;
}> = [
  {
    value: "newest",
    label: "Сначала новые",
  },
  {
    value: "oldest",
    label: "Сначала старые",
  },
  {
    value: "object",
    label: "По объекту",
  },
];

function statusLabel(status: string) {
  return (
    serviceStatusLabels[
      status as keyof typeof serviceStatusLabels
    ]
    ?? status
  );
}

function objectAddress(
  request: RequestItem,
) {
  return (
    request.objectAddress
    ?? request.object?.address
    ?? request.objectName
    ?? request.object?.name
    ?? "Объект не указан"
  );
}

function objectName(
  request: RequestItem,
) {
  return (
    request.objectName
    ?? request.object?.name
    ?? objectAddress(request)
  );
}

function progressValue(
  request: RequestItem,
) {
  const value =
    Number(
      request.progressPercent ?? 0,
    );

  return Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

function requestTimestamp(
  request: RequestItem,
) {
  const raw =
    request.createdAt
    ?? request.updatedAt
    ?? "";

  const value =
    new Date(raw).getTime();

  return Number.isFinite(value)
    ? value
    : 0;
}

function dateMatches(
  request: RequestItem,
  filter: DateFilter,
) {
  if (filter === "all") {
    return true;
  }

  const timestamp =
    requestTimestamp(request);

  if (!timestamp) {
    return false;
  }

  const now = Date.now();

  if (filter === "today") {
    const date =
      new Date(timestamp);

    const today =
      new Date();

    return (
      date.getFullYear()
        === today.getFullYear()
      && date.getMonth()
        === today.getMonth()
      && date.getDate()
        === today.getDate()
    );
  }

  const days =
    filter === "7days"
      ? 7
      : 30;

  return (
    timestamp
    >= now - days * 86400000
  );
}

function modeMatches(
  request: RequestItem,
  mode: ListMode,
) {
  if (mode === "archive") {
    return true;
  }

  if (mode === "new") {
    return [
      "New",
      "Repeat",
      "Defect",
    ].includes(request.status);
  }

  if (mode === "completed") {
    return [
      "Completed",
      "Closed",
    ].includes(request.status);
  }

  return [
    "Accepted",
    "OnSite",
    "InProgress",
    "Waiting",
    "PartiallyCompleted",
  ].includes(request.status);
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) {
    return "Дата не указана";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Дата не указана";
  }

  return date.toLocaleDateString(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );
}

function formatSla(
  value: string | null | undefined,
  now: number,
) {
  if (!value) {
    return null;
  }

  const deadline =
    new Date(value).getTime();

  if (
    !Number.isFinite(deadline)
  ) {
    return null;
  }

  const delta =
    deadline - now;

  if (delta <= 0) {
    return "SLA просрочен";
  }

  const hours =
    Math.floor(delta / 3600000);

  const minutes =
    Math.floor(
      (delta % 3600000) / 60000,
    );

  if (hours >= 24) {
    const days =
      Math.floor(hours / 24);

    return `SLA: ${days} дн. ${hours % 24} ч.`;
  }

  return `SLA: ${hours} ч. ${minutes} мин.`;
}

export default function ServiceRequestListScreen({
  initialMode = "active",
  showBack = false,
  title = "Мои заявки",
}: ServiceRequestListScreenProps) {
  const [active, setActive] =
    useState<RequestItem[]>([]);

  const [archive, setArchive] =
    useState<RequestItem[]>([]);

  const [mode, setMode] =
    useState<ListMode>(
      initialMode,
    );

  const [search, setSearch] =
    useState("");

  const [objectFilter, setObjectFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<string>("all");

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("all");

  const [sortMode, setSortMode] =
    useState<SortMode>("newest");

  const [filtersVisible, setFiltersVisible] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
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
          activeResult,
          archiveResult,
        ] = await Promise.all([
          api<RequestItem[]>(
            "/service-requests",
          ),
          api<RequestItem[]>(
            "/service-requests?archive=1",
          ),
        ]);

        setActive(activeResult);
        setArchive(archiveResult);
        setError("");
      } catch (caughtError) {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
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

      return () => {
        Keyboard.dismiss();
      };
    }, [load]),
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const filtered = useMemo(() => {
    const source =
      mode === "archive"
        ? archive
        : active;

    const cleanSearch =
      search.trim().toLowerCase();

    const cleanObject =
      objectFilter
        .trim()
        .toLowerCase();

    const result =
      source.filter((request) => {
        if (
          !modeMatches(request, mode)
        ) {
          return false;
        }

        if (
          statusFilter !== "all"
          && request.status
            !== statusFilter
        ) {
          return false;
        }

        if (
          !dateMatches(
            request,
            dateFilter,
          )
        ) {
          return false;
        }

        if (
          cleanObject
          && !objectName(request)
            .toLowerCase()
            .includes(cleanObject)
          && !objectAddress(request)
            .toLowerCase()
            .includes(cleanObject)
        ) {
          return false;
        }

        if (!cleanSearch) {
          return true;
        }

        const haystack = [
          request.requestNumber,
          request.title,
          request.problemType,
          objectName(request),
          objectAddress(request),
          request.primaryTechnicianName,
          request.technicianName,
          statusLabel(request.status),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(
          cleanSearch,
        );
      });

    return [...result].sort(
      (left, right) => {
        if (sortMode === "oldest") {
          return (
            requestTimestamp(left)
            - requestTimestamp(right)
          );
        }

        if (sortMode === "object") {
          return objectName(left)
            .localeCompare(
              objectName(right),
              "ru",
            );
        }

        return (
          requestTimestamp(right)
          - requestTimestamp(left)
        );
      },
    );
  }, [
    active,
    archive,
    dateFilter,
    mode,
    objectFilter,
    search,
    sortMode,
    statusFilter,
  ]);

  function openRequest(
    request: RequestItem,
  ) {
    if (mode === "archive") {
      router.push({
        pathname: "/archive-request",
        params: {
          id: String(request.id),
        },
      } as unknown as Href);

      return;
    }

    router.push({
      pathname: "/service-request",
      params: {
        id: String(request.id),
      },
    } as unknown as Href);
  }

  return (
    <View style={styles.page}>
      {showBack ? (
        <AppBackHeader title={title} />
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {title}
          </Text>

          <Pressable
            onPress={() =>
              void load(true)
            }
          >
            <Text style={styles.refreshLink}>
              Обновить
            </Text>
          </Pressable>
        </View>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Номер, адрес или ФИО техника"
          placeholderTextColor="#98a39e"
          returnKeyType="search"
          autoCorrect={false}
        />

        <Pressable
          style={[
            styles.filterButton,
            filtersVisible
              && styles.filterButtonActive,
          ]}
          onPress={() =>
            setFiltersVisible(
              (value) => !value,
            )
          }
        >
          <Text
            style={[
              styles.filterButtonText,
              filtersVisible
                && styles.filterButtonTextActive,
            ]}
          >
            Фильтры
          </Text>
        </Pressable>
      </View>

      {!showBack && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeTabs}
        >
          {modes.map((item) => {
            const selected =
              item.value === mode;

            return (
              <Pressable
                key={item.value}
                style={[
                  styles.modeTab,
                  selected
                    && styles.modeTabSelected,
                ]}
                onPress={() =>
                  setMode(item.value)
                }
              >
                <Text
                  style={[
                    styles.modeTabText,
                    selected
                      && styles.modeTabTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {filtersVisible && (
        <View style={styles.filters}>
          <Text style={styles.filterLabel}>
            Объект
          </Text>

          <TextInput
            style={styles.objectInput}
            value={objectFilter}
            onChangeText={setObjectFilter}
            placeholder="Название или адрес объекта"
            placeholderTextColor="#98a39e"
          />

          <Text style={styles.filterLabel}>
            Статус
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {statuses.map((status) => {
              const selected =
                statusFilter === status;

              return (
                <Pressable
                  key={status}
                  style={[
                    styles.chip,
                    selected
                      && styles.chipSelected,
                  ]}
                  onPress={() =>
                    setStatusFilter(status)
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected
                        && styles.chipTextSelected,
                    ]}
                  >
                    {status === "all"
                      ? "Все"
                      : statusLabel(status)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>
            Дата
          </Text>

          <View style={styles.wrapChips}>
            {dateFilters.map((item) => {
              const selected =
                dateFilter === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={[
                    styles.chip,
                    selected
                      && styles.chipSelected,
                  ]}
                  onPress={() =>
                    setDateFilter(
                      item.value,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected
                        && styles.chipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterLabel}>
            Сортировка
          </Text>

          <View style={styles.wrapChips}>
            {sortModes.map((item) => {
              const selected =
                sortMode === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={[
                    styles.chip,
                    selected
                      && styles.chipSelected,
                  ]}
                  onPress={() =>
                    setSortMode(item.value)
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected
                        && styles.chipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.resultHeader}>
        <Text style={styles.resultCount}>
          Найдено: {filtered.length}
        </Text>

        {(search
          || objectFilter
          || statusFilter !== "all"
          || dateFilter !== "all") && (
          <Pressable
            onPress={() => {
              setSearch("");
              setObjectFilter("");
              setStatusFilter("all");
              setDateFilter("all");
            }}
          >
            <Text style={styles.clearLink}>
              Сбросить
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={colors.primary}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) =>
            String(item.id)
          }
          contentContainerStyle={
            filtered.length === 0
              ? styles.emptyList
              : styles.list
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() =>
                void load(true)
              }
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                Заявки не найдены
              </Text>

              <Text style={styles.emptyText}>
                Измените фильтры или обновите
                список.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const progress =
              progressValue(item);

            const sla =
              formatSla(
                item.slaDeadline,
                now,
              );

            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  openRequest(item)
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardNumber}>
                      {item.requestNumber
                        ?? `Заявка №${item.id}`}
                    </Text>

                    <Text style={styles.cardDate}>
                      {formatDate(
                        item.createdAt
                        ?? item.updatedAt,
                      )}
                    </Text>
                  </View>

                  <View style={styles.statusBadge}>
                    <Text
                      style={
                        styles.statusBadgeText
                      }
                    >
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <Text
                  style={styles.address}
                  numberOfLines={2}
                >
                  {objectAddress(item)}
                </Text>

                {!!(
                  item.primaryTechnicianName
                  ?? item.technicianName
                ) && (
                  <Text style={styles.technician}>
                    Техник:{" "}
                    {item.primaryTechnicianName
                      ?? item.technicianName}
                  </Text>
                )}

                <View style={styles.tags}>
                  {(item.isDefect
                    || item.status
                      === "Defect") && (
                    <View style={styles.defectTag}>
                      <Text
                        style={
                          styles.defectText
                        }
                      >
                        Брак
                      </Text>
                    </View>
                  )}

                  {(item.isRepeat
                    || item.status
                      === "Repeat") && (
                    <View style={styles.repeatTag}>
                      <Text
                        style={
                          styles.repeatText
                        }
                      >
                        ↻ Повтор
                      </Text>
                    </View>
                  )}

                  {!!sla && (
                    <View
                      style={[
                        styles.slaTag,
                        sla.includes(
                          "просрочен",
                        )
                          && styles.slaDanger,
                      ]}
                    >
                      <Text
                        style={[
                          styles.slaText,
                          sla.includes(
                            "просрочен",
                          )
                            && styles.slaDangerText,
                        ]}
                      >
                        {sla}
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={
                    styles.progressHeader
                  }
                >
                  <Text
                    style={
                      styles.progressCaption
                    }
                  >
                    Выполнение
                  </Text>

                  <Text
                    style={
                      styles.progressNumber
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

                <Text style={styles.openLink}>
                  {mode === "archive"
                    ? "Открыть в режиме просмотра ›"
                    : "Открыть заявку ›"}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 58,
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
    fontWeight: "900",
  },

  refreshLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  errorBox: {
    padding: 10,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: "center",
  },

  searchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 11,
  },

  searchInput: {
    minHeight: 45,
    flex: 1,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    color: colors.text,
    backgroundColor: colors.surface,
  },

  filterButton: {
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },

  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  filterButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  filterButtonTextActive: {
    color: colors.primary,
  },

  modeTabs: {
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  modeTab: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  modeTabSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  modeTabText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },

  modeTabTextSelected: {
    color: colors.primary,
  },

  filters: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },

  filterLabel: {
    marginTop: 9,
    marginBottom: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },

  objectInput: {
    minHeight: 44,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
  },

  chips: {
    gap: 6,
  },

  wrapChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
  },

  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  chipText: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  chipTextSelected: {
    color: colors.primary,
    fontWeight: "800",
  },

  resultHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },

  resultCount: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  clearLink: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    paddingHorizontal: 12,
    paddingBottom: 35,
  },

  emptyList: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  empty: {
    alignItems: "center",
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  emptyText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },

  card: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 9,
  },

  cardTitleWrap: {
    flex: 1,
  },

  cardNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },

  cardDate: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 10,
  },

  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },

  statusBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
  },

  address: {
    marginTop: 10,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },

  technician: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 10,
  },

  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },

  defectTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
  },

  defectText: {
    color: colors.danger,
    fontSize: 9,
    fontWeight: "800",
  },

  repeatTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },

  repeatText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
  },

  slaTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#fff3d9",
  },

  slaDanger: {
    backgroundColor: colors.dangerSoft,
  },

  slaText: {
    color: "#9b6714",
    fontSize: 9,
    fontWeight: "700",
  },

  slaDangerText: {
    color: colors.danger,
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

  progressNumber: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },

  progressTrack: {
    height: 7,
    marginTop: 6,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: colors.border,
  },

  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  openLink: {
    marginTop: 12,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
});
