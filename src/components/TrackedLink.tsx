import * as React from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { trackEvent, type ComparisonCtaEvent } from "@/lib/analytics";

export interface TrackedLinkProps extends LinkProps {
  event: Omit<ComparisonCtaEvent, "name">;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  className?: string;
  children?: React.ReactNode;
}

export const TrackedLink = React.forwardRef<HTMLAnchorElement, TrackedLinkProps>(
  ({ event, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackEvent({ name: "comparison_cta_click", ...event });
      onClick?.(e);
    };

    return <Link ref={ref} onClick={handleClick} {...props} />;
  },
);
TrackedLink.displayName = "TrackedLink";
