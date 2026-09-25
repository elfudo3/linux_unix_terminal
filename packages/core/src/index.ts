/**
 * Public API of the core package. Apps import from "@terminal-trainer/core"
 * and never reach into internal paths.
 */
export { Shell, type RunResult, type ShellOptions } from "./core/shell";
export { VirtualFS, FsError, resolvePath, type FsNode } from "./core/filesystem";
export { createSampleFS } from "./core/sample-fs";
export { complete, type Completion } from "./core/completion";
export { defaultCommands } from "./core/commands";
export type { Command, CommandContext, CommandResult } from "./core/types";
export { Trainer, STORAGE_KEY, type Challenge, type CheckContext, type CheckOutcome, type ProgressStorage } from "./trainer/trainer";
export { challenges } from "./trainer/challenges";
export { trainerCommands, describeTask } from "./trainer/commands";
