/** Reading and transforming text: echo, head, tail, wc, grep, sort, uniq, cut, tr, sed, awk. */
import type { Command } from "../types";
import { joinLines, parseArgs, readInputs, splitLines } from "./args";

const CATEGORY = "Text";

/** Turns "\n" and friends into real characters, for echo -e and tr. */
function unescape(text: string): string {
  return text.replace(/\\(n|t|r|\\)/g, (_, ch: string) => ({ n: "\n", t: "\t", r: "\r", "\\": "\\" })[ch]!);
}

export const echo: Command = {
  name: "echo",
  category: CATEGORY,
  summary: "print text",
  usage: "echo [-n] [-e] [text...]",
  details: [
    "Prints its arguments separated by single spaces.",
    "",
    "  -n   do not add a newline at the end",
    "  -e   interpret \\n (newline) and \\t (tab)",
    "",
    "Combine with > to create files: echo hello > greeting.txt",
  ].join("\n"),
  run: ({ args }) => {
    let newline = true;
    let escapes = false;
    let i = 0;
    // echo is lax: only leading -n/-e clusters are options, anything else is text.
    while (i < args.length && /^-[neE]+$/.test(args[i]!)) {
      if (args[i]!.includes("n")) newline = false;
      if (args[i]!.includes("e")) escapes = true;
      i++;
    }
    let text = args.slice(i).join(" ");
    if (escapes) text = unescape(text);
    return { stdout: text + (newline ? "\n" : "") };
  },
};

/** head and tail share everything except which end of the file they keep. */
function headOrTail(name: "head" | "tail"): Command {
  return {
    name,
    category: CATEGORY,
    summary: name === "head" ? "print the first lines of a file" : "print the last lines of a file",
    usage: `${name} [-n count] [file...]`,
    details: [
      `Prints the ${name === "head" ? "first" : "last"} 10 lines of each FILE (or of stdin).`,
      "",
      `  -n N   print N lines instead (${name} -n 3 file, or the short form ${name} -3 file)`,
    ].join("\n"),
    run: (ctx) => {
      const opts = parseArgs(ctx.args, { values: "n", numeric: "n" });
      const count = Number(opts.values.get("n") ?? 10);
      if (!Number.isInteger(count) || count < 0) return { stderr: `${name}: invalid number of lines: '${opts.values.get("n")}'\n`, code: 1 };
      const many = opts.positional.length > 1;
      return readInputs(name, ctx, opts.positional, (text, label, index) => {
        const lines = splitLines(text);
        const kept = name === "head" ? lines.slice(0, count) : count === 0 ? [] : lines.slice(-count);
        const header = many ? `${index > 0 ? "\n" : ""}==> ${label} <==\n` : "";
        return header + joinLines(kept);
      });
    },
  };
}

export const head = headOrTail("head");
export const tail = headOrTail("tail");

export const wc: Command = {
  name: "wc",
  category: CATEGORY,
  summary: "count lines, words and bytes",
  usage: "wc [-lwc] [file...]",
  details: [
    "Prints line, word and byte counts for each FILE (or stdin), plus a total.",
    "",
    "  -l   lines only      -w   words only      -c   bytes only",
    "",
    "Example: ls | wc -l   counts the entries in the current directory",
  ].join("\n"),
  run: (ctx) => {
    const opts = parseArgs(ctx.args, { flags: "lwc" });
    const wanted = opts.flags.size > 0 ? opts.flags : new Set(["l", "w", "c"]);
    const totals = { l: 0, w: 0, c: 0 };
    const counts = (text: string) => ({
      l: (text.match(/\n/g) ?? []).length,
      w: text.split(/\s+/).filter(Boolean).length,
      c: new TextEncoder().encode(text).length,
    });
    const row = (n: typeof totals, label: string) =>
      (["l", "w", "c"] as const)
        .filter((k) => wanted.has(k))
        .map((k) => n[k])
        .join(" ") + (label === "-" ? "" : ` ${label}`) + "\n";

    const result = readInputs("wc", ctx, opts.positional, (text, label) => {
      const n = counts(text);
      totals.l += n.l;
      totals.w += n.w;
      totals.c += n.c;
      return row(n, label);
    });
    if (opts.positional.length > 1) result.stdout += row(totals, "total");
    return result;
  },
};

export const grep: Command = {
  name: "grep",
  category: CATEGORY,
  summary: "search for lines matching a pattern",
  usage: "grep [options] pattern [file...]",
  details: [
    "Prints every line of FILE (or stdin) that matches PATTERN, a regular expression.",
    "",
    "  -i   ignore case            -n   show line numbers",
    "  -v   invert: non-matching   -c   count matching lines",
    "  -r   search directories recursively",
    "  -l   list only file names that match",
    "  -w   match whole words only",
    "  -E   extended regex (a|b, +, ?) - always on here",
    "",
    "Examples: grep -i error app.log    grep -rn TODO src    ps | grep bash",
  ].join("\n"),
  run: ({ args, stdin, shell }) => {
    const opts = parseArgs(args, { flags: "invclrwE" });
    const [pattern, ...files] = opts.positional;
    if (pattern === undefined) return { stderr: "Usage: grep [OPTION]... PATTERNS [FILE]...\n", code: 2 };
    let regex: RegExp;
    try {
      regex = new RegExp(opts.flags.has("w") ? `\\b(?:${pattern})\\b` : pattern, opts.flags.has("i") ? "i" : "");
    } catch {
      return { stderr: "grep: invalid regular expression\n", code: 2 };
    }

    // Gather [label, text] inputs, expanding directories when -r is given.
    const inputs: [string, string][] = [];
    let stderr = "";
    const collect = (path: string, abs: string) => {
      const node = shell.fs.stat(abs);
      if (!node) stderr += `grep: ${path}: No such file or directory\n`;
      else if (node.kind === "file") inputs.push([path, node.content]);
      else if (!opts.flags.has("r")) stderr += `grep: ${path}: Is a directory\n`;
      else for (const name of shell.fs.readdir(abs)) collect(`${path === "/" ? "" : path}/${name}`, `${abs === "/" ? "" : abs}/${name}`);
    };
    if (files.length === 0) inputs.push(["(standard input)", stdin]);
    else for (const file of files) collect(file, shell.resolve(file));

    const showNames = opts.flags.has("r") || files.length > 1;
    const invert = opts.flags.has("v");
    let stdout = "";
    let matched = false;
    for (const [label, text] of inputs) {
      const hits: string[] = [];
      splitLines(text).forEach((line, i) => {
        if (regex.test(line) !== invert) hits.push(opts.flags.has("n") ? `${i + 1}:${line}` : line);
      });
      if (hits.length > 0) matched = true;
      const prefix = showNames ? `${label}:` : "";
      if (opts.flags.has("l")) stdout += hits.length > 0 ? `${label}\n` : "";
      else if (opts.flags.has("c")) stdout += `${prefix}${hits.length}\n`;
      else stdout += joinLines(hits.map((h) => prefix + h));
    }
    return { stdout, stderr, code: stderr ? 2 : matched ? 0 : 1 };
  },
};

export const sort: Command = {
  name: "sort",
  category: CATEGORY,
  summary: "sort lines",
  usage: "sort [-rnu] [file...]",
  details: [
    "Sorts the lines of FILE (or stdin) alphabetically.",
    "",
    "  -r   reverse order      -n   numeric order      -u   drop duplicate lines",
    "",
    "Example: sort -n scores.txt | tail -3   shows the three highest numbers",
  ].join("\n"),
  run: (ctx) => {
    const opts = parseArgs(ctx.args, { flags: "rnu" });
    let all = "";
    const result = readInputs("sort", ctx, opts.positional, (text) => {
      all += text.endsWith("\n") || text === "" ? text : text + "\n";
      return "";
    });
    const lines = splitLines(all);
    const numeric = (s: string) => parseFloat(s) || 0;
    lines.sort((a, b) => (opts.flags.has("n") ? numeric(a) - numeric(b) : a < b ? -1 : a > b ? 1 : 0));
    if (opts.flags.has("r")) lines.reverse();
    const output = opts.flags.has("u") ? lines.filter((line, i) => i === 0 || line !== lines[i - 1]) : lines;
    result.stdout = joinLines(output);
    return result;
  },
};

export const uniq: Command = {
  name: "uniq",
  category: CATEGORY,
  summary: "collapse repeated adjacent lines",
  usage: "uniq [-cdu] [file]",
  details: [
    "Removes repeated lines, but only when they are next to each other, so",
    "input is usually sorted first: sort file | uniq",
    "",
    "  -c   prefix each line with how many times it appeared",
    "  -d   print only lines that were repeated",
    "  -u   print only lines that were not repeated",
  ].join("\n"),
  run: (ctx) => {
    const opts = parseArgs(ctx.args, { flags: "cdu" });
    return readInputs("uniq", ctx, opts.positional.slice(0, 1), (text) => {
      const groups: { line: string; count: number }[] = [];
      for (const line of splitLines(text)) {
        const last = groups[groups.length - 1];
        if (last && last.line === line) last.count++;
        else groups.push({ line, count: 1 });
      }
      const shown = groups.filter((g) => (opts.flags.has("d") ? g.count > 1 : opts.flags.has("u") ? g.count === 1 : true));
      return joinLines(shown.map((g) => (opts.flags.has("c") ? `${String(g.count).padStart(7)} ${g.line}` : g.line)));
    });
  },
};

/** Parses a cut-style list ("1,3", "2-4", "2-", "-3") into a predicate on 1-based positions. */
function rangeList(spec: string): (index: number) => boolean {
  const ranges = spec.split(",").map((part) => {
    const [from, to] = part.includes("-") ? part.split("-") : [part, part];
    return [from === "" ? 1 : Number(from), to === "" ? Infinity : Number(to)] as const;
  });
  return (i) => ranges.some(([from, to]) => i >= from && i <= to);
}

export const cut: Command = {
  name: "cut",
  category: CATEGORY,
  summary: "extract columns from each line",
  usage: "cut -d delim -f list [file...]  |  cut -c list [file...]",
  details: [
    "Prints selected parts of every line.",
    "",
    "  -f LIST   fields to keep (1,3 or 2-4 or 2-), split on the delimiter",
    "  -d CHAR   the delimiter (default: tab)",
    "  -c LIST   characters to keep, by position",
    "",
    "Examples: cut -d , -f 2 people.csv    cut -d: -f1 /etc/passwd    cut -c 1-5 file",
  ].join("\n"),
  run: (ctx) => {
    const opts = parseArgs(ctx.args, { values: "dfc" });
    const fields = opts.values.get("f");
    const chars = opts.values.get("c");
    if (fields === undefined && chars === undefined) {
      return { stderr: "cut: you must specify a list of bytes, characters, or fields\n", code: 1 };
    }
    const keep = rangeList(fields ?? chars!);
    const delim = unescape(opts.values.get("d") ?? "\t");
    return readInputs("cut", ctx, opts.positional, (text) =>
      joinLines(
        splitLines(text).map((line) => {
          if (chars !== undefined) return [...line].filter((_, i) => keep(i + 1)).join("");
          if (!line.includes(delim)) return line; // no delimiter: line printed whole
          return line.split(delim).filter((_, i) => keep(i + 1)).join(delim);
        }),
      ),
    );
  },
};

/** Expands "a-z" style ranges into a list of characters. */
function charSet(spec: string): string[] {
  const chars = [...unescape(spec)];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const next = chars[i + 1];
    const end = chars[i + 2];
    if (next === "-" && end !== undefined) {
      for (let c = chars[i]!.charCodeAt(0); c <= end.charCodeAt(0); c++) out.push(String.fromCharCode(c));
      i += 2;
    } else out.push(chars[i]!);
  }
  return out;
}

export const tr: Command = {
  name: "tr",
  category: CATEGORY,
  summary: "translate or delete characters",
  usage: "tr [-d] set1 [set2]",
  details: [
    "Reads stdin and replaces every character in SET1 with the matching",
    "character in SET2. Ranges like a-z work.",
    "",
    "  -d   delete the characters in SET1 instead",
    "",
    "Examples: echo hello | tr a-z A-Z    tr -d ' ' < file    tr ' ' '\\n'",
  ].join("\n"),
  run: ({ args, stdin }) => {
    const opts = parseArgs(args, { flags: "d" });
    const [set1, set2] = opts.positional;
    if (set1 === undefined) return { stderr: "tr: missing operand\n", code: 1 };
    const from = charSet(set1);
    if (opts.flags.has("d")) return { stdout: [...stdin].filter((ch) => !from.includes(ch)).join("") };
    if (set2 === undefined) return { stderr: "tr: missing operand after '" + set1 + "'\n", code: 1 };
    const to = charSet(set2);
    const map = new Map(from.map((ch, i) => [ch, to[Math.min(i, to.length - 1)]!]));
    return { stdout: [...stdin].map((ch) => map.get(ch) ?? ch).join("") };
  },
};

/** Parses "s/old/new/flags" (any delimiter) into its parts; null if it is not a substitution. */
function parseSubstitution(script: string): { regex: RegExp; replacement: string } | null {
  const delim = script[1];
  if (script[0] !== "s" || delim === undefined) return null;
  const parts: string[] = [""];
  for (let i = 2; i < script.length; i++) {
    const ch = script[i]!;
    if (ch === "\\" && script[i + 1] === delim) parts[parts.length - 1] += delim, i++;
    else if (ch === delim) parts.push("");
    else parts[parts.length - 1] += ch;
  }
  if (parts.length !== 3) return null;
  const [pattern, replacement, flags] = parts as [string, string, string];
  if (!/^[gi]*$/.test(flags)) return null;
  try {
    // sed uses & for "the match" and \1 for groups; JS uses $& and $1.
    const jsReplacement = replacement.replace(/\$/g, "$$$$").replace(/\\(\d)/g, "$$$1").replace(/(^|[^\\])&/g, "$1$$&");
    return { regex: new RegExp(pattern, flags), replacement: jsReplacement };
  } catch {
    return null;
  }
}

export const sed: Command = {
  name: "sed",
  category: CATEGORY,
  summary: "find and replace text (s/old/new/)",
  usage: "sed [-i] 's/old/new/[g]' [file...]",
  details: [
    "Stream editor. This sandbox supports the substitution command only:",
    "",
    "  s/old/new/    replace the first OLD on each line with NEW",
    "  s/old/new/g   replace every occurrence (g = global)",
    "  s/old/new/i   ignore case",
    "  -i            edit the file in place instead of printing",
    "",
    "OLD is a regular expression. Examples:",
    "  sed 's/colour/color/g' essay.txt        sed -i 's/^#//' config.txt",
  ].join("\n"),
  run: (ctx) => {
    const opts = parseArgs(ctx.args, { flags: "i" });
    const [script, ...files] = opts.positional;
    if (script === undefined) return { stderr: "sed: no script given\n", code: 1 };
    const sub = parseSubstitution(script);
    if (!sub) return { stderr: `sed: only s/old/new/ is supported in this sandbox (got '${script}')\n`, code: 1 };
    const apply = (text: string) => joinLines(splitLines(text).map((line) => line.replace(sub.regex, sub.replacement)));
    if (!opts.flags.has("i")) return readInputs("sed", ctx, files, apply);
    if (files.length === 0) return { stderr: "sed: no input files\n", code: 1 };
    return readInputs("sed", ctx, files, (text, file) => {
      ctx.shell.fs.writeFile(ctx.shell.resolve(file), apply(text));
      return "";
    });
  },
};

/** Compiles an awk program of the form `/pattern/ {print expr, expr}`. */
function parseAwk(script: string): { filter: RegExp | null; print: (fields: string[], line: string, nr: number) => string } | null {
  const match = /^\s*(?:\/((?:\\\/|[^/])*)\/)?\s*\{\s*print\b(.*?)\s*\}\s*$/s.exec(script);
  if (!match) return null;
  const filter = match[1] !== undefined ? new RegExp(match[1]) : null;
  const body = match[2]!.trim();
  // Tokens: "string", $N, $NF, $0, NR, NF and commas (which become spaces).
  const tokens = body === "" ? [{ kind: "field", value: "0" }] : [];
  const re = /"((?:\\.|[^"])*)"|\$(NF|\d+)|\bNR\b|\bNF\b|,|\s+|(.)/g;
  for (const m of body.matchAll(re)) {
    if (m[1] !== undefined) tokens.push({ kind: "str", value: unescape(m[1]) });
    else if (m[2] !== undefined) tokens.push({ kind: "field", value: m[2] });
    else if (m[0] === "NR") tokens.push({ kind: "nr", value: "" });
    else if (m[0] === "NF") tokens.push({ kind: "nf", value: "" });
    else if (m[0] === ",") tokens.push({ kind: "str", value: " " });
    else if (m[3] !== undefined) return null; // anything else is unsupported
  }
  const print = (fields: string[], line: string, nr: number) =>
    tokens
      .map((t) => {
        if (t.kind === "str") return t.value;
        if (t.kind === "nr") return String(nr);
        if (t.kind === "nf") return String(fields.length);
        if (t.value === "0") return line;
        const index = t.value === "NF" ? fields.length : Number(t.value);
        return fields[index - 1] ?? "";
      })
      .join("");
  return { filter, print };
}

export const awk: Command = {
  name: "awk",
  category: CATEGORY,
  summary: "print selected columns ({print $1})",
  usage: "awk [-F sep] '[/pattern/] {print $N ...}' [file...]",
  details: [
    "Splits each line into fields ($1, $2, ... $NF is the last one; $0 is the",
    "whole line) and prints what you ask for. This sandbox supports the most",
    "common form: an optional /pattern/ filter and a print statement.",
    "",
    "  -F SEP   split fields on SEP instead of whitespace",
    "  NR       current line number      NF   number of fields",
    "",
    "Examples: awk '{print $1}' access.log      awk -F: '{print $1}' /etc/passwd",
    "          awk '/ERROR/ {print NR\": \"$0}' app.log",
  ].join("\n"),
  run: (ctx) => {
    const opts = parseArgs(ctx.args, { values: "F" });
    const [script, ...files] = opts.positional;
    if (script === undefined) return { stderr: "awk: no program given\n", code: 1 };
    const program = parseAwk(script);
    if (!program) return { stderr: "awk: only '/pattern/ {print $N ...}' is supported in this sandbox\n", code: 1 };
    const sep = opts.values.get("F");
    let nr = 0;
    return readInputs("awk", ctx, files, (text) =>
      joinLines(
        splitLines(text).flatMap((line) => {
          nr++;
          if (program.filter && !program.filter.test(line)) return [];
          const fields = sep === undefined ? line.trim().split(/\s+/).filter(Boolean) : line.split(unescape(sep));
          return [program.print(fields, line, nr)];
        }),
      ),
    );
  },
};

export const textCommands = [echo, head, tail, wc, grep, sort, uniq, cut, tr, sed, awk];
