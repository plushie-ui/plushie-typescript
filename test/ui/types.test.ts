import { describe, expect, test } from "vitest";
import {
  encodeA11y,
  encodeAlignment,
  encodeBorder,
  encodeColor,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodePadding,
  encodeShadow,
  encodeStyleMap,
} from "../../src/ui/types.js";

describe("encodeLength", () => {
  test("number passes through", () => {
    expect(encodeLength(100)).toBe(100);
  });

  test("fill string passes through", () => {
    expect(encodeLength("fill")).toBe("fill");
  });

  test("shrink string passes through", () => {
    expect(encodeLength("shrink")).toBe("shrink");
  });

  test("fillPortion encodes to snake_case", () => {
    expect(encodeLength({ fillPortion: 2 })).toEqual({ fill_portion: 2 });
  });
});

describe("encodePadding", () => {
  test("number passes through", () => {
    expect(encodePadding(16)).toBe(16);
  });

  test("2-tuple expands to named object", () => {
    expect(encodePadding([8, 16])).toEqual({ top: 8, right: 16, bottom: 8, left: 16 });
  });

  test("4-tuple expands to named object", () => {
    expect(encodePadding([4, 8, 12, 16])).toEqual({ top: 4, right: 8, bottom: 12, left: 16 });
  });

  test("named object passes through as object", () => {
    expect(encodePadding({ top: 4, right: 8, bottom: 12, left: 16 })).toEqual({
      top: 4,
      right: 8,
      bottom: 12,
      left: 16,
    });
  });

  test("object with missing fields defaults to 0", () => {
    expect(encodePadding({ top: 10 })).toEqual({ top: 10, right: 0, bottom: 0, left: 0 });
  });

  test("uniform four-sided padding collapses to number", () => {
    expect(encodePadding({ top: 6, right: 6, bottom: 6, left: 6 })).toBe(6);
    expect(encodePadding([8, 8])).toBe(8);
    expect(encodePadding([4, 4, 4, 4])).toBe(4);
  });
});

describe("encodeColor", () => {
  test("hex passes through (lowercase)", () => {
    expect(encodeColor("#FF0000")).toBe("#ff0000");
  });

  test("hex with alpha", () => {
    expect(encodeColor("#ff000080")).toBe("#ff000080");
  });

  test("short hex #rgb expands", () => {
    expect(encodeColor("#f00")).toBe("#ff0000");
  });

  test("short hex #rgba expands", () => {
    expect(encodeColor("#f008")).toBe("#ff000088");
  });

  test("named color resolves to hex", () => {
    expect(encodeColor("red")).toBe("#ff0000");
    expect(encodeColor("cornflowerblue")).toBe("#6495ed");
    expect(encodeColor("transparent")).toBe("#00000000");
  });

  test("named color is case-insensitive", () => {
    expect(encodeColor("Red")).toBe("#ff0000");
    expect(encodeColor("BLUE")).toBe("#0000ff");
  });

  test("RGB object encodes to hex", () => {
    expect(encodeColor({ r: 1, g: 0, b: 0 })).toBe("#ff0000");
    expect(encodeColor({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });

  test("RGBA object encodes to hex with alpha", () => {
    expect(encodeColor({ r: 1, g: 0, b: 0, a: 0.5 })).toBe("#ff000080");
  });

  test("RGBA with alpha 1.0 omits alpha", () => {
    expect(encodeColor({ r: 1, g: 0, b: 0, a: 1 })).toBe("#ff0000");
  });

  test("hex rejects non-hex digits", () => {
    expect(() => encodeColor("#gg0000")).toThrow(/invalid color/);
  });

  test("hex rejects unsupported lengths", () => {
    expect(() => encodeColor("#fffff")).toThrow(/invalid color/);
  });
});

describe("encodeFont", () => {
  test("string keywords pass through", () => {
    expect(encodeFont("default")).toBe("default");
    expect(encodeFont("monospace")).toBe("monospace");
  });

  test("family name wraps in object", () => {
    expect(encodeFont("Helvetica")).toEqual({ family: "Helvetica" });
  });

  test("object with all fields passes values through as snake_case", () => {
    expect(encodeFont({ family: "Arial", weight: "semi_bold", style: "italic" })).toEqual({
      family: "Arial",
      weight: "semi_bold",
      style: "italic",
    });
  });

  test("object omits undefined fields", () => {
    expect(encodeFont({ family: "Arial" })).toEqual({ family: "Arial" });
  });
});

describe("encodeAlignment", () => {
  test("horizontal axis values pass through", () => {
    expect(encodeAlignment("left")).toBe("left");
    expect(encodeAlignment("center")).toBe("center");
    expect(encodeAlignment("right")).toBe("right");
  });

  test("vertical axis values pass through", () => {
    expect(encodeAlignment("top")).toBe("top");
    expect(encodeAlignment("bottom")).toBe("bottom");
  });
});

describe("encodeBorder", () => {
  test("encodes all fields", () => {
    expect(encodeBorder({ color: "red", width: 2, radius: 8 })).toEqual({
      color: "#ff0000",
      width: 2,
      radius: 8,
    });
  });

  test("per-corner radius", () => {
    const result = encodeBorder({ radius: { topLeft: 4, bottomRight: 8 } });
    expect(result["radius"]).toEqual({
      top_left: 4,
      top_right: 0,
      bottom_right: 8,
      bottom_left: 0,
    });
  });
});

describe("encodeShadow", () => {
  test("encodes with offset array", () => {
    expect(encodeShadow({ color: "black", offsetX: 2, offsetY: 4, blurRadius: 8 })).toEqual({
      color: "#000000",
      offset: [2, 4],
      blur_radius: 8,
    });
  });

  test("defaults", () => {
    expect(encodeShadow({})).toEqual({ color: "#000000", offset: [0, 0], blur_radius: 0 });
  });
});

describe("encodeStyleMap", () => {
  test("string preset passes through", () => {
    expect(encodeStyleMap("primary")).toBe("primary");
  });

  test("object encodes all fields", () => {
    const result = encodeStyleMap({
      base: "primary",
      background: "red",
      textColor: "white",
    });
    expect(result).toEqual({
      base: "primary",
      background: "#ff0000",
      text_color: "#ffffff",
    });
  });

  test("status overrides encode", () => {
    const result = encodeStyleMap({
      hovered: { background: "blue" },
    }) as Record<string, unknown>;
    expect(result["hovered"]).toEqual({ background: "#0000ff" });
  });
});

describe("encodeA11y", () => {
  test("encodes camelCase to snake_case", () => {
    const result = encodeA11y({
      role: "button",
      label: "Save",
      readOnly: true,
      labelledBy: "label-1",
      positionInSet: 3,
      sizeOfSet: 10,
    });
    expect(result).toEqual({
      role: "button",
      label: "Save",
      read_only: true,
      labelled_by: "label-1",
      position_in_set: 3,
      size_of_set: 10,
    });
  });

  test("omits undefined fields", () => {
    const result = encodeA11y({ role: "button" });
    expect(Object.keys(result)).toEqual(["role"]);
  });
});

describe("encodeLineHeight", () => {
  test("number (relative) passes through", () => {
    expect(encodeLineHeight(1.5)).toBe(1.5);
  });

  test("absolute object", () => {
    expect(encodeLineHeight({ absolute: 20 })).toEqual({ absolute: 20 });
  });

  test("relative object", () => {
    expect(encodeLineHeight({ relative: 1.5 })).toEqual({ relative: 1.5 });
  });
});
