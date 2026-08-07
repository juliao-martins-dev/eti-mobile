import * as Location from "expo-location";

import type { ClockCoords } from "./prezensa";

/** Thrown when coordinates can't be obtained, with a Tetum message to show. */
export class LocationError extends Error {}

const PERMISSION_DENIED =
  "Presiza asesu ba lokalizasaun atu rejista prezensa. Favór fó autorizasaun iha konfigurasaun.";

const UNAVAILABLE =
  "La konsege hetan ita-nia lokalizasaun. Favór verifika GPS no koko fila fali.";

/**
 * Foreground permission + a fix for the punch. Falls back to the last known
 * position when a fresh fix is slow (indoors, weak signal), which is accurate
 * enough for the school geofence.
 */
export async function getCurrentCoords(): Promise<ClockCoords> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== Location.PermissionStatus.GRANTED) {
    throw new LocationError(PERMISSION_DENIED);
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      return {
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      };
    }
    throw new LocationError(UNAVAILABLE);
  }
}
