"use client";

import { useState, useRef, DragEvent } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { FileText, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PdfContextBar() {
  const params = useParams();
  const documentId = params.documentId as Id<"documents">;

  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfs = useQuery(api.pdfDocuments.getByDocument, { documentId });
  const uploadMutation = useMutation(api.pdfDocuments.upload);
  const deleteMutation = useMutation(api.pdfDocuments.deleteById);

  const handleFileUpload = async (file: File) => {
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

      // Step 3: Save metadata to database
      await uploadMutation({
        documentId,
        fileName: file.name,
        fileSize: file.size,
        storageId: storageId as Id<"_storage">,
        extractedText: text,
        pageCount,
      });

      toast.success(`Added ${file.name} to context`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload PDF");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (pdfId: Id<"pdfDocuments">, fileName: string) => {
    try {
      await deleteMutation({ pdfId });
      toast.success(`Removed ${fileName} from context`);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove PDF");
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  // Show nothing if no PDFs and not dragging
  if (!pdfs || (pdfs.length === 0 && !isDragging && !uploading)) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickUpload}
        className="border-2 border-dashed border-transparent hover:border-slate-300 rounded-lg p-2 transition-all cursor-pointer group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-slate-600">
          <Upload className="h-3 w-3" />
          <span>Drop PDFs here to add context</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-2 transition-all",
        isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <FileText className="h-3 w-3" />
          <span className="font-medium">Context:</span>
        </div>

        {pdfs && pdfs.map((pdf) => (
          <div
            key={pdf._id}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-300 rounded-full text-xs hover:shadow-sm transition-shadow"
          >
            <FileText className="h-3 w-3 text-blue-600" />
            <span className="text-slate-700 max-w-[150px] truncate">{pdf.fileName}</span>
            <button
              onClick={() => handleDelete(pdf._id, pdf.fileName)}
              className="text-slate-400 hover:text-red-600 transition-colors"
              title="Remove from context"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {uploading && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs">
            <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
            <span className="text-blue-700">Uploading...</span>
          </div>
        )}

        <button
          onClick={handleClickUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          <span>Add PDF</span>
        </button>
      </div>

      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 rounded-lg border-2 border-blue-400 border-dashed">
          <div className="text-sm text-blue-600 font-medium">Drop PDF to add to context</div>
        </div>
      )}
    </div>
  );
}
