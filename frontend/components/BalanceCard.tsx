"use client";

interface BalanceCardProps {
  letter: "A" | "B";
  title: string;
  subtitle: string;
  selected?: boolean;
  onClick: () => void;
}

const COLORS = {
  A: { bg: "#0099DD", hover: "rgba(0,153,221,0.55)" },
  B: { bg: "#E07A5F", hover: "rgba(224,122,95,0.5)" },
};

export default function BalanceCard({
  letter,
  title,
  subtitle,
  selected = false,
  onClick,
}: BalanceCardProps) {
  const c = COLORS[letter];
  return (
    <button
      onClick={onClick}
      className="relative cursor-pointer text-left bg-[#F7F8FA] border-2 rounded-2xl p-5 xs:p-6 min-h-[160px] xs:min-h-[184px] flex flex-col gap-3 xs:gap-3.5 transition-all duration-150 hover:-translate-y-1 hover:scale-[1.035]"
      style={{
        borderColor: selected ? c.bg : "#ECECEC",
        boxShadow: selected ? `0 8px 24px -8px ${c.hover}` : "none",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = c.bg;
        e.currentTarget.style.boxShadow = `0 18px 34px -14px ${c.hover}`;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = selected ? c.bg : "#ECECEC";
        e.currentTarget.style.boxShadow = selected ? `0 8px 24px -8px ${c.hover}` : "none";
      }}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: c.bg }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
      <span
        className="w-[38px] h-[38px] rounded-full text-white flex items-center justify-center text-[17px] font-extrabold"
        style={{ background: c.bg }}
      >
        {letter}
      </span>
      <div>
        <p
          className="text-[17px] font-extrabold mb-1.5 leading-tight"
          style={{ color: c.bg }}
        >
          {title}
        </p>
        <p className="text-[13px] leading-relaxed text-subtle">{subtitle}</p>
      </div>
    </button>
  );
}
