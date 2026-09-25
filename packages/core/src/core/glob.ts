/**
 * Shell-style filename globbing: `*`, `?` and `[...]`.
 */
import { resolvePath, type VirtualFS } from "./filesystem";

export function hasGlob(word: string): boolean {
  return /[*?[]/.test(word);
}

/** Compiles one path segment pattern into an anchored RegExp. */
function globToRegExp(pattern: string): RegExp {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === "*") re += ".*";
    else if (ch === "?") re += ".";
    else if (ch === "[") {
      const end = pattern.indexOf("]", i + 1);
      if (end === -1) re += "\\[";
      else {
        re += "[" + pattern.slice(i + 1, end).replace(/\\/g, "\\\\") + "]";
        i = end;
      }
    } else re += ch.replace(/[.+^${}()|\\/]/g, "\\$&");
  }
  return new RegExp(re + "$");
}

export function matchGlob(pattern: string, name: string): boolean {
  return globToRegExp(pattern).test(name);
}

/**
 * Expands `pattern` (relative to `cwd`) into matching paths, in sorted order.
 * Results keep the same shape the user typed (relative stays relative).
 * Dotfiles only match when the segment pattern itself starts with a dot.
 */
export function expandGlob(fs: VirtualFS, cwd: string, pattern: string): string[] {
  const absolute = pattern.startsWith("/");
  const parts = pattern.split("/").filter((p) => p !== "");
  let results = [absolute ? "/" : ""]; // partial paths, as typed

  for (const part of parts) {
    const next: string[] = [];
    for (const prefix of results) {
      const dir = resolvePath(prefix || ".", cwd);
      if (!hasGlob(part)) {
        // Plain segment: keep it if it exists, no matching needed.
        if (fs.exists(resolvePath(part, dir))) next.push(join(prefix, part));
        continue;
      }
      if (!fs.isDir(dir)) continue;
      for (const name of fs.readdir(dir)) {
        if (name.startsWith(".") && !part.startsWith(".")) continue;
        if (matchGlob(part, name)) next.push(join(prefix, name));
      }
    }
    results = next;
  }
  return results.sort();
}

function join(prefix: string, name: string): string {
  if (prefix === "" || prefix === "/") return prefix + name;
  return prefix + "/" + name;
}
