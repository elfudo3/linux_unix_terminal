/**
 * Shared types for shell commands. A command is a plain object: metadata for
 * `help`/`man`, plus a `run` function that receives its arguments and stdin
 * and returns what it wrote. Commands never touch the DOM.
 */
import type { Shell } from "./shell";

export interface CommandContext {
  /** Arguments after the command name, already expanded (globs, ~, $VAR). */
  args: string[];
  /** Text piped or redirected into the command ("" if none). */
  stdin: string;
  /** The shell, for filesystem, cwd, env and history access. */
  shell: Shell;
}

export interface CommandResult {
  stdout?: string;
  stderr?: string;
  /** Exit code; 0 (the default) means success. */
  code?: number;
  /** Set by `clear` to ask the UI to wipe the screen. */
  clear?: boolean;
}

export interface Command {
  name: string;
  /** Group heading used by `help`, e.g. "Files". */
  category?: string;
  /** One line shown by `help`. */
  summary: string;
  /** Short syntax line, e.g. "ls [-la] [path...]". */
  usage: string;
  /** Longer explanation and examples shown by `man`. */
  details?: string;
  run(ctx: CommandContext): CommandResult;
}
