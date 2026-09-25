/** All built-in commands, in the order `help` lists them. */
import { fileCommands } from "./files";
import { helpCommands } from "./help";
import { navigationCommands } from "./navigation";
import { searchCommands } from "./search";
import { systemCommands } from "./system";
import { textCommands } from "./text";

export const defaultCommands = [
  ...navigationCommands,
  ...fileCommands,
  ...textCommands,
  ...searchCommands,
  ...systemCommands,
  ...helpCommands,
];
