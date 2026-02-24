import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const asGuestOwnerId = (guestId: string) => `guest:${guestId}`;
const isGuestDocument = (ownerId: string) => ownerId.startsWith("guest:");

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
    headers: v.array(v.string()),
    rows: v.array(v.array(v.any())),
    rowCount: v.number(),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowed = await canAccessDocument(ctx, args.documentId);
    if (!allowed) {
      throw new ConvexError("Unauthorized");
    }

    const identity = await ctx.auth.getUserIdentity();
    const uploadedBy = identity?.subject ?? asGuestOwnerId(args.guestId ?? "anonymous");

    const csvId = await ctx.db.insert("csvData", {
      documentId: args.documentId,
      fileName: args.fileName,
      headers: args.headers,
      rows: args.rows,
      rowCount: args.rowCount,
      uploadedBy,
      uploadedAt: Date.now(),
      organizationId: typeof identity?.organization_id === "string" ? identity.organization_id : undefined,
    });

    return csvId;
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
      .query("csvData")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});

export const getById = query({
  args: { csvId: v.id("csvData"), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const csv = await ctx.db.get(args.csvId);
    if (!csv) {
      return null;
    }

    const allowed = await canAccessDocument(ctx, csv.documentId);
    if (!allowed) {
      return null;
    }

    return csv;
  },
});

export const deleteById = mutation({
  args: { csvId: v.id("csvData"), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const csv = await ctx.db.get(args.csvId);
    if (!csv) {
      throw new ConvexError("CSV not found");
    }

    const allowed = await canAccessDocument(ctx, csv.documentId);
    if (!allowed) {
      throw new ConvexError("Unauthorized");
    }

    await ctx.db.delete(args.csvId);
    return { success: true };
  },
});
