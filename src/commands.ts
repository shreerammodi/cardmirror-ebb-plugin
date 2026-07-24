import {
    EXTRACT_MESSAGES,
    MODE_MESSAGES,
    NO_FLOW_APPS_MESSAGE,
    revealResultMessage,
    sendResultMessage,
    targetMessage,
} from "./messages.js";
/**
 * The plugin definition. Handlers stay thin: extract, build, post, toast.
 *
 * The command id set is frozen. CardMirror accepts a re-registration only
 * when the ids are identical, so adding or renaming one leaves the plugin
 * unloadable until the app restarts.
 */
import { buildFlowPayload, buildRevealPayload, type SendMode } from "./payload.js";
import { readMode, readTarget, nextTarget, toggleMode, TARGET_KEY } from "./settings.js";

export const PLUGIN_ID = "cardmirror-ebb";
export const PLUGIN_NAME = "ebb Flow Integration";
export const API_VERSION = 1;

/** `override` sends in one mode without disturbing the stored default. */
async function send(api: CardMirrorPluginApi, override: SendMode | null): Promise<void> {
    const extract = api.extractSelection();
    if (!extract.ok) {
        api.showToast(EXTRACT_MESSAGES[extract.error]);
        return;
    }
    const appId = readTarget(api.storage);
    const payload = buildFlowPayload(override ?? readMode(api.storage), extract);
    api.showToast(sendResultMessage(appId, await api.flowPost(appId, "/flow", payload)));
}

async function reveal(api: CardMirrorPluginApi): Promise<void> {
    const extract = api.extractSelection();
    if (!extract.ok) {
        api.showToast(EXTRACT_MESSAGES[extract.error]);
        return;
    }
    const appId = readTarget(api.storage);
    const payload = buildRevealPayload(extract);
    api.showToast(revealResultMessage(appId, await api.flowPost(appId, "/reveal", payload)));
}

async function chooseApp(api: CardMirrorPluginApi): Promise<void> {
    const current = readTarget(api.storage);
    const choice = nextTarget(await api.flowApps(), current);
    if (!choice) {
        api.showToast(NO_FLOW_APPS_MESSAGE);
        return;
    }
    api.storage.set(TARGET_KEY, choice.app.id);
    api.showToast(targetMessage(choice.app, choice.stale ? current : null));
}

export const definition: PluginDefinition = {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    apiVersion: API_VERSION,
    commands: [
        {
            id: "cardmirror-ebb.sendToFlow",
            label: "Send to Flow (ebb)",
            keywords: ["ebb", "flow", "send", "debate"],
            defaultKey: "Mod-Alt-f",
            run: (api) => send(api, null),
        },
        {
            id: "cardmirror-ebb.sendToFlowColumn",
            label: "Send to Flow (ebb, one cell per line)",
            keywords: ["ebb", "flow", "send", "column"],
            defaultKey: null,
            run: (api) => send(api, "column"),
        },
        {
            id: "cardmirror-ebb.sendToFlowCell",
            label: "Send to Flow (ebb, single cell)",
            keywords: ["ebb", "flow", "send", "cell"],
            defaultKey: null,
            run: (api) => send(api, "cell"),
        },
        {
            id: "cardmirror-ebb.toggleSendMode",
            label: "Toggle ebb Send Mode",
            keywords: ["ebb", "flow", "mode", "toggle"],
            defaultKey: null,
            run: (api) => {
                api.showToast(MODE_MESSAGES[toggleMode(api.storage)]);
            },
        },
        {
            id: "cardmirror-ebb.revealInFlow",
            label: "Reveal in Flow (ebb)",
            keywords: ["ebb", "flow", "reveal", "find", "search"],
            defaultKey: "Mod-Alt-e",
            run: (api) => reveal(api),
        },
        {
            id: "cardmirror-ebb.chooseFlowApp",
            label: "Choose Flow App for ebb Commands",
            keywords: ["ebb", "flow", "app", "target", "choose"],
            defaultKey: null,
            run: (api) => chooseApp(api),
        },
    ],
};
