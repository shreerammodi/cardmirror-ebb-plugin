import { describe, expect, it } from "vitest";

import { buildFlowPayload, buildRevealPayload, mintKeys, sourceKey } from "../src/payload.js";
import { extracted, item } from "./fake-api.js";

describe("sourceKey", () => {
    it("lowercases the text and keeps the docId verbatim", () => {
        expect(sourceKey("DoC-1", "Perm Solves")).toBe("DoC-1|perm solves");
    });

    it("keeps the separator inside text, which ebb never parses back out", () => {
        expect(sourceKey("doc-1", "A|B")).toBe("doc-1|a|b");
    });
});

describe("buildFlowPayload", () => {
    it("sends one wire item per extracted item, verbatim and in order", () => {
        const extract = extracted([
            item("block", "Cap K"),
            item("tag", "Perm Solves"),
            item("cite", "Smith 24"),
        ]);
        expect(buildFlowPayload("column", extract, 2)).toEqual({
            mode: "column",
            space: 2,
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
        });
    });

    it("leaves the layout to ebb: cell mode still sends every item", () => {
        const extract = extracted([item("tag", "One"), item("analytic", "Two")]);
        const payload = buildFlowPayload("cell", extract, 0);
        expect(payload.mode).toBe("cell");
        expect(payload.items.map((i) => i.text)).toEqual(["One", "Two"]);
    });
});

describe("mintKeys", () => {
    it("mints one key per item, order preserved", () => {
        const items = [item("tag", "Perm Solves"), item("cite", "Smith 24")];
        expect(mintKeys("doc-1", items)).toEqual(["doc-1|perm solves", "doc-1|smith 24"]);
    });

    it("drops duplicates, including ones that differ only in case", () => {
        const items = [item("tag", "Perm solves"), item("analytic", "PERM SOLVES")];
        expect(mintKeys("doc-1", items)).toEqual(["doc-1|perm solves"]);
    });
});

describe("buildRevealPayload", () => {
    it("carries the keys and the doc title", () => {
        const extract = extracted([item("tag", "Perm solves")]);
        expect(buildRevealPayload(extract)).toEqual({
            keys: ["doc-1|perm solves"],
            docTitle: "AT - Cap K",
        });
    });
});
