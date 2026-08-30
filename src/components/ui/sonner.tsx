"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // next-themes previously supplied this, but no next-themes ThemeProvider
  // is mounted anywhere in the app - its useTheme() silently fell back to
  // reading the OS colour scheme directly, ignoring the app's own toggle.
  const { resolved: theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        // No richColors: sonner's built-in variant palette is generic
        // green/red/yellow. Every variant below is themed from our own
        // brand tokens instead (navy/tomato/cream/destructive).
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-tomato group-[.toast]:text-cream",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!bg-navy group-[.toaster]:!text-cream group-[.toaster]:!border-navy",
          error:
            "group-[.toaster]:!bg-destructive group-[.toaster]:!text-destructive-foreground group-[.toaster]:!border-destructive",
          warning:
            "group-[.toaster]:!bg-tomato/10 group-[.toaster]:!text-tomato group-[.toaster]:!border-tomato/30",
          info: "group-[.toaster]:!bg-foreground/10 group-[.toaster]:!text-foreground group-[.toaster]:!border-foreground/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
