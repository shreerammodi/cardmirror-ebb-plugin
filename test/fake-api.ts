/**
 * A hand-rolled CardMirrorPluginApi. Storage round-trips through JSON the
 * way the real one does (a single localStorage bag), so a value that
 * would not survive persistence fails here too.
 */

import { SETTINGS } from "../src/settings.js";

export interface RecordedPost {
    appId: string;
    route: string;
    body: unknown;
}

export interface FakeApi {
    api: CardMirrorPluginApi;
    toasts: string[];
    posts: RecordedPost[];
    stored(key: string): unknown;
}

export interface FakeOptions {
    extract?: ExtractResult | ExtractError;
    /** One result for every route, or a per-route lookup. */
    post?: FlowPostResult | ((route: string) => FlowPostResult);
    apps?: FlowAppInfo[];
    stored?: Record<string, unknown>;
    /** Values of the declared settings, as the settings modal would store them. */
    settings?: Record<string, unknown>;
    appVersion?: string;
}

export function makeApi(options: FakeOptions = {}): FakeApi {
    const toasts: string[] = [];
    const posts: RecordedPost[] = [];
    // Setting values live in the storage bag under the host's reserved key,
    // so a value the plugin writes there is one the settings api reads back.
    let bag = JSON.stringify({ ...options.stored, __settings: options.settings ?? {} });
    const post = options.post ?? { ok: false as const, error: "unsupported" as const };
    const extract: ExtractResult | ExtractError = options.extract ?? {
        ok: false,
        error: "no-active-doc",
    };
    const api: CardMirrorPluginApi = {
        appVersion: options.appVersion ?? "0.1.0-beta.20",
        extractSelection: () => extract,
        jumpToSource: async () => ({ ok: true }),
        flowApps: async () => options.apps ?? [],
        flowPost: async (appId, route, body) => {
            posts.push({ appId, route, body });
            return typeof post === "function" ? post(route) : post;
        },
        docInfo: () => null,
        showToast: (message) => {
            toasts.push(message);
        },
        settings: {
            // Mirrors the host: an undeclared key reads undefined, and a
            // stored value of the wrong type degrades to the declared default.
            get: (key) => {
                const def = SETTINGS.find((d) => d.key === key);
                if (!def) return undefined;
                const values = (JSON.parse(bag) as Record<string, unknown>)["__settings"];
                const raw = (values as Record<string, unknown> | undefined)?.[key];
                return typeof raw === typeof def.default
                    ? (raw as PluginSettingValue)
                    : def.default;
            },
            onChanged: () => () => {},
        },
        storage: {
            get: (key) => (JSON.parse(bag) as Record<string, unknown>)[key],
            set: (key, value) => {
                const parsed = JSON.parse(bag) as Record<string, unknown>;
                parsed[key] = value;
                bag = JSON.stringify(parsed);
            },
        },
    };
    return {
        api,
        toasts,
        posts,
        stored: (key) => (JSON.parse(bag) as Record<string, unknown>)[key],
    };
}

export function item(kind: ExtractedKind, text: string, source = "cmsrc1." + text): ExtractedItem {
    return { kind, text, source };
}

export function extracted(
    items: ExtractedItem[],
    docId = "doc-1",
    docTitle = "AT - Cap K",
): ExtractResult {
    return { ok: true, docId, docTitle, items };
}

export function flowApp(id: string, running: boolean): FlowAppInfo {
    return { id, app: id, appVersion: "0.6.1", schema: 1, kind: "flow", running };
}

export function runCommand(
    def: PluginDefinition,
    id: string,
    api: CardMirrorPluginApi,
): void | Promise<void> {
    const found = def.commands.find((cmd) => cmd.id === id);
    if (!found) throw new Error(`no such command: ${id}`);
    return found.run(api);
}
