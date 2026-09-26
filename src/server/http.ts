import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireApiUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
