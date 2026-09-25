/**
 * Tab completion. Completes the command name at the start of a command, and
 * file paths everywhere else. Pure function: the UI calls it and shows the
 * result.
 */
import type { Shell } from "./shell";

export interface Completion {
  /** The line after completion (unchanged if nothing matched). */
  line: string;
  /** All matches, for the UI to list when there is more than one. */
  candidates: string[];
}

/** Longest string every candidate starts with. */
function commonPrefix(items: string[]): string {
  let prefix = items[0] ?? "";
  for (const item of items) {
    while (!item.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

export function complete(shell: Shell, line: string): Completion {
  // The word being completed is whatever follows the last space.
  const start = line.lastIndexOf(" ") + 1;
  const head = line.slice(0, start);
  const word = line.slice(start);

  // It is a command name if nothing but operators precede it in this command.
  const segment = head.split(/\||;|&&|\|\|/).pop() ?? "";
  const isCommand = segment.trim() === "";

  const candidates = isCommand ? shell.commandNames().filter((n) => n.startsWith(word)) : pathCandidates(shell, word);
  if (candidates.length === 0) return { line, candidates };

  if (candidates.length === 1) {
    const only = candidates[0]!;
    // Directories get no trailing space so the user can keep typing into them.
    const suffix = only.endsWith("/") ? "" : " ";
    return { line: head + only + suffix, candidates };
  }
  return { line: head + commonPrefix(candidates), candidates };
}

/** Files and directories matching a partial path, keeping the typed prefix (e.g. "docs/" or "~/"). */
function pathCandidates(shell: Shell, word: string): string[] {
  const slash = word.lastIndexOf("/");
  const dirPart = slash === -1 ? "" : word.slice(0, slash + 1);
  const prefix = word.slice(slash + 1);
  const dirAbs = shell.resolve(dirPart === "" ? "." : dirPart);
  if (!shell.fs.isDir(dirAbs)) return [];
  return shell.fs
    .readdir(dirAbs)
    .filter((name) => name.startsWith(prefix) && (prefix.startsWith(".") || !name.startsWith(".")))
    .map((name) => dirPart + name + (shell.fs.isDir(`${dirAbs === "/" ? "" : dirAbs}/${name}`) ? "/" : ""));
}
