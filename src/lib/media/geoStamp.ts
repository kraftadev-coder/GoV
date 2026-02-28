/**
 * Module 3: Geo-Stamp Generator
 *
 * Browser Geolocation API integration for "Witness Cam".
 * Generates anonymized geo-labels (e.g., "Ikeja District") from coordinates.
 * Attaches timestamp + geo-label as a cryptographic stamp to media.
 *
 * Source:
 * - Component Spec: Evidence Frame (top bar: region, bottom bar: hash)
 * - Feature Goal Matrix: "In-app capture attaches cryptographic Geo-Stamps"
 * - Technical Blueprint §3.1: "Worker checks cf-ipcountry and geo-coords"
 */

/* ───────────────────── Types ───────────────────── */

export interface GeoPosition {
    latitude: number;
    longitude: number;
    accuracy: number; // meters
    timestamp: number;
}

export interface GeoStamp {
    /** Anonymized district label (e.g., "Ikeja District") */
    geoLabel: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Position accuracy in meters */
    accuracyMeters: number;
    /** Whether GPS lock was achieved (accuracy < 100m) */
    hasGpsLock: boolean;
}

export type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';

/* ───────────────────── Constants ───────────────────── */

/** GPS lock threshold in meters — below this = "Presence Lock" achieved */
const GPS_LOCK_THRESHOLD = 100;

/** Geolocation timeout in ms */
const GEO_TIMEOUT = 15000;

/**
 * Nigerian district lookup table.
 * Maps approximate lat/lng bounding boxes to anonymized labels.
 * We use districts instead of exact coordinates for anonymity.
 */
const NIGERIAN_DISTRICTS: ReadonlyArray<{
    label: string;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}> = [
        // Lagos State
        { label: 'Lagos Island District', minLat: 6.43, maxLat: 6.48, minLng: 3.38, maxLng: 3.42 },
        { label: 'Victoria Island District', minLat: 6.41, maxLat: 6.45, minLng: 3.40, maxLng: 3.47 },
        { label: 'Ikeja District', minLat: 6.58, maxLat: 6.64, minLng: 3.33, maxLng: 3.40 },
        { label: 'Lekki District', minLat: 6.43, maxLat: 6.50, minLng: 3.47, maxLng: 3.65 },
        { label: 'Surulere District', minLat: 6.48, maxLat: 6.53, minLng: 3.33, maxLng: 3.38 },
        { label: 'Yaba District', minLat: 6.50, maxLat: 6.55, minLng: 3.37, maxLng: 3.40 },
        { label: 'Ikorodu District', minLat: 6.60, maxLat: 6.70, minLng: 3.48, maxLng: 3.56 },
        { label: 'Oshodi District', minLat: 6.54, maxLat: 6.60, minLng: 3.33, maxLng: 3.38 },

        // Abuja FCT
        { label: 'Abuja Central District', minLat: 9.03, maxLat: 9.10, minLng: 7.47, maxLng: 7.55 },
        { label: 'Garki District', minLat: 9.00, maxLat: 9.05, minLng: 7.48, maxLng: 7.52 },
        { label: 'Wuse District', minLat: 9.05, maxLat: 9.10, minLng: 7.45, maxLng: 7.50 },
        { label: 'Maitama District', minLat: 9.08, maxLat: 9.13, minLng: 7.47, maxLng: 7.53 },

        // Other Major Cities
        { label: 'Port Harcourt District', minLat: 4.75, maxLat: 4.85, minLng: 6.98, maxLng: 7.08 },
        { label: 'Kano District', minLat: 11.95, maxLat: 12.05, minLng: 8.50, maxLng: 8.58 },
        { label: 'Ibadan District', minLat: 7.37, maxLat: 7.45, minLng: 3.89, maxLng: 3.97 },
        { label: 'Enugu District', minLat: 6.42, maxLat: 6.48, minLng: 7.47, maxLng: 7.55 },
        { label: 'Benin City District', minLat: 6.30, maxLat: 6.40, minLng: 5.60, maxLng: 5.68 },
        { label: 'Kaduna District', minLat: 10.50, maxLat: 10.58, minLng: 7.42, maxLng: 7.48 },
        { label: 'Jos District', minLat: 9.88, maxLat: 9.95, minLng: 8.85, maxLng: 8.92 },
        { label: 'Warri District', minLat: 5.50, maxLat: 5.58, minLng: 5.73, maxLng: 5.80 },
    ];

/* ───────────────────── Core API ───────────────────── */

/**
 * Get current position from Browser Geolocation API.
 * Returns the device's location with accuracy info.
 */
export function getCurrentPosition(): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp,
                });
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Location permission denied'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Location unavailable'));
                        break;
                    case error.TIMEOUT:
                        reject(new Error('Location request timed out'));
                        break;
                    default:
                        reject(new Error('Unknown geolocation error'));
                }
            },
            {
                enableHighAccuracy: true,
                timeout: GEO_TIMEOUT,
                maximumAge: 0,
            }
        );
    });
}

/**
 * Generate an anonymized geo-label from coordinates.
 * Maps lat/lng to a known Nigerian district, or generates a generic label.
 *
 * This is deliberately imprecise — we identify the DISTRICT, not the building.
 */
export function generateGeoLabel(latitude: number, longitude: number): string {
    // Check against Nigerian district lookup table
    for (const district of NIGERIAN_DISTRICTS) {
        if (
            latitude >= district.minLat &&
            latitude <= district.maxLat &&
            longitude >= district.minLng &&
            longitude <= district.maxLng
        ) {
            return district.label;
        }
    }

    // Fallback: generate a generic grid-based label
    // Round to ~11km grid (0.1 degree) for anonymity
    const latGrid = Math.floor(latitude * 10) / 10;
    const lngGrid = Math.floor(longitude * 10) / 10;

    // Determine country region (Nigeria-centric)
    if (latitude >= 4 && latitude <= 14 && longitude >= 2 && longitude <= 15) {
        return `Nigeria • Grid ${latGrid.toFixed(1)}N, ${lngGrid.toFixed(1)}E`;
    }

    return `Region ${latGrid.toFixed(1)}, ${lngGrid.toFixed(1)}`;
}

/**
 * Create a full geo-stamp for media attachment.
 * Bundles anonymized geo-label + ISO timestamp + accuracy.
 */
export async function createGeoStamp(): Promise<GeoStamp> {
    const position = await getCurrentPosition();

    return {
        geoLabel: generateGeoLabel(position.latitude, position.longitude),
        timestamp: new Date(position.timestamp).toISOString(),
        accuracyMeters: Math.round(position.accuracy),
        hasGpsLock: position.accuracy < GPS_LOCK_THRESHOLD,
    };
}

/**
 * Check the current geolocation permission state.
 */
export async function checkGeoPermission(): Promise<GeoPermissionState> {
    if (!navigator.geolocation) return 'unavailable';

    try {
        if (navigator.permissions) {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state as GeoPermissionState;
        }
    } catch {
        // permissions API not supported — will need to try getCurrentPosition
    }

    return 'prompt';
}

/**
 * Watch position continuously for real-time GPS lock display.
 * Returns a cleanup function to stop watching.
 */
export function watchPosition(
    onUpdate: (position: GeoPosition) => void,
    onError?: (error: Error) => void
): () => void {
    if (!navigator.geolocation) {
        onError?.(new Error('Geolocation not supported'));
        return () => { };
    }

    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            onUpdate({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
            });
        },
        (error) => {
            onError?.(new Error(error.message));
        },
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
        }
    );

    return () => navigator.geolocation.clearWatch(watchId);
}
