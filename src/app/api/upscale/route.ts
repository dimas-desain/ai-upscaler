import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const scale = Number(formData.get("scale") || "2"); // Default 2x biar gak pecah banget

    if (!file) return NextResponse.json({ error: "File missing" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

    // 1. Convert file ke Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Ambil metadata gambar asli (buat hitung resolusi baru)
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Gagal membaca dimensi gambar");
    }

    // 3. Eksekusi Processing (Resize + Sharpen)
    const processedBuffer = await image
  .resize({
    width: metadata.width * scale,
    kernel: sharp.kernel.lanczos3,
  })
  // Kirim argumen secara langsung: sigma, flat, jagged
  .sharpen(1.5, 1.0, 2.0) 
  .png({ quality: 90 })
  .toBuffer();

    // 4. Kirim Response
    return new Response(processedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="enhanced.png"`,
      },
    });

  } catch (error: any) {
    console.error("Sharp Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
