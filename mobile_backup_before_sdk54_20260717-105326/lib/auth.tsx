import {
  api,
  ApiError,
} from "@/lib/api";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type PortalUser = {
  id: number;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  isActive: boolean;

  avatarUrl?: string | null;
  position?: string | null;
  category?: string | null;
  employmentDate?: string | null;
};

type AuthContextValue = {
  user: PortalUser | null;
  loading: boolean;

  login: (
    login: string,
    password: string,
  ) => Promise<PortalUser>;

  logout: () => Promise<void>;
  refresh: () => Promise<PortalUser | null>;
};

const AuthContext =
  createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<PortalUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const refresh = useCallback(async () => {
    try {
      const currentUser =
        await api<PortalUser>("/auth/me");

      setUser(currentUser);

      return currentUser;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401
      ) {
        setUser(null);
        return null;
      }

      console.error(
        "Не удалось проверить авторизацию:",
        error,
      );

      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const currentUser =
          await api<PortalUser>("/auth/me");

        if (active) {
          setUser(currentUser);
        }
      } catch (error) {
        if (
          !(
            error instanceof ApiError &&
            error.status === 401
          )
        ) {
          console.error(
            "Ошибка инициализации авторизации:",
            error,
          );
        }

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (
      loginValue: string,
      password: string,
    ) => {
      const loggedUser =
        await api<PortalUser>(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              login: loginValue.trim(),
              password,
            }),
          },
        );

      setUser(loggedUser);

      return loggedUser;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
    }),
    [
      user,
      loading,
      login,
      logout,
      refresh,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth должен использоваться внутри AuthProvider",
    );
  }

  return context;
}
