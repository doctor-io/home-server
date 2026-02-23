import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger"
import {
  upsertCustomStoreTemplate,
} from "@/lib/server/modules/store/custom-apps"
import { startAppLifecycleAction } from "@/lib/server/modules/store/service"

export const runtime = "nodejs"

const installCustomAppSchema = z.object({
  name: z.string().trim().min(1).max(80),
  iconUrl: z.string().trim().max(1024).optional(),
  webUiPort: z.number().int().min(1024).max(65535).optional(),
  repositoryUrl: z.string().trim().max(1024).optional(),
  sourceType: z.enum(["docker-compose", "docker-run"]),
  source: z.string().trim().min(1).max(50_000),
})

export async function POST(request: Request) {
  const requestId = createRequestId()

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.customApps.install.post",
        requestId,
      },
      async () => {
        const parsed = installCustomAppSchema.safeParse(await request.json())
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid custom app payload",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          )
        }

        const detectedOrigin = new URL(request.url)
        const webUiPort = parsed.data.webUiPort
        const webUiUrl =
          typeof webUiPort === "number"
            ? `${detectedOrigin.protocol}//${detectedOrigin.hostname}:${webUiPort}`
            : undefined

        const customTemplate = await upsertCustomStoreTemplate({
          name: parsed.data.name,
          iconUrl: parsed.data.iconUrl,
          webUiUrl,
          sourceType: parsed.data.sourceType,
          sourceText: parsed.data.source,
          repositoryUrl: parsed.data.repositoryUrl,
        })

        const operation = await startAppLifecycleAction({
          appId: customTemplate.appId,
          action: "install",
          displayName: parsed.data.name,
          webUiPort,
        })

        return NextResponse.json(
          {
            appId: customTemplate.appId,
            operationId: operation.operationId,
          },
          { status: 202 },
        )
      },
    )
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.customApps.install.post.response",
      status: "error",
      requestId,
      message: "Unable to install custom app",
      error,
    })

    return NextResponse.json(
      {
        error: "Unable to install custom app",
      },
      { status: 500 },
    )
  }
}
