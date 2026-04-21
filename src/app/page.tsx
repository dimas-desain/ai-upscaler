"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles, Upload, X } from "lucide-react";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<2 | 3 | 4>(4);
  const [mobileTab, setMobileTab] = useState<"original" | "result">("original");
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const setSelectedFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Maksimal ukuran file 10MB.");
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setResultImage(null);
    setError(null);
    setMobileTab("original");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setSelectedFile(selectedFile);
  };

  const handleDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);

    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setSelectedFile(dropped);
  };

  const handleDragEnter: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDragOver: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const downloadName = useMemo(() => {
    const base = file?.name?.replace(/\.[^.]+$/, "") || "image";
    return `${base}-upscaled-${scale}x.png`;
  }, [file?.name, scale]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (resultImage) URL.revokeObjectURL(resultImage);
    };
  }, [preview, resultImage]);

  // Hit API Upscale (server-side Real-ESRGAN)
  const startUpscale = async () => {
    setIsUpscaling(true);
    setError(null);

    try {
      if (!file) {
        setError("Pilih gambar dulu.");
        return;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("scale", String(scale));

      const res = await fetch("/api/upscale", { method: "POST", body: form });
      if (!res.ok) {
        let message = `Upscale gagal (HTTP ${res.status}).`;
        try {
          const json = (await res.json()) as { error?: string; detail?: string };
          message = json.error || message;
          if (json.detail) message += `\n${json.detail}`;
        } catch {
          // ignore
        }
        setError(message);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (resultImage) URL.revokeObjectURL(resultImage);
      setResultImage(url);
      setMobileTab("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpscaling(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResultImage(null);
    setError(null);
  };

  return (
    <main className="flex h-full flex-col gap-5">
      {/* Mobile: tab switch biar tetap 1 viewport tanpa scroll */}
      <div className="md:hidden">
        <div className="inline-flex w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setMobileTab("original")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              mobileTab === "original" ? "bg-zinc-100 text-black" : "text-zinc-300 hover:bg-zinc-900",
            ].join(" ")}
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("result")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              mobileTab === "result" ? "bg-zinc-100 text-black" : "text-zinc-300 hover:bg-zinc-900",
            ].join(" ")}
          >
            Result
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 min-h-0">
        {/* Kolom 1: Upload / Original */}
        <div
          className={[
            "flex min-h-0 flex-col gap-4",
            mobileTab === "result" ? "hidden md:flex" : "flex",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <h3 className="ml-1 text-sm font-semibold uppercase tracking-wider text-zinc-500">Original</h3>
            <div className="inline-flex items-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
              {[2, 3, 4].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setScale(v as 2 | 3 | 4)}
                  className={[
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                    scale === v ? "bg-zinc-100 text-black" : "text-zinc-300 hover:bg-zinc-900",
                  ].join(" ")}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {!preview ? (
              <label
                className={[
                  "group relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-all cursor-pointer",
                  isDragging
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900/50",
                ].join(" ")}
                onDrop={handleDrop}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
              >
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp"
                />
                <div className="flex flex-col items-center transition-transform group-hover:scale-105">
                  <div className="mb-3 rounded-2xl bg-zinc-900 p-4 transition-colors group-hover:bg-blue-500/10 group-hover:text-blue-500">
                    <Upload className="h-8 w-8" />
                  </div>
                  <p className="font-medium">Klik untuk pilih, atau drop gambar</p>
                  <p className="mt-2 text-xs text-zinc-500">JPG, PNG, WebP (max 10MB)</p>
                </div>
              </label>
            ) : (
              <div className="relative h-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
                <img src={preview} alt="Preview" className="h-full w-full object-contain" />
                <button
                  onClick={reset}
                  className="absolute right-4 top-4 rounded-full bg-black/50 p-2 backdrop-blur-md transition-colors hover:bg-red-500"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="absolute bottom-4 left-4 rounded-2xl bg-black/50 px-3 py-2 text-xs text-zinc-100 backdrop-blur-md">
                  <div className="font-semibold">{file?.name}</div>
                  <div className="text-zinc-300">Scale: {scale}x</div>
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* Tombol tetap 1 viewport (nempel ke area input) */}
          <button
            type="button"
            disabled={!preview || isUpscaling}
            onClick={startUpscale}
            className={[
              "flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 font-bold shadow-lg transition-all",
              !preview || isUpscaling
                ? "cursor-not-allowed bg-zinc-800 text-zinc-400"
                : "bg-zinc-100 text-black hover:bg-white",
            ].join(" ")}
          >
            {isUpscaling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {isUpscaling ? "Upscaling..." : `Upscale (${scale}x)`}
          </button>
        </div>

        {/* Kolom 2: Result */}
        <div
          className={[
            "flex min-h-0 flex-col gap-4",
            mobileTab === "original" ? "hidden md:flex" : "flex",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <h3 className="ml-1 text-sm font-semibold uppercase tracking-wider text-zinc-500">HD Result</h3>
            {resultImage && !isUpscaling && (
              <a
                href={resultImage}
                download={downloadName}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-900"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
          </div>

          <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/30">
            {!resultImage && !isUpscaling && (
              <div className="text-center text-zinc-600">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Hasil akan muncul di sini</p>
                <p className="mt-1 text-xs text-zinc-500">Upload gambar lalu klik Upscale</p>
              </div>
            )}

            {isUpscaling && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-sm font-medium animate-pulse">AI sedang bekerja...</p>
              </div>
            )}

            {resultImage && !isUpscaling && (
              <>
                <img src={resultImage} alt="Result" className="h-full w-full object-contain" />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
