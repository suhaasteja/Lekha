import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

/**
 * Visualization Catalog
 *
 * Defines components and actions available for AI-generated data visualizations.
 * Enhanced with more chart types, UI components, and data display options.
 */
export const vizCatalog = defineCatalog(schema, {
  components: {
    // Layout
    Stack: {
      props: z.object({
        direction: z.enum(["horizontal", "vertical"]).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
        wrap: z.boolean().nullable(),
      }),
      slots: ["default"],
      description: "Flex layout container for arranging components horizontally or vertically",
      example: { direction: "vertical", gap: "md" },
    },

    Grid: {
      props: z.object({
        columns: z.enum(["1", "2", "3", "4"]).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      slots: ["default"],
      description: "Grid layout for arranging components in columns. Use for dashboard layouts with multiple cards/charts.",
      example: { columns: "3", gap: "md" },
    },

    Card: {
      props: z.object({
        title: z.string().nullable(),
        description: z.string().nullable(),
      }),
      slots: ["default"],
      description: "Container card with optional title and description. Use for grouping related content.",
      example: { title: "Sales Overview", description: "Monthly performance metrics" },
    },

    // Typography
    Heading: {
      props: z.object({
        text: z.string(),
        level: z.enum(["h1", "h2", "h3", "h4"]).nullable(),
      }),
      description: "Section heading for titles",
      example: { text: "Sales Dashboard", level: "h2" },
    },

    Text: {
      props: z.object({
        content: z.string(),
        muted: z.boolean().nullable(),
        size: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      description: "Text content for descriptions and labels",
      example: { content: "Total revenue for Q1 2024", muted: true },
    },

    // Stats & Metrics
    StatCard: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        change: z.number().nullable(),
        changeLabel: z.string().nullable(),
        format: z.enum(["number", "currency", "percent"]).nullable(),
        icon: z.enum(["trending-up", "trending-down", "dollar", "users", "chart", "package"]).nullable(),
      }),
      description: "Statistic card for displaying a single KPI value. IMPORTANT: The 'value' must be a static number or string - do NOT use data binding here. Charts handle data aggregation, StatCard just displays a fixed metric. If you don't know the exact value, use a placeholder like 0 or 'N/A'.",
      example: {
        label: "Total Revenue",
        value: 125000,
        change: 12.5,
        changeLabel: "vs last month",
        format: "currency",
        icon: "dollar",
      },
    },

    // Data Display
    Table: {
      props: z.object({
        data: z.array(z.record(z.string(), z.unknown())),
        columns: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            format: z.enum(["text", "number", "currency", "date", "percent"]).nullable(),
          })
        ),
        maxRows: z.number().nullable(),
        sortable: z.boolean().nullable(),
      }),
      description:
        "Data table for displaying CSV data. Use { $state: '/csvData/data' } to bind to loaded CSV data. Specify columns to show with key matching CSV header names. Optionally set format for each column.",
      example: {
        data: { $state: "/csvData/data" },
        columns: [
          { key: "product", label: "Product", format: "text" },
          { key: "revenue", label: "Revenue", format: "currency" },
        ],
        maxRows: 10,
      },
    },

    Badge: {
      props: z.object({
        text: z.string(),
        variant: z.enum(["default", "success", "warning", "error", "info"]).nullable(),
      }),
      description: "Small badge for status indicators or labels",
      example: { text: "Active", variant: "success" },
    },

    // Charts
    BarChart: {
      props: z.object({
        title: z.string().nullable(),
        data: z.array(z.record(z.string(), z.unknown())),
        xKey: z.string(),
        yKey: z.string(),
        aggregate: z.enum(["sum", "count", "avg", "min", "max"]).nullable(),
        color: z.string().nullable(),
        height: z.number().nullable(),
        horizontal: z.boolean().nullable(),
      }),
      description:
        "Bar chart visualization. Use { $state: '/csvData/data' } to bind data. xKey is the category field (e.g., 'product'), yKey is the numeric field (e.g., 'revenue'). Use aggregate='sum' to sum values by category, 'count' to count occurrences, 'avg' to average, 'min' or 'max' for extremes. Set horizontal=true for horizontal bars.",
      example: {
        title: "Revenue by Product",
        data: { $state: "/csvData/data" },
        xKey: "product",
        yKey: "revenue",
        aggregate: "sum",
      },
    },

    LineChart: {
      props: z.object({
        title: z.string().nullable(),
        data: z.array(z.record(z.string(), z.unknown())),
        xKey: z.string(),
        yKey: z.string(),
        aggregate: z.enum(["sum", "count", "avg", "min", "max"]).nullable(),
        color: z.string().nullable(),
        height: z.number().nullable(),
        smooth: z.boolean().nullable(),
        area: z.boolean().nullable(),
      }),
      description:
        "Line chart visualization. Use { $state: '/csvData/data' } to bind data. xKey is typically a date or time field, yKey is the numeric value field. Use aggregate to combine data points. Set smooth=true for curved lines, area=true to fill below the line.",
      example: {
        title: "Revenue Over Time",
        data: { $state: "/csvData/data" },
        xKey: "date",
        yKey: "revenue",
        aggregate: "sum",
      },
    },

    AreaChart: {
      props: z.object({
        title: z.string().nullable(),
        data: z.array(z.record(z.string(), z.unknown())),
        xKey: z.string(),
        yKey: z.string(),
        aggregate: z.enum(["sum", "count", "avg", "min", "max"]).nullable(),
        color: z.string().nullable(),
        height: z.number().nullable(),
        stacked: z.boolean().nullable(),
      }),
      description:
        "Area chart for showing volume or cumulative values over time. Use { $state: '/csvData/data' } to bind data. Great for showing trends with emphasis on magnitude.",
      example: {
        title: "Sales Volume Over Time",
        data: { $state: "/csvData/data" },
        xKey: "date",
        yKey: "sales",
        aggregate: "sum",
      },
    },

    PieChart: {
      props: z.object({
        title: z.string().nullable(),
        data: z.array(z.record(z.string(), z.unknown())),
        nameKey: z.string(),
        valueKey: z.string(),
        aggregate: z.enum(["sum", "count", "avg"]).nullable(),
        donut: z.boolean().nullable(),
        height: z.number().nullable(),
        showLabels: z.boolean().nullable(),
        showLegend: z.boolean().nullable(),
      }),
      description:
        "Pie or donut chart for showing proportions. Use { $state: '/csvData/data' } to bind data. nameKey is the category field, valueKey is the numeric field. Set donut=true for a donut chart. Good for showing distribution of a single metric across categories.",
      example: {
        title: "Revenue by Region",
        data: { $state: "/csvData/data" },
        nameKey: "region",
        valueKey: "revenue",
        aggregate: "sum",
        donut: true,
        showLegend: true,
      },
    },

    ScatterChart: {
      props: z.object({
        title: z.string().nullable(),
        data: z.array(z.record(z.string(), z.unknown())),
        xKey: z.string(),
        yKey: z.string(),
        sizeKey: z.string().nullable(),
        colorKey: z.string().nullable(),
        height: z.number().nullable(),
      }),
      description:
        "Scatter plot for showing relationships between two numeric variables. Optionally use sizeKey to vary point sizes and colorKey to color by category.",
      example: {
        title: "Price vs Quantity",
        data: { $state: "/csvData/data" },
        xKey: "price",
        yKey: "quantity",
      },
    },

    // UI Components
    Tabs: {
      props: z.object({
        defaultValue: z.string().nullable(),
        tabs: z.array(
          z.object({
            value: z.string(),
            label: z.string(),
          })
        ),
      }),
      slots: ["default"],
      description: "Tabbed content container. Define tabs with value and label, then use TabContent children.",
      example: {
        defaultValue: "overview",
        tabs: [
          { value: "overview", label: "Overview" },
          { value: "details", label: "Details" },
        ],
      },
    },

    TabContent: {
      props: z.object({
        value: z.string(),
      }),
      slots: ["default"],
      description: "Content panel for a specific tab. The value must match a tab's value.",
      example: { value: "overview" },
    },

    Accordion: {
      props: z.object({
        type: z.enum(["single", "multiple"]).nullable(),
      }),
      slots: ["default"],
      description: "Collapsible accordion container. Use single to allow only one open, multiple for many.",
    },

    AccordionItem: {
      props: z.object({
        value: z.string(),
        title: z.string(),
      }),
      slots: ["default"],
      description: "Individual accordion panel with title and collapsible content.",
      example: { value: "section-1", title: "Revenue Breakdown" },
    },

    Separator: {
      props: z.object({
        orientation: z.enum(["horizontal", "vertical"]).nullable(),
      }),
      description: "Visual divider between content sections",
      example: { orientation: "horizontal" },
    },

    Alert: {
      props: z.object({
        variant: z.enum(["default", "info", "success", "warning", "error"]).nullable(),
        title: z.string(),
        description: z.string().nullable(),
      }),
      description: "Alert box for important messages or insights about the data",
      example: { variant: "info", title: "Insight", description: "Revenue increased 15% this quarter" },
    },

    Progress: {
      props: z.object({
        value: z.number(),
        max: z.number().nullable(),
        label: z.string().nullable(),
        showValue: z.boolean().nullable(),
      }),
      description: "Progress bar for showing completion or percentage values",
      example: { value: 75, max: 100, label: "Target Progress", showValue: true },
    },
  },

  actions: {
    loadCsvData: {
      params: z.object({
        csvId: z.string(),
      }),
      description:
        "Load CSV data from uploaded file. The csvId should match one of the available CSV files. Data will be available at state path 'csvData.data' as an array of objects where keys are column headers.",
    },
    computeAggregates: {
      params: z.object({
        fields: z.array(z.object({
          name: z.string(),
          type: z.enum(["sum", "count", "avg", "min", "max"]),
          field: z.string(),
        })),
      }),
      description:
        "Compute aggregate values from CSV data. Results available at '/csvData/aggregates/name'. Use this to compute totals, averages, etc. for StatCards.",
    },
  },
});
