import { describe, expect, it } from "vitest";

import { definition, PLUGIN_ID } from "../src/commands.js";
import { extracted, flowApp, item, makeApi, runCommand } from "./fake-api.js";

const SELECTION = extracted([
    item("block", "Cap K"),
    item("tag", "Perm Solves"),
    item("cite", "Smith 24"),
]);

const WROTE_THREE: FlowPostResult = {
    ok: true,
    status: 200,
    body: { ok: true, written: 3, sheet: "2AC", row: 4, col: 1 },
};

function run(id: string, api: CardMirrorPluginApi): void | Promise<void> {
    return runCommand(definition, id, api);
}

describe("definition", () => {
    it("registers the frozen command id set", () => {
        expect(definition.id).toBe(PLUGIN_ID);
        expect(definition.apiVersion).toBe(1);
        expect(definition.commands.map((cmd) => cmd.id)).toEqual([
            "cardmirror-ebb.sendToFlow",
            "cardmirror-ebb.sendToFlowColumn",
            "cardmirror-ebb.sendToFlowCell",
            "cardmirror-ebb.toggleSendMode",
            "cardmirror-ebb.revealInFlow",
            "cardmirror-ebb.chooseFlowApp",
        ]);
    });

    it("binds only the two keys the contract reserves", () => {
        const keyed = definition.commands
            .filter((cmd) => cmd.defaultKey !== null)
            .map((cmd) => [cmd.id, cmd.defaultKey]);
        expect(keyed).toEqual([
            ["cardmirror-ebb.sendToFlow", "Mod-Alt-f"],
            ["cardmirror-ebb.revealInFlow", "Mod-Alt-e"],
        ]);
    });

    it("gives every command a label and a run function", () => {
        for (const cmd of definition.commands) {
            expect(cmd.id.startsWith(`${PLUGIN_ID}.`)).toBe(true);
            expect(cmd.label.length).toBeGreaterThan(0);
            expect(typeof cmd.run).toBe("function");
        }
    });
});

describe("sendToFlow", () => {
    it("posts the extracted items to the stored target in the stored mode", async () => {
        const fake = makeApi({ extract: SELECTION, post: WROTE_THREE });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.posts).toEqual([
            {
                appId: "ebb",
                route: "/flow",
                body: {
                    mode: "column",
                    space: 0,
                    docTitle: "AT - Cap K",
                    items: [
                        {
                            kind: "block",
                            text: "Cap K",
                            source: "cmsrc1.Cap K",
                            key: "doc-1|cap k",
                        },
                        {
                            kind: "tag",
                            text: "Perm Solves",
                            source: "cmsrc1.Perm Solves",
                            key: "doc-1|perm solves",
                        },
                        {
                            kind: "cite",
                            text: "Smith 24",
                            source: "cmsrc1.Smith 24",
                            key: "doc-1|smith 24",
                        },
                    ],
                },
            },
        ]);
        expect(fake.toasts).toEqual(["Sent 3 cells to 2AC."]);
    });

    it("carries the declared empty-cell count with the send", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: WROTE_THREE,
            settings: { "paste-space": 2 },
        });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.posts[0]?.body).toMatchObject({ space: 2 });
    });

    it("honours a stored cell mode", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: WROTE_THREE,
            stored: { sendMode: "cell" },
        });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.posts[0]?.body).toMatchObject({ mode: "cell" });
    });

    it("posts to the app the user chose", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: WROTE_THREE,
            stored: { targetApp: "tabbie" },
        });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.posts[0]?.appId).toBe("tabbie");
    });

    it.each([
        ["no-heading-at-cursor", "Put the cursor in a card or under a heading first."],
        ["no-active-doc", "Open a document in CardMirror first."],
        ["empty-selection", "Nothing to extract from that selection."],
    ] as const)("explains %s and posts nothing", async (error, message) => {
        const fake = makeApi({ extract: { ok: false, error }, post: WROTE_THREE });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.toasts).toEqual([message]);
        expect(fake.posts).toEqual([]);
    });

    it.each([
        ["no-such-app", 'No flow app called "ebb" is registered. Launch it once so it registers.'],
        ["app-not-running", '"ebb" is registered but not running. Start it and try again.'],
        ["timeout", '"ebb" took too long to answer.'],
        ["bad-response", '"ebb" sent a reply CardMirror could not read.'],
        ["unsupported", "This CardMirror build cannot reach flow apps."],
    ] as const)("reports the %s transport failure", async (error, message) => {
        const fake = makeApi({ extract: SELECTION, post: { ok: false, error } });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.toasts).toEqual([message]);
    });

    it("separates an HTTP failure from a transport failure", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: { ok: true, status: 400, body: { ok: false, error: "bad-request" } },
        });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.toasts).toEqual(["ebb could not read that request."]);
    });

    it("reports a 200 that carries no-active-sheet", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: { ok: true, status: 200, body: { ok: false, error: "no-active-sheet" } },
        });
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.toasts).toEqual(["Open a flow in ebb first."]);
    });
});

describe("the explicit mode commands", () => {
    it("sends one cell per line without disturbing a stored cell default", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: WROTE_THREE,
            stored: { sendMode: "cell" },
        });
        await run("cardmirror-ebb.sendToFlowColumn", fake.api);
        expect(fake.posts[0]?.body).toMatchObject({ mode: "column" });
        expect(fake.stored("sendMode")).toBe("cell");
    });

    it("sends a single cell without disturbing the column default", async () => {
        const fake = makeApi({ extract: SELECTION, post: WROTE_THREE });
        await run("cardmirror-ebb.sendToFlowCell", fake.api);
        expect(fake.posts[0]?.body).toMatchObject({ mode: "cell" });
        expect(fake.stored("sendMode")).toBeUndefined();
    });
});

describe("toggleSendMode", () => {
    it("flips the stored default and says which mode is live", async () => {
        const fake = makeApi();
        await run("cardmirror-ebb.toggleSendMode", fake.api);
        expect(fake.stored("sendMode")).toBe("cell");
        expect(fake.toasts).toEqual(["ebb send mode: everything in one cell."]);
        await run("cardmirror-ebb.toggleSendMode", fake.api);
        expect(fake.stored("sendMode")).toBe("column");
        expect(fake.toasts[1]).toBe("ebb send mode: one cell per line.");
    });

    it("persists across commands", async () => {
        const fake = makeApi({ extract: SELECTION, post: WROTE_THREE });
        await run("cardmirror-ebb.toggleSendMode", fake.api);
        await run("cardmirror-ebb.sendToFlow", fake.api);
        expect(fake.posts[0]?.body).toMatchObject({ mode: "cell" });
    });
});

describe("chooseFlowApp", () => {
    it("cycles to the next app and stores it", async () => {
        const fake = makeApi({ apps: [flowApp("ebb", true), flowApp("tabbie", true)] });
        await run("cardmirror-ebb.chooseFlowApp", fake.api);
        expect(fake.stored("targetApp")).toBe("tabbie");
        expect(fake.toasts).toEqual(['ebb commands now target "tabbie" (running).']);
    });

    it("selects an app that is registered but closed", async () => {
        const fake = makeApi({ apps: [flowApp("ebb", true), flowApp("tabbie", false)] });
        await run("cardmirror-ebb.chooseFlowApp", fake.api);
        expect(fake.stored("targetApp")).toBe("tabbie");
        expect(fake.toasts).toEqual(['ebb commands now target "tabbie" (not running).']);
    });

    it("wraps back to the first app", async () => {
        const fake = makeApi({
            apps: [flowApp("ebb", true), flowApp("tabbie", true)],
            stored: { targetApp: "tabbie" },
        });
        await run("cardmirror-ebb.chooseFlowApp", fake.api);
        expect(fake.stored("targetApp")).toBe("ebb");
    });

    it("falls back to ebb when the stored target is no longer registered", async () => {
        const fake = makeApi({
            apps: [flowApp("tabbie", true), flowApp("ebb", false)],
            stored: { targetApp: "ghost" },
        });
        await run("cardmirror-ebb.chooseFlowApp", fake.api);
        expect(fake.stored("targetApp")).toBe("ebb");
        expect(fake.toasts).toEqual([
            '"ghost" is no longer registered. ebb commands now target "ebb" (not running).',
        ]);
    });

    it("says so when nothing has ever registered", async () => {
        const fake = makeApi({ apps: [] });
        await run("cardmirror-ebb.chooseFlowApp", fake.api);
        expect(fake.stored("targetApp")).toBeUndefined();
        expect(fake.toasts).toEqual([
            "No flow apps are registered. Launch ebb once so it registers itself.",
        ]);
    });
});

describe("revealInFlow", () => {
    it("posts the minted keys and summarises the hits", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: {
                ok: true,
                status: 200,
                body: { ok: true, matches: 3, sheets: ["2AC"], sheet: "2AC", row: 4, col: 2 },
            },
        });
        await run("cardmirror-ebb.revealInFlow", fake.api);
        expect(fake.posts).toEqual([
            {
                appId: "ebb",
                route: "/reveal",
                body: {
                    keys: ["doc-1|cap k", "doc-1|perm solves", "doc-1|smith 24"],
                    docTitle: "AT - Cap K",
                },
            },
        ]);
        expect(fake.toasts).toEqual(["3 cells on 2AC."]);
    });

    it("names every sheet holding a hit", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: { ok: true, status: 200, body: { ok: true, matches: 4, sheets: ["2AC", "1AR"] } },
        });
        await run("cardmirror-ebb.revealInFlow", fake.api);
        expect(fake.toasts).toEqual(["4 cells across 2AC, 1AR."]);
    });

    it("says when nothing on the flow came from here", async () => {
        const fake = makeApi({
            extract: SELECTION,
            post: { ok: true, status: 200, body: { ok: true, matches: 0 } },
        });
        await run("cardmirror-ebb.revealInFlow", fake.api);
        expect(fake.toasts).toEqual(["Not on the flow."]);
    });

    it("explains a failed extraction and posts nothing", async () => {
        const fake = makeApi({ extract: { ok: false, error: "no-heading-at-cursor" } });
        await run("cardmirror-ebb.revealInFlow", fake.api);
        expect(fake.toasts).toEqual(["Put the cursor in a card or under a heading first."]);
        expect(fake.posts).toEqual([]);
    });
});
