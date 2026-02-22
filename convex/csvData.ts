import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const upload = mutation({
  args: {
    documentId: v.id("documents"),
    fileName: v.string(),
    headers: v.array(v.string()),
    rows: v.array(v.array(v.any())),
    rowCount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const csvId = await ctx.db.insert("csvData", {
      documentId: args.documentId,
      fileName: args.fileName,
      headers: args.headers,
      rows: args.rows,
      rowCount: args.rowCount,
      uploadedBy: identity.subject,
      uploadedAt: Date.now(),
      organizationId: typeof identity.organizationId === "string" ? identity.organizationId : undefined,
    });

    return csvId;
  },
});

export const getByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const csvFiles = await ctx.db
      .query("csvData")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return csvFiles;
  },
});

export const getById = query({
  args: { csvId: v.id("csvData") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const csv = await ctx.db.get(args.csvId);
    if (!csv) {
      return null;
    }

    // Verify access
    if (
      csv.uploadedBy !== identity.subject &&
      (!csv.organizationId || csv.organizationId !== identity.organizationId)
    ) {
      return null;
    }

    return csv;
  },
});

export const deleteById = mutation({
  args: { csvId: v.id("csvData") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const csv = await ctx.db.get(args.csvId);
    if (!csv) {
      throw new Error("CSV not found");
    }

    // Verify user has access (owner or org member)
    if (
      csv.uploadedBy !== identity.subject &&
      (!csv.organizationId || csv.organizationId !== identity.organizationId)
    ) {
      throw new Error("Unauthorized");
    }

    // Delete from database
    await ctx.db.delete(args.csvId);

    return { success: true };
  },
});
