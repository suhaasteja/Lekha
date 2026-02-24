"use client";

import { useState, useRef, DragEvent, useEffect } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { FileSpreadsheet, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppIdentity } from "@/hooks/use-app-identity";

export function CsvUploadBar() {
  const params = useParams();
  const documentId = params.documentId as Id<"documents">;

  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { guestId } = useAppIdentity();

  const csvFiles = useQuery(api.csvData.getByDocument, { documentId, guestId: guestId ?? undefined });
  const uploadMutation = useMutation(api.csvData.upload);
  const deleteMutation = useMutation(api.csvData.deleteById);

  // Make CSV files globally available for viz command
  useEffect(() => {
    if (csvFiles) {
      (window as Window & { __csvFiles?: typeof csvFiles }).__csvFiles = csvFiles;
    }
  }, [csvFiles]);

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please select a CSV file");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploading(true);

    try {
      // Parse CSV
      const formData = new FormData();
      formData.append("file", file);

      const parseResponse = await fetch("/api/csv/parse", {
        method: "POST",
        body: formData,
      });

      if (!parseResponse.ok) {
        const error = await parseResponse.json();
        throw new Error(error.error || "Failed to parse CSV");
      }

      const { headers, rows, rowCount } = await parseResponse.json();

      // Save to Convex
      await uploadMutation({
        documentId,
        fileName: file.name,
        headers,
        rows,
        rowCount,
        guestId: guestId ?? undefined,
      });

      toast.success(`Added ${file.name} (${rowCount} rows)`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload CSV");
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

  const handleDelete = async (csvId: Id<"csvData">, fileName: string) => {
    try {
      await deleteMutation({ csvId, guestId: guestId ?? undefined });
      toast.success(`Removed ${fileName}`);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove CSV");
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  // Show nothing if no CSVs and not dragging
  if (!csvFiles || (csvFiles.length === 0 && !isDragging && !uploading)) {
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
          accept=".csv"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-slate-600">
          <Upload className="h-3 w-3" />
          <span>Drop CSV files here to add data</span>
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
        isDragging ? "border-green-400 bg-green-50" : "border-slate-200 bg-slate-50"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <FileSpreadsheet className="h-3 w-3" />
          <span className="font-medium">Data:</span>
        </div>

        {csvFiles && csvFiles.map((csv) => (
          <div
            key={csv._id}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-300 rounded-full text-xs hover:shadow-sm transition-shadow"
          >
            <FileSpreadsheet className="h-3 w-3 text-green-600" />
            <span className="text-slate-700 max-w-[150px] truncate">{csv.fileName}</span>
            <span className="text-slate-400">({csv.rowCount})</span>
            <button
              onClick={() => handleDelete(csv._id, csv.fileName)}
              className="text-slate-400 hover:text-red-600 transition-colors"
              title="Remove data"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {uploading && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-full text-xs">
            <Loader2 className="h-3 w-3 text-green-600 animate-spin" />
            <span className="text-green-700">Uploading...</span>
          </div>
        )}

        <button
          onClick={handleClickUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          <span>Add CSV</span>
        </button>
      </div>

      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-50/90 rounded-lg border-2 border-green-400 border-dashed">
          <div className="text-sm text-green-600 font-medium">Drop CSV to add data</div>
        </div>
      )}
    </div>
  );
}
