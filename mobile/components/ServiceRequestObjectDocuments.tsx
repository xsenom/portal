import React, { useMemo } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type UnknownRecord = Record<string, unknown>;

type NormalizedFile = {
  id: string;
  name: string;
  url: string | null;
  type: string | null;
};

type NormalizedContact = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
};

type Props = {
  request: unknown;
};

function record(value: unknown): UnknownRecord {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      return value.trim();
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return String(value);
    }
  }

  return null;
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      const normalized = Number(
        value.replace(",", "."),
      );

      if (Number.isFinite(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}

function dateLabel(value: unknown): string | null {
  const raw = text(value);

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizeFiles(
  values: unknown[],
): NormalizedFile[] {
  const result: NormalizedFile[] = [];
  const used = new Set<string>();

  for (const value of values) {
    for (const itemValue of array(value)) {
      const item = record(itemValue);

      const url = text(
        item.url,
        item.fileUrl,
        item.file_url,
        item.downloadUrl,
        item.download_url,
        item.publicUrl,
        item.public_url,
        item.storageUrl,
        item.storage_url,
        item.path,
      );

      const name =
        text(
          item.name,
          item.title,
          item.fileName,
          item.file_name,
          item.filename,
          item.originalName,
          item.original_name,
        ) ??
        (url
          ? decodeURIComponent(
              url.split("/").pop() ?? "Файл",
            )
          : "Файл");

      const id =
        text(item.id, item.uuid, item.code) ??
        `${name}-${url ?? result.length}`;

      const uniqueKey = `${id}-${url ?? ""}`;

      if (used.has(uniqueKey)) {
        continue;
      }

      used.add(uniqueKey);

      result.push({
        id: uniqueKey,
        name,
        url,
        type: text(
          item.type,
          item.mimeType,
          item.mime_type,
          item.category,
          item.fileType,
          item.file_type,
        ),
      });
    }
  }

  return result;
}

function normalizeContacts(
  values: unknown[],
): NormalizedContact[] {
  const result: NormalizedContact[] = [];
  const used = new Set<string>();

  for (const value of values) {
    for (const itemValue of array(value)) {
      const item = record(itemValue);

      const phone = text(
        item.phone,
        item.phoneNumber,
        item.phone_number,
        item.mobile,
      );

      const email = text(item.email);

      const name =
        text(
          item.name,
          item.fullName,
          item.full_name,
          item.fio,
        ) ?? "Контакт";

      const id =
        text(item.id, item.uuid) ??
        `${name}-${phone ?? email ?? result.length}`;

      if (used.has(id)) {
        continue;
      }

      used.add(id);

      result.push({
        id,
        name,
        position: text(
          item.position,
          item.role,
          item.jobTitle,
          item.job_title,
        ),
        phone,
        email,
      });
    }
  }

  return result;
}

function normalizePanelNumbers(
  value: unknown,
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (
          typeof item === "string" ||
          typeof item === "number"
        ) {
          return String(item).trim();
        }

        const itemRecord = record(item);

        return (
          text(
            itemRecord.number,
            itemRecord.value,
            itemRecord.code,
            itemRecord.name,
          ) ?? ""
        );
      })
      .filter(Boolean);
  }

  const single = text(value);

  if (!single) {
    return [];
  }

  return single
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function openUrl(
  url: string,
  errorMessage: string,
): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert("Не удалось открыть", errorMessage);
      return;
    }

    await Linking.openURL(url);
  } catch {
    Alert.alert("Не удалось открыть", errorMessage);
  }
}

export function ServiceRequestObjectDocuments({
  request,
}: Props) {
  const requestData = record(request);

  const objectData = record(
    requestData.object ??
      requestData.serviceObject ??
      requestData.service_object ??
      requestData.objectData ??
      requestData.object_data,
  );

  const contractData = record(
    requestData.contract ??
      requestData.serviceContract ??
      requestData.service_contract ??
      objectData.contract,
  );

  const objectName = text(
    objectData.name,
    objectData.title,
    requestData.objectName,
    requestData.object_name,
  );

  const address = text(
    objectData.address,
    objectData.fullAddress,
    objectData.full_address,
    requestData.objectAddress,
    requestData.object_address,
  );

  const latitude = numberValue(
    objectData.latitude,
    objectData.lat,
    requestData.objectLatitude,
    requestData.object_latitude,
  );

  const longitude = numberValue(
    objectData.longitude,
    objectData.lng,
    objectData.lon,
    requestData.objectLongitude,
    requestData.object_longitude,
  );

  const contacts = useMemo(
    () =>
      normalizeContacts([
        objectData.contacts,
        requestData.contacts,
        requestData.objectContacts,
        requestData.object_contacts,
      ]),
    [objectData, requestData],
  );

  const panelNumbers = useMemo(
    () =>
      normalizePanelNumbers(
        objectData.panelNumbers ??
          objectData.panel_numbers ??
          objectData.panelNumber ??
          objectData.panel_number ??
          requestData.panelNumbers ??
          requestData.panel_numbers,
      ),
    [objectData, requestData],
  );

  const files = useMemo(
    () =>
      normalizeFiles([
        objectData.files,
        objectData.documents,
        objectData.schemes,
        requestData.objectFiles,
        requestData.object_files,
        requestData.contractFiles,
        requestData.contract_files,
        requestData.schemes,
        contractData.files,
        contractData.documents,
      ]),
    [contractData, objectData, requestData],
  );

  const contractNumber = text(
    contractData.number,
    contractData.contractNumber,
    contractData.contract_number,
    requestData.contractNumber,
    requestData.contract_number,
  );

  const contractDate = dateLabel(
    contractData.date ??
      contractData.contractDate ??
      contractData.contract_date ??
      requestData.contractDate ??
      requestData.contract_date,
  );

  const openMap = async (): Promise<void> => {
    const query =
      latitude !== null && longitude !== null
        ? `${latitude},${longitude}`
        : address;

    if (!query) {
      Alert.alert(
        "Нет координат",
        "Для объекта не указан адрес или геоточка.",
      );
      return;
    }

    const encoded = encodeURIComponent(query);

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${encoded}`
        : Platform.OS === "android"
          ? `geo:0,0?q=${encoded}`
          : `https://yandex.ru/maps/?text=${encoded}`;

    await openUrl(
      url,
      "Не удалось открыть приложение с картами.",
    );
  };

  const call = async (
    phone: string,
  ): Promise<void> => {
    const normalized = phone.replace(
      /[^\d+]/g,
      "",
    );

    await openUrl(
      `tel:${normalized}`,
      "Не удалось открыть приложение телефона.",
    );
  };

  const email = async (
    emailAddress: string,
  ): Promise<void> => {
    await openUrl(
      `mailto:${emailAddress}`,
      "Не удалось открыть почтовое приложение.",
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Объект и документы
      </Text>

      {objectName ? (
        <View style={styles.field}>
          <Text style={styles.label}>Объект</Text>
          <Text style={styles.value}>{objectName}</Text>
        </View>
      ) : null}

      {address ? (
        <View style={styles.field}>
          <Text style={styles.label}>Адрес</Text>
          <Text style={styles.value}>{address}</Text>
        </View>
      ) : null}

      {latitude !== null &&
      longitude !== null ? (
        <View style={styles.field}>
          <Text style={styles.label}>
            Координаты
          </Text>

          <Text style={styles.value}>
            {latitude.toFixed(6)},{" "}
            {longitude.toFixed(6)}
          </Text>
        </View>
      ) : null}

      {(address ||
        (latitude !== null &&
          longitude !== null)) ? (
        <Pressable
          accessibilityRole="button"
          onPress={openMap}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            Открыть в навигаторе
          </Text>
        </Pressable>
      ) : null}

      {panelNumbers.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Пультовые номера
          </Text>

          <View style={styles.chips}>
            {panelNumbers.map((number) => (
              <View
                key={number}
                style={styles.chip}
              >
                <Text style={styles.chipText}>
                  {number}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Контакты на объекте
        </Text>

        {contacts.length === 0 ? (
          <Text style={styles.emptyText}>
            Контакты не указаны
          </Text>
        ) : (
          contacts.map((contact) => (
            <View
              key={contact.id}
              style={styles.contactCard}
            >
              <Text style={styles.contactName}>
                {contact.name}
              </Text>

              {contact.position ? (
                <Text style={styles.secondaryText}>
                  {contact.position}
                </Text>
              ) : null}

              {contact.phone ? (
                <Pressable
                  onPress={() => call(contact.phone!)}
                  style={({ pressed }) => [
                    styles.linkRow,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.linkLabel}>
                    Позвонить
                  </Text>

                  <Text style={styles.linkValue}>
                    {contact.phone}
                  </Text>
                </Pressable>
              ) : null}

              {contact.email ? (
                <Pressable
                  onPress={() =>
                    email(contact.email!)
                  }
                  style={({ pressed }) => [
                    styles.linkRow,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.linkLabel}>
                    Написать
                  </Text>

                  <Text style={styles.linkValue}>
                    {contact.email}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Договор
        </Text>

        {!contractNumber && !contractDate ? (
          <Text style={styles.emptyText}>
            Договор не прикреплён
          </Text>
        ) : (
          <View style={styles.contractCard}>
            {contractNumber ? (
              <View style={styles.field}>
                <Text style={styles.label}>
                  Номер
                </Text>

                <Text style={styles.value}>
                  {contractNumber}
                </Text>
              </View>
            ) : null}

            {contractDate ? (
              <View style={styles.field}>
                <Text style={styles.label}>
                  Дата
                </Text>

                <Text style={styles.value}>
                  {contractDate}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Схемы и файлы
        </Text>

        {files.length === 0 ? (
          <Text style={styles.emptyText}>
            Файлы не прикреплены
          </Text>
        ) : (
          files.map((file) => (
            <Pressable
              key={file.id}
              disabled={!file.url}
              onPress={() => {
                if (!file.url) {
                  return;
                }

                void openUrl(
                  file.url,
                  "Не удалось открыть файл.",
                );
              }}
              style={({ pressed }) => [
                styles.fileRow,
                !file.url && styles.fileDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.fileIcon}>
                <Text style={styles.fileIconText}>
                  {file.type
                    ?.toLowerCase()
                    .includes("pdf")
                    ? "PDF"
                    : "FILE"}
                </Text>
              </View>

              <View style={styles.fileText}>
                <Text
                  numberOfLines={2}
                  style={styles.fileName}
                >
                  {file.name}
                </Text>

                {file.type ? (
                  <Text style={styles.secondaryText}>
                    {file.type}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.fileAction}>
                {file.url ? "Открыть" : "Нет ссылки"}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d9e4de",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    gap: 14,
  },

  title: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    color: "#14211a",
  },

  section: {
    gap: 10,
  },

  sectionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: "#1b2c22",
  },

  field: {
    gap: 3,
  },

  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#708078",
    textTransform: "uppercase",
  },

  value: {
    fontSize: 15,
    lineHeight: 21,
    color: "#1a251f",
  },

  secondaryText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#718078",
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#718078",
  },

  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#238b57",
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },

  buttonPressed: {
    opacity: 0.72,
  },

  divider: {
    height: 1,
    backgroundColor: "#edf1ef",
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#eef7f2",
  },

  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#27704b",
  },

  contactCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f7f9f8",
    gap: 5,
  },

  contactName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#17251d",
  },

  linkRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  linkLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#238b57",
  },

  linkValue: {
    flexShrink: 1,
    fontSize: 14,
    color: "#26352d",
    textAlign: "right",
  },

  contractCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f7f9f8",
    gap: 10,
  },

  fileRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e9e5",
    borderRadius: 14,
    backgroundColor: "#fafcfb",
  },

  fileDisabled: {
    opacity: 0.55,
  },

  fileIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#e6f3ec",
  },

  fileIconText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#24704a",
  },

  fileText: {
    flex: 1,
    gap: 2,
  },

  fileName: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: "#1b2921",
  },

  fileAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#238b57",
  },
});
