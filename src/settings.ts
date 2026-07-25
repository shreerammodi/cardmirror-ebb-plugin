/**
 * What this plugin remembers between invocations, and the flow app cycle.
 *
 * The send mode and target app are driven by commands and kept in
 * `api.storage`, which is synchronous and JSON only. The paste space is a
 * declared setting instead: CardMirror renders its control on the plugin's
 * Settings row, and the value rides on each send rather than living in ebb,
 * so the editor that decides the spacing is the one the user is typing in.
 */
import type { SendMode } from "./payload.js";

export const MODE_KEY = "sendMode";
export const TARGET_KEY = "targetApp";
export const DEFAULT_MODE: SendMode = "column";
export const DEFAULT_TARGET = "ebb";

export const SPACE_KEY = "paste-space";
/** ebb refuses more than this, so the plugin never sends more. */
const SPACE_MAX = 10;

export const SETTINGS: PluginSettingDef[] = [
    {
        key: SPACE_KEY,
        label: "Empty cells after a send",
        type: "number",
        default: 0,
        description:
            "Blank cells the flow app leaves below each send, so one send reads as separate from the next. 0 to 10; 0 leaves none.",
    },
];

/** The declared count as a whole number of cells inside the bounds. */
export function readSpace(settings: PluginSettingsApi): number {
    const value = settings.get(SPACE_KEY);
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.min(SPACE_MAX, Math.max(0, Math.round(value)));
}

export function readMode(storage: PluginStorage): SendMode {
    return storage.get(MODE_KEY) === "cell" ? "cell" : DEFAULT_MODE;
}

export function toggleMode(storage: PluginStorage): SendMode {
    const next: SendMode = readMode(storage) === "column" ? "cell" : "column";
    storage.set(MODE_KEY, next);
    return next;
}

export function readTarget(storage: PluginStorage): string {
    const stored = storage.get(TARGET_KEY);
    return typeof stored === "string" && stored ? stored : DEFAULT_TARGET;
}

export interface TargetChoice {
    app: FlowAppInfo;
    /** The stored target had vanished from the registry, so this is a
     *  fallback rather than the next step of the cycle. */
    stale: boolean;
}

/**
 * The next app in the cycle. Not-running apps stay selectable: their
 * identity registration persists across a quit, and a send to one fails
 * later with `app-not-running`.
 */
export function nextTarget(apps: readonly FlowAppInfo[], current: string): TargetChoice | null {
    if (apps.length === 0) return null;
    const index = apps.findIndex((app) => app.id === current);
    if (index < 0) {
        const fallback = apps.find((app) => app.id === DEFAULT_TARGET) ?? apps[0]!;
        return { app: fallback, stale: true };
    }
    return { app: apps[(index + 1) % apps.length]!, stale: false };
}
