import { describe, expect, it } from "vitest";

import { nextTarget, readMode, readTarget, toggleMode } from "../src/settings.js";
import { flowApp, makeApi } from "./fake-api.js";

describe("readMode", () => {
    it("defaults to column with nothing stored", () => {
        expect(readMode(makeApi().api.storage)).toBe("column");
    });

    it("ignores a stored value that is not a mode", () => {
        expect(readMode(makeApi({ stored: { sendMode: "sideways" } }).api.storage)).toBe("column");
    });

    it("reads a stored cell mode", () => {
        expect(readMode(makeApi({ stored: { sendMode: "cell" } }).api.storage)).toBe("cell");
    });
});

describe("toggleMode", () => {
    it("flips and persists", () => {
        const fake = makeApi();
        expect(toggleMode(fake.api.storage)).toBe("cell");
        expect(fake.stored("sendMode")).toBe("cell");
        expect(toggleMode(fake.api.storage)).toBe("column");
        expect(fake.stored("sendMode")).toBe("column");
    });
});

describe("readTarget", () => {
    it("defaults to ebb", () => {
        expect(readTarget(makeApi().api.storage)).toBe("ebb");
    });

    it("ignores an empty stored id", () => {
        expect(readTarget(makeApi({ stored: { targetApp: "" } }).api.storage)).toBe("ebb");
    });

    it("reads a stored id", () => {
        expect(readTarget(makeApi({ stored: { targetApp: "tabbie" } }).api.storage)).toBe("tabbie");
    });
});

describe("nextTarget", () => {
    it("is null when nothing is registered", () => {
        expect(nextTarget([], "ebb")).toBeNull();
    });

    it("advances through the list and wraps", () => {
        const apps = [flowApp("ebb", true), flowApp("tabbie", false)];
        expect(nextTarget(apps, "ebb")).toEqual({ app: apps[1], stale: false });
        expect(nextTarget(apps, "tabbie")).toEqual({ app: apps[0], stale: false });
    });

    it("keeps a registered but closed app selectable", () => {
        const apps = [flowApp("ebb", true), flowApp("tabbie", false)];
        expect(nextTarget(apps, "ebb")?.app.running).toBe(false);
    });

    it("falls back to ebb when the stored target is gone", () => {
        const apps = [flowApp("tabbie", false), flowApp("ebb", false)];
        expect(nextTarget(apps, "ghost")).toEqual({ app: apps[1], stale: true });
    });

    it("falls back to the first app when even ebb is gone", () => {
        const apps = [flowApp("tabbie", true)];
        expect(nextTarget(apps, "ghost")).toEqual({ app: apps[0], stale: true });
    });
});
