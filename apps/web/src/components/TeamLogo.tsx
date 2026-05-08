import { useEffect, useState } from "react";

interface TeamLogoProps {
  src: string | null;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "team" | "flag";
}

export function TeamLogo({ src, label, size = "md", variant = "team" }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  const variantClass = variant === "flag" ? "countryFlagLogo" : "";
  const className = ["teamLogo", size, variantClass].filter(Boolean).join(" ");
  const fallbackClassName = ["logoFallback", size, variantClass, variant === "flag" ? "countryFlagFallback" : ""]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className={fallbackClassName} aria-hidden="true">
        {initial}
      </span>
    );
  }

  return <img className={className} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
