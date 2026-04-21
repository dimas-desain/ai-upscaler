import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const TMP_ROOT = process.env.UPSCALER_TMP_DIR ?? "/app/.tmp";

function getExtFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/webp") return "webp";
  return null;
}

async function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
  cwd: string // Tambahkan CWD agar binary bisa nemu folder models
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: ["ignore", "pipe", "pipe"],
      cwd: cwd // Eksekusi dari folder /app
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timeout: Proses AI memakan waktu lebih dari ${timeoutMs / 1000} detik.`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function POST(request: NextRequest) {
  const jobId = randomUUID();
  const jobDir = path.join(TMP_ROOT, jobId);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const scaleRaw = form.get("scale")?.toString();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    const ext = getExtFromMime(file.type);
    if (!ext) {
      return NextResponse.json({ error: `Format ${file.type} tidak didukung.` }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File terlalu besar (Maks 10MB)." }, { status: 413 });
    }

    const scale = Number(scaleRaw ?? "4");
    
    // Setup Folder & Path
    await mkdir(jobDir, { recursive: true });
    const inputPath = path.join(jobDir, `input.${ext}`);
    const outputPath = path.join(jobDir, "output.png");

    // Simpan file asli
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buf);

    // Konfigurasi Path
    const bin = "/app/realesrgan-ncnn-vulkan";
    const modelName = process.env.REAL_ESRGAN_MODEL ?? "realesrgan-x4plus";
    const timeoutMs = 180000; 

    // PENTING: Gunakan path model absolut atau pastikan CWD benar
    const args = [
      "-i", inputPath, 
      "-o", outputPath, 
      "-n", modelName, 
      "-s", String(scale),
      "-f", "png" // Force output png agar konsisten
    ];

    // Eksekusi AI dari folder /app (biar dia nemu folder /app/models)
    const result = await runCommand(bin, args, timeoutMs, "/app");

    if (result.code !== 0) {
      console.error("AI Error Stderr:", result.stderr);
      return NextResponse.json({ 
        error: "AI Engine gagal memproses gambar.", 
        details: result.stderr 
      }, { status: 500 });
    }

    const out = await readFile(outputPath);
    
    return new Response(out, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="upscaled-${jobId}.png"`,
        "Cache-Control": "no-store"
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    // Cleanup folder job
    rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}
