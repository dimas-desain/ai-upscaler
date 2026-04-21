import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
let isProcessing = false;

function getExtFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/webp") return "webp";
  return null;
}

async function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Upscale timeout after ${timeoutMs}ms`));
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
    return Response.json(
      { error: "Server is busy. Try again in a moment." },
      { status: 429 },
    );
  }

  isProcessing = true;
  const jobId = randomUUID();

  const tmpRoot =
    process.env.UPSCALER_TMP_DIR ?? path.join(process.cwd(), ".tmp", "upscale");
  const jobDir = path.join(tmpRoot, jobId);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const scaleRaw = form.get("scale")?.toString();

    if (!(file instanceof File)) {
      return Response.json({ error: "Missing `file`." }, { status: 400 });
    }

    const ext = getExtFromMime(file.type);
    if (!ext) {
      return Response.json(
        { error: `Unsupported image type: ${file.type || "unknown"}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: "File too large (max 10MB)." },
        { status: 413 },
      );
    }

    const scale =
      Number(scaleRaw ?? process.env.UPSCALER_SCALE ?? "4") || Number.NaN;
    if (![2, 3, 4].includes(scale)) {
      return Response.json(
        { error: "Invalid scale. Use 2, 3, or 4." },
        { status: 400 },
      );
    }

    await mkdir(jobDir, { recursive: true });
    const inputPath = path.join(jobDir, `input.${ext}`);
    const outputPath = path.join(jobDir, "output.png");

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buf);

    const bin = process.env.REAL_ESRGAN_PATH ?? "realesrgan-ncnn-vulkan";
    const model = process.env.REAL_ESRGAN_MODEL ?? "realesrgan-x4plus";
    const timeoutMs = Number(process.env.UPSCALER_TIMEOUT_MS ?? "120000");

    // Real-ESRGAN (ncnn) CLI:
    // realesrgan-ncnn-vulkan -i input -o output -n realesrgan-x4plus -s 4
    const args = ["-i", inputPath, "-o", outputPath, "-n", model, "-s", String(scale)];

    let result;
    try {
      result = await runCommand(bin, args, timeoutMs);
    } catch (err) {
      return Response.json(
        {
          error:
            "Upscaler binary failed to run. Ensure Real-ESRGAN is installed and `REAL_ESRGAN_PATH` is set.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 503 },
      );
    }

    if (result.code !== 0) {
      return Response.json(
        {
          error: "Upscale process failed.",
          code: result.code,
          stderr: result.stderr.slice(-4000),
        },
        { status: 500 },
      );
    }

    const out = await readFile(outputPath);
    return new Response(out, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="upscaled-${scale}x.png"`,
        "X-Upscale-Scale": String(scale),
        "X-Upscale-Model": model,
      },
    });
  } finally {
    // Best-effort cleanup; keep server resilient even if rm fails on Windows locks.
    void rm(jobDir, { recursive: true, force: true });
    isProcessing = false;
  }
}
