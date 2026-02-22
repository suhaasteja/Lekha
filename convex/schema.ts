import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  documents: defineTable({
    title: v.string(),
    initialContent: v.optional(v.string()),
    ownerId: v.string(),
    roomId: v.optional(v.string()),
    organizationId: v.optional(v.string()),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_organization_id", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["ownerId", "organizationId"],
    }),

  pdfDocuments: defineTable({
    documentId: v.id("documents"),
    fileName: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    extractedText: v.string(),
    pageCount: v.number(),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
    organizationId: v.optional(v.string()),
  })
    .index("by_document", ["documentId"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_content", {
      searchField: "extractedText",
      filterFields: ["documentId", "organizationId"],
    }),

  csvData: defineTable({
    documentId: v.id("documents"),
    fileName: v.string(),
    headers: v.array(v.string()),
    rows: v.array(v.array(v.any())),
    rowCount: v.number(),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
    organizationId: v.optional(v.string()),
  })
    .index("by_document", ["documentId"])
    .index("by_organization", ["organizationId"]),
});
