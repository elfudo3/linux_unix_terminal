/** Moving around: pwd, cd, ls, tree. */
import { type FsNode } from "../filesystem";
import type { Command } from "../types";
import { joinLines, parseArgs } from "./args";

const CATEGORY = "Navigation";

export const pwd: Command = {
  name: "pwd",
  category: CATEGORY,
  summary: "print the working directory",
  usage: "pwd",
  details: "Prints the absolute path of the directory you are currently in.",
  run: ({ shell }) => ({ stdout: shell.cwd + "\n" }),
};

export const cd: Command = {
  name: "cd",
  category: CATEGORY,
  summary: "change directory",
  usage: "cd [directory]",
  details: [
    "Moves into DIRECTORY. With no argument, goes to your home directory.",
    "",
    "  cd ..      go up one level",
    "  cd ~       go home (same as plain cd)",
    "  cd -       go back to the previous directory",
    "  cd /       go to the root of the filesystem",
  ].join("\n"),
  run: ({ args, shell }) => {
    if (args.length > 1) return { stderr: "bash: cd: too many arguments\n", code: 1 };
    const target = args[0] ?? "~";
    const goingBack = target === "-";
    try {
      shell.changeDir(goingBack ? shell.oldCwd : target);
    } catch (err) {
      return { stderr: `bash: cd: ${target}: ${(err as Error).message}\n`, code: 1 };
    }
    // Like bash, `cd -` prints where it took you.
    return goingBack ? { stdout: shell.cwd + "\n" } : {};
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats 0o755 as "rwxr-xr-x". */
export function modeString(mode: number): string {
  const bits = ["r", "w", "x"];
  let out = "";
  for (let shift = 6; shift >= 0; shift -= 3) {
    const triplet = (mode >> shift) & 0o7;
    bits.forEach((ch, i) => (out += triplet & (4 >> i) ? ch : "-"));
  }
  return out;
}

/** Size in bytes, as `ls -l` would show it. Directories are a nominal 4096. */
function sizeOf(node: FsNode): number {
  return node.kind === "dir" ? 4096 : new TextEncoder().encode(node.content).length;
}

/** "Sep 25 07:01", the timestamp column of `ls -l`. */
function shortDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, " ")} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function longLine(name: string, node: FsNode, user: string): string {
  const type = node.kind === "dir" ? "d" : "-";
  return `${type}${modeString(node.mode)} 1 ${user} ${user} ${String(sizeOf(node)).padStart(5)} ${shortDate(node.mtime)} ${name}`;
}

export const ls: Command = {
  name: "ls",
  category: CATEGORY,
  summary: "list directory contents",
  usage: "ls [-alF] [path...]",
  details: [
    "Lists files and directories. With no path, lists the current directory.",
    "",
    "  -a   show hidden entries (names starting with a dot)",
    "  -l   long format: permissions, owner, size, date",
    "  -F   append / to directory names",
    "",
    "Examples: ls -la    ls docs    ls -l *.txt",
  ].join("\n"),
  run: ({ args, shell }) => {
    const opts = parseArgs(args, { flags: "alF1" });
    const paths = opts.positional.length > 0 ? opts.positional : ["."];
    const all = opts.flags.has("a");
    const long = opts.flags.has("l");
    const classify = opts.flags.has("F");

    const format = (name: string, node: FsNode): string => {
      const shown = classify && node.kind === "dir" ? name + "/" : name;
      return long ? longLine(shown, node, shell.user) : shown;
    };

    let stdout = "";
    let stderr = "";
    let code = 0;
    const files: string[] = [];
    const dirs: string[] = [];
    for (const path of paths) {
      const node = shell.fs.stat(shell.resolve(path));
      if (!node) {
        stderr += `ls: cannot access '${path}': No such file or directory\n`;
        code = 2;
      } else (node.kind === "dir" ? dirs : files).push(path);
    }

    // Plain files come first, then each directory as its own block.
    stdout += joinLines(files.map((path) => format(path, shell.fs.stat(shell.resolve(path))!)));
    for (const path of dirs) {
      const abs = shell.resolve(path);
      const entries = shell.fs.readdir(abs).filter((name) => all || !name.startsWith("."));
      if (all) entries.unshift(".", "..");
      const lines = entries.map((name) => {
        const node = name === "." ? shell.fs.stat(abs)! : name === ".." ? shell.fs.stat(shell.resolve(abs + "/.."))! : shell.fs.stat(abs + "/" + name)!;
        return format(name, node);
      });
      if (paths.length > 1) stdout += (stdout ? "\n" : "") + path + ":\n";
      stdout += joinLines(lines);
    }
    return { stdout, stderr, code };
  },
};

export const tree: Command = {
  name: "tree",
  category: CATEGORY,
  summary: "show a directory as a tree",
  usage: "tree [-a] [path]",
  details: "Draws the directory structure below PATH (default: current directory). -a includes hidden entries.",
  run: ({ args, shell }) => {
    const opts = parseArgs(args, { flags: "a" });
    const root = opts.positional[0] ?? ".";
    const abs = shell.resolve(root);
    if (!shell.fs.isDir(abs)) return { stderr: `tree: '${root}': No such directory\n`, code: 1 };

    let dirs = 0;
    let files = 0;
    const lines = [root];
    const walk = (dir: string, prefix: string) => {
      const names = shell.fs.readdir(dir).filter((n) => opts.flags.has("a") || !n.startsWith("."));
      names.forEach((name, i) => {
        const last = i === names.length - 1;
        const child = dir === "/" ? "/" + name : dir + "/" + name;
        lines.push(`${prefix}${last ? "└── " : "├── "}${name}`);
        if (shell.fs.isDir(child)) {
          dirs++;
          walk(child, prefix + (last ? "    " : "│   "));
        } else files++;
      });
    };
    walk(abs, "");
    lines.push("", `${dirs} director${dirs === 1 ? "y" : "ies"}, ${files} file${files === 1 ? "" : "s"}`);
    return { stdout: joinLines(lines) };
  },
};

export const navigationCommands = [pwd, cd, ls, tree];
