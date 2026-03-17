import { Metadata } from "next";
import { TrendingCollections } from "@/components/collections/CollectionsList";

export const metadata: Metadata = {
  title: "Collections | Repodar",
  description: "Discover community-curated repository collections",
};

export default function CollectionsPage() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <TrendingCollections />
    </div>
  );
}
