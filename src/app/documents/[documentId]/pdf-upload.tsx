"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { FileText, Upload, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PdfUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfUploadDialog({ open, onOpenChange }: PdfUploadDialogProps) {
  const params = useParams();
  const documentId = params.documentId as Id<"documents">;

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfs = useQuery(api.pdfDocuments.getByDocument, { documentId });
  const uploadMutation = useMutation(api.pdfDocuments.upload);
  const deleteMutation = useMutation(api.pdfDocuments.deleteById);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    setUploadProgress("Extracting text from PDF...");

    try {
      // Step 1: Extract text from PDF
      const formData = new FormData();
      formData.append("file", file);

      const extractResponse = await fetch("/api/pdf/extract", {
        method: "POST",
        body: formData,
      });

      if (!extractResponse.ok) {
        const error = await extractResponse.json();
        throw new Error(error.error || "Failed to extract text from PDF");
      }

      const { text, pageCount } = await extractResponse.json();

      setUploadProgress("Uploading to storage...");

      // Step 2: Upload file to Convex storage
      const uploadUrl = await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/upload_file`, {
        method: "POST",
      });

      const { uploadToken } = await uploadUrl.json();

      const storageResponse = await fetch(uploadToken, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!storageResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      const { storageId } = await storageResponse.json();

      setUploadProgress("Saving metadata...");

      // Step 3: Save metadata to database
      await uploadMutation({
        documentId,
        fileName: file.name,
        fileSize: file.size,
        storageId: storageId as Id<"_storage">,
        extractedText: text,
        pageCount,
      });

      toast.success(`Successfully uploaded ${file.name}`);
      setUploadProgress("");

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload PDF");
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (pdfId: Id<"pdfDocuments">, fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;

    try {
      await deleteMutation({ pdfId });
      toast.success(`Deleted ${fileName}`);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete PDF");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Context Documents
          </DialogTitle>
          <DialogDescription>
            Upload PDF documents to provide context for AI-generated content in this document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Section */}
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
              id="pdf-upload-input"
            />
            <label
              htmlFor="pdf-upload-input"
              className={`cursor-pointer ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex flex-col items-center gap-2">
                {uploading ? (
                  <>
                    <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-600">{uploadProgress}</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">
                      Click to upload PDF
                    </p>
                    <p className="text-xs text-slate-500">
                      Maximum file size: 10MB
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>

          {/* List of uploaded PDFs */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">
              Uploaded PDFs ({pdfs?.length || 0})
            </h3>

            {pdfs && pdfs.length > 0 ? (
              <div className="space-y-2">
                {pdfs.map((pdf) => (
                  <div
                    key={pdf._id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {pdf.fileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatFileSize(pdf.fileSize)} • {pdf.pageCount} pages • {formatDate(pdf.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(pdf._id, pdf.fileName)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition flex-shrink-0"
                      title="Delete PDF"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-slate-500">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p>No PDFs uploaded yet</p>
                <p className="text-xs mt-1">Upload PDF documents to enable AI context search</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
