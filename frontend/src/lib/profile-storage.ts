export const PROFILE_STORAGE_KEY =
  "portal.user-profile";

export type UserProfile = {
  id?: number;
  firstName: string;
  lastName: string;
  middleName: string;
  fullName: string;
  login: string;
  email: string;
  avatar: string;
  role?: string;
  isActive?: boolean;
};

export const emptyProfile: UserProfile = {
  id: 0,
  firstName: "",
  lastName: "",
  middleName: "",
  fullName: "Профиль не заполнен",
  login: "",
  email: "",
  avatar: "",
  role: "User",
  isActive: true,
};

export function readProfile(): UserProfile {
  if (typeof window === "undefined") {
    return emptyProfile;
  }

  const rawProfile =
    window.localStorage.getItem(
      PROFILE_STORAGE_KEY,
    );

  if (!rawProfile) {
    return emptyProfile;
  }

  try {
    const parsedProfile = JSON.parse(
      rawProfile,
    ) as Partial<UserProfile>;

    return {
      ...emptyProfile,
      ...parsedProfile,
    };
  } catch {
    return emptyProfile;
  }
}

export function saveProfile(
  profile: UserProfile,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(profile),
  );
}

export function clearProfile(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(
    PROFILE_STORAGE_KEY,
  );
}
