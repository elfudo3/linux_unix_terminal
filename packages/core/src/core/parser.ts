/**
 * Command-line parser.
 *
 * Two stages, like a real shell:
 *   1. `tokenize`  – splits a line into words and operators, handling quotes
 *                    and backslashes. `$VAR` references are kept as parts.
 *   2. `parseLine` – groups those tokens into pipelines (`a | b`) joined by
 *                    `;`, `&&` or `||`, with `<`, `>` and `>>` redirects.
 *
 * Variables, globs (`*.txt`) and `~` are expanded later by the shell, right
 * before each command runs, so `false; echo $?` sees the fresh exit code.
 * `Word.quoted` tells the shell which words to leave alone for globs and `~`.
 */

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/** A piece of a word: literal text, or a variable name to look up later. */
export interface WordPart {
  kind: "literal" | "var";
  text: string;
}

export interface Word {
  parts: WordPart[];
  /** True when any part of the word was inside quotes (disables glob/tilde expansion). */
  quoted: boolean;
}

export type VarLookup = (name: string) => string;

/** Resolves a word to its final text by looking up its variable parts. */
export function expandWord(word: Word, lookup: VarLookup): string {
  return word.parts.map((p) => (p.kind === "var" ? lookup(p.text) : p.text)).join("");
}

export type Operator = "|" | ">" | ">>" | "<" | "&&" | "||" | ";";

export type Token = ({ type: "word" } & Word) | { type: "op"; value: Operator };

export type RedirectKind = ">" | ">>" | "<";

export interface Redirect {
  kind: RedirectKind;
  target: Word;
}

export interface SimpleCommand {
  argv: Word[];
  redirects: Redirect[];
}

/** One pipeline plus the operator that links it to the next one. */
export interface ListEntry {
  pipeline: SimpleCommand[];
  next: "&&" | "||" | ";" | null;
}

// Longest operators first so ">>" wins over ">".
const OPERATORS: Operator[] = [">>", "&&", "||", "|", ">", "<", ";"];

const isSpace = (ch: string) => ch === " " || ch === "\t";
const isVarChar = (ch: string) => /[A-Za-z0-9_]/.test(ch);

/** Splits `line` into word and operator tokens. */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let parts: WordPart[] = [];
  let literal = "";
  let quoted = false;
  let inWord = false;

  const flushLiteral = () => {
    if (literal !== "") parts.push({ kind: "literal", text: literal });
    literal = "";
  };

  const finishWord = () => {
    flushLiteral();
    if (inWord) tokens.push({ type: "word", parts, quoted });
    parts = [];
    quoted = false;
    inWord = false;
  };

  /** Reads `$NAME`, `${NAME}` or `$?` starting at `i` (which points at `$`) into a var part. */
  const readVariable = (): void => {
    i++; // skip '$'
    let name = "";
    if (line[i] === "{") {
      const end = line.indexOf("}", i);
      if (end === -1) throw new ParseError("bad substitution");
      name = line.slice(i + 1, end);
      i = end + 1;
    } else if (line[i] === "?") {
      name = "?";
      i++;
    } else {
      while (i < line.length && isVarChar(line[i]!)) name += line[i++];
    }
    if (name === "") {
      literal += "$"; // a lone "$" is just text
      return;
    }
    flushLiteral();
    parts.push({ kind: "var", text: name });
  };

  while (i < line.length) {
    const ch = line[i]!;

    if (isSpace(ch)) {
      finishWord();
      i++;
      continue;
    }

    const op = OPERATORS.find((o) => line.startsWith(o, i));
    if (op) {
      finishWord();
      tokens.push({ type: "op", value: op });
      i += op.length;
      continue;
    }

    inWord = true;

    if (ch === "'") {
      const end = line.indexOf("'", i + 1);
      if (end === -1) throw new ParseError("unterminated quote");
      literal += line.slice(i + 1, end);
      quoted = true;
      i = end + 1;
    } else if (ch === '"') {
      quoted = true;
      i++;
      let closed = false;
      while (i < line.length) {
        const c = line[i]!;
        if (c === '"') {
          closed = true;
          i++;
          break;
        }
        if (c === "\\" && i + 1 < line.length && '"$\\'.includes(line[i + 1]!)) {
          literal += line[i + 1];
          i += 2;
        } else if (c === "$") {
          readVariable();
        } else {
          literal += c;
          i++;
        }
      }
      if (!closed) throw new ParseError("unterminated quote");
    } else if (ch === "\\") {
      if (i + 1 < line.length) literal += line[i + 1];
      i += 2;
    } else if (ch === "$") {
      readVariable();
    } else {
      literal += ch;
      i++;
    }
  }
  finishWord();
  return tokens;
}

/** Groups tokens into a list of pipelines. Throws ParseError on bad syntax. */
export function parseLine(line: string): ListEntry[] {
  const tokens = tokenize(line);
  const entries: ListEntry[] = [];
  let pipeline: SimpleCommand[] = [];
  let cmd: SimpleCommand = { argv: [], redirects: [] };
  let i = 0;

  const syntaxError = (near: string) => new ParseError(`syntax error near unexpected token \`${near}'`);

  const endCommand = (opText: string) => {
    if (cmd.argv.length === 0 && cmd.redirects.length === 0) throw syntaxError(opText);
    pipeline.push(cmd);
    cmd = { argv: [], redirects: [] };
  };

  const endPipeline = (next: ListEntry["next"]) => {
    entries.push({ pipeline, next });
    pipeline = [];
  };

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.type === "word") {
      cmd.argv.push({ parts: token.parts, quoted: token.quoted });
      i++;
      continue;
    }
    switch (token.value) {
      case ">":
      case ">>":
      case "<": {
        const target = tokens[i + 1];
        if (!target || target.type !== "word") throw syntaxError(target?.value ?? "newline");
        cmd.redirects.push({ kind: token.value, target: { parts: target.parts, quoted: target.quoted } });
        i += 2;
        break;
      }
      case "|":
        endCommand("|");
        i++;
        break;
      case "&&":
      case "||":
      case ";":
        endCommand(token.value);
        endPipeline(token.value);
        i++;
        break;
    }
  }

  // Flush whatever is left. A trailing ";" is fine; a trailing "|" or "&&" is not.
  if (cmd.argv.length > 0 || cmd.redirects.length > 0) {
    pipeline.push(cmd);
    endPipeline(null);
  } else if (pipeline.length > 0) {
    throw syntaxError("newline");
  } else if (entries.length > 0 && entries[entries.length - 1]!.next !== ";") {
    throw syntaxError("newline");
  }
  return entries;
}
