import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-jarvis-key");
  if (!key || !config.apiKeys.includes(key)) {
    res.status(401).json({ error: "Missing or invalid x-jarvis-key header." });
    return;
  }
  next();
}
