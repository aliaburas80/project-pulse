import type { Request, Response } from "express";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import type { Credentials } from "google-auth-library";

export interface AppSession {
  googleTokens?: Credentials;
  googleEmail?: string;
  oauthState?: string;
}

declare module "iron-session" {
  interface IronSessionData extends AppSession {}
}

const isProduction = process.env.NODE_ENV === "production";
const fallbackPassword = "development-only-password-change-before-production";

export const sessionOptions: SessionOptions = {
  cookieName: "project_pulse_session",
  password: process.env.SESSION_PASSWORD || fallbackPassword,
  cookieOptions: {
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  }
};

export function session(req: Request, res: Response): Promise<IronSession<AppSession>> {
  return getIronSession<AppSession>(req, res, sessionOptions);
}

export function sessionIsSafe(): boolean {
  return !isProduction || Boolean(process.env.SESSION_PASSWORD && process.env.SESSION_PASSWORD.length >= 32);
}
