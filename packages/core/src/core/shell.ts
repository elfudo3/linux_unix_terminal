/**
 * The shell: owns the filesystem, working directory, environment and history,
 * and runs command lines. It is pure logic with no DOM dependency, which keeps
 * it easy to test and lets the UI stay thin.
 */
import { FsError, VirtualFS, resolvePath } from "./filesystem";
import { expandGlob, hasGlob } from "./glob";
import { ParseError, expandWord, parseLine, type SimpleCommand, type Word } from "./parser";
import type { Command } from "./types";
import { defaultCommands } from "./commands";

export interface ShellOptions {
  fs?: VirtualFS;
  cwd?: string;
  user?: string;
  host?: string;
  /** Commands to install; defaults to the built-in set. */
  commands?: Iterable<Command>;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
  /** True when the UI should clear the screen. */
  clear: boolean;
}

const EXIT_NOT_FOUND = 127;
const EXIT_SYNTAX = 2;

export class Shell {
  fs: VirtualFS;
  readonly user: string;
  readonly host: string;
  readonly home: string;
  readonly env = new Map<string, string>();
  readonly history: string[] = [];
  cwd: string;
  /** Exit code of the last command, exposed as `$?`. */
  lastCode = 0;
  private previousCwd: string;
  private readonly commands = new Map<string, Command>();

  constructor(opts: ShellOptions = {}) {
    this.fs = opts.fs ?? new VirtualFS();
    this.user = opts.user ?? "user";
    this.host = opts.host ?? "sandbox";
    this.home = `/home/${this.user}`;
    this.cwd = opts.cwd ?? this.home;
    this.previousCwd = this.cwd;
    this.env.set("HOME", this.home);
    this.env.set("USER", this.user);
    this.env.set("SHELL", "/bin/bash");
    this.env.set("PATH", "/usr/local/bin:/usr/bin:/bin");
    for (const cmd of opts.commands ?? defaultCommands) this.register(cmd);
  }

  // ---- Commands ----------------------------------------------------------

  register(cmd: Command): void {
    this.commands.set(cmd.name, cmd);
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  commandNames(): string[] {
    return [...this.commands.keys()].sort();
  }

  // ---- Paths -------------------------------------------------------------

  /** Absolute path for a user-typed path (handles `~` and relative paths). */
  resolve(path: string): string {
    return resolvePath(this.expandTilde(path), this.cwd);
  }

  /** Changes directory; throws FsError if the target is unusable. */
  changeDir(path: string): void {
    const target = this.resolve(path);
    const node = this.fs.stat(target);
    if (!node) throw new FsError("ENOENT", path);
    if (node.kind !== "dir") throw new FsError("ENOTDIR", path);
    this.previousCwd = this.cwd;
    this.cwd = target;
    this.env.set("PWD", target);
  }

  /** Replaces the filesystem and returns home. Used to reset the sandbox. */
  resetFilesystem(fs: VirtualFS): void {
    this.fs = fs;
    this.cwd = this.home;
    this.previousCwd = this.home;
    this.env.set("PWD", this.home);
  }

  /** The directory before the last `cd`, used by `cd -`. */
  get oldCwd(): string {
    return this.previousCwd;
  }

  /** The prompt, with the home directory shown as `~`. */
  prompt(): string {
    return `${this.user}@${this.host}:${this.displayPath(this.cwd)}$ `;
  }

  /** Shortens `/home/user/x` to `~/x` for display. */
  displayPath(absPath: string): string {
    if (absPath === this.home) return "~";
    if (absPath.startsWith(this.home + "/")) return "~" + absPath.slice(this.home.length);
    return absPath;
  }

  // ---- Running -----------------------------------------------------------

  /** Runs one line of input, exactly as if typed at the prompt. */
  run(line: string): RunResult {
    if (line.trim() !== "") this.history.push(line);
    const result: RunResult = { stdout: "", stderr: "", code: 0, clear: false };

    let entries;
    try {
      entries = parseLine(line);
    } catch (err) {
      result.stderr = `bash: ${(err as ParseError).message}\n`;
      result.code = EXIT_SYNTAX;
      this.lastCode = EXIT_SYNTAX;
      return result;
    }

    let skipUntil: "&&" | "||" | null = null;
    for (const entry of entries) {
      // `a && b`: skip b when a failed. `a || b`: skip b when a succeeded.
      const skip = skipUntil !== null;
      if (!skip) {
        const out = this.runPipeline(entry.pipeline);
        result.stdout += out.stdout;
        result.stderr += out.stderr;
        result.code = out.code;
        result.clear ||= out.clear;
        this.lastCode = out.code;
      }
      if (entry.next === "&&" && this.lastCode !== 0) skipUntil = "&&";
      else if (entry.next === "||" && this.lastCode === 0) skipUntil = "||";
      else if (entry.next === ";" || entry.next === null) skipUntil = null;
      // A skipped `&&` chain keeps skipping through further `&&`, and the
      // same for `||`; any other operator resets the skip.
      else if (skipUntil !== entry.next) skipUntil = null;
    }
    return result;
  }

  private runPipeline(pipeline: SimpleCommand[]): RunResult {
    const result: RunResult = { stdout: "", stderr: "", code: 0, clear: false };
    let stdin = "";
    for (const [index, cmd] of pipeline.entries()) {
      const out = this.runSimple(cmd, stdin);
      result.stderr += out.stderr;
      result.clear ||= out.clear;
      result.code = out.code;
      if (index === pipeline.length - 1) result.stdout += out.stdout;
      else stdin = out.stdout; // feed the next command
    }
    return result;
  }

  private runSimple(cmd: SimpleCommand, stdin: string): RunResult {
    const argv = this.expandWords(cmd.argv);
    const result: RunResult = { stdout: "", stderr: "", code: 0, clear: false };
    const name = argv[0];
    if (name === undefined) return result;

    // `NAME=value` on its own is a variable assignment, not a command.
    const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(name);
    if (assignment && argv.length === 1) {
      this.env.set(assignment[1]!, assignment[2]!);
      return result;
    }

    // Wire up redirects before running so `< missing` fails early.
    let outputPath: string | undefined;
    let append = false;
    try {
      for (const redirect of cmd.redirects) {
        const target = this.expandWords([redirect.target])[0]!;
        const abs = this.resolve(target);
        if (redirect.kind === "<") {
          if (!this.fs.exists(abs)) throw new FsError("ENOENT", target);
          stdin = this.fs.readFile(abs);
        } else {
          if (this.fs.isDir(abs)) throw new FsError("EISDIR", target);
          const [parent] = abs === "/" ? ["/"] : [abs.slice(0, abs.lastIndexOf("/")) || "/"];
          if (!this.fs.isDir(parent)) throw new FsError("ENOENT", target);
          outputPath = abs;
          append = redirect.kind === ">>";
          // `> file` truncates the file even if the command fails.
          if (!append) this.fs.writeFile(abs, "");
        }
      }
    } catch (err) {
      result.stderr = `bash: ${(err as FsError).path}: ${(err as Error).message}\n`;
      result.code = 1;
      return result;
    }

    const command = this.commands.get(name);
    if (!command) {
      result.stderr = `bash: ${name}: command not found\n`;
      result.code = EXIT_NOT_FOUND;
      return result;
    }

    try {
      const out = command.run({ args: argv.slice(1), stdin, shell: this });
      result.stdout = out.stdout ?? "";
      result.stderr = out.stderr ?? "";
      result.code = out.code ?? 0;
      result.clear = out.clear ?? false;
    } catch (err) {
      result.stderr = `${name}: ${(err as Error).message}\n`;
      result.code = 1;
    }

    if (outputPath !== undefined) {
      this.fs.writeFile(outputPath, result.stdout, { append });
      result.stdout = "";
    }
    return result;
  }

  // ---- Expansion ---------------------------------------------------------

  private lookupVar(name: string): string {
    if (name === "?") return String(this.lastCode);
    if (name === "PWD") return this.cwd;
    return this.env.get(name) ?? "";
  }

  private expandTilde(word: string): string {
    if (word === "~") return this.home;
    if (word.startsWith("~/")) return this.home + word.slice(1);
    return word;
  }

  /** Expands variables in every word, then `~` and globs in the unquoted ones. */
  private expandWords(words: Word[]): string[] {
    const out: string[] = [];
    for (const word of words) {
      const text = expandWord(word, (name) => this.lookupVar(name));
      if (word.quoted) {
        out.push(text);
        continue;
      }
      const value = this.expandTilde(text);
      if (hasGlob(value)) {
        const matches = expandGlob(this.fs, this.cwd, value);
        // Bash keeps the pattern as-is when nothing matches.
        out.push(...(matches.length > 0 ? matches : [value]));
      } else out.push(value);
    }
    return out;
  }
}
