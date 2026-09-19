import { google } from "googleapis";
import { config } from "../config.js";

export interface EmailHighlight {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  isImportant: boolean;
  isUnread: boolean;
}

export interface GmailTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

function oauthClient(tokens: GmailTokens) {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });
  return client;
}

/**
 * Pulls the emails most worth surfacing in a daily brief: unread mail Gmail
 * itself has flagged IMPORTANT, from the last 24 hours.
 */
export async function getImportantEmails(
  tokens: GmailTokens,
  maxResults = 8,
): Promise<EmailHighlight[]> {
  const auth = oauthClient(tokens);
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: "is:important is:unread newer_than:1d",
    maxResults,
  });

  const messages = list.data.messages ?? [];
  const highlights: EmailHighlight[] = [];

  for (const message of messages) {
    if (!message.id) continue;
    const full = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = full.data.payload?.headers ?? [];
    const from = headers.find((h) => h.name === "From")?.value ?? "Unknown sender";
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
    const date = headers.find((h) => h.name === "Date")?.value ?? new Date().toISOString();
    const labelIds = full.data.labelIds ?? [];

    highlights.push({
      id: message.id,
      from,
      subject,
      snippet: full.data.snippet ?? "",
      receivedAt: date,
      isImportant: labelIds.includes("IMPORTANT"),
      isUnread: labelIds.includes("UNREAD"),
    });
  }

  return highlights;
}

export function buildAuthUrl(): string {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
}

export async function exchangeCodeForTokens(code: string): Promise<GmailTokens> {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
  const { tokens } = await client.getToken(code);
  return {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined,
  };
}
