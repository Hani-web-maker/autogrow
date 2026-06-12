"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#4F8EF7] text-white hover:bg-[#3b7de8] focus-visible:ring-[#4F8EF7] shadow-sm hover:-translate-y-px active:translate-y-0",
        destructive: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500 shadow-sm",
        outline: "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#F8F9FA] focus-visible:ring-[#4F8EF7]",
        secondary: "bg-[#F8F9FA] text-[#0f172a] hover:bg-[#e2e8f0] focus-visible:ring-slate-400",
        ghost: "text-[#64748b] hover:bg-[#F8F9FA] hover:text-[#0f172a]",
        link: "text-[#4F8EF7] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
