import {
  api,
  ApiError,
} from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Platform,
} from "react-native";

const AUTH_TOKEN_KEY =
  "volgashield.sanctum-token";

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

type RequestCodeResponse = {
  ttl: number;
};

type EmailCodeLoginResponse =
  PortalUser & {
    token: string;
    remoteUserId: number;
  };

type AuthContextValue = {
  user: PortalUser | null;
  loading: boolean;

  requestCode: (
    email: string,
  ) => Promise<RequestCodeResponse>;

  login: (
    email: string,
    code: string,
  ) => Promise<PortalUser>;

  logout: () => Promise<void>;

  refresh:
    () => Promise<PortalUser | null>;
};

const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );

type AuthProviderProps = {
  children: ReactNode;
};

async function saveAuthToken(
  token: string | null,
): Promise<void> {
  if (
    Platform.OS !== "ios" &&
    Platform.OS !== "android"
  ) {
    return;
  }

  if (token === null) {
    await SecureStore.deleteItemAsync(
      AUTH_TOKEN_KEY,
    );

    return;
  }

  await SecureStore.setItemAsync(
    AUTH_TOKEN_KEY,
    token,
  );
}

function deviceName(): string {
  if (Platform.OS === "ios") {
    return "VolgaShield iOS";
  }

  if (Platform.OS === "android") {
    return "VolgaShield Android";
  }

  if (Platform.OS === "web") {
    return "VolgaShield Web";
  }

  return "VolgaShield";
}

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
        await api<PortalUser>(
          "/auth/me",
        );

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
          await api<PortalUser>(
            "/auth/me",
          );

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

  const requestCode =
    useCallback(
      async (
        emailValue: string,
      ) => {
        return api<RequestCodeResponse>(
          "/authentication",
          {
            method: "POST",

            body: JSON.stringify({
              email:
                emailValue.trim(),
            }),
          },
        );
      },
      [],
    );

  const login = useCallback(
    async (
      emailValue: string,
      codeValue: string,
    ) => {
      const cleanEmail =
        emailValue.trim();

      const cleanCode =
        codeValue.trim();

      if (
        !/^\d+$/.test(cleanCode)
      ) {
        throw new ApiError(
          "Введите корректный код",
          400,
        );
      }

      const loggedUser =
        await api<EmailCodeLoginResponse>(
          "/login",
          {
            method: "POST",

            body: JSON.stringify({
              email: cleanEmail,
              code: cleanCode,
              device_name:
                deviceName(),
            }),
          },
        );

      try {
        await saveAuthToken(
          loggedUser.token,
        );
      } catch (error) {
        console.error(
          "Не удалось сохранить токен авторизации:",
          error,
        );
      }

      setUser(loggedUser);

      return loggedUser;
    },
    [],
  );

  const logout =
    useCallback(async () => {
      try {
        await api("/auth/logout", {
          method: "POST",
        });
      } finally {
        try {
          await saveAuthToken(null);
        } catch (error) {
          console.error(
            "Не удалось удалить токен авторизации:",
            error,
          );
        }

        setUser(null);
      }
    }, []);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        loading,
        requestCode,
        login,
        logout,
        refresh,
      }),
      [
        user,
        loading,
        requestCode,
        login,
        logout,
        refresh,
      ],
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth():
  AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth должен использоваться внутри AuthProvider",
    );
  }

  return context;
}
