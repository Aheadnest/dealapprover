import QRCode from "qrcode";

export async function generateQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 1024,
    errorCorrectionLevel: "Q",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 2,
  });
}
