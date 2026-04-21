import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { cn } from "@/lib/cn";

interface AvatarUploadProps {
  value?: string;
  name: string;
  disabled?: boolean;
  loading?: boolean;
  onSelect: (file: File) => void;
}

function resolveAvatar(value?: string) {
  if (!value) {
    return null;
  }

  return value;
}

export function AvatarUpload({ value, name, disabled, loading = false, onSelect }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const preview = resolveAvatar(value);
  const isDisabled = disabled || loading;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((item) => item[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        {preview ? (
          <img src={preview} alt={name} className="h-20 w-20 rounded-[24px] object-cover shadow-sm" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-primary text-lg font-semibold text-white shadow-sm">
            {initials || "?"}
          </div>
        )}
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-border/80 bg-white text-slate-600 shadow-sm transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950 dark:text-slate-300"
          aria-label="Rasm tanlash"
          aria-busy={loading}
        >
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera size={15} />}
        </button>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Profil rasmi</div>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "inline-flex items-center gap-3 rounded-2xl border border-dashed border-border bg-white/60 px-4 py-3 text-sm transition hover:border-primary/30 hover:bg-white dark:bg-slate-950/40",
            isDisabled && "cursor-not-allowed opacity-60"
          )}
          aria-busy={loading}
        >
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ImagePlus size={16} className="text-primary" />}
          <span>{loading ? "Yuklanmoqda..." : "Rasm yuklash"}</span>
        </button>
        <div className="text-xs text-slate-500">PNG, JPG yoki WEBP rasm yuklang.</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (!file) {
            return;
          }

          onSelect(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
