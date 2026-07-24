import { describe, expect, it } from "vitest";

import { revealResultMessage, sendResultMessage } from "../src/messages.js";

const ok = (body: unknown, status = 200): FlowPostResult => ({ ok: true, status, body });

describe("sendResultMessage", () => {
    it("names the sheet and the written count", () => {
        expect(sendResultMessage("ebb", ok({ ok: true, written: 3, sheet: "2AC", row: 4 }))).toBe(
            "Sent 3 cells to 2AC.",
        );
    });

    it("reads one cell as singular", () => {
        expect(sendResultMessage("ebb", ok({ ok: true, written: 1, sheet: "1AR" }))).toBe(
            "Sent 1 cell to 1AR.",
        );
    });

    it("falls back to the app id when ebb reports no sheet", () => {
        expect(sendResultMessage("ebb", ok({ ok: true, written: 2 }))).toBe("Sent 2 cells to ebb.");
    });

    it("translates no-active-sheet, which arrives with HTTP 200", () => {
        expect(sendResultMessage("ebb", ok({ ok: false, error: "no-active-sheet" }))).toBe(
            "Open a flow in ebb first.",
        );
    });

    it("translates no-active-cell", () => {
        expect(sendResultMessage("ebb", ok({ ok: false, error: "no-active-cell" }))).toBe(
            "Click the cell in ebb where this should land.",
        );
    });

    it("translates a 400 bad-request", () => {
        expect(sendResultMessage("ebb", ok({ ok: false, error: "bad-request" }, 400))).toBe(
            "ebb could not read that request.",
        );
    });

    it("translates a 500 timeout", () => {
        expect(sendResultMessage("ebb", ok({ ok: false, error: "timeout" }, 500))).toBe(
            "ebb took too long to answer.",
        );
    });

    it("quotes an unknown error code rather than swallowing it", () => {
        expect(sendResultMessage("ebb", ok({ ok: false, error: "meteor-strike" }))).toBe(
            '"ebb" reported: meteor-strike.',
        );
    });

    it("reports a bare non-200 with no usable body", () => {
        expect(sendResultMessage("ebb", ok("<html>", 502))).toBe('"ebb" answered HTTP 502.');
    });

    it("treats a 200 whose body is not ok as a failure", () => {
        expect(sendResultMessage("ebb", ok({ written: 3 }))).toBe('"ebb" answered HTTP 200.');
    });

    it("reports every transport failure by name", () => {
        const of = (error: Extract<FlowPostResult, { ok: false }>["error"]): string =>
            sendResultMessage("ebb", { ok: false, error });
        expect(of("no-such-app")).toBe(
            'No flow app called "ebb" is registered. Launch it once so it registers.',
        );
        expect(of("app-not-running")).toBe(
            '"ebb" is registered but not running. Start it and try again.',
        );
        expect(of("timeout")).toBe('"ebb" took too long to answer.');
        expect(of("bad-response")).toBe('"ebb" sent a reply CardMirror could not read.');
        expect(of("unsupported")).toBe("This CardMirror build cannot reach flow apps.");
    });

    it("names the chosen app, not ebb, when the target was changed", () => {
        expect(sendResultMessage("tabbie", { ok: false, error: "app-not-running" })).toBe(
            '"tabbie" is registered but not running. Start it and try again.',
        );
    });
});

describe("revealResultMessage", () => {
    it("says nothing matched", () => {
        expect(revealResultMessage("ebb", ok({ ok: true, matches: 0 }))).toBe("Not on the flow.");
    });

    it("counts cells on one sheet", () => {
        const body = { ok: true, matches: 3, sheets: ["2AC"], sheet: "2AC", row: 4, col: 2 };
        expect(revealResultMessage("ebb", ok(body))).toBe("3 cells on 2AC.");
    });

    it("reads one match as singular", () => {
        expect(revealResultMessage("ebb", ok({ ok: true, matches: 1, sheets: ["1AR"] }))).toBe(
            "1 cell on 1AR.",
        );
    });

    it("lists the sheets when a match spans several", () => {
        const body = { ok: true, matches: 5, sheets: ["2AC", "1AR", "2AR"] };
        expect(revealResultMessage("ebb", ok(body))).toBe("5 cells across 2AC, 1AR, 2AR.");
    });

    it("still reports a count when the sheet list is missing", () => {
        expect(revealResultMessage("ebb", ok({ ok: true, matches: 2 }))).toBe(
            "2 cells on the flow.",
        );
    });

    it("translates no-round the same way as no-active-sheet", () => {
        expect(revealResultMessage("ebb", ok({ ok: false, error: "no-round" }))).toBe(
            "Open a flow in ebb first.",
        );
    });

    it("reports a transport failure", () => {
        expect(revealResultMessage("ebb", { ok: false, error: "no-such-app" })).toBe(
            'No flow app called "ebb" is registered. Launch it once so it registers.',
        );
    });
});
