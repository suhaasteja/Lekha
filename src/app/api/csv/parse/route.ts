import { NextResponse } from "next/server";
import Papa from "papaparse";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 10000; // Limit rows to prevent huge datasets

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json({ error: "File must be a CSV" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Read file as text
    const text = await file.text();

    // Parse CSV
    const parseResult = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: true, // Auto-convert numbers
    });

    if (parseResult.errors.length > 0) {
      console.error("CSV parse errors:", parseResult.errors);
      return NextResponse.json(
        {
          error: "Failed to parse CSV",
          details: parseResult.errors[0]?.message,
        },
        { status: 400 }
      );
    }

    const allRows = parseResult.data as unknown[][];

    if (allRows.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // First row is headers
    const headers = allRows[0] as string[];
    const dataRows = allRows.slice(1);

    if (dataRows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          error: `CSV has too many rows (max ${MAX_ROWS})`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      headers,
      rows: dataRows,
      rowCount: dataRows.length,
      fileName: file.name,
    });
  } catch (error) {
    console.error("CSV parsing error:", error);
    return NextResponse.json(
      {
        error: "Failed to parse CSV",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
