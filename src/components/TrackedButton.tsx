import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { trackEvent, type ComparisonCtaEvent } from "@/lib/analytics";

export interface TrackedButtonProps extends ButtonProps {
  event: Omit<ComparisonCtaEvent, "name">;
  asChild?: boolean;
}

export const TrackedButton = React.forwardRef<HTMLButtonElement, TrackedButtonProps>(
  ({ event, onClick, asChild = false, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      trackEvent({ name: "comparison_cta_click", ...event });
      onClick?.(e);
    };

    return <Button ref={ref} onClick={handleClick} asChild={asChild} {...props} />;
  },
);
TrackedButton.displayName = "TrackedButton";
