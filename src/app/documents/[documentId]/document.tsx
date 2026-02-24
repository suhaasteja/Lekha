"use client";

import { useQuery } from "convex/react";

import { Room } from "./room";
import { Editor } from "./editor";
import { Navbar } from "./navbar";
import { Toolbar } from "./toolbar";
import { TodoPlanPanel } from "./todo-plan-panel";
import { CsvUploadBar } from "./csv-upload-bar";
// import { PdfContextBar } from "./pdf-context-bar";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useAppIdentity } from "@/hooks/use-app-identity";
import { FullscreenLoader } from "@/components/fullscreen-loader";

interface DocumentProps {
  documentId: Id<"documents">;
}

export const Document = ({ documentId }: DocumentProps) => {
  const { guestId, ready } = useAppIdentity();
  const document = useQuery(
    api.documents.getById,
    ready ? { id: documentId, guestId: guestId ?? undefined } : "skip"
  );

  if (!ready || document === undefined) {
    return <FullscreenLoader label="Loading document..." />;
  }

  if (!document) {
    return <FullscreenLoader label="Document not found or access denied." />;
  }

  return (
    <Room>
      <div className="min-h-screen bg-editor-bg">
        <div className="flex flex-col px-4 pt-2 gap-y-2 fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-xl border-b border-black/5 print:hidden">
          <Navbar data={document} />
          <Toolbar />
          <CsvUploadBar />
          {/* <PdfContextBar /> */}
        </div>
        <div className="pt-[160px] print:pt-0">
          <Editor initialContent={document.initialContent} />
        </div>
      </div>
      <TodoPlanPanel />
    </Room>
  );
};
