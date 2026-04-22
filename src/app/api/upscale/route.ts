import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
let isProcessing = false;

async function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    // spawn dijalankan dengan cwd agar binary bisa menemukan folder /models
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], cwd });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Process timeout setelah ${timeoutMs}ms`));
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

export async function POST(request: Request) {
  if (isProcessing) {
    return Response.json({ error: "Server sibuk, coba lagi sebentar lagi." }, { status: 429 });
  }

  isProcessing = true;
  const jobId = randomUUID();
  const tmpRoot = "/app/.tmp"; // Path mount Coolify
  const jobDir = path.join(tmpRoot, jobId);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const scale = form.get("scale")?.toString() || "4";

    if (!(file instanceof File)) {
      return Response.json({ error: "File tidak valid." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: "File terlalu besar (Max 10MB)." }, { status: 413 });
    }

    await mkdir(jobDir, { recursive: true });
    
    const inputPath = path.join(jobDir, "input.png");
    const outputPath = path.join(jobDir, "output.png");

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buf);

    const bin = "/app/realesrgan-ncnn-vulkan";
    const model = process.env.REAL_ESRGAN_MODEL ?? "realesrgan-x4plus";
    const timeoutMs = 180000; // 3 menit

    // FLAG KRUSIAL: -g -1 memaksa penggunaan CPU
    const args = [
      "-i", inputPath,
      "-o", outputPath,
      "-n", model,
      "-s", scale,
      "-g", "-1", 
      "-f", "png"
    ];

    const result = await runCommand(bin, args, timeoutMs, "/app");

    if (result.code !== 0) {
      console.error("AI Engine Error:", result.stderr);
      return Response.json({ error: "AI Gagal memproses.", detail: result.stderr }, { status: 500 });
    }

    const out = await readFile(outputPath);
    
    return new Response(out, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="upscaled-${jobId}.png"`,
      },
    });

  } catch (err: any) {
    console.error("Route Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    // Cleanup folder job
    rm(jobDir, { recursive: true, force: true }).catch(() => {});
    isProcessing = false;
  }
}
