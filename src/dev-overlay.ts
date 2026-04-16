/**
 * Dev-mode overlay: injects a rebuild status bar and frozen-UI indicator
 * into the widget tree.
 *
 * The overlay is built from standard widget nodes and injected
 * post-normalization by wrapping window content in a stack. All
 * overlay widget IDs use the `__plushie_dev__/` prefix so the runtime
 * can intercept their events before they reach the app's handlers.
 *
 * @module
 */

import type { WireNode } from "./tree/normalize.js";

const PREFIX = "__plushie_dev__";
const DISMISS_MS = 1500;
const FROZEN_THRESHOLD = 5;

export type OverlayStatus = "building" | "succeeded" | "failed" | "frozen_ui";

export interface DevOverlay {
  readonly status: OverlayStatus;
  readonly detail: string;
  readonly expanded: boolean;
}

export function statusMessage(status: OverlayStatus): string {
  switch (status) {
    case "building":
      return "Rebuilding...";
    case "succeeded":
      return "Rebuild succeeded.";
    case "failed":
      return "Rebuild failed.";
    case "frozen_ui":
      return "UI frozen: view() is failing repeatedly.";
  }
}

export function overlayEventId(id: string): boolean {
  return id.startsWith(`${PREFIX}/`);
}

export function overlayAction(id: string): string {
  return id.slice(PREFIX.length + 1);
}

export type HandleResult =
  | { readonly type: "updated"; readonly overlay: DevOverlay }
  | { readonly type: "dismissed" }
  | { readonly type: "noop" };

export function handleOverlayAction(action: string, overlay: DevOverlay): HandleResult {
  switch (action) {
    case "toggle":
      if (overlay.status === "frozen_ui") return { type: "noop" };
      return { type: "updated", overlay: { ...overlay, expanded: !overlay.expanded } };
    case "dismiss":
      return { type: "dismissed" };
    default:
      return { type: "noop" };
  }
}

export function frozenThreshold(): number {
  return FROZEN_THRESHOLD;
}

export function dismissMs(): number {
  return DISMISS_MS;
}

// -- Tree injection -----------------------------------------------------------

export function maybeInjectOverlay(
  tree: WireNode | null,
  overlay: DevOverlay | null,
): WireNode | null {
  if (!overlay || !tree) return tree;
  const overlayNode = buildOverlay(overlay);
  return injectIntoTree(tree, overlayNode);
}

function injectIntoTree(tree: WireNode, overlayNode: WireNode): WireNode {
  if (tree.type === "window") {
    return injectIntoWindow(tree, overlayNode);
  }

  if (tree.children.length > 0) {
    return {
      ...tree,
      children: tree.children.map((child: WireNode) => injectIntoTree(child, overlayNode)),
    };
  }

  return tree;
}

function injectIntoWindow(window: WireNode, overlayNode: WireNode): WireNode {
  const wrappedChildren =
    window.children.length > 0
      ? [wrapRoot(window.children[0]!, overlayNode), ...window.children.slice(1)]
      : [overlayNode];

  return { ...window, children: wrappedChildren };
}

function wrapRoot(content: WireNode, overlayNode: WireNode): WireNode {
  return {
    id: `${PREFIX}/stack`,
    type: "stack",
    props: { width: "fill", height: "fill" },
    children: [content, overlayNode],
  };
}

// -- Overlay node building ----------------------------------------------------

function buildOverlay(overlay: DevOverlay): WireNode {
  const bar = buildBar(overlay);
  const drawer = overlay.expanded ? [buildDrawer(overlay)] : [];

  return {
    id: `${PREFIX}/anchor`,
    type: "container",
    props: { width: "fill", align_y: "top" },
    children: [
      {
        id: `${PREFIX}/column`,
        type: "column",
        props: {
          padding: { top: 8, right: 8, bottom: 0, left: 8 },
          width: "shrink",
          max_width: 600,
        },
        children: [bar, ...drawer],
      },
    ],
  };
}

function buildBar(overlay: DevOverlay): WireNode {
  const toggleLabel = overlay.expanded ? "^" : "v";
  const statusIcon =
    overlay.status === "building" ? "..." : overlay.status === "succeeded" ? "ok" : "!!";
  const textColor =
    overlay.status === "failed" || overlay.status === "frozen_ui"
      ? "#ffaaaa"
      : overlay.status === "succeeded"
        ? "#aaffaa"
        : "#ffffff";
  const message = statusMessage(overlay.status);

  const iconNode: WireNode = {
    id: `${PREFIX}/icon`,
    type: "text",
    props: { content: `[${statusIcon}]`, color: textColor, size: 12 },
    children: [],
  };

  const statusNode: WireNode = {
    id: `${PREFIX}/status`,
    type: "text",
    props: { content: message, color: textColor, size: 12 },
    children: [],
  };

  const children: WireNode[] =
    overlay.status === "frozen_ui"
      ? [iconNode, statusNode]
      : [
          {
            id: `${PREFIX}/toggle`,
            type: "button",
            props: { label: toggleLabel, style: "text", padding: 0, width: 20 },
            children: [],
          },
          iconNode,
          statusNode,
        ];

  if (overlay.status === "failed" || overlay.status === "frozen_ui") {
    children.push({
      id: `${PREFIX}/dismiss`,
      type: "button",
      props: { label: "x", style: "text", padding: 0, width: 20 },
      children: [],
    });
  }

  const bg =
    overlay.status === "failed" || overlay.status === "frozen_ui"
      ? "rgba(180, 40, 40, 0.85)"
      : "rgba(0, 0, 0, 0.7)";

  return {
    id: `${PREFIX}/bar`,
    type: "container",
    props: {
      background: bg,
      padding: { top: 6, right: 12, bottom: 6, left: 8 },
      border: { radius: 6 },
    },
    children: [
      {
        id: `${PREFIX}/bar_row`,
        type: "row",
        props: { spacing: 6, align_y: "center" },
        children,
      },
    ],
  };
}

function buildDrawer(overlay: DevOverlay): WireNode {
  const content = overlay.detail || "(waiting for output)";
  return {
    id: `${PREFIX}/drawer`,
    type: "container",
    props: {
      background: "rgba(0, 0, 0, 0.85)",
      padding: { top: 6, right: 12, bottom: 8, left: 12 },
      max_height: 300,
      border: { radius: 6 },
    },
    children: [
      {
        id: `${PREFIX}/scrollable`,
        type: "scrollable",
        props: { height: "shrink" },
        children: [
          {
            id: `${PREFIX}/output`,
            type: "text",
            props: { content, color: "#cccccc", size: 11, font: { family: "monospace" } },
            children: [],
          },
        ],
      },
    ],
  };
}
