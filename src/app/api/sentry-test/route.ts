import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "NEXT_PUBLIC_SENTRY_DSN is not configured in this deployment.",
      },
      { status: 503 },
    );
  }

  const eventId = Sentry.captureException(
    new Error("Cook's Kitchen Sentry verification test"),
  );
  const sent = await Sentry.flush(2000);

  return NextResponse.json({ ok: true, configured: true, sent, eventId });
}
