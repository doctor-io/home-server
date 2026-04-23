import { NextResponse } from "next/server";
import { buildAuthUrl, generateState, GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = generateState();
    const url = buildAuthUrl(state);

    const cookieStore = await cookies();
    cookieStore.set("gd_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to start Google Drive auth", code: "internal_error" }, { status: 500 });
  }
}
