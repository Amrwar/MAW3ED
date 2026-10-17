import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * Where the logo links. Defaults to the home page, which means Logo
   * renders its own <a> — so do not wrap it in another one. The company
   * page did, and an <a> inside an <a> is invalid HTML that made React
   * throw a hydration error on every load.
   *
   * Pass href="" for a logo that is only a picture.
   */
  href?: string;
  showText?: boolean;
  variant?: "default" | "white";
}

const sizeMap = {
  sm: { width: 130, height: 56  },
  md: { width: 170, height: 72  },
  lg: { width: 220, height: 94  },
};

export default function Logo({
  className,
  size = "md",
  href = "/",
  variant = "default",
}: LogoProps) {
  const dims = sizeMap[size];

  const name = "موعد - Maw3ed";

  // As a link, the name goes on the <a> itself and the picture is
  // decorative, so the control is named whatever reads it — a checker
  // that looks at the link alone found it unnamed.
  const imgEl = (
    <Image
      src="/logo.png"
      alt={href ? "" : name}
      width={dims.width}
      height={dims.height}
      className={cn(
        "object-contain",
        variant === "white" && "brightness-0 invert",
        className
      )}
      priority
    />
  );

  if (href) {
    return (
      <Link href={href} aria-label={name} className="flex items-center">
        {imgEl}
      </Link>
    );
  }

  return imgEl;
}
