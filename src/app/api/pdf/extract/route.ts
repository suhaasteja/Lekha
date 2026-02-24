import { NextResponse } from "next/server";
import * as pdfParse from "pdf-parse";

// Force Node.js runtime (pdf-parse requires Node.js features)
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const pdf = pdfParse.default || pdfParse;
    const data = await pdf(buffer);

    return NextResponse.json({
      text: data.text,
      pageCount: data.numpages,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract text from PDF",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
