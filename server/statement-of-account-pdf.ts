/**
 * Statement of Account PDF Export
 * Generates a professional PDF for supplier/customer statements
 */

import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { fetchPartnerLedger, fetchPartners } from "./odoo-finance";

// Platfarm brand colors
const GREEN = "#2D5A3D";
const TERRACOTTA = "#C0714A";
const LIGHT_BG = "#F5F5F0";
const BORDER = "#E4E1DC";
const TEXT_DARK = "#2C3E50";
const TEXT_MUTED = "#64706C";
const TEXT_LIGHT = "#95A09C";

function fmt(v: number, currency: string = "EGP"): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "K";
  return v.toLocaleString();
}

export function registerStatementOfAccountPdfRoute(app: Express) {
  app.get("/api/statement-of-account-pdf", async (req: Request, res: Response) => {
    try {
      const mode = (req.query.mode as string) || "supplier";
      const partnerId = Number(req.query.partnerId);
      const dateFrom = (req.query.dateFrom as string) || "";
      const dateTo = (req.query.dateTo as string) || "";
      const partnerNameParam = (req.query.partnerName as string) || "";

      if (!partnerId || isNaN(partnerId)) {
        res.status(400).send("Missing or invalid partnerId");
        return;
      }

      // Fetch statement data
      const accountType = mode === "customer" ? "receivable" : "payable";
      const entries = await fetchPartnerLedger(partnerId, accountType, undefined, dateFrom, dateTo);
      const partners = await fetchPartners();
      const partner = partners.find((p: any) => p.id === partnerId);
      
      if (!entries || entries.length === 0) {
        res.status(404).send("Statement data not found");
        return;
      }

      // Calculate balances
      let openingBalance = 0;
      let totalDebit = 0;
      let totalCredit = 0;
      let runningBalance = 0;

      const processedEntries = entries.map((entry: any) => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        totalDebit += debit;
        totalCredit += credit;
        runningBalance += debit - credit;
        return {
          date: entry.date,
          ref: entry.move_id ? (Array.isArray(entry.move_id) ? entry.move_id[1] : entry.move_id) : "",
          description: entry.name || "",
          dueDate: entry.date_maturity || "",
          debit,
          credit,
          runningBalance,
        };
      });

      const closingBalance = runningBalance;
      const currencyCode = "EGP"; // Default to EGP

      const soaData = {
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        entries: processedEntries,
        currency: currencyCode,
      };

      // Create PDF
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      // Set response headers
      const filename = `Statement_of_Account_${partnerNameParam.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      doc.pipe(res);

      // ─── HEADER ────────────────────────────────────────────────────────
      const pageW = doc.page.width - 80; // margins

      // Company name
      doc.fontSize(22).font("Helvetica-Bold").fillColor(GREEN).text("PLATFARM", 40, 40);
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_MUTED).text("for Agritech and Agribusiness Ltd", 40, 65);
      doc.fontSize(8).text("Abu Dhabi Global Market", 40, 76);

      // Right side: date + statement type
      const statementType = mode === "customer" ? "Customer Statement" : "Supplier Statement";
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_MUTED)
        .text(statementType, 40, 40, { align: "right", width: pageW })
        .text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, 40, 52, { align: "right", width: pageW });

      // Divider
      doc.moveTo(40, 92).lineTo(40 + pageW, 92).lineWidth(2).strokeColor(GREEN).stroke();

      // ─── TITLE ─────────────────────────────────────────────────────────
      doc.fontSize(14).font("Helvetica-Bold").fillColor(TEXT_DARK)
        .text("Statement of Account", 40, 102);

      doc.fontSize(10).font("Helvetica").fillColor(TERRACOTTA)
        .text(partnerNameParam, 40, 120);

      const periodText = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : "All Time";
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_MUTED)
        .text(`Period: ${periodText}`, 40, 135);

      // ─── SUMMARY BOXES ─────────────────────────────────────────────────
      const boxY = 155;
      const boxW = (pageW - 30) / 4;

      const boxes = mode === "customer"
        ? [
            { label: "OPENING", value: fmt(soaData.openingBalance, soaData.currency) },
            { label: "INVOICED", value: fmt(soaData.totalDebit, soaData.currency) },
            { label: "COLLECTED", value: fmt(soaData.totalCredit, soaData.currency) },
            { label: "CUSTOMER OWES", value: fmt(soaData.closingBalance, soaData.currency) },
          ]
        : [
            { label: "OPENING", value: fmt(Math.abs(soaData.openingBalance), soaData.currency) },
            { label: "BILLED", value: fmt(soaData.totalCredit, soaData.currency) },
            { label: "PAID", value: fmt(soaData.totalDebit, soaData.currency) },
            { label: "WE OWE", value: fmt(Math.abs(soaData.closingBalance), soaData.currency) },
          ];

      boxes.forEach((b, i) => {
        const bx = 40 + i * (boxW + 10);
        doc.roundedRect(bx, boxY, boxW, 45, 4).fillAndStroke(LIGHT_BG, BORDER);
        doc.fontSize(7).font("Helvetica-Bold").fillColor(GREEN)
          .text(b.label, bx + 10, boxY + 8, { width: boxW - 20 });
        doc.fontSize(14).font("Helvetica-Bold").fillColor(TEXT_DARK)
          .text(b.value, bx + 10, boxY + 22, { width: boxW - 20 });
      });

      // ─── TABLE ─────────────────────────────────────────────────────────
      const tableY = boxY + 60;
      const cols = [
        { label: "Date", width: 50, align: "left" as const },
        { label: "Ref", width: 55, align: "left" as const },
        { label: "Description", width: 150, align: "left" as const },
        { label: "Due", width: 50, align: "left" as const },
        { label: mode === "customer" ? "Debit" : "Debit (Paid)", width: 60, align: "right" as const },
        { label: mode === "customer" ? "Credit" : "Credit (Billed)", width: 60, align: "right" as const },
        { label: "Balance", width: 60, align: "right" as const },
      ];

      // Adjust column widths to fit page
      const totalColW = cols.reduce((s, c) => s + c.width, 0);
      const scale = pageW / totalColW;
      cols.forEach((c) => (c.width = Math.floor(c.width * scale)));

      // Helper to truncate text to fit column
      const truncateText = (text: string, maxWidth: number, fontSize: number = 9): string => {
        const charWidth = fontSize * 0.5; // Approximate character width
        const maxChars = Math.floor(maxWidth / charWidth);
        return text.length > maxChars ? text.substring(0, maxChars - 2) + "..." : text;
      };

      // Helper to draw table header
      const drawTableHeader = (y: number) => {
        let cx = 40;
        doc.rect(40, y, pageW, 18).fill(mode === "customer" ? GREEN : TERRACOTTA);
        cols.forEach((c) => {
          const truncatedLabel = truncateText(c.label, c.width - 6, 6.5);
          doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#fff")
            .text(truncatedLabel, cx + 3, y + 5, { width: c.width - 6, align: c.align, lineBreak: false });
          cx += c.width;
        });
      };

      // Table header on first page
      drawTableHeader(tableY);

      // Table rows
      let ry = tableY + 18;
      let cx = 40;
      const rowH = 14;
      const headerH = 18;
      const footerH = 40;
      const maxRowsPerPage = Math.floor((doc.page.height - 80 - ry - footerH) / rowH);
      let pageNum = 1;
      let rowCount = 0;

      // Opening balance row
      if (soaData.openingBalance !== 0) {
        cx = 40;
        const rowData = [
          dateFrom,
          "Opening",
          "",
          "",
          "",
          "",
          fmt(Math.abs(soaData.openingBalance), soaData.currency),
        ];
        rowData.forEach((cell, i) => {
          const align = cols[i].align;
          const truncatedCell = truncateText(cell, cols[i].width - 6, 9);
          doc.fontSize(9).font("Helvetica").fillColor(TEXT_DARK)
            .text(truncatedCell, cx + 3, ry + 2, { width: cols[i].width - 6, align, lineBreak: false });
          cx += cols[i].width;
        });
        ry += rowH;
      }

      // Transaction rows
      soaData.entries.forEach((entry: any, idx: number) => {
        if (rowCount > 0 && rowCount % maxRowsPerPage === 0) {
          // Add page number to current page
          doc.fontSize(8).font("Helvetica").fillColor(TEXT_MUTED)
            .text(`Page ${pageNum}`, 40, doc.page.height - 30, { align: "center", width: pageW });
          
          // Add new page
          doc.addPage();
          pageNum++;
          ry = 40;
          
          // Draw table header on new page
          drawTableHeader(ry);
          ry += headerH;
        }

        cx = 40;
        const rowData = [
          entry.date,
          entry.ref,
          entry.description,
          entry.dueDate || "—",
          entry.debit ? fmt(entry.debit, soaData.currency) : "—",
          entry.credit ? fmt(entry.credit, soaData.currency) : "—",
          fmt(Math.abs(entry.runningBalance), soaData.currency),
        ];
        rowData.forEach((cell, i) => {
          const align = cols[i].align;
          const isBalance = i === 6;
          const balanceColor = mode === "customer"
            ? entry.runningBalance >= 0 ? GREEN : "#C94444"
            : entry.runningBalance <= 0 ? "#C94444" : GREEN;
          const truncatedCell = truncateText(cell, cols[i].width - 6, 9);

          doc.fontSize(9).font("Helvetica").fillColor(isBalance ? balanceColor : TEXT_DARK)
            .text(truncatedCell, cx + 3, ry + 2, { width: cols[i].width - 6, align, lineBreak: false });
          cx += cols[i].width;
        });
        ry += rowH;
        rowCount++;
      });

      // Totals row
      ry += 4;
      
      // Check if totals row fits on current page, if not add new page
      if (ry + rowH > doc.page.height - 60) {
        doc.fontSize(8).font("Helvetica").fillColor(TEXT_MUTED)
          .text(`Page ${pageNum}`, 40, doc.page.height - 30, { align: "center", width: pageW });
        doc.addPage();
        pageNum++;
        ry = 40;
        drawTableHeader(ry);
        ry += headerH + 4;
      }
      
      cx = 40;
      const totalsData = [
        "",
        "",
        "Totals:",
        "",
        fmt(soaData.totalDebit, soaData.currency),
        fmt(soaData.totalCredit, soaData.currency),
        fmt(Math.abs(soaData.closingBalance), soaData.currency),
      ];
      totalsData.forEach((cell, i) => {
        const align = cols[i].align;
        const truncatedCell = truncateText(cell, cols[i].width - 6, 9);
        doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT_DARK)
          .text(truncatedCell, cx + 3, ry + 2, { width: cols[i].width - 6, align, lineBreak: false });
        cx += cols[i].width;
      });

      // Add page number to last page
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_MUTED)
        .text(`Page ${pageNum}`, 40, doc.page.height - 30, { align: "center", width: pageW });
      
      // ─── FOOTER NOTE ────────────────────────────────────────────────────
      doc.fontSize(8).font("Helvetica").fillColor(TERRACOTTA)
        .text(
          mode === "customer"
            ? "Customer: Debit = invoiced. Credit = collected. Positive = they owe you."
            : "Supplier: Credit = billed. Debit = paid. (Parentheses) = you owe them.",
          40,
          doc.page.height - 50,
          { width: pageW }
        );

      doc.end();
    } catch (error) {
      console.error("Error generating SOA PDF:", error);
      res.status(500).send("Error generating PDF");
    }
  });
}
