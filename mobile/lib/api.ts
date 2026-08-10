import { Platform } from "react-native";

const API_BASE =
  Platform.OS === "web"
    ? "/api/portal"
    : "https://test.xsenom.ru/api/portal";

const DEFAULT_REQUEST_TIMEOUT = 12000;
const UPLOAD_REQUEST_TIMEOUT = 120000;

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(
    message: string,
    status: number,
    data: unknown = null,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export type ApiRequestInit =
  RequestInit & {
    timeoutMs?: number;
  };

function statusMessage(status: number): string {
  if (status === 400) {
    return "Некорректные данные запроса";
  }

  if (status === 401) {
    return "Требуется авторизация";
  }

  if (status === 403) {
    return "Недостаточно прав";
  }

  if (status === 404) {
    return "Данные не найдены";
  }

  if (status === 408) {
    return "Сервер слишком долго не отвечает";
  }

  if (status === 409) {
    return "Данные уже были изменены";
  }

  if (status === 413) {
    return "Файл слишком большой";
  }

  if (status >= 500) {
    return "Внутренняя ошибка сервера";
  }

  return "Не удалось выполнить запрос";
}

function normalizePath(path: string): string {
  return path.startsWith("/")
    ? path
    : `/${path}`;
}

function isFormDataBody(
  body: BodyInit | null | undefined,
): boolean {
  return (
    typeof FormData !== "undefined" &&
    body instanceof FormData
  );
}

export async function api<T = unknown>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const {
    timeoutMs = DEFAULT_REQUEST_TIMEOUT,
    ...fetchInit
  } = init;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const headers = new Headers(fetchInit.headers);

  headers.set("Accept", "application/json");

  if (
    fetchInit.body !== undefined &&
    fetchInit.body !== null &&
    !isFormDataBody(fetchInit.body) &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE}${normalizePath(path)}`,
      {
        ...fetchInit,
        headers,
        credentials: "include",
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new ApiError(
        "Сервер слишком долго не отвечает",
        408,
      );
    }

    throw new ApiError(
      "Сервер временно недоступен",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();

  let data: unknown = null;

  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    const serverMessage =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message.trim()
        : "";

    throw new ApiError(
      serverMessage ||
        statusMessage(response.status),
      response.status,
      data,
    );
  }

  return data as T;
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  return api<T>(path, {
    method: "POST",
    body: formData,
    timeoutMs: UPLOAD_REQUEST_TIMEOUT,
  });
}
