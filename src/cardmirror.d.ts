/**
 * CardMirror plugin API v1, mirrored from the app's own sources:
 *   src/editor/plugin-api.ts       - the capability object a command receives
 *   src/editor/plugin-registry.ts  - the registration surface and the window global
 * PLUGIN_API_VERSION there is 1, which is what this file describes.
 *
 * Ambient on purpose: the bundle is evaluated as a classic script in the
 * renderer, so these types must never turn into an import at runtime.
 * The only edit against upstream is punctuation in the doc comments.
 */

type ExtractedKind = "pocket" | "hat" | "block" | "tag" | "analytic" | "undertag" | "cite";

interface ExtractedItem {
    kind: ExtractedKind;
    text: string;
    /** Opaque provenance token (see plugin-source-token.ts). */
    source: string;
}

interface ExtractResult {
    ok: true;
    docId: string;
    docTitle: string;
    items: ExtractedItem[];
}

type ExtractErrorCode = "no-heading-at-cursor" | "no-active-doc" | "empty-selection";

interface ExtractError {
    ok: false;
    error: ExtractErrorCode;
}

type JumpResult =
    | { ok: true }
    | { ok: false; error: "doc-not-open" | "not-found" | "bad-request"; docTitle?: string };

interface FlowAppInfo {
    id: string;
    app: string;
    appVersion: string;
    schema: number;
    kind: "flow";
    /** Whether the app answered a liveness ping just now. Closed apps are
     *  LISTED (their identity registration persists), so selection never
     *  requires the app to be running; sends to a closed app fail at
     *  runtime with `app-not-running`. */
    running: boolean;
}

type FlowPostResult =
    | { ok: true; status: number; body: unknown }
    | {
          ok: false;
          error: "no-such-app" | "app-not-running" | "timeout" | "bad-response" | "unsupported";
      };

interface PluginStorage {
    get(key: string): unknown;
    /** `__settings` is reserved for declared-setting values. */
    set(key: string, value: unknown): void;
}

type PluginSettingValue = boolean | string | number;

interface PluginSettingDef {
    key: string;
    label: string;
    type: "boolean" | "text" | "number" | "select";
    /** Must match `type`; for `select`, must be one of `options`. */
    default: PluginSettingValue;
    /** Required for `select` (the choices), forbidden otherwise. */
    options?: readonly string[];
    /** Muted helper line rendered under the control. */
    description?: string;
}

interface PluginSettingsApi {
    /** The stored value, the declared default when it is missing or
     *  off-type, and undefined for an undeclared key. */
    get(key: string): PluginSettingValue | undefined;
    onChanged(cb: (key: string, value: PluginSettingValue) => void): () => void;
}

interface CardMirrorPluginApi {
    readonly appVersion: string;
    extractSelection(): ExtractResult | ExtractError;
    jumpToSource(token: string): Promise<JumpResult>;
    flowApps(): Promise<FlowAppInfo[]>;
    flowPost(appId: string, route: string, body: unknown): Promise<FlowPostResult>;
    docInfo(): { docId: string; docTitle: string } | null;
    showToast(message: string): void;
    storage: PluginStorage;
    settings: PluginSettingsApi;
}

interface PluginCommandDef {
    /** Must start with `<pluginId>.` */
    id: string;
    label: string;
    keywords?: readonly string[];
    defaultKey?: string | string[] | null;
    run: (api: CardMirrorPluginApi) => void | Promise<void>;
}

interface PluginDefinition {
    id: string;
    name: string;
    apiVersion: number;
    commands: PluginCommandDef[];
    settings?: PluginSettingDef[];
}

interface Window {
    __registerCardMirrorPlugin?: (def: PluginDefinition) => void;
}
