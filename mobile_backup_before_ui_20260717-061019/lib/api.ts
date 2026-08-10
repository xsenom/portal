import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://test.xsenom.ru/api/portal";
const TOKEN_KEY = "portal.auth.token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") return;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.message || "Ошибка запроса");
  return data as T;
}
