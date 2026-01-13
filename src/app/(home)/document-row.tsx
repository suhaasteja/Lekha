import { format } from "date-fns";
import { SiGoogledocs } from "react-icons/si";
import { TableCell, TableRow } from "@/components/ui/table";

import { Doc } from "../../../convex/_generated/dataModel";
import { Building2Icon, CircleUserIcon } from "lucide-react";
import { DocumentMenu } from "./document-menu";
import { useRouter } from "next/navigation";

interface DocumentRowProps {
  document: Doc<"documents">;
  index: number;
}

export const DocumentRow = ({ document, index }: DocumentRowProps) => {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer transition hover:bg-slate-50/80 reveal-up"
      onClick={() => router.push(`/documents/${document._id}`)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <TableCell className="w-[50px]">
        <div className="size-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
          <SiGoogledocs className="size-5 fill-current" />
        </div>
      </TableCell>
      <TableCell className="font-medium md:w-[45%] text-slate-900">
        {document.title}
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:flex items-center gap-2">
        {document.organizationId ? (
          <Building2Icon className="size-4" />
        ) : (
          <CircleUserIcon className="size-4" />
        )}
        {document.organizationId ? "Organization" : "Personal"}
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">
        {format(new Date(document._creationTime), "MMM dd, yyyy")}
      </TableCell>
      <TableCell className="flex justify-end">
        <DocumentMenu
          documentId={document._id}
          title={document.title}
          onNewTab={() => window.open(`/documents/${document._id}`, "_blank")}
        />
      </TableCell>
    </TableRow>
  );
};
