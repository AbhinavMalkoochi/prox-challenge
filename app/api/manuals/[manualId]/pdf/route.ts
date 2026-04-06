import { NextResponse } from "next/server";

import { getManualPdfUrl, MANUALS } from "@/lib/manuals";

type RouteContext = {
  params: Promise<{
    manualId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { manualId } = await context.params;
  const manual = MANUALS.find((entry) => entry.id === manualId);

  if (!manual) {
    return new NextResponse("Manual not found.", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}${getManualPdfUrl(manualId)}`);
}
