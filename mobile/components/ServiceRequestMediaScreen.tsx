import {
  api,
  ApiError,
  apiUpload,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  readCurrentGeo,
} from "@/lib/service-device";
import {
  serviceStatusLabels,
  type ServiceRequestDetail,
} from "@/lib/service-requests";
import { colors } from "@/lib/theme";
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
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

type CommentType =
  | "Service"
  | "Client"
  | "System";

type AttachmentType =
  | "BeforePhoto"
  | "AfterPhoto"
  | "ActPhoto"
  | "Video"
  | "Scheme"
  | "Contract"
  | "Other";

type ServiceComment = {
  id: number;
  type: CommentType;
  message: string;
  isInternal: boolean;

  author: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
    avatarUrl: string | null;
    position: string | null;
  } | null;

  createdAt: string;
  updatedAt: string;
};

type ServiceAttachment = {
  id: number;
  type: AttachmentType;
  fileName: string;
  originalName: string | null;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  qualityScore: number | null;
  isDocumentScan: boolean;

  uploadedBy: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;

  createdAt: string;
};

type BusyAction =
  | "comment"
  | "before-camera"
  | "before-gallery"
  | "after-camera"
  | "after-gallery"
  | "act-camera"
  | "act-gallery"
  | "video"
  | "close"
  | null;

export default function ServiceRequestMediaScreen() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const requestId = useMemo(() => {
    const raw = Array.isArray(params.id)
      ? params.id[0]
      : params.id;

    const value = Number(raw);

    return Number.isInteger(value) &&
      value > 0
      ? value
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
    comments,
    setComments,
  ] = useState<ServiceComment[]>([]);

  const [
    attachments,
    setAttachments,
  ] = useState<ServiceAttachment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState<BusyAction>(null);

  const [
    commentType,
    setCommentType,
  ] = useState<CommentType>("Service");

  const [
    commentText,
    setCommentText,
  ] = useState("");

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
          commentsResult,
          attachmentsResult,
        ] = await Promise.all([
          api<ServiceRequestDetail>(
            `/service-requests/${requestId}`,
          ),

          api<ServiceComment[]>(
            `/service-requests/${requestId}/comments`,
          ),

          api<ServiceAttachment[]>(
            `/service-requests/${requestId}/attachments`,
          ),
        ]);

        setRequest(requestResult);
        setComments(commentsResult);
        setAttachments(attachmentsResult);
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Не удалось загрузить материалы заявки",
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

  async function addComment() {
    if (
      requestId === null ||
      busy !== null
    ) {
      return;
    }

    const message =
      commentText.trim();

    if (message === "") {
      setError(
        "Введите текст комментария",
      );

      return;
    }

    setBusy("comment");
    setError("");

    try {
      await api(
        `/service-requests/${requestId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            type: commentType,
            message,
          }),
        },
      );

      setCommentText("");
      await load(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось добавить комментарий",
      );
    } finally {
      setBusy(null);
    }
  }

  async function selectAndUpload(
    attachmentType: AttachmentType,
    source: "camera" | "gallery",
    action: BusyAction,
  ) {
    if (
      requestId === null ||
      request?.isArchived ||
      busy !== null
    ) {
      return;
    }

    setBusy(action);
    setError("");

    try {
      let result:
        ImagePicker.ImagePickerResult;

      if (source === "camera") {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          throw new Error(
            "Разрешите приложению доступ к камере",
          );
        }

        result =
          await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.85,
            allowsEditing: false,
          });
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          throw new Error(
            "Разрешите приложению доступ к фотографиям",
          );
        }

        result =
          await ImagePicker.launchImageLibraryAsync({
            mediaTypes:
              attachmentType === "Video"
                ? ["videos"]
                : ["images"],
            quality: 0.85,
            allowsEditing: false,
            allowsMultipleSelection: false,
          });
      }

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset) {
        throw new Error(
          "Файл не был выбран",
        );
      }

      const formData = new FormData();

      if (
        Platform.OS === "web" &&
        asset.file
      ) {
        formData.append(
          "file",
          asset.file,
        );
      } else {
        const fallbackExtension =
          attachmentType === "Video"
            ? "mp4"
            : "jpg";

        const fileName =
          asset.fileName ||
          `${attachmentType}-${Date.now()}.${fallbackExtension}`;

        const mimeType =
          asset.mimeType ||
          (
            attachmentType === "Video"
              ? "video/mp4"
              : "image/jpeg"
          );

        formData.append(
          "file",
          {
            uri: asset.uri,
            name: fileName,
            type: mimeType,
          } as unknown as Blob,
        );
      }

      formData.append(
        "attachmentType",
        attachmentType,
      );

      if (attachmentType === "ActPhoto") {
        formData.append(
          "isDocumentScan",
          "true",
        );
      }

      await apiUpload(
        `/service-requests/${requestId}/attachments`,
        formData,
      );

      await load(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить файл",
      );
    } finally {
      setBusy(null);
    }
  }

  async function openCloseScanner() {
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

  async function closeRequest(
    barcodeValue: string,
    barcodeFormat: string,
  ) {
    if (
      requestId === null ||
      scannerLocked ||
      busy !== null ||
      barcodeValue.trim().length < 2
    ) {
      return;
    }

    setScannerLocked(true);
    setBusy("close");
    setError("");

    try {
      const geo =
        await readCurrentGeo();

      await api(
        `/service-requests/${requestId}/close`,
        {
          method: "POST",
          body: JSON.stringify({
            barcodeValue:
              barcodeValue.trim(),
            barcodeFormat,
            ...geo,
          }),
        },
      );

      setScannerVisible(false);
      setManualBarcode("");

      await load(false);
    } catch (requestError) {
      setScannerLocked(false);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось закрыть заявку",
      );
    } finally {
      setBusy(null);
    }
  }

  function onBarcodeScanned(
    result: BarcodeScanningResult,
  ) {
    void closeRequest(
      result.data,
      result.type,
    );
  }

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const actPhotos =
    attachments.filter(
      (attachment) =>
        attachment.type === "ActPhoto",
    );

  const canEdit =
    request !== null &&
    !request.isArchived &&
    request.status !== "Closed";

  const canClose =
    request?.status === "Completed" &&
    actPhotos.length > 0 &&
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
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              Материалы заявки
            </Text>

            {!!request && (
              <Text style={styles.headerNumber}>
                № {request.requestNumber}
              </Text>
            )}
          </View>

          <Pressable
            style={styles.headerButton}
            onPress={() =>
              void load()
            }
          >
            <Text style={styles.reloadText}>
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
          <Loading />
        ) : request ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={
              styles.content
            }
          >
            <View style={styles.summary}>
              <View>
                <Text style={styles.summaryTitle}>
                  {request.title}
                </Text>

                <Text style={styles.summaryStatus}>
                  {
                    serviceStatusLabels[
                      request.status
                    ]
                  }
                </Text>
              </View>

              <Text style={styles.summaryCount}>
                {attachments.length} файлов
              </Text>
            </View>

            {request.isArchived && (
              <View style={styles.archive}>
                <Text style={styles.archiveTitle}>
                  Архивная заявка
                </Text>

                <Text style={styles.archiveText}>
                  Добавление комментариев и файлов отключено.
                </Text>
              </View>
            )}

            <Section title="Фотографии и видео">
              <UploadGroup
                title="Фото до начала работ"
                count={
                  attachments.filter(
                    (item) =>
                      item.type ===
                      "BeforePhoto",
                  ).length
                }
                disabled={!canEdit || busy !== null}
                cameraLoading={
                  busy === "before-camera"
                }
                galleryLoading={
                  busy === "before-gallery"
                }
                onCamera={() =>
                  void selectAndUpload(
                    "BeforePhoto",
                    "camera",
                    "before-camera",
                  )
                }
                onGallery={() =>
                  void selectAndUpload(
                    "BeforePhoto",
                    "gallery",
                    "before-gallery",
                  )
                }
              />

              <UploadGroup
                title="Фото после работ"
                count={
                  attachments.filter(
                    (item) =>
                      item.type ===
                      "AfterPhoto",
                  ).length
                }
                disabled={!canEdit || busy !== null}
                cameraLoading={
                  busy === "after-camera"
                }
                galleryLoading={
                  busy === "after-gallery"
                }
                onCamera={() =>
                  void selectAndUpload(
                    "AfterPhoto",
                    "camera",
                    "after-camera",
                  )
                }
                onGallery={() =>
                  void selectAndUpload(
                    "AfterPhoto",
                    "gallery",
                    "after-gallery",
                  )
                }
              />

              <UploadGroup
                title="Страницы акта"
                count={actPhotos.length}
                disabled={!canEdit || busy !== null}
                cameraLoading={
                  busy === "act-camera"
                }
                galleryLoading={
                  busy === "act-gallery"
                }
                onCamera={() =>
                  void selectAndUpload(
                    "ActPhoto",
                    "camera",
                    "act-camera",
                  )
                }
                onGallery={() =>
                  void selectAndUpload(
                    "ActPhoto",
                    "gallery",
                    "act-gallery",
                  )
                }
              />

              <Pressable
                style={[
                  styles.videoButton,
                  (
                    !canEdit ||
                    busy !== null
                  ) &&
                    styles.disabled,
                ]}
                disabled={
                  !canEdit ||
                  busy !== null
                }
                onPress={() =>
                  void selectAndUpload(
                    "Video",
                    "gallery",
                    "video",
                  )
                }
              >
                {busy === "video" ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                  />
                ) : (
                  <Text
                    style={
                      styles.videoButtonText
                    }
                  >
                    Добавить видео
                  </Text>
                )}
              </Pressable>
            </Section>

            <Section title="Загруженные файлы">
              {attachments.length === 0 ? (
                <Text style={styles.emptyText}>
                  Файлы пока не загружены.
                </Text>
              ) : (
                <View style={styles.files}>
                  {attachments.map(
                    (attachment) => (
                      <AttachmentCard
                        key={attachment.id}
                        attachment={attachment}
                      />
                    ),
                  )}
                </View>
              )}
            </Section>

            <Section title="Комментарии">
              {canEdit && (
                <>
                  <View
                    style={styles.commentTypes}
                  >
                    <CommentTypeButton
                      label="Служебный"
                      selected={
                        commentType ===
                        "Service"
                      }
                      onPress={() =>
                        setCommentType(
                          "Service",
                        )
                      }
                    />

                    <CommentTypeButton
                      label="Для клиента"
                      selected={
                        commentType ===
                        "Client"
                      }
                      onPress={() =>
                        setCommentType(
                          "Client",
                        )
                      }
                    />
                  </View>

                  <TextInput
                    style={styles.commentInput}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    placeholder="Добавить комментарий"
                    placeholderTextColor={
                      colors.textSecondary
                    }
                  />

                  <Pressable
                    style={[
                      styles.commentButton,
                      (
                        busy !== null ||
                        commentText.trim() ===
                          ""
                      ) &&
                        styles.disabled,
                    ]}
                    disabled={
                      busy !== null ||
                      commentText.trim() ===
                        ""
                    }
                    onPress={() =>
                      void addComment()
                    }
                  >
                    {busy === "comment" ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.white}
                      />
                    ) : (
                      <Text
                        style={
                          styles.commentButtonText
                        }
                      >
                        Отправить комментарий
                      </Text>
                    )}
                  </Pressable>
                </>
              )}

              <View style={styles.comments}>
                {comments.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Комментариев пока нет.
                  </Text>
                ) : (
                  comments.map((comment) => (
                    <View
                      key={comment.id}
                      style={styles.comment}
                    >
                      <View
                        style={
                          styles.commentHeading
                        }
                      >
                        <Text
                          style={
                            styles.commentAuthor
                          }
                        >
                          {comment.author
                            ? `${comment.author.lastName} ${comment.author.firstName}`
                            : "Система"}
                        </Text>

                        <Text
                          style={
                            styles.commentDate
                          }
                        >
                          {formatDateTime(
                            comment.createdAt,
                          )}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.commentKind
                        }
                      >
                        {comment.type ===
                        "Client"
                          ? "Для клиента"
                          : comment.type ===
                              "System"
                            ? "Системный"
                            : "Служебный"}
                      </Text>

                      <Text
                        style={
                          styles.commentMessage
                        }
                      >
                        {comment.message}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </Section>

            {request.status ===
              "Completed" &&
              actPhotos.length === 0 && (
                <View
                  style={
                    styles.closeWarning
                  }
                >
                  <Text
                    style={
                      styles.closeWarningTitle
                    }
                  >
                    Нельзя закрыть заявку
                  </Text>

                  <Text
                    style={
                      styles.closeWarningText
                    }
                  >
                    Загрузите хотя бы одну страницу акта.
                  </Text>
                </View>
              )}

            {canClose && (
              <Pressable
                style={[
                  styles.closeButton,
                  busy !== null &&
                    styles.disabled,
                ]}
                disabled={busy !== null}
                onPress={() =>
                  void openCloseScanner()
                }
              >
                <Text
                  style={
                    styles.closeButtonText
                  }
                >
                  Сканировать акт и закрыть заявку
                </Text>
              </Pressable>
            )}
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
          style={styles.scanner}
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

            <Text style={styles.scannerTitle}>
              Штрих-код акта
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

            {busy === "close" && (
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
                  Закрываем заявку…
                </Text>
              </View>
            )}
          </View>

          <View style={styles.manual}>
            <Text style={styles.manualTitle}>
              Или введите код вручную
            </Text>

            <TextInput
              style={styles.manualInput}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder="Штрих-код акта"
              placeholderTextColor={
                colors.textSecondary
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable
              style={[
                styles.manualButton,
                (
                  manualBarcode.trim()
                    .length < 2 ||
                  busy !== null
                ) &&
                  styles.disabled,
              ]}
              disabled={
                manualBarcode.trim()
                  .length < 2 ||
                busy !== null
              }
              onPress={() =>
                void closeRequest(
                  manualBarcode,
                  "manual",
                )
              }
            >
              <Text
                style={
                  styles.manualButtonText
                }
              >
                Закрыть заявку
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function UploadGroup({
  title,
  count,
  disabled,
  cameraLoading,
  galleryLoading,
  onCamera,
  onGallery,
}: {
  title: string;
  count: number;
  disabled: boolean;
  cameraLoading: boolean;
  galleryLoading: boolean;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <View style={styles.uploadGroup}>
      <View style={styles.uploadHeading}>
        <Text style={styles.uploadTitle}>
          {title}
        </Text>

        <Text style={styles.uploadCount}>
          {count}
        </Text>
      </View>

      <View style={styles.uploadActions}>
        <UploadButton
          label="Снять"
          loading={cameraLoading}
          disabled={disabled}
          onPress={onCamera}
        />

        <UploadButton
          label="Выбрать"
          loading={galleryLoading}
          disabled={disabled}
          onPress={onGallery}
        />
      </View>
    </View>
  );
}

function UploadButton({
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
        styles.uploadButton,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
        />
      ) : (
        <Text
          style={styles.uploadButtonText}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function AttachmentCard({
  attachment,
}: {
  attachment: ServiceAttachment;
}) {
  const url = absoluteFileUrl(
    attachment.fileUrl,
  );

  const isImage =
    attachment.mimeType?.startsWith(
      "image/",
    ) ?? false;

  return (
    <Pressable
      style={styles.file}
      onPress={() =>
        void Linking.openURL(url)
      }
    >
      {isImage ? (
        <Image
          style={styles.fileImage}
          source={{
            uri: url,
          }}
        />
      ) : (
        <View style={styles.fileIcon}>
          <Text style={styles.fileIconText}>
            {attachment.type === "Video"
              ? "▶"
              : "▤"}
          </Text>
        </View>
      )}

      <View style={styles.fileContent}>
        <Text
          style={styles.fileTitle}
          numberOfLines={1}
        >
          {attachment.originalName ||
            attachment.fileName}
        </Text>

        <Text style={styles.fileType}>
          {attachmentTypeLabel(
            attachment.type,
          )}
        </Text>

        <Text style={styles.fileDate}>
          {formatDateTime(
            attachment.createdAt,
          )}
        </Text>
      </View>

      <Text style={styles.fileArrow}>
        ›
      </Text>
    </Pressable>
  );
}

function CommentTypeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.commentTypeButton,
        selected &&
          styles.commentTypeSelected,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.commentTypeText,
          selected &&
            styles.commentTypeTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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

      {children}
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator
        color={colors.primary}
      />

      <Text style={styles.loadingText}>
        Загружаем материалы…
      </Text>
    </View>
  );
}

function attachmentTypeLabel(
  type: AttachmentType,
): string {
  const labels:
    Record<AttachmentType, string> = {
      BeforePhoto: "Фото до работ",
      AfterPhoto: "Фото после работ",
      ActPhoto: "Страница акта",
      Video: "Видео",
      Scheme: "Схема",
      Contract: "Договор",
      Other: "Другой файл",
    };

  return labels[type];
}

function absoluteFileUrl(
  value: string,
): string {
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `https://test.xsenom.ru${
    value.startsWith("/")
      ? value
      : `/${value}`
  }`;
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

  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.graphite,
  },

  summaryTitle: {
    maxWidth: 260,
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  summaryStatus: {
    marginTop: 4,
    color: "#aebbb5",
    fontSize: 10,
  },

  summaryCount: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
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

  section: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  sectionTitle: {
    marginBottom: 11,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  uploadGroup: {
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  uploadHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  uploadTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },

  uploadCount: {
    minWidth: 25,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: colors.primarySoft,
  },

  uploadActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  uploadButton: {
    minHeight: 40,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
  },

  uploadButtonText: {
    color: colors.primaryHover,
    fontSize: 11,
    fontWeight: "600",
  },

  videoButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
  },

  videoButtonText: {
    color: colors.primaryHover,
    fontSize: 11,
    fontWeight: "700",
  },

  files: {
    gap: 8,
  },

  file: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surfaceSoft,
  },

  fileImage: {
    width: 48,
    height: 48,
    borderRadius: 7,
    backgroundColor: colors.border,
  },

  fileIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: colors.primarySoft,
  },

  fileIconText: {
    color: colors.primary,
    fontSize: 20,
  },

  fileContent: {
    minWidth: 0,
    flex: 1,
  },

  fileTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },

  fileType: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 10,
  },

  fileDate: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 9,
  },

  fileArrow: {
    color: colors.textSecondary,
    fontSize: 22,
  },

  commentTypes: {
    flexDirection: "row",
    gap: 7,
  },

  commentTypeButton: {
    minHeight: 36,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },

  commentTypeSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  commentTypeText: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  commentTypeTextSelected: {
    color: colors.primaryHover,
    fontWeight: "700",
  },

  commentInput: {
    minHeight: 90,
    marginTop: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    color: colors.text,
    fontSize: 12,
    textAlignVertical: "top",
  },

  commentButton: {
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },

  commentButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },

  comments: {
    gap: 8,
    marginTop: 13,
  },

  comment: {
    padding: 10,
    borderRadius: 9,
    backgroundColor: colors.surfaceSoft,
  },

  commentHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  commentAuthor: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },

  commentDate: {
    color: colors.textSecondary,
    fontSize: 8,
  },

  commentKind: {
    marginTop: 3,
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: "600",
  },

  commentMessage: {
    marginTop: 6,
    color: colors.text,
    fontSize: 11,
    lineHeight: 16,
  },

  closeWarning: {
    padding: 12,
    borderRadius: 9,
    backgroundColor: "#fff8e4",
  },

  closeWarningTitle: {
    color: "#96680b",
    fontSize: 12,
    fontWeight: "700",
  },

  closeWarningText: {
    marginTop: 3,
    color: "#96680b",
    fontSize: 11,
  },

  closeButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  closeButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
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

  scanner: {
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

  closeText: {
    color: colors.text,
    fontSize: 30,
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

  manual: {
    gap: 10,
    padding: 16,
    backgroundColor: colors.surface,
  },

  manualTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  manualInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    color: colors.text,
  },

  manualButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  manualButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
});
