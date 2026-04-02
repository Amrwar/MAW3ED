import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
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

  const imgEl = (
    <Image
      src="/logo.png"
      alt="موعد - MAW3ED"
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
      <Link href={href} className="flex items-center focus:outline-none">
        {imgEl}
      </Link>
    );
  }

  return imgEl;
}
