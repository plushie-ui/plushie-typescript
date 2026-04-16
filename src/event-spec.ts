/**
 * Event specification system for typed event data validation.
 *
 * Provides canonical specs for all built-in widget event types and
 * validation for emitted event data. Custom widgets can define their
 * own event specs for runtime validation of emitted payloads.
 *
 * @module
 */

/**
 * The shape of an event's data payload.
 *
 * - `none`: no payload (click, focus, blur, open, close)
 * - `value`: scalar payload stored in WidgetEvent.value
 */
export type EventSpec =
  | {
      readonly carrier: "none";
    }
  | {
      readonly carrier: "value";
      readonly type?: FieldType;
      readonly fields?: ReadonlyArray<readonly [string, FieldType]>;
      readonly required?: readonly string[];
    };

export type FieldType = "float" | "string" | "boolean" | "any";

const BUILTIN_SPECS: Readonly<Record<string, EventSpec>> = {
  status: { carrier: "value", type: "string" },
  click: { carrier: "none" },
  input: { carrier: "value", type: "string" },
  submit: { carrier: "value", type: "string" },
  toggle: { carrier: "value", type: "boolean" },
  select: { carrier: "value", type: "any" },
  slide: { carrier: "value", type: "float" },
  slide_release: { carrier: "value", type: "float" },
  paste: { carrier: "value", type: "string" },
  open: { carrier: "none" },
  close: { carrier: "none" },
  option_hovered: { carrier: "value", type: "any" },
  key_binding: { carrier: "value", fields: [] },
  sort: { carrier: "value", type: "string" },
  scrolled: {
    carrier: "value",
    fields: [
      ["absolute_x", "float"],
      ["absolute_y", "float"],
      ["relative_x", "float"],
      ["relative_y", "float"],
      ["bounds_width", "float"],
      ["bounds_height", "float"],
      ["content_width", "float"],
      ["content_height", "float"],
    ],
  },
  pane_focus_cycle: { carrier: "value", fields: [["pane", "any"]] },
  focused: { carrier: "none" },
  blurred: { carrier: "none" },
  drag: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
      ["delta_x", "float"],
      ["delta_y", "float"],
    ],
  },
  drag_end: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
    ],
  },
  key_press: {
    carrier: "value",
    fields: [
      ["key", "string"],
      ["modified_key", "string"],
      ["physical_key", "string"],
      ["location", "string"],
      ["modifiers", "any"],
      ["text", "string"],
      ["repeat", "boolean"],
    ],
    required: ["key", "modifiers"],
  },
  key_release: {
    carrier: "value",
    fields: [
      ["key", "string"],
      ["modified_key", "string"],
      ["physical_key", "string"],
      ["location", "string"],
      ["modifiers", "any"],
      ["text", "string"],
      ["repeat", "boolean"],
    ],
    required: ["key", "modifiers"],
  },
  press: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
      ["button", "any"],
      ["pointer", "any"],
      ["finger", "float"],
      ["modifiers", "any"],
    ],
  },
  release: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
      ["button", "any"],
      ["pointer", "any"],
      ["finger", "float"],
      ["modifiers", "any"],
    ],
  },
  move: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
      ["pointer", "any"],
      ["finger", "float"],
      ["modifiers", "any"],
    ],
  },
  scroll: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
      ["delta_x", "float"],
      ["delta_y", "float"],
      ["pointer", "any"],
      ["modifiers", "any"],
    ],
  },
  enter: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
    ],
    required: [],
  },
  exit: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
    ],
    required: [],
  },
  double_click: {
    carrier: "value",
    fields: [
      ["x", "float"],
      ["y", "float"],
      ["pointer", "any"],
      ["modifiers", "any"],
    ],
  },
  resize: {
    carrier: "value",
    fields: [
      ["width", "float"],
      ["height", "float"],
    ],
  },
  pane_resized: {
    carrier: "value",
    fields: [
      ["split", "any"],
      ["ratio", "float"],
    ],
  },
  pane_dragged: {
    carrier: "value",
    fields: [
      ["pane", "any"],
      ["target", "any"],
      ["action", "any"],
      ["region", "any"],
      ["edge", "any"],
    ],
  },
  pane_clicked: { carrier: "value", fields: [["pane", "any"]] },
  transition_complete: {
    carrier: "value",
    fields: [
      ["tag", "any"],
      ["prop", "string"],
    ],
  },
};

export { BUILTIN_SPECS };

export function builtinSpec(name: string): EventSpec | undefined {
  return BUILTIN_SPECS[name];
}

export function validateFieldType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case "float":
      return typeof value === "number";
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "any":
      return true;
  }
}

export function validateEmitData(
  eventKind: string,
  data: unknown,
  spec?: EventSpec,
): string | null {
  const resolvedSpec = spec ?? builtinSpec(eventKind);
  if (!resolvedSpec) return null;

  if (resolvedSpec.carrier === "none") {
    if (data !== undefined && data !== null) {
      return `Event "${eventKind}" has no payload but data was provided`;
    }
    return null;
  }

  // carrier: "value" with scalar type
  if (resolvedSpec.type) {
    if (data === null || data === undefined) {
      return `Event "${eventKind}" requires a value of type ${resolvedSpec.type}`;
    }
    if (!validateFieldType(data, resolvedSpec.type)) {
      return `Event "${eventKind}" value must be ${resolvedSpec.type}, got ${typeof data}`;
    }
    return null;
  }

  // carrier: "value" with structured fields
  if (resolvedSpec.fields) {
    if (data === null || data === undefined) {
      return `Event "${eventKind}" requires structured data`;
    }
    if (typeof data !== "object" || Array.isArray(data)) {
      return `Event "${eventKind}" requires a map/object, got ${typeof data}`;
    }
    const obj = data as Record<string, unknown>;
    const requiredFields = resolvedSpec.required;

    if (requiredFields) {
      for (const field of requiredFields) {
        if (!(field in obj)) {
          return `Event "${eventKind}" missing required field "${field}"`;
        }
      }
    } else {
      const fieldNames = resolvedSpec.fields.map(([name]) => name);
      for (const name of fieldNames) {
        if (!(name in obj)) {
          return `Event "${eventKind}" missing required field "${name}"`;
        }
      }
    }

    for (const [name, type] of resolvedSpec.fields) {
      if (name in obj && !validateFieldType(obj[name], type)) {
        return `Event "${eventKind}" field "${name}" must be ${type}, got ${typeof obj[name]}`;
      }
    }
  }

  return null;
}
