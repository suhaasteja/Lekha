import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId") as Id<"documents"> | null;

    if (!documentId) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // Note: This won't have auth context, so it will return empty array
    // In a production app, you'd need to pass auth tokens
    // For now, this is just a helper - the real data comes from the component
    const csvFiles = await convex.query(api.csvData.getByDocument, { documentId });

    return NextResponse.json({ csvFiles });
  } catch (error) {
    console.error("Failed to list CSV files:", error);
    return NextResponse.json({ csvFiles: [] });
  }
}
