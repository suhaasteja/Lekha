import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { vizCatalog } from "@/lib/viz/catalog";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CsvFile {
  _id: string;
  fileName: string;
  headers: string[];
  rowCount: number;
  rows?: unknown[][];
  sampleRows?: unknown[][];
}

// Helper to analyze CSV structure and suggest chart types
function analyzeDataStructure(csvFiles: CsvFile[]) {
  if (!csvFiles || csvFiles.length === 0) return "";

  const analyses: string[] = [];

  for (const csv of csvFiles) {
    const headers = csv.headers as string[];
    const rowCount = csv.rowCount as number;

    // Categorize columns
    const dateColumns: string[] = [];
    const numericColumns: string[] = [];
    const categoryColumns: string[] = [];

    // Sample first few rows to infer types
    const sampleRows = (csv.sampleRows || csv.rows?.slice(0, 5) || []) as unknown[][];

    headers.forEach((header, idx) => {
      const samples = sampleRows.map((row) => row[idx]).filter(Boolean);

      // Check if it's a date column
      const isDate = samples.some((s) => {
        if (typeof s !== "string") return false;
        return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
      });

      // Check if it's numeric
      const isNumeric = samples.every((s) => {
        if (typeof s === "number") return true;
        if (typeof s === "string") {
          const cleaned = s.replace(/[$,]/g, "");
          return !isNaN(parseFloat(cleaned));
        }
        return false;
      });

      // Categorize
      if (isDate) {
        dateColumns.push(header);
      } else if (isNumeric) {
        numericColumns.push(header);
      } else {
        categoryColumns.push(header);
      }
    });

    let suggestion = `\n📊 Data Analysis for "${csv.fileName}":\n`;
    suggestion += `- Total rows: ${rowCount}\n`;

    if (dateColumns.length > 0) {
      suggestion += `- Date/time columns: ${dateColumns.join(", ")}\n`;
      suggestion += `  → Good for: LineChart, AreaChart (trends over time)\n`;
    }

    if (numericColumns.length > 0) {
      suggestion += `- Numeric columns: ${numericColumns.join(", ")}\n`;
      suggestion += `  → Good for: StatCard (totals/averages), BarChart, PieChart values\n`;
    }

    if (categoryColumns.length > 0) {
      suggestion += `- Category columns: ${categoryColumns.join(", ")}\n`;
      suggestion += `  → Good for: PieChart categories, BarChart x-axis, grouping data\n`;
    }

    // Chart recommendations
    suggestion += "\n📈 Recommended visualizations:\n";

    if (dateColumns.length > 0 && numericColumns.length > 0) {
      suggestion += `- LineChart/AreaChart: Use "${dateColumns[0]}" as xKey, "${numericColumns[0]}" as yKey with aggregate="sum"\n`;
    }

    if (categoryColumns.length > 0 && numericColumns.length > 0) {
      suggestion += `- BarChart: Use "${categoryColumns[0]}" as xKey, "${numericColumns[0]}" as yKey with aggregate="sum"\n`;
      suggestion += `- PieChart: Use "${categoryColumns[0]}" as nameKey, "${numericColumns[0]}" as valueKey with aggregate="sum"\n`;
    }

    if (numericColumns.length >= 2) {
      suggestion += `- ScatterChart: Use "${numericColumns[0]}" as xKey, "${numericColumns[1]}" as yKey\n`;
    }

    if (numericColumns.length > 0) {
      suggestion += `- StatCard: Show total/average of "${numericColumns[0]}"\n`;
    }

    analyses.push(suggestion);
  }

  return analyses.join("\n");
}

// Enhanced system prompt with visualization guidelines
function getEnhancedPrompt(csvContext: string, dataAnalysis: string) {
  const basePrompt = vizCatalog.prompt();

  const enhancedInstructions = `
${basePrompt}

## Data Visualization Guidelines

You are creating data visualizations from CSV data. The CSV data is already loaded and available at { $state: '/csvData/data' }.

### Important Rules:
1. For ALL charts (BarChart, LineChart, AreaChart, PieChart, ScatterChart, Table), ALWAYS include: "data": { "$state": "/csvData/data" }
2. Match column names EXACTLY as they appear in the CSV headers (case-sensitive)
3. Use aggregate functions when needed: "sum", "count", "avg", "min", "max"
4. For dates, use them as xKey with aggregation to group by day/month
5. Create COMPLETE dashboard layouts with multiple visualizations when appropriate
6. StatCard is for displaying single KPI values - use a static number or string, NOT data binding. For example: { "label": "Total Sales", "value": 12500, "format": "currency" }

### Best Practices:
- Start with a Heading to title the dashboard
- Use Grid or Stack layouts to organize multiple charts
- Include StatCards for key metrics at the top
- Use appropriate chart types:
  * LineChart/AreaChart for trends over time
  * BarChart for comparing categories
  * PieChart for showing proportions (use donut=true for modern look)
  * ScatterChart for relationships between two numeric variables
  * Table for detailed data display
- Add descriptive titles to all charts
- Use Card components to group related visualizations
- Include Alert components for insights or notes

### Data Context:
${csvContext}

${dataAnalysis}

### Output Format:
Generate a complete UI spec using the SpecStream format (JSONL with JSON Patch operations).
Each line should be a valid JSON object with "op", "path", and "value" fields.
Start with the root element, then add all child elements.
`;

  return enhancedInstructions;
}

export async function POST(req: Request) {
  try {
    const { prompt, context } = await req.json();

    // Build context about available CSV files
    const csvFiles = context?.csvFiles || [];
    let csvContext = "";

    const selectedFiles = context?.selectedFiles as string[] | undefined;

    if (csvFiles.length > 0) {
      if (selectedFiles && selectedFiles.length > 0) {
        csvContext = `\n## Selected CSV Data (user specified @${selectedFiles.join(', @')}):\n`;
      } else {
        csvContext = "\n## Available CSV Data:\n";
      }
      csvFiles.forEach((csv: CsvFile) => {
        csvContext += `\n### ${csv.fileName} (ID: ${csv._id})\n`;
        csvContext += `- Columns: ${csv.headers.join(", ")}\n`;
        csvContext += `- Row count: ${csv.rowCount}\n`;
      });
      csvContext += "\n**IMPORTANT:** The CSV data is already loaded at { $state: '/csvData/data' }. Reference it directly in component props.\n";
      if (csvFiles.length === 1) {
        csvContext += `\n**Note:** Only "${csvFiles[0].fileName}" is available for this visualization.\n`;
      }
    } else {
      csvContext = "\n⚠️ No CSV files available. Create a simple message asking the user to upload a CSV file first.\n";
    }

    // Analyze data structure
    const dataAnalysis = analyzeDataStructure(csvFiles);

    // Get enhanced system prompt
    const systemPrompt = getEnhancedPrompt(csvContext, dataAnalysis);

    // Build user prompt with clear instructions
    const userPrompt = `Create a data visualization dashboard based on this request:

"${prompt}"

Requirements:
1. Use the available CSV data (already loaded at $state: '/csvData/data')
2. Create an appropriate layout with multiple visualizations if the data supports it
3. Include StatCards for key metrics when relevant
4. Use the correct column names from the CSV headers
5. Apply appropriate aggregations (sum, count, avg) where needed
6. Make it visually appealing with proper titles and descriptions`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Viz generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to generate visualization",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
