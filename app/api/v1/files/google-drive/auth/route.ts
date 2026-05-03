import { NextResponse } from "next/server";
import { buildAuthUrl, generateState, GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const state = generateState();
    const url = await buildAuthUrl(state);

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
      return NextResponse.redirect(`${origin}/google-drive/connected?error=${encodeURIComponent(error.message)}`);
    }
    return NextResponse.redirect(`${origin}/google-drive/connected?error=${encodeURIComponent("Failed to start Google Drive auth")}`);
  }
}
