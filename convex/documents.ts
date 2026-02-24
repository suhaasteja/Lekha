import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { mutation, query } from "./_generated/server";

const asGuestOwnerId = (guestId: string) => `guest:${guestId}`;
const isGuestDocument = (ownerId: string) => ownerId.startsWith("guest:");

async function resolveActor(ctx: any, guestId?: string) {
  const user = await ctx.auth.getUserIdentity();

  if (user) {
    return {
      mode: "user" as const,
      ownerId: user.subject,
      organizationId: (user.organization_id ?? undefined) as string | undefined,
    };
  }

  if (!guestId) {
    throw new ConvexError("Unauthorized");
  }

  return {
    mode: "guest" as const,
    ownerId: asGuestOwnerId(guestId),
    organizationId: undefined,
  };
}

export const getByIds = query({
  args: { ids: v.array(v.id("documents")) },
  handler: async (ctx, { ids }) => {
    const documents = [];

    for (const id of ids) {
      const document = await ctx.db.get(id);

      if (document) {
        documents.push({ id: document._id, name: document.title });
      } else {
        documents.push({ id, name: "[Removed]" });
      }
    }

    return documents;
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    initialContent: v.optional(v.string()),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.guestId);

    return ctx.db.insert("documents", {
      title: args.title ?? "Untitled document",
      ownerId: actor.ownerId,
      organizationId: actor.organizationId,
      initialContent: args.initialContent,
    });
  },
});

export const get = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { search, paginationOpts, guestId }) => {
    const user = await ctx.auth.getUserIdentity();

    if (user) {
      const organizationId = (user.organization_id ?? undefined) as string | undefined;

      if (search && organizationId) {
        return ctx.db
          .query("documents")
          .withSearchIndex("search_title", (q) =>
            q.search("title", search).eq("organizationId", organizationId)
          )
          .paginate(paginationOpts);
      }

      if (search) {
        return ctx.db
          .query("documents")
          .withSearchIndex("search_title", (q) => q.search("title", search).eq("ownerId", user.subject))
          .paginate(paginationOpts);
      }

      if (organizationId) {
        return ctx.db
          .query("documents")
          .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
          .paginate(paginationOpts);
      }

      return ctx.db
        .query("documents")
        .withIndex("by_owner_id", (q) => q.eq("ownerId", user.subject))
        .paginate(paginationOpts);
    }

    if (!guestId) {
      throw new ConvexError("Unauthorized");
    }

    const guestOwnerId = asGuestOwnerId(guestId);

    if (search) {
      return ctx.db
        .query("documents")
        .withSearchIndex("search_title", (q) => q.search("title", search).eq("ownerId", guestOwnerId))
        .paginate(paginationOpts);
    }

    return ctx.db
      .query("documents")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", guestOwnerId))
      .paginate(paginationOpts);
  },
});

export const removeById = mutation({
  args: { id: v.id("documents"), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.guestId);
    const document = await ctx.db.get(args.id);

    if (!document) {
      throw new ConvexError("Document not found");
    }

    const isOwner = document.ownerId === actor.ownerId;
    const isOrganizationMember = !!(
      actor.mode === "user" &&
      document.organizationId &&
      document.organizationId === actor.organizationId
    );

    if (!isOwner && !isOrganizationMember) {
      throw new ConvexError("Unauthorized");
    }

    return ctx.db.delete(args.id);
  },
});

export const updateById = mutation({
  args: { id: v.id("documents"), title: v.string(), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.guestId);
    const document = await ctx.db.get(args.id);

    if (!document) {
      throw new ConvexError("Document not found");
    }

    const isOwner = document.ownerId === actor.ownerId;
    const isOrganizationMember = !!(
      actor.mode === "user" &&
      document.organizationId &&
      document.organizationId === actor.organizationId
    );

    if (!isOwner && !isOrganizationMember) {
      throw new ConvexError("Unauthorized");
    }

    return ctx.db.patch(args.id, { title: args.title });
  },
});

export const getById = query({
  args: { id: v.id("documents"), guestId: v.optional(v.string()) },
  handler: async (ctx, { id }) => {
    const document = await ctx.db.get(id);

    if (!document) {
      return null;
    }

    if (isGuestDocument(document.ownerId)) {
      return document;
    }

    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      return null;
    }

    const organizationId = (user.organization_id ?? undefined) as string | undefined;
    const isOwner = document.ownerId === user.subject;
    const isOrganizationMember = !!(
      document.organizationId &&
      document.organizationId === organizationId
    );

    if (!isOwner && !isOrganizationMember) {
      return null;
    }

    return document;
  },
});

export const getByIdForAuth = query({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});
