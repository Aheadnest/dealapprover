import PDFDocument from "pdfkit";

// A6 portrait: 105 × 148 mm → 297.64 × 419.53 pt
const A6_W = 297.64;
const A6_H = 419.53;

interface StickerInput {
  title: string;
  slug: string;
  issuedAt: string;
  sellerName: string;
  verificationLevel: "L0" | "L1" | "L2";
  qrPngBuffer: Buffer;
}

export async function renderStickerPdf(input: StickerInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [A6_W, A6_H], margin: 20 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header band
    doc.rect(0, 0, A6_W, 56).fill("#0F172A");
    doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("DealApprover", 20, 18);
    doc.fillColor("#22C55E").fontSize(10).font("Helvetica").text("Verified Certificate", 20, 36);

    // Title
    doc.fillColor("#0F172A").fontSize(16).font("Helvetica-Bold").text(input.title, 20, 80, { width: A6_W - 40 });

    // QR
    const qrSize = 180;
    const qrX = (A6_W - qrSize) / 2;
    doc.image(input.qrPngBuffer, qrX, 130, { width: qrSize, height: qrSize });

    // Slug
    doc.fillColor("#76777d").fontSize(9).font("Helvetica").text("Certificate ID", 20, 330);
    doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text(input.slug, 20, 343);

    // Issued
    doc.fillColor("#76777d").fontSize(9).font("Helvetica").text("Issued", A6_W / 2, 330);
    doc.fillColor("#0F172A").fontSize(10).font("Helvetica").text(new Date(input.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }), A6_W / 2, 343);

    // Seller line
    const badge = input.verificationLevel === "L2" ? "ID-verified" : input.verificationLevel === "L1" ? "Verified contact" : "Email-verified";
    doc.fillColor("#45464d").fontSize(9).font("Helvetica").text(`Issued by ${input.sellerName} · ${badge}`, 20, 380, { width: A6_W - 40, align: "center" });

    // Footer
    doc.fillColor("#c6c6cd").fontSize(8).text("Scan the QR code with any phone camera to verify.", 20, 398, { width: A6_W - 40, align: "center" });

    doc.end();
  });
}
