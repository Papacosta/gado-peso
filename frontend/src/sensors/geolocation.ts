/** Geolocalização opcional (identifica a fazenda/local da coleta). */
import type { GeolocationReading } from "../types";

let latestGeo: GeolocationReading = {
  available: false,
  latitude: null,
  longitude: null,
  accuracy_m: null,
  timestamp: null,
};

export function getGeolocation(): GeolocationReading {
  return latestGeo;
}

export function readGeolocation(timeoutMs = 5000): Promise<GeolocationReading> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(latestGeo);
      return;
    }
    const timer = setTimeout(() => resolve(latestGeo), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        latestGeo = {
          available: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        resolve(latestGeo);
      },
      () => {
        clearTimeout(timer);
        resolve(latestGeo);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}