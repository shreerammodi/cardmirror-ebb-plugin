/**
 * The two values this plugin remembers between invocations, and the flow
 * app cycle. CardMirror gives a plugin no settings panel, so both values
 * are driven by commands and read back out of `api.storage`, which is
 * synchronous and JSON only.
 */
import type { SendMode } from "./payload.js";

export const MODE_KEY = "sendMode";
export const TARGET_KEY = "targetApp";
export const DEFAULT_MODE: SendMode = "column";
export const DEFAULT_TARGET = "ebb";

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
