/**
 * User preferences (font size, collapsed task card). Stored as one JSON
 * blob; unreadable or missing data falls back to the defaults.
 */
import type { ProgressStorage } from "@terminal-trainer/core";

export type FontSize = "small" | "medium" | "large";

export interface Preferences {
  fontSize: FontSize;
  taskCardCollapsed: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { fontSize: "medium", taskCardCollapsed: false };

/** Terminal font size in CSS pixels for each setting. */
export const FONT_SIZE_PX: Record<FontSize, number> = { small: 13, medium: 15, large: 17 };

export const PREFERENCES_KEY = "terminal-trainer.preferences";

const FONT_SIZES: FontSize[] = ["small", "medium", "large"];

export function loadPreferences(storage?: ProgressStorage): Preferences {
  try {
    const raw = storage?.getItem(PREFERENCES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
    return {
      fontSize: FONT_SIZES.includes(parsed.fontSize as FontSize) ? (parsed.fontSize as FontSize) : DEFAULT_PREFERENCES.fontSize,
      taskCardCollapsed: typeof parsed.taskCardCollapsed === "boolean" ? parsed.taskCardCollapsed : DEFAULT_PREFERENCES.taskCardCollapsed,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(storage: ProgressStorage | undefined, prefs: Preferences): void {
  try {
    storage?.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: preferences simply do not persist.
  }
}
