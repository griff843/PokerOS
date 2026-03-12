import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const authCookie = req.cookies.get("coach_auth");

  if (!authCookie || authCookie.value !== "1") {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
