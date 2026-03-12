import { Command } from "commander";
import { initCommand } from "./commands/init";
import { drillCommand } from "./commands/drill";
import { reviewCommand } from "./commands/review";
import { reportCommand } from "./commands/report";

const program = new Command();

program
  .name("coach")
  .description("Poker Coach OS — NLHE drill engine with spaced repetition")
  .version("1.0.0");

program.addCommand(initCommand);
program.addCommand(drillCommand);
program.addCommand(reviewCommand);
program.addCommand(reportCommand);

program.parse(process.argv);

