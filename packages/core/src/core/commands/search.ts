/** Finding things: find, which, xargs. */
import { matchGlob } from "../glob";
import type { Command } from "../types";
import { joinLines } from "./args";

const CATEGORY = "Search";

export const find: Command = {
  name: "find",
  category: CATEGORY,
  summary: "search for files by name or type",
  usage: "find [path...] [-name pattern] [-iname pattern] [-type f|d]",
  details: [
    "Walks the directory tree below PATH (default: .) and prints every path,",
    "or only those matching the tests you give.",
    "",
    "  -name PATTERN    name matches PATTERN (quote globs: -name '*.txt')",
    "  -iname PATTERN   like -name but ignores case",
    "  -type f          files only      -type d   directories only",
    "",
    "Examples: find . -name '*.log'    find /etc -type d    find src -type f -name 'test*'",
  ].join("\n"),
  run: ({ args, shell }) => {
    const paths: string[] = [];
    const tests: ((name: string, isDir: boolean) => boolean)[] = [];
    let i = 0;
    while (i < args.length && !args[i]!.startsWith("-")) paths.push(args[i++]!);
    while (i < args.length) {
      const predicate = args[i++]!;
      const value = args[i++];
      if (value === undefined) return { stderr: `find: missing argument to \`${predicate}'\n`, code: 1 };
      if (predicate === "-name") tests.push((name) => matchGlob(value, name));
      else if (predicate === "-iname") tests.push((name) => matchGlob(value.toLowerCase(), name.toLowerCase()));
      else if (predicate === "-type") {
        if (value !== "f" && value !== "d") return { stderr: `find: Unknown argument to -type: ${value}\n`, code: 1 };
        tests.push((_, isDir) => isDir === (value === "d"));
      } else return { stderr: `find: unknown predicate \`${predicate}'\n`, code: 1 };
    }

    const lines: string[] = [];
    let stderr = "";
    const walk = (shown: string, abs: string) => {
      const node = shell.fs.stat(abs);
      if (!node) return;
      const name = abs.slice(abs.lastIndexOf("/") + 1) || "/";
      if (tests.every((t) => t(name, node.kind === "dir"))) lines.push(shown);
      if (node.kind === "dir") {
        for (const child of shell.fs.readdir(abs)) {
          walk(`${shown === "/" ? "" : shown}/${child}`, `${abs === "/" ? "" : abs}/${child}`);
        }
      }
    };
    for (const path of paths.length > 0 ? paths : ["."]) {
      const abs = shell.resolve(path);
      if (!shell.fs.exists(abs)) stderr += `find: '${path}': No such file or directory\n`;
      else walk(path.length > 1 ? path.replace(/\/+$/, "") : path, abs);
    }
    return { stdout: joinLines(lines), stderr, code: stderr ? 1 : 0 };
  },
};

export const which: Command = {
  name: "which",
  category: CATEGORY,
  summary: "show where a command lives",
  usage: "which command...",
  details: "Prints the path of each COMMAND that exists. Exit status is 1 if any was not found.",
  run: ({ args, shell }) => {
    const found = args.filter((name) => shell.getCommand(name));
    return { stdout: joinLines(found.map((name) => `/usr/bin/${name}`)), code: found.length === args.length ? 0 : 1 };
  },
};

export const xargs: Command = {
  name: "xargs",
  category: CATEGORY,
  summary: "turn stdin into command arguments",
  usage: "xargs [command [args...]]",
  details: [
    "Reads words from stdin and runs COMMAND with those words appended as",
    "arguments (default command: echo). Handy after find or grep -l.",
    "",
    "Examples: find . -name '*.tmp' | xargs rm      grep -l TODO *.py | xargs wc -l",
  ].join("\n"),
  run: ({ args, stdin, shell }) => {
    const extra = stdin.split(/\s+/).filter(Boolean);
    const name = args[0] ?? "echo";
    const command = shell.getCommand(name);
    if (!command) return { stderr: `xargs: ${name}: No such file or directory\n`, code: 127 };
    return command.run({ args: [...args.slice(1), ...extra], stdin: "", shell });
  },
};

export const searchCommands = [find, which, xargs];
