import { describe, expect, it } from "vitest";
import { ParseError, expandWord, parseLine, tokenize, type Word } from "../../src/core/parser";

const env = (name: string) => ({ HOME: "/home/user", USER: "user", "?": "0" })[name] ?? "";

const expand = (word: Word) => expandWord(word, env);

const words = (line: string) =>
  tokenize(line)
    .filter((t) => t.type === "word")
    .map((t) => expand(t));

describe("tokenize", () => {
  it("splits on whitespace", () => {
    expect(words("ls  -la   /tmp")).toEqual(["ls", "-la", "/tmp"]);
    expect(words("   ")).toEqual([]);
  });

  it("keeps single-quoted text literally", () => {
    expect(words("echo 'a  b' '$HOME'")).toEqual(["echo", "a  b", "$HOME"]);
  });

  it("keeps spaces but expands variables inside double quotes", () => {
    expect(words('echo "a  b" "$HOME/x" "${USER}"')).toEqual(["echo", "a  b", "/home/user/x", "user"]);
  });

  it("keeps variables as parts so they can be expanded later", () => {
    const [, home] = tokenize("echo $HOME");
    expect(home).toEqual({ type: "word", quoted: false, parts: [{ kind: "var", text: "HOME" }] });
    expect(words("echo $HOME $? $MISSING x$USER")).toEqual(["echo", "/home/user", "0", "", "xuser"]);
    expect(words("echo cost: 5$")).toEqual(["echo", "cost:", "5$"]);
  });

  it("supports backslash escapes", () => {
    expect(words("echo a\\ b \\$HOME")).toEqual(["echo", "a b", "$HOME"]);
  });

  it("joins adjacent quoted and unquoted parts into one word", () => {
    expect(words("echo a'b c'd")).toEqual(["echo", "ab cd"]);
  });

  it("recognises operators, with or without surrounding spaces", () => {
    const ops = (line: string) => tokenize(line).filter((t) => t.type === "op").map((t) => t.value);
    expect(ops("a | b > c >> d < e && f || g ; h")).toEqual(["|", ">", ">>", "<", "&&", "||", ";"]);
    expect(ops("a|b>c")).toEqual(["|", ">"]);
  });

  it("marks whether a word was quoted so globs can be skipped", () => {
    const tokens = tokenize("ls *.txt '*.txt'") as (Word & { type: "word" })[];
    expect([expand(tokens[1]!), tokens[1]!.quoted]).toEqual(["*.txt", false]);
    expect([expand(tokens[2]!), tokens[2]!.quoted]).toEqual(["*.txt", true]);
  });

  it("rejects unterminated quotes", () => {
    expect(() => tokenize("echo 'oops")).toThrow(ParseError);
    expect(() => tokenize('echo "oops')).toThrow(/unterminated quote/i);
  });
});

describe("parseLine", () => {
  it("returns nothing for an empty line", () => {
    expect(parseLine("")).toEqual([]);
    expect(parseLine("   ")).toEqual([]);
  });

  it("parses a single command", () => {
    const [entry] = parseLine("ls -l /tmp");
    expect(entry?.pipeline.map((c) => c.argv.map(expand))).toEqual([["ls", "-l", "/tmp"]]);
    expect(entry?.pipeline[0]?.redirects).toEqual([]);
    expect(entry?.next).toBeNull();
  });

  it("parses pipelines", () => {
    const [entry] = parseLine("cat f | sort | uniq -c");
    expect(entry?.pipeline.map((c) => c.argv.map(expand))).toEqual([["cat", "f"], ["sort"], ["uniq", "-c"]]);
  });

  it("parses redirects and keeps them out of argv", () => {
    const [entry] = parseLine("sort < in.txt > out.txt");
    expect(entry?.pipeline[0]?.argv.map(expand)).toEqual(["sort"]);
    expect(entry?.pipeline[0]?.redirects.map((r) => [r.kind, expand(r.target)])).toEqual([
      ["<", "in.txt"],
      [">", "out.txt"],
    ]);
  });

  it("parses command lists joined by ; && ||", () => {
    const list = parseLine("a; b && c || d");
    expect(list.map((e) => [expand(e.pipeline[0]!.argv[0]!), e.next])).toEqual([
      ["a", ";"],
      ["b", "&&"],
      ["c", "||"],
      ["d", null],
    ]);
  });

  it("allows a trailing semicolon", () => {
    expect(parseLine("ls;")).toHaveLength(1);
  });

  it("rejects dangling operators", () => {
    expect(() => parseLine("ls |")).toThrow(/syntax error/);
    expect(() => parseLine("| ls")).toThrow(/syntax error/);
    expect(() => parseLine("ls >")).toThrow(/syntax error/);
    expect(() => parseLine("ls && && ls")).toThrow(/syntax error/);
  });
});
