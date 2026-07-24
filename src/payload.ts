/**
 * Extraction results to bridge payloads. Pure: no api object, no window,
 * no CardMirror runtime.
 *
 * The layout rule (cite folding, cell-mode joining, per-kind decoration)
 * lives in ebb, not here. One wire item per extracted item, in document
 * order, so every editor speaking this bridge gets the same layout from
 * one implementation.
 */

export type SendMode = "column" | "cell";

/** One item of a POST /flow payload. `kind` drives ebb's decoration. */
export interface FlowItem {
    kind: ExtractedKind;
    text: string;
    source: string;
    key: string;
}

export interface FlowPayload {
    mode: SendMode;
    docTitle: string;
    items: FlowItem[];
}

export interface RevealPayload {
    keys: string[];
    docTitle: string;
}

/**
 * The equality key ebb stores on a cell and matches with `===`. Opaque to
 * ebb: minted here, never parsed there.
 */
export function sourceKey(docId: string, text: string): string {
    return docId + "|" + text.toLowerCase();
}

export function buildFlowPayload(mode: SendMode, extract: ExtractResult): FlowPayload {
    return {
        mode,
        docTitle: extract.docTitle,
        items: extract.items.map((item) => ({
            kind: item.kind,
            text: item.text,
            source: item.source,
            key: sourceKey(extract.docId, item.text),
        })),
    };
}

/** Keys for every extracted item, order preserved, duplicates dropped. */
export function mintKeys(docId: string, items: readonly ExtractedItem[]): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const key = sourceKey(docId, item.text);
        if (seen.has(key)) continue;
        seen.add(key);
        keys.push(key);
    }
    return keys;
}

export function buildRevealPayload(extract: ExtractResult): RevealPayload {
    return { keys: mintKeys(extract.docId, extract.items), docTitle: extract.docTitle };
}
