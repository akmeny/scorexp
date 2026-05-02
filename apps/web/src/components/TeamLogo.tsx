import { useEffect, useState } from "react";

interface TeamLogoProps {
  src: string | null;
  label: string;
  size?: "sm" | "md" | "lg";
}

export function TeamLogo({ src, label, size = "md" }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className={`logoFallback ${size}`} aria-hidden="true">
        {initial}
      </span>
    );
  }

  return <img className={`teamLogo ${size}`} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
