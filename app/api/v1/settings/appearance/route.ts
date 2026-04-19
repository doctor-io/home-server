import { NextResponse } from "next/server";
import { db } from "@/lib/server/db/drizzle";
import { settings } from "@/lib/server/db/schema";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  sanitizeAppearanceSettings,
  type AppearanceSettings,
} from "@/lib/desktop/appearance";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

async function getAppearance(): Promise<AppearanceSettings> {
  const rows = await db.select().from(settings).where(eq(settings.id, "singleton")).limit(1);
  if (rows.length === 0 || !rows[0].appearanceJson) {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
  return sanitizeAppearanceSettings(rows[0].appearanceJson);
}

export async function GET() {
  try {
    const appearance = await getAppearance();
    return NextResponse.json({ data: appearance });
  } catch {
    return NextResponse.json({ data: DEFAULT_APPEARANCE_SETTINGS });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const appearance = sanitizeAppearanceSettings(body);

    await db
      .insert(settings)
      .values({ id: "singleton", appearanceJson: appearance })
      .onConflictDoUpdate({
        target: settings.id,
        set: { appearanceJson: appearance, updatedAt: new Date() },
      });

    return NextResponse.json({ data: appearance });
  } catch {
    return NextResponse.json({ error: "Failed to save appearance" }, { status: 500 });
  }
}
