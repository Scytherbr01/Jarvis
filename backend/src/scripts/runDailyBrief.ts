import { runDailyBrief } from "../agent/dailyBriefAgent.js";

// npm run brief:run — generates and prints today's brief without the
// iOS app or a server running. Useful for testing the agent logic, or
// for wiring into your own cron/launchd job.
const brief = await runDailyBrief({});
console.log(JSON.stringify(brief, null, 2));
