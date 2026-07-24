/**
 * Bundle entry. CardMirror evaluates plugin.js as a classic script in the
 * renderer, so this must register once at top level and export nothing.
 * The global is optional: an older host that never installed the registry
 * leaves the bundle inert instead of throwing.
 */
import { definition } from "./commands.js";

window.__registerCardMirrorPlugin?.(definition);
