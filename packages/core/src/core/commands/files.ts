/** Creating, copying, moving and deleting: cat, touch, mkdir, rm, rmdir, cp, mv, chmod. */
import { basename } from "../filesystem";
import type { Shell } from "../shell";
import type { Command } from "../types";
import { forEachPath, joinLines, parseArgs, readInputs, splitLines } from "./args";

const CATEGORY = "Files";

export const cat: Command = {
  name: "cat",
  category: CATEGORY,
  summary: "print file contents",
  usage: "cat [-n] [file...]",
  details: [
    "Prints each FILE to the screen, one after another (con-cat-enates them).",
    "Reads from stdin when no file is given, so it also works at the end of a pipe.",
    "",
    "  -n   number the output lines",
  ].join("\n"),
  run: (ctx) => {
    const opts = parseArgs(ctx.args, { flags: "n" });
    const result = readInputs("cat", ctx, opts.positional, (text) => text);
    if (opts.flags.has("n") && result.stdout) {
      result.stdout = joinLines(splitLines(result.stdout).map((line, i) => `${String(i + 1).padStart(6)}\t${line}`));
    }
    return result;
  },
};

export const touch: Command = {
  name: "touch",
  category: CATEGORY,
  summary: "create an empty file (or update its timestamp)",
  usage: "touch file...",
  details: "Creates each FILE if it does not exist. Existing files are left unchanged apart from their modification time.",
  run: ({ args, shell }) => {
    if (args.length === 0) return { stderr: "touch: missing file operand\n", code: 1 };
    return forEachPath(
      "touch",
      args,
      (path) => {
        const abs = shell.resolve(path);
        if (shell.fs.exists(abs)) shell.fs.touch(abs);
        else shell.fs.writeFile(abs, "");
      },
      "cannot touch",
    );
  },
};

export const mkdir: Command = {
  name: "mkdir",
  category: CATEGORY,
  summary: "create directories",
  usage: "mkdir [-p] directory...",
  details: [
    "Creates each DIRECTORY.",
    "",
    "  -p   also create missing parent directories (mkdir -p a/b/c), and",
    "       do not complain if the directory already exists",
  ].join("\n"),
  run: ({ args, shell }) => {
    const opts = parseArgs(args, { flags: "p" });
    if (opts.positional.length === 0) return { stderr: "mkdir: missing operand\n", code: 1 };
    return forEachPath(
      "mkdir",
      opts.positional,
      (path) => shell.fs.mkdir(shell.resolve(path), { parents: opts.flags.has("p") }),
      "cannot create directory",
    );
  },
};

export const rm: Command = {
  name: "rm",
  category: CATEGORY,
  summary: "delete files or directories",
  usage: "rm [-rf] file...",
  details: [
    "Deletes each FILE. There is no trash can: deleted means gone.",
    "",
    "  -r   recursive: delete a directory and everything inside it",
    "  -f   force: ignore missing files and never ask",
  ].join("\n"),
  run: ({ args, shell }) => {
    const opts = parseArgs(args, { flags: "rfR" });
    const recursive = opts.flags.has("r") || opts.flags.has("R");
    const force = opts.flags.has("f");
    if (opts.positional.length === 0) return force ? {} : { stderr: "rm: missing operand\n", code: 1 };

    let stderr = "";
    let code = 0;
    for (const path of opts.positional) {
      const abs = shell.resolve(path);
      if (abs === "/") {
        stderr += "rm: it is dangerous to operate recursively on '/'\n";
        code = 1;
        continue;
      }
      try {
        shell.fs.remove(abs, { recursive });
      } catch (err) {
        if (force && (err as { code?: string }).code === "ENOENT") continue;
        stderr += `rm: cannot remove '${path}': ${(err as Error).message}\n`;
        code = 1;
      }
    }
    return { stderr, code };
  },
};

export const rmdir: Command = {
  name: "rmdir",
  category: CATEGORY,
  summary: "delete empty directories",
  usage: "rmdir directory...",
  details: "Deletes each DIRECTORY, but only if it is empty. Use `rm -r` for directories with content.",
  run: ({ args, shell }) => {
    if (args.length === 0) return { stderr: "rmdir: missing operand\n", code: 1 };
    return forEachPath("rmdir", args, (path) => shell.fs.rmdir(shell.resolve(path)), "failed to remove");
  },
};

/**
 * Shared by cp and mv: works out where each source should land. When the
 * destination is a directory, sources go inside it under their own name.
 */
function transfer(name: "cp" | "mv", args: string[], shell: Shell, recursive: boolean) {
  if (args.length === 0) return { stderr: `${name}: missing file operand\n`, code: 1 };
  if (args.length === 1) return { stderr: `${name}: missing destination file operand after '${args[0]}'\n`, code: 1 };

  const dest = args[args.length - 1]!;
  const sources = args.slice(0, -1);
  const destAbs = shell.resolve(dest);
  const destIsDir = shell.fs.isDir(destAbs);
  if (sources.length > 1 && !destIsDir) return { stderr: `${name}: target '${dest}' is not a directory\n`, code: 1 };

  let stderr = "";
  let code = 0;
  for (const src of sources) {
    const srcAbs = shell.resolve(src);
    const node = shell.fs.stat(srcAbs);
    if (!node) {
      stderr += `${name}: cannot stat '${src}': No such file or directory\n`;
      code = 1;
      continue;
    }
    if (name === "cp" && node.kind === "dir" && !recursive) {
      stderr += `cp: -r not specified; omitting directory '${src}'\n`;
      code = 1;
      continue;
    }
    const target = destIsDir ? `${destAbs === "/" ? "" : destAbs}/${basename(srcAbs)}` : destAbs;
    if (target === srcAbs) {
      stderr += `${name}: '${src}' and '${dest}' are the same file\n`;
      code = 1;
      continue;
    }
    try {
      if (name === "cp") shell.fs.copy(srcAbs, target, { recursive: true });
      else shell.fs.move(srcAbs, target);
    } catch (err) {
      stderr += `${name}: cannot create '${dest}': ${(err as Error).message}\n`;
      code = 1;
    }
  }
  return { stderr, code };
}

export const cp: Command = {
  name: "cp",
  category: CATEGORY,
  summary: "copy files or directories",
  usage: "cp [-r] source... destination",
  details: [
    "Copies SOURCE to DESTINATION. If DESTINATION is a directory, the copy is",
    "placed inside it with the same name.",
    "",
    "  -r   recursive: copy a directory and everything inside it",
    "",
    "Examples: cp notes.txt backup.txt    cp -r docs docs-backup    cp a.txt b.txt dir/",
  ].join("\n"),
  run: ({ args, shell }) => {
    const opts = parseArgs(args, { flags: "rR" });
    return transfer("cp", opts.positional, shell, opts.flags.has("r") || opts.flags.has("R"));
  },
};

export const mv: Command = {
  name: "mv",
  category: CATEGORY,
  summary: "move or rename files and directories",
  usage: "mv source... destination",
  details: [
    "Moves SOURCE to DESTINATION. Renaming is just moving to a new name in the",
    "same directory. If DESTINATION is a directory, SOURCE is moved inside it.",
    "",
    "Examples: mv old.txt new.txt    mv report.md docs/    mv *.log archive/",
  ].join("\n"),
  run: ({ args, shell }) => transfer("mv", parseArgs(args).positional, shell, true),
};

/** Applies a chmod mode string ("755", "+x", "u=rw,go-w") to `mode`. Returns null if invalid. */
export function applyMode(spec: string, mode: number): number | null {
  if (/^[0-7]{3,4}$/.test(spec)) return parseInt(spec, 8) & 0o777;
  const WHO: Record<string, number> = { u: 0o700, g: 0o070, o: 0o007, a: 0o777 };
  const PERM: Record<string, number> = { r: 0o444, w: 0o222, x: 0o111 };
  for (const clause of spec.split(",")) {
    const match = /^([ugoa]*)([+\-=])([rwx]*)$/.exec(clause);
    if (!match) return null;
    const [, who, op, perms] = match;
    let mask = 0;
    for (const w of who || "a") mask |= WHO[w]!;
    let bits = 0;
    for (const p of perms!) bits |= PERM[p]! & mask;
    if (op === "+") mode |= bits;
    else if (op === "-") mode &= ~bits;
    else mode = (mode & ~mask) | bits;
  }
  return mode;
}

export const chmod: Command = {
  name: "chmod",
  category: CATEGORY,
  summary: "change file permissions",
  usage: "chmod mode file...",
  details: [
    "Sets the permissions of each FILE. MODE is either three octal digits",
    "(owner, group, others; r=4 w=2 x=1) or a symbolic change.",
    "",
    "  chmod 755 script.sh    rwx for owner, r-x for group and others",
    "  chmod 644 notes.txt    rw- for owner, r-- for everyone else",
    "  chmod +x script.sh     add execute permission for everyone",
    "  chmod u+w,go-w f       owner may write, group and others may not",
    "",
    "Check the result with: ls -l",
  ].join("\n"),
  run: ({ args, shell }) => {
    const [spec, ...files] = args;
    if (spec === undefined || files.length === 0) return { stderr: "chmod: missing operand\n", code: 1 };
    if (applyMode(spec, 0) === null) return { stderr: `chmod: invalid mode: '${spec}'\n`, code: 1 };
    return forEachPath(
      "chmod",
      files,
      (path) => {
        const abs = shell.resolve(path);
        const node = shell.fs.stat(abs);
        if (!node) throw new Error("No such file or directory");
        shell.fs.chmod(abs, applyMode(spec, node.mode)!);
      },
      "cannot access",
    );
  },
};

export const fileCommands = [cat, touch, mkdir, rm, rmdir, cp, mv, chmod];
