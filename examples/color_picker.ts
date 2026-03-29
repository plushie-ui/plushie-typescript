// HSV color picker using a widget handler.
//
// The color picker widget handles all interaction internally (mouse drag,
// keyboard adjustment, focus tracking). The app receives "change" events
// with the current HSV values.

import type { Event, WindowNode } from "../src/index.js";
import { app, isWidget } from "../src/index.js";
import { column, container, row, text, window } from "../src/ui/index.js";
import { colorPickerWidget } from "./widgets/color_picker.js";

// -- Types --------------------------------------------------------------------

interface Model {
  hue: number;
  saturation: number;
  value: number;
}

// -- Color conversion (for display only) --------------------------------------

function fmod(a: number, b: number): number {
  return a - b * Math.floor(a / b);
}

function hsvToHex(h: number, s: number, v: number): string {
  let hue = fmod(h, 360.0);
  if (hue < 0) hue += 360.0;

  const c = v * s;
  const hSector = hue / 60.0;
  const x = c * (1.0 - Math.abs(fmod(hSector, 2.0) - 1.0));
  const m = v - c;

  let r1: number, g1: number, b1: number;
  if (hSector < 1) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (hSector < 2) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (hSector < 3) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (hSector < 4) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (hSector < 5) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
}

// -- Display helpers ----------------------------------------------------------

function hsvLabel(model: Model): string {
  const h = Math.round(model.hue);
  const s = Math.round(model.saturation * 100);
  const v = Math.round(model.value * 100);
  return `H: ${h}  S: ${s}%  V: ${v}%`;
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  init: { hue: 0.0, saturation: 1.0, value: 1.0 },

  update(state, event: Event) {
    // ColorPickerWidget emits "change" with { hue, saturation, value }.
    if (isWidget(event) && event.type === "change" && event.id === "picker") {
      return {
        ...state,
        hue: event.data?.["hue"] as number,
        saturation: event.data?.["saturation"] as number,
        value: event.data?.["value"] as number,
      };
    }
    return state;
  },

  view: (s) => {
    const hex = hsvToHex(s.hue, s.saturation, s.value);

    return window("color_picker", { title: "Color Picker" }, [
      column({ padding: 20, spacing: 16, alignX: "center" }, [
        colorPickerWidget("picker"),

        row({ spacing: 16, alignY: "center" }, [
          container(
            "swatch",
            {
              width: 48,
              height: 48,
              background: hex,
              border: { width: 1, color: "#cccccc", radius: 4 },
              a11y: { role: "image", label: `Selected color: ${hex}` },
            },
            [],
          ),

          column({ spacing: 4 }, [
            text("hex_display", hex, {
              size: 18,
              a11y: { live: "polite", busy: s.hue === 0 && s.saturation === 1 && s.value === 1 },
            }),
            text("hsv_display", hsvLabel(s), {
              a11y: { live: "polite" },
            }),
          ]),
        ]),
      ]),
    ]) as WindowNode;
  },
});
