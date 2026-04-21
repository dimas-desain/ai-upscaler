export default function Footer() {
  return (
    <footer className="border-t border-zinc-900 py-4 text-xs text-zinc-500">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p>(c) {new Date().getFullYear()} AI Upscaler. Self-hosted.</p>
        <p>Tip: set `REAL_ESRGAN_PATH` to enable true upscaling.</p>
      </div>
    </footer>
  );
}

