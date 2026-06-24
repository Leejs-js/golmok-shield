"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";

export default function SiteHeader() {
  const router = useRouter();

  const handleLogoClick = () => {
    sessionStorage.removeItem("answers");
    sessionStorage.removeItem("recommendation");
    sessionStorage.removeItem("onboardingDone");
    sessionStorage.removeItem("worstRevealed");
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 h-16 bg-[#0099DD] flex items-center justify-center px-5">
      <button onClick={handleLogoClick} className="bg-transparent border-none cursor-pointer p-0">
        <img
          src="/golmok-lockup.png"
          alt="골목방패 로고"
          className="h-8 w-auto brightness-0 invert"
        />
      </button>
    </header>
  );
}
