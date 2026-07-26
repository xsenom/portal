import { api, ApiError, saveToken } from "@/lib/api";
import { router } from "expo-router";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";

export type User = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  isActive: boolean;
  token?: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setUser(await api<User>("/auth/me"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null);
      else throw error;
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function login(loginValue: string, password: string) {
    const result = await api<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: loginValue.trim(), password }),
    });
    await saveToken(result.token ?? null);
    setUser(result);
  }

  async function logout() {
    await api<{ success: boolean }>("/auth/logout", { method: "POST" }).catch(() => null);
    await saveToken(null);
    setUser(null);
    router.replace("/login");
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
