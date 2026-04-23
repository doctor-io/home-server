import { NextResponse } from "next/server";
import { handleOAuthCallback, GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/google-drive/connected?error=access_denied", request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/google-drive/connected?error=invalid_callback", request.url));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("gd_oauth_state")?.value;

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/google-drive/connected?error=state_mismatch", request.url));
  }

  cookieStore.delete("gd_oauth_state");

  try {
    await handleOAuthCallback(code);
    return NextResponse.redirect(new URL("/google-drive/connected?success=1", request.url));
  } catch (err) {
    const msg = err instanceof GoogleDriveError ? err.code : "internal_error";
    return NextResponse.redirect(new URL(`/google-drive/connected?error=${msg}`, request.url));
  }
}
