import { Metadata } from "next";
import { TrendingCollections } from "@/components/collections/CollectionsList";

export const metadata: Metadata = {
  title: "Collections | Repodar",
  description: "Discover community-curated repository collections",
};

export default function CollectionsPage() {
  return (
    <div className="page-root">
      <TrendingCollections />
    </div>
  );
}
