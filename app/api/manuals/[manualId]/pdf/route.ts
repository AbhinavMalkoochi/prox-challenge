import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { FILES_DIRECTORY, MANUALS } from "@/lib/manuals";

type RouteContext = {
  params: Promise<{
    manualId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { manualId } = await context.params;
  const manual = MANUALS.find((entry) => entry.id === manualId);

  if (!manual) {
    return new NextResponse("Manual not found.", { status: 404 });
  }

  const pdfBuffer = await readFile(
    path.join(process.cwd(), FILES_DIRECTORY, manual.filename)
  );

  return new NextResponse(pdfBuffer, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${manual.filename}"`
    }
  });
}
