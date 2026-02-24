"use client";

import { defineRegistry } from "@json-render/react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  Area,
  AreaChart as RechartsAreaChart,
  Pie,
  PieChart as RechartsPieChart,
  Cell,
  Scatter,
  ScatterChart as RechartsScatterChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { vizCatalog } from "./catalog";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  BarChart3,
  Package,
} from "lucide-react";

// =============================================================================
// Helper Functions
// =============================================================================

function isISODate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type AggregateType = "sum" | "count" | "avg" | "min" | "max" | null | undefined;

function processChartData(
  items: Array<Record<string, unknown>>,
  xKey: string,
  yKey: string,
  aggregate: AggregateType
): { items: Array<Record<string, unknown>>; valueKey: string } {
  if (items.length === 0) {
    return { items: [], valueKey: yKey };
  }

  const firstXValue = items[0]?.[xKey];
  const isDateKey = isISODate(firstXValue);

  if (!aggregate) {
    const formatted = items.map((item) => {
      const xValue = item[xKey];
      return {
        ...item,
        label:
          isDateKey && typeof xValue === "string"
            ? formatDateLabel(xValue)
            : String(xValue ?? ""),
      };
    });
    return { items: formatted, valueKey: yKey };
  }

  const groups = new Map<string, Array<Record<string, unknown>>>();

  for (const item of items) {
    const xValue = item[xKey];
    let groupKey: string;

    if (isDateKey && typeof xValue === "string") {
      groupKey = xValue.split("T")[0] ?? xValue;
    } else {
      groupKey = String(xValue ?? "unknown");
    }

    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  const valueKey = aggregate === "count" ? "count" : yKey;
  const aggregated: Array<Record<string, unknown>> = [];
  const sortedKeys = Array.from(groups.keys()).sort();

  for (const key of sortedKeys) {
    const group = groups.get(key)!;
    let value: number;

    if (aggregate === "count") {
      value = group.length;
    } else if (aggregate === "sum") {
      value = group.reduce((sum, item) => {
        const v = item[yKey];
        return sum + (typeof v === "number" ? v : parseFloat(String(v)) || 0);
      }, 0);
    } else if (aggregate === "avg") {
      const sum = group.reduce((s, item) => {
        const v = item[yKey];
        return s + (typeof v === "number" ? v : parseFloat(String(v)) || 0);
      }, 0);
      value = group.length > 0 ? sum / group.length : 0;
    } else if (aggregate === "min") {
      value = Math.min(
        ...group.map((item) => {
          const v = item[yKey];
          return typeof v === "number" ? v : parseFloat(String(v)) || Infinity;
        })
      );
    } else if (aggregate === "max") {
      value = Math.max(
        ...group.map((item) => {
          const v = item[yKey];
          return typeof v === "number" ? v : parseFloat(String(v)) || -Infinity;
        })
      );
    } else {
      value = 0;
    }

    let label: string;
    if (isDateKey) {
      const date = new Date(key);
      label = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else {
      label = key;
    }

    aggregated.push({
      label,
      [valueKey]: value,
      _groupKey: key,
    });
  }

  return { items: aggregated, valueKey };
}

function processPieData(
  items: Array<Record<string, unknown>>,
  nameKey: string,
  valueKey: string,
  aggregate: "sum" | "count" | "avg" | null | undefined
): Array<{ name: string; value: number }> {
  if (items.length === 0) return [];

  const groups = new Map<string, number[]>();

  for (const item of items) {
    const name = String(item[nameKey] ?? "Unknown");
    const rawValue = item[valueKey];
    const numValue = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue)) || 0;

    const existing = groups.get(name) ?? [];
    existing.push(numValue);
    groups.set(name, existing);
  }

  const result: Array<{ name: string; value: number }> = [];

  for (const [name, values] of groups.entries()) {
    let aggregatedValue: number;

    if (aggregate === "count") {
      aggregatedValue = values.length;
    } else if (aggregate === "sum" || !aggregate) {
      aggregatedValue = values.reduce((a, b) => a + b, 0);
    } else if (aggregate === "avg") {
      aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
    } else {
      aggregatedValue = values.reduce((a, b) => a + b, 0);
    }

    result.push({ name, value: aggregatedValue });
  }

  return result.sort((a, b) => b.value - a.value);
}

function formatNumber(value: number, format?: "number" | "currency" | "percent" | null): string {
  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }
  if (format === "currency") {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  }
  // Default number formatting
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function formatValue(value: unknown, format?: "text" | "number" | "currency" | "date" | "percent" | null): string {
  if (value === null || value === undefined) return "";

  if (format === "currency" && typeof value === "number") {
    return formatNumber(value, "currency");
  }
  if (format === "percent" && typeof value === "number") {
    return formatNumber(value, "percent");
  }
  if (format === "date" && (typeof value === "string" || value instanceof Date)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
  if (format === "number" && typeof value === "number") {
    return formatNumber(value);
  }

  return String(value);
}

// Chart colors
const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

// =============================================================================
// Registry
// =============================================================================

export const { registry, handlers, executeAction } = defineRegistry(
  vizCatalog,
  {
    components: {
      // Layout Components
      Stack: ({ props, children }) => {
        const gapClass =
          { sm: "gap-2", md: "gap-4", lg: "gap-6" }[props.gap ?? "md"] ?? "gap-4";
        return (
          <div
            className={`flex ${props.direction === "horizontal" ? "flex-row" : "flex-col"} ${gapClass} ${props.wrap ? "flex-wrap" : ""}`}
          >
            {children}
          </div>
        );
      },

      Grid: ({ props, children }) => {
        const colClass = {
          "1": "grid-cols-1",
          "2": "grid-cols-1 md:grid-cols-2",
          "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        }[props.columns ?? "3"] ?? "grid-cols-3";
        const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[props.gap ?? "md"] ?? "gap-4";

        return (
          <div className={`grid ${colClass} ${gapClass}`}>
            {children}
          </div>
        );
      },

      Card: ({ props, children }) => (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {(props.title || props.description) && (
            <div className="px-4 py-3 border-b border-slate-100">
              {props.title && (
                <h3 className="text-sm font-semibold text-slate-800">{props.title}</h3>
              )}
              {props.description && (
                <p className="text-xs text-slate-500 mt-0.5">{props.description}</p>
              )}
            </div>
          )}
          <div className="p-4">{children}</div>
        </div>
      ),

      // Typography
      Heading: ({ props }) => {
        const Tag = props.level ?? "h2";
        const sizeClass = {
          h1: "text-2xl font-bold text-slate-900",
          h2: "text-xl font-semibold text-slate-800",
          h3: "text-lg font-semibold text-slate-800",
          h4: "text-base font-semibold text-slate-700",
        }[Tag];

        return <Tag className={sizeClass}>{props.text}</Tag>;
      },

      Text: ({ props }) => {
        const sizeClass = { sm: "text-xs", md: "text-sm", lg: "text-base" }[props.size ?? "md"] ?? "text-sm";
        return (
          <p className={`${sizeClass} ${props.muted ? "text-slate-500" : "text-slate-700"}`}>
            {props.content}
          </p>
        );
      },

      // Stats & Metrics
      StatCard: ({ props }) => {
        const value = props.value;
        const numValue = typeof value === "number" ? value : parseFloat(String(value)) || 0;
        const formattedValue = props.format ? formatNumber(numValue, props.format) : String(value);

        const changeColor = props.change !== null && props.change !== undefined
          ? props.change >= 0 ? "text-green-600" : "text-red-600"
          : "text-slate-500";

        const IconComponent = {
          "trending-up": TrendingUp,
          "trending-down": TrendingDown,
          "dollar": DollarSign,
          "users": Users,
          "chart": BarChart3,
          "package": Package,
        }[props.icon ?? "chart"] ?? BarChart3;

        return (
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {props.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formattedValue}
                </p>
                {props.change !== null && props.change !== undefined && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${changeColor}`}>
                    {props.change >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{props.change >= 0 ? "+" : ""}{props.change.toFixed(1)}%</span>
                    {props.changeLabel && (
                      <span className="text-slate-400">{props.changeLabel}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-2 bg-slate-100 rounded-lg">
                <IconComponent className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </div>
        );
      },

      // Data Display
      Table: ({ props }) => {
        const rawData = props.data;

        const items: Array<Record<string, unknown>> = Array.isArray(rawData)
          ? rawData
          : Array.isArray((rawData as Record<string, unknown>)?.data)
            ? ((rawData as Record<string, unknown>).data as Array<Record<string, unknown>>)
            : [];

        const displayItems =
          props.maxRows && items.length > props.maxRows
            ? items.slice(0, props.maxRows)
            : items;

        if (displayItems.length === 0) {
          return (
            <div className="text-center py-8 text-slate-500 text-sm">
              No data available
            </div>
          );
        }

        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {props.columns.map((col) => (
                    <th
                      key={col.key}
                      className="text-left py-2.5 px-3 font-semibold text-slate-700 text-xs uppercase tracking-wide"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {props.columns.map((col) => (
                      <td key={col.key} className="py-2.5 px-3 text-slate-600">
                        {formatValue(item[col.key], col.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {props.maxRows && items.length > props.maxRows && (
              <div className="text-xs text-slate-400 mt-2 text-center py-2 border-t border-slate-100">
                Showing {props.maxRows} of {items.length} rows
              </div>
            )}
          </div>
        );
      },

      Badge: ({ props }) => {
        const variantClass = {
          default: "bg-slate-100 text-slate-700",
          success: "bg-green-100 text-green-700",
          warning: "bg-amber-100 text-amber-700",
          error: "bg-red-100 text-red-700",
          info: "bg-blue-100 text-blue-700",
        }[props.variant ?? "default"] ?? "bg-slate-100 text-slate-700";

        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClass}`}>
            {props.text}
          </span>
        );
      },

      // Charts
      BarChart: ({ props }) => {
        const rawData = props.data;

        const rawItems: Array<Record<string, unknown>> = Array.isArray(rawData)
          ? rawData
          : Array.isArray((rawData as Record<string, unknown>)?.data)
            ? ((rawData as Record<string, unknown>).data as Array<Record<string, unknown>>)
            : [];

        const { items, valueKey } = processChartData(
          rawItems,
          props.xKey,
          props.yKey,
          props.aggregate
        );

        if (items.length === 0) {
          return (
            <div className="text-center py-8 text-slate-500 text-sm">
              No data available
            </div>
          );
        }

        return (
          <div className="w-full">
            {props.title && (
              <h3 className="text-sm font-semibold mb-3 text-slate-700">
                {props.title}
              </h3>
            )}
            <ResponsiveContainer width="100%" height={props.height ?? 300}>
              <RechartsBarChart data={items} layout={props.horizontal ? "vertical" : "horizontal"}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                {props.horizontal ? (
                  <>
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} stroke="#64748b" width={80} />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  </>
                )}
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                <Bar
                  dataKey={valueKey}
                  fill={props.color ?? "#3b82f6"}
                  radius={props.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        );
      },

      LineChart: ({ props }) => {
        const rawData = props.data;

        const rawItems: Array<Record<string, unknown>> = Array.isArray(rawData)
          ? rawData
          : Array.isArray((rawData as Record<string, unknown>)?.data)
            ? ((rawData as Record<string, unknown>).data as Array<Record<string, unknown>>)
            : [];

        const { items, valueKey } = processChartData(
          rawItems,
          props.xKey,
          props.yKey,
          props.aggregate
        );

        if (items.length === 0) {
          return (
            <div className="text-center py-8 text-slate-500 text-sm">
              No data available
            </div>
          );
        }

        const lineColor = props.color ?? "#10b981";

        return (
          <div className="w-full">
            {props.title && (
              <h3 className="text-sm font-semibold mb-3 text-slate-700">
                {props.title}
              </h3>
            )}
            <ResponsiveContainer width="100%" height={props.height ?? 300}>
              {props.area ? (
                <RechartsAreaChart data={items}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => formatNumber(value)}
                  />
                  <Area
                    type={props.smooth ? "monotone" : "linear"}
                    dataKey={valueKey}
                    stroke={lineColor}
                    fill={lineColor}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RechartsAreaChart>
              ) : (
                <RechartsLineChart data={items}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => formatNumber(value)}
                  />
                  <Line
                    type={props.smooth ? "monotone" : "linear"}
                    dataKey={valueKey}
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={{ r: 3, fill: lineColor }}
                  />
                </RechartsLineChart>
              )}
            </ResponsiveContainer>
          </div>
        );
      },

      AreaChart: ({ props }) => {
        const rawData = props.data;

        const rawItems: Array<Record<string, unknown>> = Array.isArray(rawData)
          ? rawData
          : Array.isArray((rawData as Record<string, unknown>)?.data)
            ? ((rawData as Record<string, unknown>).data as Array<Record<string, unknown>>)
            : [];

        const { items, valueKey } = processChartData(
          rawItems,
          props.xKey,
          props.yKey,
          props.aggregate
        );

        if (items.length === 0) {
          return (
            <div className="text-center py-8 text-slate-500 text-sm">
              No data available
            </div>
          );
        }

        const areaColor = props.color ?? "#8b5cf6";

        return (
          <div className="w-full">
            {props.title && (
              <h3 className="text-sm font-semibold mb-3 text-slate-700">
                {props.title}
              </h3>
            )}
            <ResponsiveContainer width="100%" height={props.height ?? 300}>
              <RechartsAreaChart data={items}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                <Area
                  type="monotone"
                  dataKey={valueKey}
                  stroke={areaColor}
                  fill={areaColor}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RechartsAreaChart>
            </ResponsiveContainer>
          </div>
        );
      },

      PieChart: ({ props }) => {
        const rawData = props.data;

        const rawItems: Array<Record<string, unknown>> = Array.isArray(rawData)
          ? rawData
          : Array.isArray((rawData as Record<string, unknown>)?.data)
            ? ((rawData as Record<string, unknown>).data as Array<Record<string, unknown>>)
            : [];

        const pieData = processPieData(rawItems, props.nameKey, props.valueKey, props.aggregate);

        if (pieData.length === 0) {
          return (
            <div className="text-center py-8 text-slate-500 text-sm">
              No data available
            </div>
          );
        }

        const innerRadius = props.donut ? "50%" : 0;

        return (
          <div className="w-full">
            {props.title && (
              <h3 className="text-sm font-semibold mb-3 text-slate-700">
                {props.title}
              </h3>
            )}
            <ResponsiveContainer width="100%" height={props.height ?? 300}>
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius="80%"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={props.showLabels !== false ? ({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  : undefined}
                  labelLine={props.showLabels !== false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                {props.showLegend && <Legend />}
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        );
      },

      ScatterChart: ({ props }) => {
        const rawData = props.data;

        const items: Array<Record<string, unknown>> = Array.isArray(rawData)
          ? rawData
          : Array.isArray((rawData as Record<string, unknown>)?.data)
            ? ((rawData as Record<string, unknown>).data as Array<Record<string, unknown>>)
            : [];

        if (items.length === 0) {
          return (
            <div className="text-center py-8 text-slate-500 text-sm">
              No data available
            </div>
          );
        }

        // Process data for scatter plot
        const scatterData = items.map((item) => ({
          x: typeof item[props.xKey] === "number" ? item[props.xKey] : parseFloat(String(item[props.xKey])) || 0,
          y: typeof item[props.yKey] === "number" ? item[props.yKey] : parseFloat(String(item[props.yKey])) || 0,
          size: props.sizeKey && item[props.sizeKey]
            ? (typeof item[props.sizeKey] === "number" ? item[props.sizeKey] : parseFloat(String(item[props.sizeKey])) || 60)
            : 60,
          category: props.colorKey ? String(item[props.colorKey]) : "default",
        }));

        // Group by category if colorKey is provided
        const categories = props.colorKey
          ? [...new Set(scatterData.map(d => d.category))]
          : ["default"];

        return (
          <div className="w-full">
            {props.title && (
              <h3 className="text-sm font-semibold mb-3 text-slate-700">
                {props.title}
              </h3>
            )}
            <ResponsiveContainer width="100%" height={props.height ?? 300}>
              <RechartsScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name={props.xKey}
                  tick={{ fontSize: 12 }}
                  stroke="#64748b"
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name={props.yKey}
                  tick={{ fontSize: 12 }}
                  stroke="#64748b"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                {categories.map((category, index) => (
                  <Scatter
                    key={category}
                    name={category}
                    data={scatterData.filter(d => d.category === category)}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
                {props.colorKey && <Legend />}
              </RechartsScatterChart>
            </ResponsiveContainer>
          </div>
        );
      },

      // UI Components
      Tabs: ({ props, children }) => {
        // Simple tabs implementation
        return (
          <div className="w-full">
            <div className="flex border-b border-slate-200 mb-4">
              {props.tabs.map((tab, i) => (
                <button
                  key={tab.value}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    i === 0 || tab.value === props.defaultValue
                      ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {children}
          </div>
        );
      },

      TabContent: ({ props, children }) => {
        // Render all tab content (visibility controlled by parent)
        return <div data-tab-value={props.value}>{children}</div>;
      },

      Accordion: ({ children }) => (
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {children}
        </div>
      ),

      AccordionItem: ({ props, children }) => (
        <details className="group">
          <summary className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
            <span className="text-sm font-medium text-slate-700">{props.title}</span>
            <svg
              className="h-4 w-4 text-slate-500 group-open:rotate-180 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 py-3 bg-white">
            {children}
          </div>
        </details>
      ),

      Separator: ({ props }) => (
        <div
          className={`bg-slate-200 ${
            props.orientation === "vertical" ? "w-px h-full" : "h-px w-full"
          }`}
        />
      ),

      Alert: ({ props }) => {
        const variantStyles = {
          default: "bg-slate-50 border-slate-200 text-slate-700",
          info: "bg-blue-50 border-blue-200 text-blue-700",
          success: "bg-green-50 border-green-200 text-green-700",
          warning: "bg-amber-50 border-amber-200 text-amber-700",
          error: "bg-red-50 border-red-200 text-red-700",
        }[props.variant ?? "default"];

        return (
          <div className={`p-4 border rounded-lg ${variantStyles}`}>
            <h4 className="text-sm font-semibold">{props.title}</h4>
            {props.description && (
              <p className="text-sm mt-1 opacity-90">{props.description}</p>
            )}
          </div>
        );
      },

      Progress: ({ props }) => {
        const max = props.max ?? 100;
        const percentage = Math.min(100, (props.value / max) * 100);

        return (
          <div className="w-full">
            {(props.label || props.showValue) && (
              <div className="flex justify-between items-center mb-1">
                {props.label && (
                  <span className="text-xs font-medium text-slate-600">{props.label}</span>
                )}
                {props.showValue && (
                  <span className="text-xs text-slate-500">{props.value}/{max}</span>
                )}
              </div>
            )}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      },
    },

    actions: {
      loadCsvData: async (params, setState) => {
        if (!params) return;
        console.log("Loading CSV data:", params.csvId);
        setState((prev) => ({
          ...prev,
          _loadingCsv: params.csvId,
        }));
      },

      computeAggregates: async (params, setState, state) => {
        if (!params) return;
        const stateObj = state as Record<string, unknown>;
        const csvDataObj = stateObj?.csvData as { data?: Array<Record<string, unknown>> } | undefined;
        const csvData = csvDataObj?.data;
        if (!csvData || !Array.isArray(csvData)) return;

        const aggregates: Record<string, number> = {};

        for (const field of params.fields) {
          const values = csvData
            .map(row => {
              const v = row[field.field];
              return typeof v === "number" ? v : parseFloat(String(v)) || 0;
            })
            .filter(v => !isNaN(v));

          if (values.length === 0) {
            aggregates[field.name] = 0;
            continue;
          }

          switch (field.type) {
            case "sum":
              aggregates[field.name] = values.reduce((a, b) => a + b, 0);
              break;
            case "count":
              aggregates[field.name] = values.length;
              break;
            case "avg":
              aggregates[field.name] = values.reduce((a, b) => a + b, 0) / values.length;
              break;
            case "min":
              aggregates[field.name] = Math.min(...values);
              break;
            case "max":
              aggregates[field.name] = Math.max(...values);
              break;
          }
        }

        setState((prev) => {
          const prevObj = prev as Record<string, unknown>;
          const prevCsvData = prevObj?.csvData as Record<string, unknown> | undefined;
          return {
            ...prevObj,
            csvData: {
              ...prevCsvData,
              aggregates,
            },
          };
        });
      },
    },
  }
);

// Fallback component for unknown types
export function Fallback({ type }: { type: string }) {
  return (
    <div className="p-4 border border-dashed border-slate-300 rounded-lg text-slate-400 text-sm">
      Unknown component: {type}
    </div>
  );
}
