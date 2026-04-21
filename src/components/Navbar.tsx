import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function Navbar() {
  return (
    <header className="flex items-center justify-between py-6">
      <Link href="/" className="inline-flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">AI Upscaler</div>
          <div className="text-xs text-zinc-500">Self-hosted Real-ESRGAN</div>
        </div>
      </Link>

      <div className="text-xs text-zinc-500">
        <span className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1">
          Privacy-first
        </span>
      </div>
    </header>
  );
}
