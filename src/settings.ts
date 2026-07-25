/**
 * What this plugin remembers between invocations, and the flow app cycle.
 *
 * The target app is driven by a command and kept in `api.storage`, which is
 * synchronous and JSON only. The send mode and the paste space are declared
 * settings, so CardMirror renders their controls on the plugin's Settings
 * row. The space rides on each send rather than living in ebb, so the editor
 * that decides the spacing is the one the user is typing in.
 */
import type { SendMode } from "./payload.js";

export const MODE_KEY = "sendMode";
export const TARGET_KEY = "targetApp";
export const DEFAULT_MODE: SendMode = "column";
export const DEFAULT_TARGET = "ebb";

/** A select stores the option text itself, so these strings are both the
 *  labels in the modal and the stored values. */
export const MODE_LABELS: Record<SendMode, string> = {
    column: "One cell per line",
    cell: "Everything in one cell",
};

export const SPACE_KEY = "paste-space";
/** ebb refuses more than this, so the plugin never sends more. */
const SPACE_MAX = 10;

/** Where the host keeps declared-setting values inside the plugin's own
 *  storage bag. The host only reads settings, so writing this key is how
 *  the toggle command moves the same value the modal shows. */
const SETTINGS_BAG_KEY = "__settings";

export const SETTINGS: PluginSettingDef[] = [
    {
        key: MODE_KEY,
        label: "Send mode",
        type: "select",
        options: [MODE_LABELS.column, MODE_LABELS.cell],
        default: MODE_LABELS.column,
        description:
            "How Send to Flow (ebb) lays out what it sends. The two mode-specific send commands ignore this.",
    },
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

export function readMode(settings: PluginSettingsApi): SendMode {
    return settings.get(MODE_KEY) === MODE_LABELS.cell ? "cell" : DEFAULT_MODE;
}

/** Flips the declared setting, leaving every other setting value alone. */
export function toggleMode(api: CardMirrorPluginApi): SendMode {
    const next: SendMode = readMode(api.settings) === "column" ? "cell" : "column";
    const bag = api.storage.get(SETTINGS_BAG_KEY);
    const values = bag !== null && typeof bag === "object" && !Array.isArray(bag) ? bag : {};
    api.storage.set(SETTINGS_BAG_KEY, { ...values, [MODE_KEY]: MODE_LABELS[next] });
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
