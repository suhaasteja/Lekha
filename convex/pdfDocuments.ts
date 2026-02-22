import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const upload = mutation({
  args: {
    documentId: v.id("documents"),
    fileName: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    extractedText: v.string(),
    pageCount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const pdfId = await ctx.db.insert("pdfDocuments", {
      documentId: args.documentId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      storageId: args.storageId,
      extractedText: args.extractedText,
      pageCount: args.pageCount,
      uploadedBy: identity.subject,
      uploadedAt: Date.now(),
      organizationId: typeof identity.organizationId === "string" ? identity.organizationId : undefined,
    });

    return pdfId;
  },
});

export const getByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const pdfs = await ctx.db
      .query("pdfDocuments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return pdfs;
  },
});

export const searchContext = query({
  args: {
    documentId: v.id("documents"),
    searchQuery: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const results = await ctx.db
      .query("pdfDocuments")
      .withSearchIndex("search_content", (q) =>
        q.search("extractedText", args.searchQuery).eq("documentId", args.documentId)
      )
      .take(5);

    return results.map((pdf) => ({
      pdfId: pdf._id,
      fileName: pdf.fileName,
      snippet: pdf.extractedText.substring(0, 500),
      fullText: pdf.extractedText,
    }));
  },
});

export const deleteById = mutation({
  args: { pdfId: v.id("pdfDocuments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const pdf = await ctx.db.get(args.pdfId);
    if (!pdf) {
      throw new Error("PDF not found");
    }

    // Verify user has access (owner or org member)
    if (
      pdf.uploadedBy !== identity.subject &&
      (!pdf.organizationId || pdf.organizationId !== identity.organizationId)
    ) {
      throw new Error("Unauthorized");
    }

    // Delete from storage
    await ctx.storage.delete(pdf.storageId);

    // Delete from database
    await ctx.db.delete(args.pdfId);

    return { success: true };
  },
});

export const getById = query({
  args: { pdfId: v.id("pdfDocuments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const pdf = await ctx.db.get(args.pdfId);
    if (!pdf) {
      return null;
    }

    // Verify access
    if (
      pdf.uploadedBy !== identity.subject &&
      (!pdf.organizationId || pdf.organizationId !== identity.organizationId)
    ) {
      return null;
    }

    return pdf;
  },
});
