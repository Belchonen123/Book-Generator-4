import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "heal stuck chapters",
  { minutes: 5 },
  internal.chapters.healStuck,
  {}
);

export default crons;
