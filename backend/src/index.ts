import express from "express";
import cors from "cors";
import cron from "node-cron";
import { config } from "./config.js";
import { requireApiKey } from "./middleware/requireApiKey.js";
import { briefRoutes } from "./routes/briefRoutes.js";
import { runDailyBrief } from "./agent/dailyBriefAgent.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", requireApiKey, briefRoutes);

app.listen(config.port, () => {
  console.log(`Jarvis agent backend listening on :${config.port}`);
});

// Generates the brief on a schedule (default 7am server time) so a push
// notification can be sent even if the app isn't open. Wire the actual
// APNs push send-in `runDailyBrief`'s caller once you have device tokens
// stored (see README for the push-notification setup).
if (config.dailyBriefCron) {
  cron.schedule(config.dailyBriefCron, async () => {
    try {
      const brief = await runDailyBrief({});
      console.log(`[cron] Generated daily brief at ${brief.generatedAt}`);
    } catch (err) {
      console.error("[cron] Failed to generate daily brief", err);
    }
  });
}
