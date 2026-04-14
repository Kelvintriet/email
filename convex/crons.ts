import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "clear-trash",
  { hourUTC: 0, minuteUTC: 0 },
  internal.emails.permanentlyDeleteTrash
);

export default crons;
