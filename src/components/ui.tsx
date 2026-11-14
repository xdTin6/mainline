import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "quiet" | "danger" }) {
  return (
    <button
      type={type}
      className={cn(
        "press inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "ghost" && "border border-line bg-transparent text-fg hover:bg-elevated",
        variant === "quiet" && "bg-transparent px-2 text-muted hover:text-fg",
        variant === "danger" && "border border-line bg-transparent text-danger hover:bg-elevated",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-2 block text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

const control =
  "min-h-11 w-full rounded-sm border border-line bg-bg px-3 text-base text-fg outline-none placeholder:text-subtle";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-32 resize-y py-3 leading-normal", props.className)} />;
}

export function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-elevated", className)} />;
}
