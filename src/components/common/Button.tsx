import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-white shadow-[0_10px_22px_rgba(59,91,219,0.18)] hover:-translate-y-px hover:bg-primary/95 hover:shadow-[0_14px_26px_rgba(59,91,219,0.22)]",
        secondary:
          "border-border/90 bg-white text-slate-700 shadow-sm hover:border-primary/20 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
        ghost:
          "border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900",
        danger:
          "border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:-translate-y-px hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300",
        success:
          "border-emerald-600 bg-emerald-600 text-white shadow-[0_10px_22px_rgba(5,150,105,0.18)] hover:-translate-y-px hover:bg-emerald-700"
      },
      size: {
        sm: "h-10 px-4 text-[13px]",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-11 w-11 p-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: React.ReactNode;
  lockOnClick?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled,
      loading = false,
      loadingText,
      lockOnClick = true,
      onClick,
      variant,
      size,
      ...props
    },
    ref
  ) => {
    const [asyncPending, setAsyncPending] = React.useState(false);
    const [clickLocked, setClickLocked] = React.useState(false);
    const lockTimerRef = React.useRef<number | null>(null);
    const isBusy = loading || asyncPending;
    const isDisabled = disabled || isBusy || clickLocked;

    React.useEffect(
      () => () => {
        if (lockTimerRef.current) {
          window.clearTimeout(lockTimerRef.current);
        }
      },
      []
    );

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (isDisabled) {
        event.preventDefault();
        return;
      }

      const result = onClick?.(event) as Promise<unknown> | void;

      if (!lockOnClick || event.defaultPrevented) {
        return;
      }

      if (result && typeof result.then === "function") {
        setAsyncPending(true);
        void result.finally(() => setAsyncPending(false)).catch(() => undefined);
        return;
      }

      setClickLocked(true);
      if (lockTimerRef.current) {
        window.clearTimeout(lockTimerRef.current);
      }
      lockTimerRef.current = window.setTimeout(() => {
        setClickLocked(false);
        lockTimerRef.current = null;
      }, 650);
    };

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), isBusy && "relative overflow-hidden", className)}
        disabled={isDisabled}
        aria-busy={isBusy}
        data-loading={isBusy ? "true" : undefined}
        onClick={handleClick}
        {...props}
      >
        {isBusy ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        <span>{isBusy && loadingText ? loadingText : children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
