/**
 * Keyboard key constants matching standard KeyboardEvent.key values.
 *
 * Use these instead of raw strings for key matching in event handlers
 * to avoid typos and get autocomplete support.
 *
 * @module
 */

// --- Navigation ---

export const Enter = "Enter";
export const Tab = "Tab";
export const Space = " ";
export const Escape = "Escape";
export const Backspace = "Backspace";
export const Delete = "Delete";
export const ArrowUp = "ArrowUp";
export const ArrowDown = "ArrowDown";
export const ArrowLeft = "ArrowLeft";
export const ArrowRight = "ArrowRight";
export const Home = "Home";
export const End = "End";
export const PageUp = "PageUp";
export const PageDown = "PageDown";
export const Insert = "Insert";

// --- Function keys ---

export const F1 = "F1";
export const F2 = "F2";
export const F3 = "F3";
export const F4 = "F4";
export const F5 = "F5";
export const F6 = "F6";
export const F7 = "F7";
export const F8 = "F8";
export const F9 = "F9";
export const F10 = "F10";
export const F11 = "F11";
export const F12 = "F12";
export const F13 = "F13";
export const F14 = "F14";
export const F15 = "F15";
export const F16 = "F16";
export const F17 = "F17";
export const F18 = "F18";
export const F19 = "F19";
export const F20 = "F20";
export const F21 = "F21";
export const F22 = "F22";
export const F23 = "F23";
export const F24 = "F24";
export const F25 = "F25";
export const F26 = "F26";
export const F27 = "F27";
export const F28 = "F28";
export const F29 = "F29";
export const F30 = "F30";
export const F31 = "F31";
export const F32 = "F32";
export const F33 = "F33";
export const F34 = "F34";
export const F35 = "F35";

// --- Modifier keys ---

export const Alt = "Alt";
export const AltGraph = "AltGraph";
export const AltLeft = "AltLeft";
export const AltRight = "AltRight";
export const CapsLock = "CapsLock";
export const Control = "Control";
export const ControlLeft = "ControlLeft";
export const ControlRight = "ControlRight";
export const Fn = "Fn";
export const FnLock = "FnLock";
export const Hyper = "Hyper";
export const Meta = "Meta";
export const MetaLeft = "MetaLeft";
export const MetaRight = "MetaRight";
export const NumLock = "NumLock";
export const ScrollLock = "ScrollLock";
export const Shift = "Shift";
export const ShiftLeft = "ShiftLeft";
export const ShiftRight = "ShiftRight";
export const Super = "Super";
export const SymbolKey = "Symbol";
export const SymbolLock = "SymbolLock";

// --- Editing ---

export const Copy = "Copy";
export const Cut = "Cut";
export const Paste = "Paste";
export const Redo = "Redo";
export const Undo = "Undo";
export const Select = "Select";
export const Find = "Find";
export const Save = "Save";
export const New = "New";
export const Open = "Open";
export const Close = "Close";
export const Print = "Print";
export const Execute = "Execute";

// --- UI keys ---

export const Accept = "Accept";
export const Again = "Again";
export const Attn = "Attn";
export const Cancel = "Cancel";
export const Clear = "Clear";
export const ContextMenu = "ContextMenu";
export const EraseEof = "EraseEof";
export const ExSel = "ExSel";
export const Help = "Help";
export const Pause = "Pause";
export const Play = "Play";
export const PrintScreen = "PrintScreen";
export const Props = "Props";
export const CrSel = "CrSel";
export const Process = "Process";
export const Unidentified = "Unidentified";

// --- IME keys ---

export const AllCandidates = "AllCandidates";
export const Alphanumeric = "Alphanumeric";
export const CodeInput = "CodeInput";
export const Compose = "Compose";
export const Convert = "Convert";
export const Eisu = "Eisu";
export const FinalMode = "FinalMode";
export const GroupFirst = "GroupFirst";
export const GroupLast = "GroupLast";
export const GroupNext = "GroupNext";
export const GroupPrevious = "GroupPrevious";
export const HangulMode = "HangulMode";
export const HanjaMode = "HanjaMode";
export const Hankaku = "Hankaku";
export const Hiragana = "Hiragana";
export const HiraganaKatakana = "HiraganaKatakana";
export const JunjaMode = "JunjaMode";
export const KanaMode = "KanaMode";
export const KanjiMode = "KanjiMode";
export const Katakana = "Katakana";
export const ModeChange = "ModeChange";
export const NextCandidate = "NextCandidate";
export const NonConvert = "NonConvert";
export const PreviousCandidate = "PreviousCandidate";
export const Romaji = "Romaji";
export const SingleCandidate = "SingleCandidate";
export const Zenkaku = "Zenkaku";
export const ZenkakuHankaku = "ZenkakuHankaku";

// --- Media keys ---

export const AudioBalanceLeft = "AudioBalanceLeft";
export const AudioBalanceRight = "AudioBalanceRight";
export const AudioBassBoostDown = "AudioBassBoostDown";
export const AudioBassBoostToggle = "AudioBassBoostToggle";
export const AudioBassBoostUp = "AudioBassBoostUp";
export const AudioFaderFront = "AudioFaderFront";
export const AudioFaderRear = "AudioFaderRear";
export const AudioSurroundModeNext = "AudioSurroundModeNext";
export const AudioTrebleDown = "AudioTrebleDown";
export const AudioTrebleUp = "AudioTrebleUp";
export const AudioVolumeDown = "AudioVolumeDown";
export const AudioVolumeMute = "AudioVolumeMute";
export const AudioVolumeUp = "AudioVolumeUp";
export const ChannelDown = "ChannelDown";
export const ChannelUp = "ChannelUp";
export const MediaClose = "MediaClose";
export const MediaFastForward = "MediaFastForward";
export const MediaPause = "MediaPause";
export const MediaPlay = "MediaPlay";
export const MediaPlayPause = "MediaPlayPause";
export const MediaRecord = "MediaRecord";
export const MediaRewind = "MediaRewind";
export const MediaStop = "MediaStop";
export const MediaTrackNext = "MediaTrackNext";
export const MediaTrackPrevious = "MediaTrackPrevious";
export const MicrophoneToggle = "MicrophoneToggle";
export const MicrophoneVolumeDown = "MicrophoneVolumeDown";
export const MicrophoneVolumeMute = "MicrophoneVolumeMute";
export const MicrophoneVolumeUp = "MicrophoneVolumeUp";

// --- Browser keys ---

export const BrowserBack = "BrowserBack";
export const BrowserFavorites = "BrowserFavorites";
export const BrowserForward = "BrowserForward";
export const BrowserHome = "BrowserHome";
export const BrowserRefresh = "BrowserRefresh";
export const BrowserSearch = "BrowserSearch";
export const BrowserStop = "BrowserStop";

// --- Launch keys ---

export const LaunchApplication1 = "LaunchApplication1";
export const LaunchApplication2 = "LaunchApplication2";
export const LaunchCalendar = "LaunchCalendar";
export const LaunchContacts = "LaunchContacts";
export const LaunchMail = "LaunchMail";
export const LaunchMediaPlayer = "LaunchMediaPlayer";
export const LaunchMusicPlayer = "LaunchMusicPlayer";
export const LaunchPhone = "LaunchPhone";
export const LaunchScreenSaver = "LaunchScreenSaver";
export const LaunchSpreadsheet = "LaunchSpreadsheet";
export const LaunchWebBrowser = "LaunchWebBrowser";
export const LaunchWebCam = "LaunchWebCam";
export const LaunchWordProcessor = "LaunchWordProcessor";

// --- Power keys ---

export const BrightnessDown = "BrightnessDown";
export const BrightnessUp = "BrightnessUp";
export const Eject = "Eject";
export const Hibernate = "Hibernate";
export const LogOff = "LogOff";
export const Power = "Power";
export const PowerOff = "PowerOff";
export const Standby = "Standby";
export const WakeUp = "WakeUp";

// --- Phone keys ---

export const AppSwitch = "AppSwitch";
export const Call = "Call";
export const Camera = "Camera";
export const CameraFocus = "CameraFocus";
export const EndCall = "EndCall";
export const GoBack = "GoBack";
export const GoHome = "GoHome";
export const HeadsetHook = "HeadsetHook";
export const LastNumberRedial = "LastNumberRedial";
export const MannerMode = "MannerMode";
export const Notification = "Notification";
export const VoiceDial = "VoiceDial";

// --- TV keys ---

export const TV = "TV";
export const TV3DMode = "TV3DMode";
export const TVAntennaCable = "TVAntennaCable";
export const TVAudioDescription = "TVAudioDescription";
export const TVAudioDescriptionMixDown = "TVAudioDescriptionMixDown";
export const TVAudioDescriptionMixUp = "TVAudioDescriptionMixUp";
export const TVContentsMenu = "TVContentsMenu";
export const TVDataService = "TVDataService";
export const TVInput = "TVInput";
export const TVInputComponent1 = "TVInputComponent1";
export const TVInputComponent2 = "TVInputComponent2";
export const TVInputComposite1 = "TVInputComposite1";
export const TVInputComposite2 = "TVInputComposite2";
export const TVInputHDMI1 = "TVInputHDMI1";
export const TVInputHDMI2 = "TVInputHDMI2";
export const TVInputHDMI3 = "TVInputHDMI3";
export const TVInputHDMI4 = "TVInputHDMI4";
export const TVInputVGA1 = "TVInputVGA1";
export const TVMediaContext = "TVMediaContext";
export const TVNetwork = "TVNetwork";
export const TVNumberEntry = "TVNumberEntry";
export const TVPower = "TVPower";
export const TVRadioService = "TVRadioService";
export const TVSatellite = "TVSatellite";
export const TVSatelliteBS = "TVSatelliteBS";
export const TVSatelliteCS = "TVSatelliteCS";
export const TVSatelliteToggle = "TVSatelliteToggle";
export const TVTerrestrialAnalog = "TVTerrestrialAnalog";
export const TVTerrestrialDigital = "TVTerrestrialDigital";
export const TVTimer = "TVTimer";

// --- Speech keys ---

export const SpeechCorrectionList = "SpeechCorrectionList";
export const SpeechInputToggle = "SpeechInputToggle";
export const SpellCheck = "SpellCheck";

// --- Mail keys ---

export const MailForward = "MailForward";
export const MailReply = "MailReply";
export const MailSend = "MailSend";

// --- Numpad keys ---

export const Numpad0 = "Numpad0";
export const Numpad1 = "Numpad1";
export const Numpad2 = "Numpad2";
export const Numpad3 = "Numpad3";
export const Numpad4 = "Numpad4";
export const Numpad5 = "Numpad5";
export const Numpad6 = "Numpad6";
export const Numpad7 = "Numpad7";
export const Numpad8 = "Numpad8";
export const Numpad9 = "Numpad9";
export const NumpadAdd = "NumpadAdd";
export const NumpadBackspace = "NumpadBackspace";
export const NumpadClear = "NumpadClear";
export const NumpadClearEntry = "NumpadClearEntry";
export const NumpadComma = "NumpadComma";
export const NumpadDecimal = "NumpadDecimal";
export const NumpadDivide = "NumpadDivide";
export const NumpadEnter = "NumpadEnter";
export const NumpadEqual = "NumpadEqual";
export const NumpadHash = "NumpadHash";
export const NumpadMemoryAdd = "NumpadMemoryAdd";
export const NumpadMemoryClear = "NumpadMemoryClear";
export const NumpadMemoryRecall = "NumpadMemoryRecall";
export const NumpadMemoryStore = "NumpadMemoryStore";
export const NumpadMemorySubtract = "NumpadMemorySubtract";
export const NumpadMultiply = "NumpadMultiply";
export const NumpadParenLeft = "NumpadParenLeft";
export const NumpadParenRight = "NumpadParenRight";
export const NumpadStar = "NumpadStar";
export const NumpadSubtract = "NumpadSubtract";

// --- Physical key codes ---

export const Backquote = "Backquote";
export const Backslash = "Backslash";
export const BracketLeft = "BracketLeft";
export const BracketRight = "BracketRight";
export const Comma = "Comma";
export const Digit0 = "Digit0";
export const Digit1 = "Digit1";
export const Digit2 = "Digit2";
export const Digit3 = "Digit3";
export const Digit4 = "Digit4";
export const Digit5 = "Digit5";
export const Digit6 = "Digit6";
export const Digit7 = "Digit7";
export const Digit8 = "Digit8";
export const Digit9 = "Digit9";
export const Equal = "Equal";
export const KeyA = "KeyA";
export const KeyB = "KeyB";
export const KeyC = "KeyC";
export const KeyD = "KeyD";
export const KeyE = "KeyE";
export const KeyF = "KeyF";
export const KeyG = "KeyG";
export const KeyH = "KeyH";
export const KeyI = "KeyI";
export const KeyJ = "KeyJ";
export const KeyK = "KeyK";
export const KeyL = "KeyL";
export const KeyM = "KeyM";
export const KeyN = "KeyN";
export const KeyO = "KeyO";
export const KeyP = "KeyP";
export const KeyQ = "KeyQ";
export const KeyR = "KeyR";
export const KeyS = "KeyS";
export const KeyT = "KeyT";
export const KeyU = "KeyU";
export const KeyV = "KeyV";
export const KeyW = "KeyW";
export const KeyX = "KeyX";
export const KeyY = "KeyY";
export const KeyZ = "KeyZ";
export const Key11 = "Key11";
export const Key12 = "Key12";
export const Minus = "Minus";
export const Period = "Period";
export const Quote = "Quote";
export const Semicolon = "Semicolon";
export const Slash = "Slash";
export const Soft1 = "Soft1";
export const Soft2 = "Soft2";
export const Soft3 = "Soft3";
export const Soft4 = "Soft4";
export const ZoomIn = "ZoomIn";
export const ZoomOut = "ZoomOut";

// =========================================================================
// Key resolution (case-insensitive lookup)
// =========================================================================

/**
 * All known key wire values. Used for validation and case-insensitive
 * resolution in test helpers.
 */
const ALL_KEYS: readonly string[] = [
  // Single characters (a-z) are valid as bare strings -- iced uses
  // lowercased logical keys for single printable chars. These are
  // not listed here; resolveKey handles them as a special case.
  Accept,
  Again,
  AllCandidates,
  Alphanumeric,
  Alt,
  AltGraph,
  AltLeft,
  AltRight,
  AppSwitch,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Attn,
  AudioBalanceLeft,
  AudioBalanceRight,
  AudioBassBoostDown,
  AudioBassBoostToggle,
  AudioBassBoostUp,
  AudioFaderFront,
  AudioFaderRear,
  AudioSurroundModeNext,
  AudioTrebleDown,
  AudioTrebleUp,
  AudioVolumeDown,
  AudioVolumeMute,
  AudioVolumeUp,
  Backquote,
  Backslash,
  Backspace,
  BracketLeft,
  BracketRight,
  BrightnessDown,
  BrightnessUp,
  BrowserBack,
  BrowserFavorites,
  BrowserForward,
  BrowserHome,
  BrowserRefresh,
  BrowserSearch,
  BrowserStop,
  Call,
  Camera,
  CameraFocus,
  Cancel,
  CapsLock,
  ChannelDown,
  ChannelUp,
  Clear,
  Close,
  CodeInput,
  Comma,
  Compose,
  ContextMenu,
  Control,
  ControlLeft,
  ControlRight,
  Convert,
  Copy,
  CrSel,
  Cut,
  Delete,
  Digit0,
  Digit1,
  Digit2,
  Digit3,
  Digit4,
  Digit5,
  Digit6,
  Digit7,
  Digit8,
  Digit9,
  Eisu,
  Eject,
  End,
  EndCall,
  Enter,
  Equal,
  EraseEof,
  Escape,
  ExSel,
  Execute,
  F1,
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  F9,
  F10,
  F11,
  F12,
  F13,
  F14,
  F15,
  F16,
  F17,
  F18,
  F19,
  F20,
  F21,
  F22,
  F23,
  F24,
  F25,
  F26,
  F27,
  F28,
  F29,
  F30,
  F31,
  F32,
  F33,
  F34,
  F35,
  FinalMode,
  Find,
  Fn,
  FnLock,
  GoBack,
  GoHome,
  GroupFirst,
  GroupLast,
  GroupNext,
  GroupPrevious,
  HangulMode,
  HanjaMode,
  Hankaku,
  HeadsetHook,
  Help,
  Hibernate,
  Hiragana,
  HiraganaKatakana,
  Home,
  Hyper,
  Insert,
  JunjaMode,
  KanaMode,
  KanjiMode,
  Katakana,
  Key11,
  Key12,
  KeyA,
  KeyB,
  KeyC,
  KeyD,
  KeyE,
  KeyF,
  KeyG,
  KeyH,
  KeyI,
  KeyJ,
  KeyK,
  KeyL,
  KeyM,
  KeyN,
  KeyO,
  KeyP,
  KeyQ,
  KeyR,
  KeyS,
  KeyT,
  KeyU,
  KeyV,
  KeyW,
  KeyX,
  KeyY,
  KeyZ,
  LastNumberRedial,
  LaunchApplication1,
  LaunchApplication2,
  LaunchCalendar,
  LaunchContacts,
  LaunchMail,
  LaunchMediaPlayer,
  LaunchMusicPlayer,
  LaunchPhone,
  LaunchScreenSaver,
  LaunchSpreadsheet,
  LaunchWebBrowser,
  LaunchWebCam,
  LaunchWordProcessor,
  LogOff,
  MailForward,
  MailReply,
  MailSend,
  MannerMode,
  MediaClose,
  MediaFastForward,
  MediaPause,
  MediaPlay,
  MediaPlayPause,
  MediaRecord,
  MediaRewind,
  MediaStop,
  MediaTrackNext,
  MediaTrackPrevious,
  Meta,
  MetaLeft,
  MetaRight,
  MicrophoneToggle,
  MicrophoneVolumeDown,
  MicrophoneVolumeMute,
  MicrophoneVolumeUp,
  Minus,
  ModeChange,
  New,
  NextCandidate,
  NonConvert,
  Notification,
  NumLock,
  Numpad0,
  Numpad1,
  Numpad2,
  Numpad3,
  Numpad4,
  Numpad5,
  Numpad6,
  Numpad7,
  Numpad8,
  Numpad9,
  NumpadAdd,
  NumpadBackspace,
  NumpadClear,
  NumpadClearEntry,
  NumpadComma,
  NumpadDecimal,
  NumpadDivide,
  NumpadEnter,
  NumpadEqual,
  NumpadHash,
  NumpadMemoryAdd,
  NumpadMemoryClear,
  NumpadMemoryRecall,
  NumpadMemoryStore,
  NumpadMemorySubtract,
  NumpadMultiply,
  NumpadParenLeft,
  NumpadParenRight,
  NumpadStar,
  NumpadSubtract,
  Open,
  PageDown,
  PageUp,
  Paste,
  Pause,
  Period,
  Play,
  Power,
  PowerOff,
  PreviousCandidate,
  Print,
  PrintScreen,
  Process,
  Props,
  Quote,
  Redo,
  Romaji,
  Save,
  ScrollLock,
  Select,
  Semicolon,
  Shift,
  ShiftLeft,
  ShiftRight,
  SingleCandidate,
  Slash,
  Soft1,
  Soft2,
  Soft3,
  Soft4,
  Space,
  SpeechCorrectionList,
  SpeechInputToggle,
  SpellCheck,
  Standby,
  Super,
  SymbolKey,
  SymbolLock,
  Tab,
  TV,
  TV3DMode,
  TVAntennaCable,
  TVAudioDescription,
  TVAudioDescriptionMixDown,
  TVAudioDescriptionMixUp,
  TVContentsMenu,
  TVDataService,
  TVInput,
  TVInputComponent1,
  TVInputComponent2,
  TVInputComposite1,
  TVInputComposite2,
  TVInputHDMI1,
  TVInputHDMI2,
  TVInputHDMI3,
  TVInputHDMI4,
  TVInputVGA1,
  TVMediaContext,
  TVNetwork,
  TVNumberEntry,
  TVPower,
  TVRadioService,
  TVSatellite,
  TVSatelliteBS,
  TVSatelliteCS,
  TVSatelliteToggle,
  TVTerrestrialAnalog,
  TVTerrestrialDigital,
  TVTimer,
  Undo,
  Unidentified,
  VoiceDial,
  WakeUp,
  Zenkaku,
  ZenkakuHankaku,
  ZoomIn,
  ZoomOut,
];

/** Lowercased key -> canonical PascalCase key. Built lazily on first use. */
let keyLookup: Map<string, string> | null = null;

function getKeyLookup(): Map<string, string> {
  if (keyLookup) return keyLookup;
  keyLookup = new Map<string, string>();
  for (const key of ALL_KEYS) {
    keyLookup.set(key.toLowerCase(), key);
  }
  return keyLookup;
}

/**
 * Resolve a key string to its canonical wire-protocol form using
 * case-insensitive matching. Single printable characters (a-z, 0-9,
 * punctuation) are returned as-is. Modifier prefixes like "ctrl+"
 * are preserved.
 *
 * @param key - The key string to resolve (e.g. "escape", "Escape", "ctrl+s").
 * @returns The canonical key string.
 * @throws Error if the key is not recognized.
 */
export function resolveKey(key: string): string {
  // Handle modifier prefixes: "ctrl+s" -> resolve "s" part only
  const plusIdx = key.lastIndexOf("+");
  if (plusIdx !== -1 && plusIdx < key.length - 1) {
    const prefix = key.slice(0, plusIdx + 1);
    const keyPart = key.slice(plusIdx + 1);
    return prefix + resolveKey(keyPart);
  }

  // Single character: lowercased for iced's logical key representation
  if (key.length === 1) {
    return key.toLowerCase();
  }

  // Exact match first (fast path)
  const lookup = getKeyLookup();
  const canonical = lookup.get(key.toLowerCase());
  if (canonical !== undefined) {
    return canonical;
  }

  // "Space" special case (the wire value is " " but users type "Space")
  if (key.toLowerCase() === "space") {
    return " ";
  }

  throw new Error(
    `Unknown key "${key}". Use Keys.* constants for valid key names, ` +
      `or pass a single character for printable keys.`,
  );
}
