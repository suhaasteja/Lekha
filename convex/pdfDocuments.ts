import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const isGuestDocument = (ownerId: string) => ownerId.startsWith("guest:");
const asGuestOwnerId = (guestId: string) => `guest:${guestId}`;

async function canAccessDocument(ctx: any, documentId: string) {
  const document = await ctx.db.get(documentId);
  if (!document) {
    return false;
  }

  if (isGuestDocument(document.ownerId)) {
    return true;
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return false;
  }

  const organizationId = (identity.organization_id ?? undefined) as string | undefined;
  const isOwner = document.ownerId === identity.subject;
  const isOrgMember = !!(
    document.organizationId &&
    document.organizationId === organizationId
  );

  return isOwner || isOrgMember;
}

export const upload = mutation({
  args: {
    documentId: v.id("documents"),
    fileName: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    extractedText: v.string(),
    pageCount: v.number(),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowed = await canAccessDocument(ctx, args.documentId);
    if (!allowed) {
      throw new ConvexError("Unauthorized");
    }

    const identity = await ctx.auth.getUserIdentity();

    const pdfId = await ctx.db.insert("pdfDocuments", {
      documentId: args.documentId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      storageId: args.storageId,
      extractedText: args.extractedText,
      pageCount: args.pageCount,
      uploadedBy: identity?.subject ?? asGuestOwnerId(args.guestId ?? "anonymous"),
      uploadedAt: Date.now(),
      organizationId: typeof identity?.organization_id === "string" ? identity.organization_id : undefined,
    });

    return pdfId;
  },
});

export const getByDocument = query({
  args: { documentId: v.id("documents"), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const allowed = await canAccessDocument(ctx, args.documentId);
    if (!allowed) {
      return [];
    }

    return await ctx.db
      .query("pdfDocuments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});

export const searchContext = query({
  args: {
    documentId: v.id("documents"),
    searchQuery: v.string(),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowed = await canAccessDocument(ctx, args.documentId);
    if (!allowed) {
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
  args: { pdfId: v.id("pdfDocuments"), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const pdf = await ctx.db.get(args.pdfId);
    if (!pdf) {
      throw new ConvexError("PDF not found");
    }

    const allowed = await canAccessDocument(ctx, pdf.documentId);
    if (!allowed) {
      throw new ConvexError("Unauthorized");
    }

    await ctx.storage.delete(pdf.storageId);
    await ctx.db.delete(args.pdfId);

    return { success: true };
  },
});

export const getById = query({
  args: { pdfId: v.id("pdfDocuments"), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const pdf = await ctx.db.get(args.pdfId);
    if (!pdf) {
      return null;
    }

    const allowed = await canAccessDocument(ctx, pdf.documentId);
    if (!allowed) {
      return null;
    }

    return pdf;
  },
});
