/**
 * The practice engine. It loads one exercise at a time into the shell,
 * checks whether the user's last command solved it, and remembers progress
 * (in localStorage when running in a browser). No DOM code here.
 */
import type { VirtualFS } from "../core/filesystem";
import type { RunResult, Shell } from "../core/shell";

export interface CheckContext {
  shell: Shell;
  /** The line the user typed. */
  line: string;
  /** Simple whitespace split of `line`, handy for "did they use ls -l" checks. */
  argv: string[];
  /** What the command printed and its exit code. */
  result: RunResult;
}

export interface Challenge {
  /** Stable id used to store progress; never renumber. */
  id: string;
  topic: string;
  title: string;
  /** What to do, shown to the user. */
  task: string;
  hint: string;
  /** Reference answer, one line per command. Shown by `answer` and used in tests. */
  solution: string[];
  /** Extra preparation on top of the fresh sample filesystem. */
  setup?: (shell: Shell) => void;
  /** True once the task is done. Runs after every command. */
  check: (ctx: CheckContext) => boolean;
}

/** The subset of localStorage the trainer needs, so tests can pass a plain object. */
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface SavedProgress {
  completed: string[];
  current: number;
}

export interface TrainerOptions {
  shell: Shell;
  challenges: Challenge[];
  /** Builds a pristine filesystem; called whenever a task (re)starts. */
  freshFS: () => VirtualFS;
  storage?: ProgressStorage;
}

export const STORAGE_KEY = "terminal-trainer.progress";

export type CheckOutcome = "solved" | "already" | "no";

export class Trainer {
  readonly challenges: Challenge[];
  private readonly shell: Shell;
  private readonly freshFS: () => VirtualFS;
  private readonly storage: ProgressStorage | undefined;
  private readonly completed = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private index = 0;
  /** True once the current task has been solved (so `next` is allowed). */
  solved = false;

  constructor(opts: TrainerOptions) {
    this.shell = opts.shell;
    this.challenges = opts.challenges;
    this.freshFS = opts.freshFS;
    this.storage = opts.storage;
    const saved = this.load();
    for (const id of saved.completed) this.completed.add(id);
    this.goTo(saved.current);
  }

  // ---- State -------------------------------------------------------------

  get current(): Challenge {
    return this.challenges[this.index]!;
  }

  get progress(): { done: number; total: number; index: number } {
    return { done: this.completed.size, total: this.challenges.length, index: this.index };
  }

  get finished(): boolean {
    return this.completed.size === this.challenges.length;
  }

  isCompleted(challenge: Challenge): boolean {
    return this.completed.has(challenge.id);
  }

  // ---- Moving between tasks ----------------------------------------------

  /** Loads task `index` into a fresh sandbox. Out-of-range values are clamped. */
  goTo(index: number): void {
    this.index = Math.min(Math.max(0, index), this.challenges.length - 1);
    this.solved = false;
    this.reset();
    this.save();
  }

  /** Advances to the next task; false if the current one is unsolved or is the last. */
  next(): boolean {
    if (!this.solved) return false;
    return this.skip();
  }

  /** Moves on without solving; false when already on the last task. */
  skip(): boolean {
    if (this.index >= this.challenges.length - 1) return false;
    this.goTo(this.index + 1);
    return true;
  }

  /** Puts the sandbox back to this task's starting state. Progress is kept. */
  reset(): void {
    this.shell.resetFilesystem(this.freshFS());
    this.current.setup?.(this.shell);
    this.solved = false;
    this.notify();
  }

  /** Forgets all progress and starts over from the first task. */
  resetProgress(): void {
    this.completed.clear();
    this.goTo(0);
  }

  // ---- Checking ----------------------------------------------------------

  /** Call after every command the user runs. */
  afterCommand(line: string, result: RunResult): CheckOutcome {
    if (this.solved) return "already";
    const argv = line.trim().split(/\s+/);
    let passed = false;
    try {
      passed = this.current.check({ shell: this.shell, line, argv, result });
    } catch {
      passed = false; // a check should never crash the terminal
    }
    if (!passed) return "no";
    this.solved = true;
    this.completed.add(this.current.id);
    this.save();
    this.notify();
    return "solved";
  }

  // ---- Listeners (the UI panel re-renders on change) ---------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  // ---- Persistence -------------------------------------------------------

  private load(): SavedProgress {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<SavedProgress>) : {};
      return {
        completed: Array.isArray(parsed.completed) ? parsed.completed.filter((x) => typeof x === "string") : [],
        current: typeof parsed.current === "number" ? parsed.current : 0,
      };
    } catch {
      return { completed: [], current: 0 };
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ completed: [...this.completed], current: this.index }));
    } catch {
      // Storage can be unavailable (private mode, quota); progress just won't persist.
    }
  }
}
