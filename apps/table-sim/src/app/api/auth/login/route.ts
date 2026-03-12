import { NextRequest, NextResponse } from "next/server";

interface LoginRequestBody {
  passcode: string;
}

function parseLoginRequestBody(value: unknown): LoginRequestBody | null {
  if (typeof value !== "object" || value === null || !("passcode" in value)) {
    return null;
  }

  const { passcode } = value;
  return typeof passcode === "string" ? { passcode } : null;
}

export async function POST(req: NextRequest) {
  const parsedBody = parseLoginRequestBody(await req.json());
  if (!parsedBody) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const expected = process.env.COACH_APP_PASSCODE;
  if (!expected) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (parsedBody.passcode !== expected) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("coach_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
