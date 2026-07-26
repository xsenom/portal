import { api } from "@/lib/api";
import { colors } from "@/lib/theme";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TaskStatus =
  | "Assigned"
  | "InProgress"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Cancelled";

type Task = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  status: TaskStatus;
  plannedHours: number | null;
  actualHours: number | null;
  rewardAmount: number | null;
  dueAt: string | null;
  approvalComment?: string | null;
};

type TabName =
  | "current"
  | "new"
  | "completed";

const labels: Record<TaskStatus, string> = {
  Assigned: "Новое",
  InProgress: "В работе",
  Submitted: "На проверке",
  Approved: "Выполнено",
  Rejected: "Нужно исправить",
  Cancelled: "Отказ",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Без срока";
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
  ).format(new Date(value));
}

export default function TasksScreen() {
  const [tasks, setTasks] =
    useState<Task[]>([]);
  const [activeTab, setActiveTab] =
    useState<TabName>("current");

  const [loading, setLoading] =
    useState(true);
  const [savingId, setSavingId] =
    useState<number | null>(null);
  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);

    try {
      const result =
        await api<Task[]>("/tasks");

      setTasks(result);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить задания",
      );
    } finally {
      setLoading(false);
    }
  }

  async function startTask(task: Task) {
    setSavingId(task.id);
    setError("");

    try {
      await api(
        `/tasks/${task.id}/start`,
        {
          method: "POST",
        },
      );

      setActiveTab("current");
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось принять задание",
      );
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleTasks = useMemo(() => {
    if (activeTab === "new") {
      return tasks.filter(
        (task) =>
          task.status === "Assigned",
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

  return (
    <View style={styles.page}>
      <View style={styles.tabs}>
        <TabButton
          label="Текущие"
          active={activeTab === "current"}
          onPress={() =>
            setActiveTab("current")
          }
        />

        <TabButton
          label="Новые"
          active={activeTab === "new"}
          onPress={() =>
            setActiveTab("new")
          }
        />

        <TabButton
          label="Выполненные"
          active={activeTab === "completed"}
          onPress={() =>
            setActiveTab("completed")
          }
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {loading && (
          <ActivityIndicator
            color={colors.primary}
          />
        )}

        {!!error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        {!loading &&
          !error &&
          visibleTasks.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>
                  ✓
                </Text>
              </View>

              <Text style={styles.emptyTitle}>
                Здесь пока нет заданий
              </Text>

              <Text style={styles.emptyText}>
                Новые задания появятся после
                назначения администратором.
              </Text>
            </View>
          )}

        {!loading &&
          visibleTasks.map((task) => (
            <View
              key={task.id}
              style={styles.card}
            >
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>
                  {task.title}
                </Text>

                <Text style={styles.cardDate}>
                  {formatDate(task.dueAt)}
                </Text>
              </View>

              {!!task.description && (
                <Text style={styles.description}>
                  {task.description}
                </Text>
              )}

              <View style={styles.dataList}>
                {!!task.category && (
                  <DataRow
                    label="Категория"
                    value={task.category}
                  />
                )}

                <DataRow
                  label="Предполагаемое время"
                  value={
                    task.plannedHours === null
                      ? "Не указано"
                      : `${task.plannedHours} ч`
                  }
                />

                <DataRow
                  label="Стоимость"
                  value={
                    task.rewardAmount === null
                      ? "Не указана"
                      : `${task.rewardAmount} ₽`
                  }
                />

                <DataRow
                  label="Статус"
                  value={labels[task.status]}
                  valueColor={
                    task.status === "Rejected"
                      ? colors.danger
                      : colors.primary
                  }
                />
              </View>

              {!!task.approvalComment && (
                <View style={styles.comment}>
                  <Text style={styles.commentTitle}>
                    Комментарий администратора
                  </Text>

                  <Text style={styles.commentText}>
                    {task.approvalComment}
                  </Text>
                </View>
              )}

              {task.status === "Assigned" && (
                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      savingId === task.id &&
                        styles.disabled,
                    ]}
                    disabled={savingId === task.id}
                    onPress={() =>
                      void startTask(task)
                    }
                  >
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Взять
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                  >
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      Отказаться
                    </Text>
                  </Pressable>
                </View>
              )}

              {[
                "InProgress",
                "Rejected",
              ].includes(task.status) && (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.primaryButton}
                  >
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Завершить
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                  >
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      Чат
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

type TabButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function TabButton({
  label,
  active,
  onPress,
}: TabButtonProps) {
  return (
    <Pressable
      style={styles.tabButton}
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

      <View
        style={[
          styles.tabIndicator,
          active && styles.tabIndicatorActive,
        ]}
      />
    </Pressable>
  );
}

type DataRowProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function DataRow({
  label,
  value,
  valueColor,
}: DataRowProps) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>
        {label}
      </Text>

      <Text
        style={[
          styles.dataValue,
          valueColor
            ? {
                color: valueColor,
              }
            : null,
        ]}
      >
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

  tabs: {
    minHeight: 58,
    flexDirection: "row",

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  tabButton: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  tabText: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  tabTextActive: {
    color: colors.text,
    fontWeight: "600",
  },

  tabIndicator: {
    height: 2,
    position: "absolute",
    right: 12,
    bottom: 0,
    left: 12,

    borderRadius: 3,
    backgroundColor: "transparent",
  },

  tabIndicatorActive: {
    backgroundColor: colors.primary,
  },

  scroll: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 11,
  },

  error: {
    padding: 11,

    borderWidth: 1,
    borderColor: "#f2c8cc",
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
  },

  errorText: {
    color: "#a52d36",
    fontSize: 10,
  },

  empty: {
    alignItems: "center",
    marginTop: 42,
    paddingHorizontal: 22,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },

  emptyIconText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "700",
  },

  emptyTitle: {
    marginTop: 13,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  emptyText: {
    maxWidth: 250,
    marginTop: 7,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },

  card: {
    padding: 14,

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,

    shadowColor: colors.graphite,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },

  cardHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },

  cardDate: {
    color: colors.textSecondary,
    fontSize: 9,
  },

  description: {
    marginTop: 9,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },

  dataList: {
    marginTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  dataRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  dataLabel: {
    color: colors.textSecondary,
    fontSize: 9,
  },

  dataValue: {
    maxWidth: "54%",
    color: colors.text,
    fontSize: 9,
    fontWeight: "600",
    textAlign: "right",
  },

  comment: {
    marginTop: 10,
    padding: 10,

    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
  },

  commentTitle: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "700",
  },

  commentText: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },

  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },

  primaryButton: {
    minHeight: 42,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

    borderRadius: 7,
    backgroundColor: colors.primary,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "600",
  },

  secondaryButton: {
    minHeight: 42,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.surface,
  },

  secondaryButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "500",
  },

  disabled: {
    opacity: 0.55,
  },
});
