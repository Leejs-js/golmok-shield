"use client";

interface ErrorCardProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export default function ErrorCard({
  title,
  description,
  actionLabel,
  onAction,
}: ErrorCardProps) {
  return (
    <div
      className="flex flex-col items-center text-center bg-white rounded-card p-8 shadow-md border border-card-border-light max-w-md mx-auto"
      role="alert"
    >
      <span className="w-14 h-14 rounded-full bg-[#FDECEE] text-status-danger flex items-center justify-center mb-4">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <h3 className="text-lg font-extrabold text-[#34454D] mb-2">{title}</h3>
      <p className="text-sm text-subtle mb-6">{description}</p>
      <button
        onClick={onAction}
        className="h-10 px-6 bg-navy text-white rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-navy-hover transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}
