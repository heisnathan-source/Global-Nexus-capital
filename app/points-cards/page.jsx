"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PointsCardsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/points-card");
  }, [router]);

  return (
    <main className="mobile-shell">
      <section className="empty-document">
        <strong>Opening Points Card…</strong>
      </section>
    </main>
  );
}
