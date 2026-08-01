import { AppBackHeader } from "@/components/AppBackHeader";
import {
  api,
  ApiError,
} from "@/lib/api";
import {
  servicePriorityLabels,
  serviceStatusLabels,
} from "@/lib/service-requests";
import { colors } from "@/lib/theme";
import {
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  useCallback,
  useState,
} from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type UnknownRecord =
  Record<string, unknown>;

type CommentItem = {
  id?: number;
  type?: string;
  message?: string;
  createdAt?: string;
  author?: {
    firstName?: string;
    lastName?: string;
  };
};

type AttachmentItem = {
  id?: number;
  fileName?: string;
  fileUrl?: string;
  attachmentType?: string;
  mimeType?: string;
  qualityScore?: number | null;
};

function recordValue(
  value: unknown,
): UnknownRecord {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(value)
  )
    ? value as UnknownRecord
    : {};
}

function arrayValue(
  value: unknown,
): UnknownRecord[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item) =>
            item
            && typeof item === "object",
        )
        .map(
          (item) =>
            item as UnknownRecord,
        )
    : [];
}

function stringValue(
  ...values: unknown[]
) {
  for (const value of values) {
    if (
      typeof value === "string"
      && value.trim()
    ) {
      return value.trim();
    }

    if (
      typeof value === "number"
    ) {
      return String(value);
    }
  }

  return "";
}

function numberValue(
  ...values: unknown[]
) {
  for (const value of values) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function formatDate(value: unknown) {
  const text =
    stringValue(value);

  if (!text) {
    return "—";
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(date.getTime())
  ) {
    return text;
  }

  return date.toLocaleString(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export default function ArchiveRequestScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const requestId =
    Number(params.id ?? 0);

  const [detail, setDetail] =
    useState<UnknownRecord | null>(null);

  const [comments, setComments] =
    useState<CommentItem[]>([]);

  const [attachments, setAttachments] =
    useState<AttachmentItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    if (!requestId) {
      setError("Заявка не найдена");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [
        detailResult,
        commentsResult,
        attachmentsResult,
      ] = await Promise.all([
        api<UnknownRecord>(
          `/service-requests/${requestId}`,
        ),

        api<CommentItem[]>(
          `/service-requests/${requestId}/comments`,
        ).catch(() => []),

        api<AttachmentItem[]>(
          `/service-requests/${requestId}/attachments`,
        ).catch(() => []),
      ]);

      setDetail(detailResult);
      setComments(commentsResult);
      setAttachments(attachmentsResult);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Не удалось загрузить заявку",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.page}>
        <AppBackHeader title="Архивная заявка" />

        <View style={styles.center}>
          <ActivityIndicator
            color={colors.primary}
          />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.page}>
        <AppBackHeader title="Архивная заявка" />

        <View style={styles.center}>
          <Text style={styles.error}>
            {error || "Заявка не найдена"}
          </Text>
        </View>
      </View>
    );
  }

  const object =
    recordValue(
      detail.object,
    );

  const contract =
    recordValue(
      detail.contract,
    );

  const progress =
    Math.max(
      0,
      Math.min(
        100,
        numberValue(
          detail.progressPercent,
          detail.progress,
        ),
      ),
    );

  const status =
    stringValue(detail.status);

  const priority =
    stringValue(detail.priority);

  const contacts =
    arrayValue(
      detail.contacts
      ?? object.contacts,
    );

  const assignees =
    arrayValue(
      detail.assignees,
    );

  const workItems =
    arrayValue(
      detail.workItems,
    );

  const history =
    arrayValue(
      detail.objectHistory
      ?? detail.history,
    );

  const panelNumbers =
    Array.isArray(
      object.panelNumbers
      ?? detail.panelNumbers,
    )
      ? (
          object.panelNumbers
          ?? detail.panelNumbers
        ) as unknown[]
      : [];

  const latitude =
    numberValue(
      object.latitude,
      detail.objectLatitude,
    );

  const longitude =
    numberValue(
      object.longitude,
      detail.objectLongitude,
    );

  return (
    <View style={styles.page}>
      <AppBackHeader
        title={
          stringValue(
            detail.requestNumber,
          )
          || `Заявка №${requestId}`
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        {!!error && (
          <Text style={styles.error}>
            {error}
          </Text>
        )}

        <View style={styles.readOnly}>
          <Text style={styles.readOnlyTitle}>
            Режим просмотра
          </Text>

          <Text style={styles.readOnlyText}>
            Архивная заявка доступна только
            для чтения. Изменение статуса,
            чек-листа и вложений заблокировано.
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryMain}>
              <Text style={styles.number}>
                {stringValue(
                  detail.requestNumber,
                )
                || `Заявка №${requestId}`}
              </Text>

              <Text style={styles.title}>
                {stringValue(
                  detail.title,
                  detail.problemType,
                )
                || "Техническая заявка"}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <Text
                style={styles.statusText}
              >
                {serviceStatusLabels[
                  status as keyof typeof serviceStatusLabels
                ]
                ?? status
                ?? "—"}
              </Text>
            </View>
          </View>

          <DataRow
            label="Приоритет"
            value={
              servicePriorityLabels[
                priority as keyof typeof servicePriorityLabels
              ]
              ?? priority
              ?? "—"
            }
          />

          <DataRow
            label="SLA-дедлайн"
            value={formatDate(
              detail.slaDeadline,
            )}
          />

          <View style={styles.progressHeader}>
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
                  width: `${progress}%`,
                },
              ]}
            />
          </View>
        </View>

        <Section title="Объект">
          <DataRow
            label="Название"
            value={
              stringValue(
                object.name,
                detail.objectName,
              )
              || "—"
            }
          />

          <DataRow
            label="Адрес"
            value={
              stringValue(
                object.address,
                detail.objectAddress,
              )
              || "—"
            }
          />

          {panelNumbers.length > 0 && (
            <DataRow
              label="Пультовые номера"
              value={panelNumbers
                .map((item) =>
                  stringValue(item),
                )
                .filter(Boolean)
                .join(", ")}
            />
          )}

          {!!latitude
            && !!longitude && (
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                const url =
                  "https://www.google.com/maps/search/"
                  + `?api=1&query=${latitude},${longitude}`;

                void Linking.openURL(url);
              }}
            >
              <Text style={styles.linkText}>
                Открыть объект в картах
              </Text>
            </Pressable>
          )}
        </Section>

        <Section title="Контакты на объекте">
          {contacts.length === 0 ? (
            <Text style={styles.emptyText}>
              Контакты не указаны
            </Text>
          ) : (
            contacts.map(
              (contact, index) => (
                <View
                  key={
                    stringValue(
                      contact.id,
                    )
                    || String(index)
                  }
                  style={styles.item}
                >
                  <Text style={styles.itemTitle}>
                    {stringValue(
                      contact.name,
                      contact.fullName,
                      contact.position,
                    )
                    || "Контакт"}
                  </Text>

                  <Text style={styles.itemText}>
                    {stringValue(
                      contact.phone,
                      contact.value,
                      contact.email,
                    )
                    || "Контактные данные не указаны"}
                  </Text>
                </View>
              ),
            )
          )}
        </Section>

        <Section title="Договор">
          <DataRow
            label="Номер"
            value={
              stringValue(
                contract.number,
                detail.contractNumber,
              )
              || "—"
            }
          />

          <DataRow
            label="Дата"
            value={formatDate(
              contract.date
              ?? contract.signedAt
              ?? detail.contractDate,
            )}
          />
        </Section>

        <Section title="История заявок по объекту">
          {history.length === 0 ? (
            <Text style={styles.emptyText}>
              История заявок не найдена
            </Text>
          ) : (
            history.map(
              (historyItem, index) => (
                <View
                  key={
                    stringValue(
                      historyItem.id,
                    )
                    || String(index)
                  }
                  style={styles.item}
                >
                  <Text style={styles.itemTitle}>
                    {stringValue(
                      historyItem.requestNumber,
                    )
                    || `Заявка №${stringValue(
                      historyItem.id,
                    )}`}
                  </Text>

                  <Text style={styles.itemText}>
                    {formatDate(
                      historyItem.createdAt
                      ?? historyItem.closedAt,
                    )}
                    {" · "}
                    {stringValue(
                      historyItem.status,
                    )}
                  </Text>

                  <Text style={styles.itemText}>
                    Техник:{" "}
                    {stringValue(
                      historyItem.technicianName,
                      historyItem.primaryTechnicianName,
                    )
                    || "—"}
                  </Text>
                </View>
              ),
            )
          )}
        </Section>

        {(detail.isRepeat === true
          || status === "Repeat") && (
          <Section title="Повторная заявка">
            <DataRow
              label="Исходная заявка"
              value={
                stringValue(
                  detail.sourceRequestNumber,
                  detail.repeatSourceRequestNumber,
                  detail.sourceRequestId,
                )
                || "Не указана"
              }
            />
          </Section>
        )}

        <Section title="Состав исполнителей">
          {assignees.length === 0 ? (
            <Text style={styles.emptyText}>
              Исполнители не указаны
            </Text>
          ) : (
            assignees.map(
              (assignee, index) => (
                <View
                  key={
                    stringValue(
                      assignee.id,
                    )
                    || String(index)
                  }
                  style={styles.item}
                >
                  <Text style={styles.itemTitle}>
                    {stringValue(
                      assignee.fullName,
                      assignee.name,
                    )
                    || [
                      stringValue(
                        assignee.lastName,
                      ),
                      stringValue(
                        assignee.firstName,
                      ),
                    ]
                      .filter(Boolean)
                      .join(" ")
                    || "Исполнитель"}
                  </Text>

                  <Text style={styles.itemText}>
                    {stringValue(
                      assignee.role,
                      assignee.assignmentRole,
                    )
                    || "Исполнитель"}
                  </Text>
                </View>
              ),
            )
          )}
        </Section>

        <Section title="Чек-лист работ">
          {workItems.length === 0 ? (
            <Text style={styles.emptyText}>
              Чек-лист не заполнен
            </Text>
          ) : (
            workItems.map(
              (item, index) => {
                const completed =
                  item.isCompleted === true
                  || item.completed === true
                  || stringValue(
                    item.status,
                  ) === "Completed";

                return (
                  <View
                    key={
                      stringValue(item.id)
                      || String(index)
                    }
                    style={styles.checkItem}
                  >
                    <View
                      style={[
                        styles.check,
                        completed
                          && styles.checkDone,
                      ]}
                    >
                      <Text
                        style={
                          styles.checkText
                        }
                      >
                        {completed
                          ? "✓"
                          : ""}
                      </Text>
                    </View>

                    <View style={styles.checkMain}>
                      <Text style={styles.itemTitle}>
                        {stringValue(
                          item.title,
                          item.name,
                          item.workTypeName,
                        )
                        || "Работа"}
                      </Text>

                      <Text style={styles.itemText}>
                        Вес:{" "}
                        {numberValue(
                          item.weightPercent,
                          item.weight,
                        )}
                        %
                      </Text>
                    </View>
                  </View>
                );
              },
            )
          )}
        </Section>

        <Section title="Комментарии">
          {comments.length === 0 ? (
            <Text style={styles.emptyText}>
              Комментариев нет
            </Text>
          ) : (
            comments.map(
              (comment, index) => (
                <View
                  key={
                    comment.id
                    ?? index
                  }
                  style={styles.item}
                >
                  <Text style={styles.itemTitle}>
                    {comment.type === "Client"
                      ? "Клиентский комментарий"
                      : "Служебный комментарий"}
                  </Text>

                  <Text style={styles.itemText}>
                    {comment.message
                      ?? ""}
                  </Text>

                  <Text style={styles.itemDate}>
                    {formatDate(
                      comment.createdAt,
                    )}
                  </Text>
                </View>
              ),
            )
          )}
        </Section>

        <Section title="Вложения">
          {attachments.length === 0 ? (
            <Text style={styles.emptyText}>
              Вложений нет
            </Text>
          ) : (
            attachments.map(
              (attachment, index) => (
                <Pressable
                  key={
                    attachment.id
                    ?? index
                  }
                  style={styles.file}
                  disabled={
                    !attachment.fileUrl
                  }
                  onPress={() => {
                    if (
                      attachment.fileUrl
                    ) {
                      const url =
                        attachment.fileUrl.startsWith(
                          "http",
                        )
                          ? attachment.fileUrl
                          : `https://test.xsenom.ru${attachment.fileUrl}`;

                      void Linking.openURL(
                        url,
                      );
                    }
                  }}
                >
                  <View style={styles.fileMain}>
                    <Text style={styles.itemTitle}>
                      {attachment.fileName
                        ?? "Вложение"}
                    </Text>

                    <Text style={styles.itemText}>
                      {attachment.attachmentType
                        ?? attachment.mimeType
                        ?? "Файл"}
                    </Text>

                    {attachment.qualityScore
                      !== null
                      && attachment.qualityScore
                      !== undefined && (
                      <Text style={styles.itemText}>
                        Качество:{" "}
                        {attachment.qualityScore}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.fileArrow}>
                    ›
                  </Text>
                </Pressable>
              ),
            )
          )}
        </Section>

        <Section title="Штрих-код акта">
          <DataRow
            label="Состояние"
            value={
              stringValue(
                detail.actBarcode,
                detail.barcodeValue,
                detail.expectedActBarcode,
              )
                ? "Сканирован"
                : "Не сканирован"
            }
          />

          {!!stringValue(
            detail.actBarcode,
            detail.barcodeValue,
          ) && (
            <DataRow
              label="Значение"
              value={stringValue(
                detail.actBarcode,
                detail.barcodeValue,
              )}
            />
          )}
        </Section>

        <View style={styles.bottomMode}>
          <Text style={styles.bottomModeTitle}>
            Режим просмотра
          </Text>

          <Text style={styles.bottomModeText}>
            Действия с закрытой заявкой
            недоступны.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <View style={styles.sectionContent}>
        {children}
      </View>
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  content: {
    padding: 14,
    paddingBottom: 40,
  },

  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
  },

  readOnly: {
    marginBottom: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },

  readOnlyTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },

  readOnlyText: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  summary: {
    padding: 15,
    borderRadius: 14,
    backgroundColor: colors.graphite,
  },

  summaryTop: {
    flexDirection: "row",
    gap: 9,
  },

  summaryMain: {
    flex: 1,
  },

  number: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "900",
  },

  title: {
    marginTop: 5,
    color: "#c1cac5",
    fontSize: 12,
  },

  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },

  statusText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 13,
  },

  progressLabel: {
    color: "#c1cac5",
    fontSize: 10,
  },

  progressValue: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },

  progressTrack: {
    height: 7,
    marginTop: 6,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: "#65706b",
  },

  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  section: {
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  sectionContent: {
    marginTop: 9,
  },

  dataRow: {
    minHeight: 38,
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
    fontWeight: "700",
    textAlign: "right",
  },

  linkButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },

  linkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  item: {
    marginBottom: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
  },

  itemTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },

  itemText: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  itemDate: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 9,
  },

  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
  },

  check: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.disabled,
    borderRadius: 7,
  },

  checkDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  checkText: {
    color: colors.white,
    fontWeight: "900",
  },

  checkMain: {
    flex: 1,
  },

  file: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
  },

  fileMain: {
    flex: 1,
  },

  fileArrow: {
    color: colors.primary,
    fontSize: 22,
  },

  bottomMode: {
    marginTop: 15,
    padding: 16,
    borderRadius: 13,
    backgroundColor: colors.graphite,
  },

  bottomModeTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  bottomModeText: {
    marginTop: 5,
    color: "#b9c3be",
    fontSize: 11,
    textAlign: "center",
  },
});
