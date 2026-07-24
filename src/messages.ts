/**
 * Every toast this plugin can show. A toast is the only channel back to
 * the user, so each one names what went wrong and what to do about it,
 * never a bare error code.
 */
import type { SendMode } from "./payload.js";

type TransportError = Extract<FlowPostResult, { ok: false }>["error"];

export const EXTRACT_MESSAGES: Record<ExtractErrorCode, string> = {
    "no-heading-at-cursor": "Put the cursor in a card or under a heading first.",
    "no-active-doc": "Open a document in CardMirror first.",
    "empty-selection": "Nothing to extract from that selection.",
};

/** ebb's `error` codes, from the bridge contract, in plain language. */
const EBB_MESSAGES: Record<string, string> = {
    "no-active-sheet": "Open a flow in ebb first.",
    "no-round": "Open a flow in ebb first.",
    "no-active-cell": "Click the cell in ebb where this should land.",
    "bad-request": "ebb could not read that request.",
    timeout: "ebb took too long to answer.",
    unauthorized: "ebb refused the connection. Restart ebb, then try again.",
};

function transportMessage(appId: string, error: TransportError): string {
    switch (error) {
        case "no-such-app":
            return `No flow app called "${appId}" is registered. Launch it once so it registers.`;
        case "app-not-running":
            return `"${appId}" is registered but not running. Start it and try again.`;
        case "timeout":
            return `"${appId}" took too long to answer.`;
        case "bad-response":
            return `"${appId}" sent a reply CardMirror could not read.`;
        case "unsupported":
            return "This CardMirror build cannot reach flow apps.";
    }
}

interface EbbBody {
    ok: boolean;
    error: string | null;
    written: number | null;
    sheet: string | null;
    matches: number | null;
    sheets: string[];
}

function readBody(body: unknown): EbbBody {
    const parsed: EbbBody = {
        ok: false,
        error: null,
        written: null,
        sheet: null,
        matches: null,
        sheets: [],
    };
    if (typeof body !== "object" || body === null) return parsed;
    const raw = body as Record<string, unknown>;
    parsed.ok = raw["ok"] === true;
    if (typeof raw["error"] === "string") parsed.error = raw["error"];
    if (typeof raw["written"] === "number") parsed.written = raw["written"];
    if (typeof raw["sheet"] === "string") parsed.sheet = raw["sheet"];
    if (typeof raw["matches"] === "number") parsed.matches = raw["matches"];
    if (Array.isArray(raw["sheets"])) {
        parsed.sheets = raw["sheets"].filter((sheet): sheet is string => typeof sheet === "string");
    }
    return parsed;
}

/** An `ok:false` body, or an HTTP status that carried no usable body. */
function failureMessage(appId: string, status: number, parsed: EbbBody): string {
    if (parsed.error) {
        return EBB_MESSAGES[parsed.error] ?? `"${appId}" reported: ${parsed.error}.`;
    }
    return `"${appId}" answered HTTP ${status}.`;
}

function cellCount(n: number): string {
    return n === 1 ? "1 cell" : `${n} cells`;
}

export function sendResultMessage(appId: string, result: FlowPostResult): string {
    if (!result.ok) return transportMessage(appId, result.error);
    const parsed = readBody(result.body);
    if (result.status !== 200 || !parsed.ok) return failureMessage(appId, result.status, parsed);
    const where = parsed.sheet ?? appId;
    if (parsed.written === null) return `Sent to ${where}.`;
    return `Sent ${cellCount(parsed.written)} to ${where}.`;
}

export function revealResultMessage(appId: string, result: FlowPostResult): string {
    if (!result.ok) return transportMessage(appId, result.error);
    const parsed = readBody(result.body);
    if (result.status !== 200 || !parsed.ok) return failureMessage(appId, result.status, parsed);
    const matches = parsed.matches ?? 0;
    if (matches === 0) return "Not on the flow.";
    if (parsed.sheets.length === 0) return `${cellCount(matches)} on the flow.`;
    if (parsed.sheets.length === 1) return `${cellCount(matches)} on ${parsed.sheets[0]}.`;
    return `${cellCount(matches)} across ${parsed.sheets.join(", ")}.`;
}

export const MODE_MESSAGES: Record<SendMode, string> = {
    column: "ebb send mode: one cell per line.",
    cell: "ebb send mode: everything in one cell.",
};

/** `staleId` is the vanished target that forced the fallback, if any. */
export function targetMessage(app: FlowAppInfo, staleId: string | null): string {
    const state = app.running ? "running" : "not running";
    const now = `ebb commands now target "${app.id}" (${state}).`;
    return staleId === null ? now : `"${staleId}" is no longer registered. ${now}`;
}

export const NO_FLOW_APPS_MESSAGE =
    "No flow apps are registered. Launch ebb once so it registers itself.";
