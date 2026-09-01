import { Suspense } from "react";
import { PhoneFiles } from "@/modules/phone/components/phone-files";

export const dynamic = "force-dynamic";

export default function PhoneFilesPage() {
  return (
    // The current folder is a search param, so the tree has to be a Suspense
    // boundary — useSearchParams opts the subtree into client rendering.
    <Suspense fallback={<p className="mt-8 text-center text-sm text-muted-foreground">Loading files…</p>}>
      <PhoneFiles />
    </Suspense>
  );
}
