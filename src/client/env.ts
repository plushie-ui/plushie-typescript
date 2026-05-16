/**
 * Environment variable whitelist for the renderer subprocess.
 *
 * The renderer process receives a cleaned environment with only
 * whitelisted variables. This prevents credential leakage and
 * ensures a predictable rendering environment.
 *
 * The whitelist matches the canonical list shared across every host
 * SDK: exact entries for display/rendering/locale/accessibility/font
 * vars, prefix entries for families (`LC_`, `MESA_`, etc.), and an
 * explicit closed list of `PLUSHIE_*` variables the renderer actually
 * reads.
 *
 * @module
 */

/** Exact variable names to forward. */
const EXACT_WHITELIST = new Set([
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "WAYLAND_SOCKET",
  "WINIT_UNIX_BACKEND",
  "XDG_RUNTIME_DIR",
  "XDG_DATA_DIRS",
  "XDG_DATA_HOME",
  "PATH",
  "LD_LIBRARY_PATH",
  "DYLD_LIBRARY_PATH",
  "DYLD_FALLBACK_LIBRARY_PATH",
  "LANG",
  "LANGUAGE",
  "DBUS_SESSION_BUS_ADDRESS",
  "GTK_MODULES",
  "NO_AT_BRIDGE",
  "WGPU_BACKEND",
  "RUST_LOG",
  "RUST_BACKTRACE",
  "HOME",
  "USER",
  // The renderer subprocess in spawn mode reads at most PLUSHIE_NO_CATCH_UNWIND
  // from inherited env. Other PLUSHIE_* names are host-side, launcher-set, or
  // secrets (e.g. PLUSHIE_TOKEN) that must not leak across the process boundary.
  "PLUSHIE_NO_CATCH_UNWIND",
]);

/** Prefix-based forwarding: any variable starting with these. */
const PREFIX_WHITELIST = [
  "LC_",
  "MESA_",
  "LIBGL_",
  "__GLX_",
  "VK_",
  "GALLIUM_",
  "AT_SPI_",
  "FONTCONFIG_",
];

/**
 * Build a clean environment for the renderer subprocess.
 *
 * Only whitelisted variables are included. All others are excluded
 * to prevent credential leakage.
 *
 * @param opts.rustLog - Override value for RUST_LOG (e.g., "plushie=debug").
 * @returns An environment object suitable for `child_process.spawn`.
 */
export function buildRendererEnv(opts?: { rustLog?: string }): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (isWhitelisted(key)) {
      env[key] = value;
    }
  }

  // Override RUST_LOG if specified
  if (opts?.rustLog !== undefined) {
    env["RUST_LOG"] = opts.rustLog;
  }

  return env;
}

function isWhitelisted(key: string): boolean {
  if (EXACT_WHITELIST.has(key)) return true;
  for (const prefix of PREFIX_WHITELIST) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}
