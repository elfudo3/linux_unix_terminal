import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, loadPreferences, savePreferences } from "../src/preferences";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("preferences", () => {
  it("falls back to defaults when nothing is stored, storage is missing, or data is corrupt", () => {
    expect(loadPreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences(memory())).toEqual(DEFAULT_PREFERENCES);
    const bad = memory();
    bad.setItem(PREFERENCES_KEY, "{oops");
    expect(loadPreferences(bad)).toEqual(DEFAULT_PREFERENCES);
    bad.setItem(PREFERENCES_KEY, JSON.stringify({ fontSize: "huge" }));
    expect(loadPreferences(bad).fontSize).toBe("medium");
  });

  it("round-trips through storage", () => {
    const storage = memory();
    savePreferences(storage, { fontSize: "large", taskCardCollapsed: true });
    expect(loadPreferences(storage)).toEqual({ fontSize: "large", taskCardCollapsed: true });
    expect(() => savePreferences(undefined, DEFAULT_PREFERENCES)).not.toThrow();
  });
});
