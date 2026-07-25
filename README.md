# ebb Flow Integration

A CardMirror plugin that pushes what you just cut into an ebb flow, and
finds it again later.

Put the cursor in a card, or select a range, and one keystroke drops the
extracted blocks, tags, analytics and cites into the active ebb sheet at
the active cell. Every cell ebb writes remembers where it came from, so
"Reveal in Flow" walks you through the cells a passage produced, and
ebb's own "Jump to Source in CardMirror" brings you back the other way.

Nothing leaves the machine. The two apps talk over loopback HTTP with a
per-session token that neither the plugin nor the ebb renderer ever sees.

## Requirements

- CardMirror `0.1.0-beta.22` or newer (the plugin API v1 host, from the
  release that renders plugin settings).
- An ebb build carrying the CardMirror bridge. It landed after `0.6.1`, so
  any release newer than that registers ebb as a flow app and serves the
  bridge routes.

Both apps must be installed on the same machine and run as the same user.
ebb has to have been launched at least once so that it registers; after
that it stays selectable even while closed.

## Install

The GitHub installer only accepts repositories on CardMirror's curated
allowlist, and this repo is not on it yet. Until it is, install the
developer way:

1. Download `cardmirror-plugin.json` and `plugin.js` from the latest
   [release](../../releases/latest).
2. In CardMirror, open Settings, then Plugins, then
   "Load plugin from file..." and pick `plugin.js`.

Loading from file is independent of the allowlist and does not install
anything, so repeat it after a CardMirror restart.

Once the repo is allowlisted on the CardMirror relay, the normal path
works: paste this repository's URL (or its `owner/repo` shorthand) into
Settings, then Plugins, accept the consent prompt, and enable the plugin.
Installed plugins load at every launch and update in place.

## Commands

`Mod` is Cmd on macOS and Ctrl elsewhere. Everything is also reachable
from the command palette.

| Command                               | Default key | What it does                                                                             |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Send to Flow (ebb)                    | `Mod-Alt-f` | Sends the extracted items in the current send mode.                                      |
| Send to Flow (ebb, one cell per line) | none        | Sends one cell per item, whatever the stored mode is.                                    |
| Send to Flow (ebb, single cell)       | none        | Sends everything as one cell, whatever the stored mode is.                               |
| Toggle ebb Send Mode                  | none        | Flips the stored default between the two and toasts the new one.                         |
| Reveal in Flow (ebb)                  | `Mod-Alt-e` | Selects a cell in ebb that came from this passage. Run it again to walk to the next one. |
| Choose Flow App for ebb Commands      | none        | Cycles the target flow app. Defaults to `ebb`.                                           |

The send mode and the target app persist in CardMirror's per-plugin
storage, and both are driven by the commands above rather than by a
control.

## Settings

While the plugin is enabled, its row in Settings, then Plugins carries a
gear:

| Setting                  | Default | What it does                                                                                                |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------- |
| Empty cells after a send | `0`     | Blank cells the flow app leaves below each send, so one send reads as separate from the next. Capped at 10. |

The count rides on every send, so the spacing is decided here rather than
in the flow app. An ebb old enough to predate the `space` field ignores
it and writes no empty cells.

Layout, when ebb writes a column:

- Pocket, hat and block become one bold cell each.
- A tag becomes one cell marked as a card.
- Analytics and undertags become one plain cell each.
- A cite joins the cell above it as a second line, and stands alone only
  when nothing precedes it.

## How it works

ebb announces itself in the shared `cardmirror-bridge` directory (on
macOS, `~/Library/Application Support/cardmirror-bridge/`) by writing
`ebb.json` with its identity and `ebb.session.json` with the port and
token of the session it is running right now. CardMirror's main process
reads those files, so the plugin only ever names an app id.

Two routes carry everything:

- `POST /flow` with `{ mode, docTitle, items, space }`. Each item is one
  extracted item, verbatim: its `kind`, its whitespace-collapsed `text`,
  the opaque CardMirror `source` token, and a `key`. `space` is the
  Empty cells setting, which ebb clamps again on arrival and does not
  count among the cells it reports. ebb answers with the sheet it wrote
  to and how many cells it filled. The plugin sends items
  in document order and leaves the layout above to ebb, so any other
  editor speaking this bridge lands the same way.
- `POST /reveal` with `{ keys, docTitle }`. ebb answers with how many
  cells match, which sheets hold them, and which one it selected.
  Repeating the request walks to the next match.

The `key` is `docId + "|" + text.toLowerCase()`, minted here and opaque
to ebb, which only ever compares keys for equality. ebb stores it on the
cell together with the `source` token, so the provenance survives sheet
switches, row shifts, undo, and export and import of the flow file. That
stored token is what ebb hands back to CardMirror's `/jump` route.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build      # writes plugin.js at the repo root
npm run format     # oxfmt, the same formatter ebb uses
```

`plugin.js` is a build artifact and is not committed. It has to be a
single self-contained classic script under 5 MiB, because CardMirror
reads it off disk and evaluates it in the renderer, so esbuild bundles
`src/main.ts` into one IIFE with no runtime dependencies. Tagging `v*`
builds it in CI and attaches it to the release next to the manifest.

`src/cardmirror.d.ts` mirrors CardMirror's own `plugin-api.ts` and
`plugin-registry.ts`. Update it from those files, never by guessing.

The command id set is frozen. CardMirror accepts a re-registration only
when the ids are identical, so renaming or adding one leaves the plugin
dead until the app restarts.

## License

MPL-2.0, the same as ebb. See [LICENSE](LICENSE).
