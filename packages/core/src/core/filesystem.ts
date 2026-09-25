/**
 * In-memory virtual filesystem.
 *
 * Everything lives in a tree of plain objects, so the whole "disk" can be
 * cloned, reset or thrown away instantly. Paths passed to VirtualFS methods
 * must already be absolute; use `resolvePath` to turn a user-typed path into
 * one. Error messages mirror the wording real Linux tools print.
 */

export interface FileNode {
  kind: "file";
  content: string;
  mode: number; // Unix permission bits, e.g. 0o644
  mtime: number; // last modified, ms since epoch
}

export interface DirNode {
  kind: "dir";
  children: Map<string, FsNode>;
  mode: number;
  mtime: number;
}

export type FsNode = FileNode | DirNode;

export type FsErrorCode = "ENOENT" | "EEXIST" | "ENOTDIR" | "EISDIR" | "ENOTEMPTY";

const MESSAGES: Record<FsErrorCode, string> = {
  ENOENT: "No such file or directory",
  EEXIST: "File exists",
  ENOTDIR: "Not a directory",
  EISDIR: "Is a directory",
  ENOTEMPTY: "Directory not empty",
};

/** An error with a Unix-style code and message, e.g. "ENOENT: No such file or directory". */
export class FsError extends Error {
  constructor(
    public readonly code: FsErrorCode,
    public readonly path: string,
  ) {
    super(MESSAGES[code]);
    this.name = "FsError";
  }
}

/** Turns `path` (absolute or relative to `cwd`) into a clean absolute path. */
export function resolvePath(path: string, cwd: string): string {
  const base = path.startsWith("/") ? [] : segments(cwd);
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return "/" + base.join("/");
}

/** Splits an absolute path into its non-empty segments. */
function segments(absPath: string): string[] {
  return absPath.split("/").filter((s) => s !== "");
}

/** Splits "/a/b/c" into ["/a/b", "c"]. */
export function splitPath(absPath: string): [parent: string, name: string] {
  const parts = segments(absPath);
  const name = parts.pop() ?? "";
  return ["/" + parts.join("/"), name];
}

/** The last segment of a path ("/a/b/c" → "c"). */
export function basename(absPath: string): string {
  return splitPath(absPath)[1];
}

const emptyDir = (): DirNode => ({ kind: "dir", children: new Map(), mode: 0o755, mtime: Date.now() });

export class VirtualFS {
  private root: DirNode = emptyDir();

  // ---- Reading -----------------------------------------------------------

  /** The node at `absPath`, or undefined if nothing is there. */
  stat(absPath: string): FsNode | undefined {
    let node: FsNode = this.root;
    for (const part of segments(absPath)) {
      if (node.kind !== "dir") return undefined;
      const next = node.children.get(part);
      if (!next) return undefined;
      node = next;
    }
    return node;
  }

  exists(absPath: string): boolean {
    return this.stat(absPath) !== undefined;
  }

  isDir(absPath: string): boolean {
    return this.stat(absPath)?.kind === "dir";
  }

  isFile(absPath: string): boolean {
    return this.stat(absPath)?.kind === "file";
  }

  readFile(absPath: string): string {
    const node = this.stat(absPath);
    if (!node) throw new FsError("ENOENT", absPath);
    if (node.kind === "dir") throw new FsError("EISDIR", absPath);
    return node.content;
  }

  /** Names inside a directory, sorted alphabetically. */
  readdir(absPath: string): string[] {
    const node = this.stat(absPath);
    if (!node) throw new FsError("ENOENT", absPath);
    if (node.kind !== "dir") throw new FsError("ENOTDIR", absPath);
    return [...node.children.keys()].sort();
  }

  // ---- Writing -----------------------------------------------------------

  writeFile(absPath: string, content: string, opts: { append?: boolean } = {}): void {
    const [parentPath, name] = splitPath(absPath);
    const parent = this.dirOrThrow(parentPath);
    const existing = parent.children.get(name);
    if (existing?.kind === "dir") throw new FsError("EISDIR", absPath);
    if (existing && opts.append) {
      existing.content += content;
      existing.mtime = Date.now();
    } else {
      parent.children.set(name, { kind: "file", content, mode: existing?.mode ?? 0o644, mtime: Date.now() });
    }
  }

  mkdir(absPath: string, opts: { parents?: boolean } = {}): void {
    if (opts.parents) {
      let node: DirNode = this.root;
      for (const part of segments(absPath)) {
        let next = node.children.get(part);
        if (!next) {
          next = emptyDir();
          node.children.set(part, next);
        }
        if (next.kind !== "dir") throw new FsError("ENOTDIR", absPath);
        node = next;
      }
      return;
    }
    const [parentPath, name] = splitPath(absPath);
    const parent = this.dirOrThrow(parentPath);
    if (parent.children.has(name)) throw new FsError("EEXIST", absPath);
    parent.children.set(name, emptyDir());
  }

  /** Deletes a file, or a directory tree when `recursive` is set (like `rm -r`). */
  remove(absPath: string, opts: { recursive?: boolean } = {}): void {
    const [parentPath, name] = splitPath(absPath);
    const parent = this.dirOrThrow(parentPath);
    const node = parent.children.get(name);
    if (!node) throw new FsError("ENOENT", absPath);
    if (node.kind === "dir" && !opts.recursive) throw new FsError("EISDIR", absPath);
    parent.children.delete(name);
  }

  /** Deletes an empty directory (like `rmdir`). */
  rmdir(absPath: string): void {
    const node = this.stat(absPath);
    if (!node) throw new FsError("ENOENT", absPath);
    if (node.kind !== "dir") throw new FsError("ENOTDIR", absPath);
    if (node.children.size > 0) throw new FsError("ENOTEMPTY", absPath);
    this.remove(absPath, { recursive: true });
  }

  /** Copies `src` to exactly `dst`. Directories need `recursive` (like `cp -r`). */
  copy(src: string, dst: string, opts: { recursive?: boolean } = {}): void {
    const node = this.stat(src);
    if (!node) throw new FsError("ENOENT", src);
    if (node.kind === "dir" && !opts.recursive) throw new FsError("EISDIR", src);
    this.place(dst, cloneNode(node));
  }

  /** Moves `src` to exactly `dst` (like `mv`). */
  move(src: string, dst: string): void {
    const node = this.stat(src);
    if (!node) throw new FsError("ENOENT", src);
    this.place(dst, node);
    this.remove(src, { recursive: true });
  }

  chmod(absPath: string, mode: number): void {
    const node = this.stat(absPath);
    if (!node) throw new FsError("ENOENT", absPath);
    node.mode = mode;
  }

  /** A deep, independent copy of the whole filesystem. */
  clone(): VirtualFS {
    const copy = new VirtualFS();
    copy.root = cloneNode(this.root) as DirNode;
    return copy;
  }

  // ---- Helpers -----------------------------------------------------------

  private dirOrThrow(absPath: string): DirNode {
    const node = this.stat(absPath);
    if (!node) throw new FsError("ENOENT", absPath);
    if (node.kind !== "dir") throw new FsError("ENOTDIR", absPath);
    return node;
  }

  /** Marks a file or directory as modified now (like `touch` on an existing path). */
  touch(absPath: string): void {
    const node = this.stat(absPath);
    if (!node) throw new FsError("ENOENT", absPath);
    node.mtime = Date.now();
  }

  /** Attaches `node` at `dst`, replacing whatever was there. */
  private place(dst: string, node: FsNode): void {
    const [parentPath, name] = splitPath(dst);
    const parent = this.dirOrThrow(parentPath);
    parent.children.set(name, node);
  }
}

function cloneNode(node: FsNode): FsNode {
  if (node.kind === "file") return { ...node };
  const children = new Map<string, FsNode>();
  for (const [name, child] of node.children) children.set(name, cloneNode(child));
  return { kind: "dir", children, mode: node.mode, mtime: node.mtime };
}
