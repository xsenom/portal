import * as Location from "expo-location";
import { Platform } from "react-native";

export type CurrentGeo = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export function deviceLabel(): string {
  return `${Platform.OS} ${String(
    Platform.Version,
  )}`;
}

function mapPosition(
  position: Location.LocationObject,
): CurrentGeo {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "Геолокация определяется слишком долго",
          ),
        );
      }, milliseconds);
    }),
  ]);
}

export async function readCurrentGeo(): Promise<CurrentGeo> {
  try {
    if (Platform.OS !== "web") {
      const servicesEnabled =
        await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        throw new Error(
          "Включите геолокацию на устройстве",
        );
      }
    }

    let permission =
      await Location.getForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      permission =
        await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== "granted") {
      throw new Error(
        "Разрешите приложению доступ к геолокации",
      );
    }

    const lastKnown =
      await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 300,
      });

    if (lastKnown) {
      return mapPosition(lastKnown);
    }

    try {
      const current = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy:
            Location.Accuracy.Balanced,
        }),
        6000,
      );

      return mapPosition(current);
    } catch {
      const fallback =
        await Location.getLastKnownPositionAsync({
          maxAge: 30 * 60 * 1000,
          requiredAccuracy: 1000,
        });

      if (fallback) {
        return mapPosition(fallback);
      }

      throw new Error(
        "Не удалось быстро определить местоположение",
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Не удалось определить местоположение",
    );
  }
}
