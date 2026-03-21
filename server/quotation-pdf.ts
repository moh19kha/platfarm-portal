/**
 * Server-side PDF generation for Quotations and Invoices using PDFKit.
 * Pure Node.js — no Chromium/Puppeteer needed, works in all environments.
 */
import PDFDocument from "pdfkit";
import type { Express } from "express";
import { ensureAssets, ASSET_PATHS } from "./assets-cdn";

// Brand colors
const GREEN = "#2D5A3D";
const SAGE = "#4A7C59";
const TERRA = "#C0714A";
const DARK = "#2C3E50";
const MUTED = "#8A9BA8";
const GRAY = "#6B7C8A";
const GREEN_TINT = "#EEF5F1";
const GREEN_BDR = "#C5DDD0";
const TERRA_TINT = "#FDF4EF";
const WHITE = "#FFFFFF";

// Asset paths — resolved from CDN cache at /tmp/platfarm-assets
const LOGO_PATH = ASSET_PATHS.images.logo;
const SIGNATURE_PATH = ASSET_PATHS.images.signature;
const STAMP_PATH = ASSET_PATHS.images.stamp;

interface Product {
  id: number;
  description: string;
  subDescription: string;
  specs: string;
  quantity: number;
  unit: string;
  rate: number;
  vat: number;
}

interface BankDetails {
  beneficiary: string;
  bankName: string;
  iban: string;
  swiftCode: string;
  branch: string;
  currency: string;
}

interface QuotationData {
  isInvoice: boolean;
  quotationNo: string;
  quotationTitle: string;
  quotationSubtitle: string;
  quotationDate: string;
  validUntil: string;
  incoterms: string;
  paymentTerms: string;
  currency: string;
  notes: string;
  paymentSchedule: string;
  clientName: string;
  clientAddress: string;
  clientCountry: string;
  clientTrn: string;
  projectName: string;
  products: Product[];
  bankDetails: BankDetails;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateQuotationPdf(data: QuotationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `${data.isInvoice ? "Invoice" : "Quotation"} ${data.quotationNo}`,
        Author: "Platfarm",
      },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const W = doc.page.width;   // 595.28
    const PX = 40;               // horizontal padding
    const CW = W - PX * 2;      // content width

    // ── Accent bar ──
    doc.rect(0, 0, W, 4).fill(GREEN);

    let y = 4;
    y += 24;

    // Logo (right side)
    try { doc.image(LOGO_PATH, W - PX - 100, y, { width: 100 }); } catch {}

    // Company header
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13)
      .text("PLATFARM FOR AGRITECH AND", PX, y, { width: CW - 110 });
    doc.text("AGRIBUSINESS LTD ABU DHABI", PX, y + 16, { width: CW - 110 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5)
      .text("Office 16-120, Floor 16, Al Khatem Tower, Abu Dhabi Global Market Square", PX, y + 38, { width: CW - 110 })
      .text("Al Maryah Island, ABU DHABI 20054 ARE", PX, y + 48, { width: CW - 110 });
    doc.fillColor(GRAY).fontSize(7)
      .text("+971504309603   info@platfarm.io   www.platfarm.io", PX, y + 60, { width: CW - 110 })
      .text("TRN: 104090372400003", PX, y + 70, { width: CW - 110 });

    y += 90;

    // ── Green rule ──
    doc.rect(PX, y, CW, 1.5).fill(GREEN);
    y += 14;

    // ── Title + Quotation No ──
    const qBoxW = 120;
    const qBoxX = W - PX - qBoxW;

    doc.roundedRect(qBoxX, y, qBoxW, 44, 6).fillAndStroke(GREEN_TINT, GREEN_BDR);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(6.5)
      .text(data.isInvoice ? "INVOICE NO." : "QUOTATION NO.", qBoxX, y + 7, { width: qBoxW, align: "center" });
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(13)
      .text(data.quotationNo || "-", qBoxX, y + 18, { width: qBoxW, align: "center" });

    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(22)
      .text(data.quotationTitle || (data.isInvoice ? "INVOICE" : "QUOTATION"), PX, y + 6);
    if (data.quotationSubtitle) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(7.5)
        .text(data.quotationSubtitle.toUpperCase(), PX, y + 32);
    }

    y += 56;

    // ── Bill To + Details (two-column cards) ──
    const colW = (CW - 12) / 2;

    // Bill To card
    doc.roundedRect(PX, y, colW, 80, 6).fill(GREEN_TINT);
    doc.rect(PX, y, 3, 80).fill(GREEN);
    doc.fillColor(SAGE).font("Helvetica-Bold").fontSize(6.5).text("BILL TO", PX + 12, y + 10);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text(data.clientName || "-", PX + 12, y + 22, { width: colW - 20 });
    doc.fillColor(GRAY).font("Helvetica").fontSize(8.5)
      .text(data.clientAddress || "", PX + 12, y + 36, { width: colW - 20 })
      .text(data.clientCountry || "", PX + 12, y + 47, { width: colW - 20 });
    if (data.clientTrn) {
      doc.fillColor(MUTED).fontSize(7.5).text(`TRN: ${data.clientTrn}`, PX + 12, y + 58, { width: colW - 20 });
    }
    if (data.projectName) {
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8.5)
        .text(`Project: ${data.projectName}`, PX + 12, y + 68, { width: colW - 20 });
    }

    // Details card
    const detX = PX + colW + 12;
    doc.roundedRect(detX, y, colW, 80, 6).fill(GREEN_TINT);
    doc.fillColor(SAGE).font("Helvetica-Bold").fontSize(6.5).text("DETAILS", detX + 12, y + 10);

    const detailRows: [string, string][] = [
      ["Date", data.quotationDate || "-"],
    ];
    if (data.validUntil) detailRows.push(["Valid Until", data.validUntil]);
    detailRows.push(["Incoterms", data.incoterms || "—"]);
    detailRows.push(["Payment Terms", data.paymentTerms || "-"]);
    detailRows.push(["Currency", data.currency || "USD"]);

    let detY = y + 22;
    for (const [label, value] of detailRows) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text(label, detX + 12, detY, { width: colW / 2 - 10 });
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8)
        .text(value, detX + colW / 2, detY, { width: colW / 2 - 10, align: "right" });
      detY += 11;
    }

    y += 90;

    // ── Items Table ──
    const colWidths = [CW * 0.35, CW * 0.18, CW * 0.08, CW * 0.08, CW * 0.15, CW * 0.16];
    const headers = ["Description", "Details", "Qty", "Unit", `Rate (${data.currency})`, `Amount (${data.currency})`];
    const thH = 20;

    // Table header
    doc.roundedRect(PX, y, CW, thH, 4).fill(GREEN);
    let hx = PX;
    for (let i = 0; i < headers.length; i++) {
      const align = i >= 4 ? "right" : i >= 2 ? "center" : "left";
      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6.5)
        .text(headers[i].toUpperCase(), hx + 6, y + 6, { width: colWidths[i] - 8, align });
      hx += colWidths[i];
    }
    y += thH;

    // Table rows
    for (let i = 0; i < data.products.length; i++) {
      const p = data.products[i];
      const amount = p.quantity * p.rate;
      const bg = i % 2 === 0 ? WHITE : "#F7FAF8";
      const descColW = colWidths[0] - 10;

      // Measure actual text heights to compute dynamic row height
      doc.font("Helvetica-Bold").fontSize(8);
      const descH = doc.heightOfString(p.description || "", { width: descColW });
      let subH = 0;
      if (p.subDescription) {
        doc.font("Helvetica").fontSize(6.5);
        subH = doc.heightOfString(p.subDescription, { width: descColW });
      }
      const contentH = descH + (subH > 0 ? subH + 2 : 0);
      const rH = Math.max(22, contentH + 12); // 6px top + 6px bottom padding

      doc.rect(PX, y, CW, rH).fill(bg);
      doc.rect(PX, y, CW, rH).stroke(GREEN_BDR);

      let cx = PX;
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8)
        .text(p.description || "", cx + 6, y + 6, { width: descColW });
      if (p.subDescription) {
        doc.fillColor(MUTED).font("Helvetica").fontSize(6.5)
          .text(p.subDescription, cx + 6, y + 6 + descH + 2, { width: descColW });
      }
      cx += colWidths[0];

      doc.fillColor(GRAY).font("Helvetica").fontSize(7.5)
        .text(p.specs || "", cx + 4, y + 7, { width: colWidths[1] - 8, align: "center" });
      cx += colWidths[1];

      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8)
        .text(Math.round(p.quantity).toLocaleString("en-US"), cx + 4, y + 7, { width: colWidths[2] - 8, align: "center" });
      cx += colWidths[2];

      doc.fillColor(GRAY).font("Helvetica").fontSize(7.5)
        .text(p.unit || "", cx + 4, y + 7, { width: colWidths[3] - 8, align: "center" });
      cx += colWidths[3];

      doc.fillColor(DARK).font("Helvetica").fontSize(8)
        .text(fmtNum(p.rate), cx + 4, y + 7, { width: colWidths[4] - 8, align: "right" });
      cx += colWidths[4];

      doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(8)
        .text(fmtNum(amount), cx + 4, y + 7, { width: colWidths[5] - 10, align: "right" });

      y += rH;
    }

    y += 16;

    // ── Signature + Totals ──
    const subtotal = data.products.reduce((s, p) => s + p.quantity * p.rate, 0);
    const vatTotal = data.products.reduce((s, p) => s + p.quantity * p.rate * (p.vat / 100), 0);
    const total = subtotal + vatTotal;

    const totW = 200;
    const totX = W - PX - totW;

    // Signature block
    try { doc.image(SIGNATURE_PATH, PX, y, { width: 56, height: 40 }); } catch {}
    doc.rect(PX, y + 44, 110, 0.5).fill("#D8E4DC");
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5)
      .text("Authorized Signature", PX, y + 48, { width: 110, align: "center" });
    try { doc.image(STAMP_PATH, PX + 5, y + 58, { width: 80, height: 80 }); } catch {}

    // Totals
    let ty = y;
    const totRows: [string, string][] = [
      ["Subtotal", fmtNum(subtotal)],
      ["VAT", fmtNum(vatTotal)],
    ];
    for (const [label, value] of totRows) {
      doc.roundedRect(totX, ty, totW, 22, 0).fillAndStroke(GREEN_TINT, GREEN_BDR);
      doc.fillColor(GRAY).font("Helvetica").fontSize(8.5).text(label, totX + 12, ty + 7);
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8.5)
        .text(value, totX, ty + 7, { width: totW - 12, align: "right" });
      ty += 22;
    }
    doc.roundedRect(totX, ty, totW, 28, 0).fill(GREEN);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(11).text("TOTAL", totX + 12, ty + 8);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(11)
      .text(`${data.currency} ${fmtNum(total)}`, totX, ty + 8, { width: totW - 12, align: "right" });

    y += Math.max(150, ty - y + 40);

    // ── Notes ──
    if (data.notes) {
      doc.roundedRect(PX, y, CW, 14).fill(TERRA_TINT);
      doc.rect(PX, y, 3, 14).fill(TERRA);
      doc.fillColor(TERRA).font("Helvetica-Bold").fontSize(6.5).text("NOTES", PX + 10, y + 4);
      y += 16;
      const notesH = Math.max(30, Math.ceil(data.notes.length / 90) * 11 + 16);
      doc.roundedRect(PX, y, CW, notesH).fill(TERRA_TINT);
      doc.rect(PX, y, 3, notesH).fill(TERRA);
      doc.fillColor(DARK).font("Helvetica").fontSize(8)
        .text(data.notes, PX + 10, y + 8, { width: CW - 20 });
      y += notesH + 10;
    }

    // ── Payment Schedule ──
    if (data.paymentSchedule) {
      doc.roundedRect(PX, y, CW, 14).fill(GREEN_TINT);
      doc.rect(PX, y, 3, 14).fill(SAGE);
      doc.fillColor(SAGE).font("Helvetica-Bold").fontSize(6.5).text("PAYMENT SCHEDULE", PX + 10, y + 4);
      y += 16;
      const psH = Math.max(30, Math.ceil(data.paymentSchedule.length / 90) * 11 + 16);
      doc.roundedRect(PX, y, CW, psH).fill(GREEN_TINT);
      doc.rect(PX, y, 3, psH).fill(SAGE);
      doc.fillColor(DARK).font("Helvetica").fontSize(8)
        .text(data.paymentSchedule, PX + 10, y + 8, { width: CW - 20 });
      y += psH + 10;
    }

    // ── Bank Details ──
    const bankH = 90;
    doc.roundedRect(PX, y, CW, bankH, 6).fill(GREEN);
    doc.fillColor("rgba(255,255,255,0.45)").font("Helvetica-Bold").fontSize(6.5)
      .text("BANK DETAILS FOR PAYMENT", PX + 16, y + 12);

    const bankCols = [
      ["Beneficiary", data.bankDetails.beneficiary],
      ["Bank Name", data.bankDetails.bankName],
      ["Branch", data.bankDetails.branch],
      ["IBAN", data.bankDetails.iban],
      ["SWIFT Code", data.bankDetails.swiftCode],
      ["Currency", data.bankDetails.currency],
    ];

    const bColW = CW / 3;
    for (let i = 0; i < bankCols.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = PX + 16 + col * bColW;
      const by = y + 26 + row * 32;
      doc.fillColor("rgba(255,255,255,0.4)").font("Helvetica-Bold").fontSize(6)
        .text(bankCols[i][0].toUpperCase(), bx, by, { width: bColW - 16 });
      doc.fillColor(WHITE).font("Helvetica").fontSize(8)
        .text(bankCols[i][1] || "-", bx, by + 9, { width: bColW - 16 });
    }

    y += bankH + 14;

    // ── Footer ──
    doc.rect(PX, y, CW, 0.5).fill("#E0E8E4");
    y += 8;
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text("Thank you for your business", PX, y);
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(7.5)
      .text("Platfarm Document System", PX, y, { width: CW, align: "right" });

    doc.end();
  });
}

export function registerQuotationPdfRoute(app: Express) {
  app.post("/api/generate-quotation-pdf", async (req, res) => {
    try {
      const data = req.body as QuotationData;
      if (!data || !data.quotationNo) {
        return res.status(400).json({ error: "Missing quotation data" });
      }

      // Ensure assets are downloaded from CDN
      await ensureAssets();

      const pdfBuffer = await generateQuotationPdf(data);
      const filename = `${data.isInvoice ? "Invoice" : "Quotation"}-${data.quotationNo}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("[QuotationPDF] Error:", err);
      res.status(500).json({ error: "PDF generation failed", detail: String(err) });
    }
  });
}
