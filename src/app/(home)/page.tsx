"use client";

import { Suspense } from "react";
import { usePaginatedQuery } from "convex/react";

import { Navbar } from "./navbar";
import { TemplatesGallery } from "./templates-gallery";
import { DocumentsTable } from "./documents-table";

import { api } from "../../../convex/_generated/api";
import { useSearchParam } from "@/hooks/use-search-param";
import { useAppIdentity } from "@/hooks/use-app-identity";
import { FullscreenLoader } from "@/components/fullscreen-loader";

const HomeContent = ({ guestId }: { guestId: string | null }) => {
  const [search] = useSearchParam();
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.get,
    { search, guestId: guestId ?? undefined },
    { initialNumItems: 5 }
  );

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(1200px_600px_at_15%_-10%,#e6f4ff_0%,transparent_60%),radial-gradient(900px_500px_at_90%_10%,#f9ead7_0%,transparent_55%)]">
      <div className="fixed top-0 left-0 right-0 z-10 h-16 border-b border-black/5 bg-white/80 backdrop-blur-xl p-4">
        <Navbar />
      </div>
      <div className="mt-16">
        <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-16 pt-6 pb-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Your writing space, tuned for teams
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600 max-w-2xl">
            Draft, collaborate, and ship polished docs with live presence, comments, and smart
            prompts.
          </p>
        </div>
        <TemplatesGallery />
        <DocumentsTable documents={results} loadMore={loadMore} status={status} />
      </div>
    </div>
  );
};

const Home = () => {
  const { ready, guestId } = useAppIdentity();

  if (!ready) {
    return <FullscreenLoader label="Loading home..." />;
  }

  return (
    <Suspense fallback={<FullscreenLoader label="Loading home..." />}>
      <HomeContent guestId={guestId} />
    </Suspense>
  );
};

export default Home;
