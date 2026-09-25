/**
 * Small helpers shared by commands: option parsing and per-file error handling.
 */
import type { FsError } from "../filesystem";
import type { CommandContext, CommandResult } from "../types";

export interface ParsedArgs {
  /** Boolean options that were present, e.g. "l" and "a" for `ls -la`. */
  flags: Set<string>;
  /** Options that take a value, e.g. n → "5" for `head -n 5`. */
  values: Map<string, string>;
  /** Everything else, in order. */
  positional: string[];
}

export interface ArgSpec {
  /** Letters allowed as boolean flags, e.g. "la". */
  flags?: string;
  /** Letters that take a value (either `-n5` or `-n 5`), e.g. "n". */
  values?: string;
  /** Allow bare numbers like `-5` (used by head/tail) as the value of this letter. */
  numeric?: string;
}

export class ArgError extends Error {}

/** Parses Unix-style short options. `--` ends option parsing. */
export function parseArgs(args: string[], spec: ArgSpec = {}): ParsedArgs {
  const result: ParsedArgs = { flags: new Set(), values: new Map(), positional: [] };
  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    i++;
    if (arg === "--") {
      result.positional.push(...args.slice(i));
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      result.positional.push(arg);
      continue;
    }
    if (spec.numeric && /^-\d+$/.test(arg)) {
      result.values.set(spec.numeric, arg.slice(1));
      continue;
    }
    // Walk the letters in a cluster like `-la`.
    const letters = arg.slice(1);
    for (let j = 0; j < letters.length; j++) {
      const letter = letters[j]!;
      if (spec.values?.includes(letter)) {
        const rest = letters.slice(j + 1);
        const value = rest !== "" ? rest : args[i++];
        if (value === undefined) throw new ArgError(`option requires an argument -- '${letter}'`);
        result.values.set(letter, value);
        break;
      }
      if (!spec.flags?.includes(letter)) throw new ArgError(`invalid option -- '${letter}'`);
      result.flags.add(letter);
    }
  }
  return result;
}

/**
 * Runs `fn` for each path, collecting output. A failure on one path is
 * reported and the others still run, like real tools. With `label`, errors
 * read GNU-style: "rm: cannot remove 'x': No such file or directory".
 */
export function forEachPath(
  name: string,
  paths: string[],
  fn: (path: string) => string | void,
  label?: string,
): CommandResult {
  let stdout = "";
  let stderr = "";
  let code = 0;
  for (const path of paths) {
    try {
      stdout += fn(path) ?? "";
    } catch (err) {
      const message = (err as FsError).message;
      stderr += label ? `${name}: ${label} '${path}': ${message}\n` : `${name}: ${path}: ${message}\n`;
      code = 1;
    }
  }
  return { stdout, stderr, code };
}

/**
 * The "files or stdin" pattern shared by text tools: calls `fn` once per file
 * (or once with stdin when no files are given) and concatenates the output.
 */
export function readInputs(
  name: string,
  ctx: CommandContext,
  files: string[],
  fn: (text: string, label: string, index: number) => string,
): CommandResult {
  if (files.length === 0) return { stdout: fn(ctx.stdin, "-", 0) };
  let index = 0;
  return forEachPath(name, files, (file) => fn(ctx.shell.fs.readFile(ctx.shell.resolve(file)), file, index++));
}

/** Joins lines back into text with a trailing newline (or "" for no lines). */
export function joinLines(lines: string[]): string {
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

/** Splits text into lines, dropping the final empty piece after a trailing newline. */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}
