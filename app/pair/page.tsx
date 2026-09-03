import { Suspense } from "react";
import { PairClaim } from "@/modules/onboarding/components/pair-claim";

export const dynamic = "force-dynamic";

/**
 * Where the phone lands after scanning. Its whole job is to spend the code from
 * the server's **own origin**, so the session cookie the claim returns is stored
 * for the server rather than discarded.
 *
 * The app cannot do this itself: its launcher runs on http://localhost, and a
 * cross-origin claim would need CORS on an endpoint deliberately kept narrow —
 * and would still not leave a usable cookie behind.
 */
export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PairClaim />
    </Suspense>
  );
}
