interface LogoProps {
  size?: "sm" | "md" | "lg";
}

const SIZES: Record<NonNullable<LogoProps["size"]>, number> = {
  sm: 140,
  md: 160,
  lg: 180,
};

export function Logo({ size = "md" }: LogoProps) {
  return <img src="/logo.png" alt="DealApprover" width={SIZES[size]} height="auto" />;
}
