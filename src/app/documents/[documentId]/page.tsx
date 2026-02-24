import { Document } from "./document";
import { Id } from "../../../../convex/_generated/dataModel";

interface DocumentIdPageProps {
  params: Promise<{ documentId: Id<"documents"> }>;
}

const DocumentIdPage = async ({ params }: DocumentIdPageProps) => {
  const { documentId } = await params;

  return <Document documentId={documentId} />;
};

export default DocumentIdPage;
