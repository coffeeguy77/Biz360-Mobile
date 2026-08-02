import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const LOGO_URL = "https://res.cloudinary.com/dzx6x1hou/image/upload/v1785661117/Exit360_logo.svg";

/**
 * EXIT360 brand mark. The logo is an SVG rendered through a CSS mask so it takes
 * the current text colour — i.e. it is fully theme-driven (change the colour
 * theme and the logo recolours with it). Uses `currentColor` by default, or the
 * active theme gradient when `gradient` is set.
 *
 * The SVG's natural aspect ratio is detected at runtime so the mark is sized
 * correctly whether it's a wide wordmark or a square icon.
 */
export function Logo({
  height = 30,
  gradient = false,
  className = "",
  ariaLabel = "EXIT360",
}: {
  height?: number;
  gradient?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [ratio, setRatio] = useState<number>(4.4); // sensible wordmark default until measured

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = LOGO_URL;
  }, []);

  const style: CSSProperties = {
    height,
    width: Math.round(height * ratio),
    WebkitMaskImage: `url("${LOGO_URL}")`,
    maskImage: `url("${LOGO_URL}")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "left center",
    maskPosition: "left center",
    ...(gradient
      ? { backgroundImage: "linear-gradient(100deg, hsl(var(--grad-from)), hsl(var(--grad-via)), hsl(var(--grad-to)))" }
      : { backgroundColor: "currentColor" }),
  };

  return <span role="img" aria-label={ariaLabel} className={cn("inline-block align-middle flex-shrink-0", className)} style={style} />;
}
