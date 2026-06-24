"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export default function GolmokLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? 24 : 32;
  return (
    <Link href="/" className="flex items-center shrink-0">
      <img
        src="/golmok-lockup.png"
        alt="골목 방패"
        className="block"
        style={{ height: h, width: "auto" }}
      />
    </Link>
  );
}
