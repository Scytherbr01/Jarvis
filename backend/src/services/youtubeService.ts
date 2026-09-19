import { Readable } from "node:stream";
import { google } from "googleapis";
import { config } from "../config.js";

export interface YouTubeTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

function oauthClient(tokens?: YouTubeTokens) {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.youtubeRedirectUri,
  );
  if (tokens) {
    client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate,
    });
  }
  return client;
}

export function buildYouTubeAuthUrl(): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
  });
}

export async function exchangeYouTubeCode(code: string): Promise<YouTubeTokens> {
  const { tokens } = await oauthClient().getToken(code);
  return {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined,
  };
}

export interface VideoUpload {
  sourceUrl: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: "private" | "unlisted" | "public";
}

/**
 * Posts a video Jarvis (or the user) already has, packaged with the
 * content subagent's title/description/tags. Takes a source URL rather
 * than an uploaded file: fetching it server-side avoids adding a
 * multipart-upload dependency for what's still a single-user backend.
 * This never generates footage — it only packages and posts video that
 * already exists at `sourceUrl`.
 */
export async function uploadVideo(tokens: YouTubeTokens, video: VideoUpload): Promise<{ id: string; url: string }> {
  const auth = oauthClient(tokens);
  const youtube = google.youtube({ version: "v3", auth });

  const sourceRes = await fetch(video.sourceUrl);
  if (!sourceRes.ok || !sourceRes.body) {
    throw new Error(`Couldn't fetch the source video (${sourceRes.status}).`);
  }

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: video.title,
        description: video.description,
        tags: video.tags,
      },
      status: {
        privacyStatus: video.privacyStatus ?? "private",
      },
    },
    media: {
      body: Readable.fromWeb(sourceRes.body as import("stream/web").ReadableStream),
    },
  });

  const id = res.data.id ?? "";
  return { id, url: id ? `https://youtube.com/watch?v=${id}` : "" };
}
