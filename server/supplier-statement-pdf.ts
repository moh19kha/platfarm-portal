/**
 * Supply Statement PDF Export
 * Generates a professional PDF with company branding for supplier receipts
 */

import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { fetchReceiptSuppliers, fetchSupplierReceipts } from "./odoo-inventory";
import { ensureAssets, ASSET_PATHS } from "./assets-cdn";

// Platfarm brand colors
const GREEN = "#2D5A3D";
const TERRACOTTA = "#C0714A";
const LIGHT_BG = "#F5F5F0";
const BORDER = "#E4E1DC";
const TEXT_DARK = "#2C3E50";
const TEXT_MUTED = "#64706C";
const TEXT_LIGHT = "#95A09C";

function fK(kg: number): string {
  if (Math.abs(kg) >= 1e6) return (kg / 1e6).toFixed(2) + "M kg";
  if (Math.abs(kg) >= 1000) return (kg / 1000).toFixed(1) + "t";
  return kg.toFixed(1) + " kg";
}

function fV(v: number): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "K";
  return v.toLocaleString();
}

export function registerSupplierStatementPdfRoute(app: Express) {
  app.get("/api/supplier-statement-pdf", async (req: Request, res: Response) => {
    try {
      const supplierId = Number(req.query.supplierId);
      const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const supplierNameParam = req.query.supplierName as string | undefined;
      const periodParam = req.query.period as string | undefined;

      if (!supplierId || isNaN(supplierId)) {
        res.status(400).send("Missing or invalid supplierId");
        return;
      }

      // Ensure fonts/images are downloaded from CDN
      await ensureAssets();

      // Fetch data (include purchaseOrders and poLines for price lookup)
      const [suppliers, { receipts, moves, purchaseOrders, poLines }] = await Promise.all([
        fetchReceiptSuppliers(companyId),
        fetchSupplierReceipts(supplierId, companyId, dateFrom, dateTo),
      ]);

      const supplierInfo = suppliers.find((s) => s.id === supplierId);
      const supplierName = supplierNameParam
        || (supplierInfo ? supplierInfo.name.replace(/^\d[\d-]*-/, "").trim() : "Unknown Supplier");

      // Build maps for lookups
      const moveMap = new Map(moves.map((m: any) => [m.id, m]));
      const poMap = new Map(purchaseOrders.map((po: any) => [po.id, po]));
      const poLineMap = new Map<string, number>();
      const truckingCostByPo = new Map<number, number>();
      const truckingCostAssigned = new Set<number>();
      poLines.forEach((line: any) => {
        const key = `${line.order_id[0]}_${line.product_id[0]}`;
        poLineMap.set(key, line.price_unit || 0);
        const productName = Array.isArray(line.product_id) ? String(line.product_id[1]) : '';
        const uomName = Array.isArray(line.product_uom) ? String(line.product_uom[1]).toLowerCase() : '';
        const isTrucking = /freight|trucking|transport/i.test(productName) || uomName === 'units' || uomName === 'unit';
        if (isTrucking && line.price_subtotal > 0) {
          const existing = truckingCostByPo.get(line.order_id[0]) || 0;
          truckingCostByPo.set(line.order_id[0], existing + line.price_subtotal);
        }
      });

      // Filter out receipts whose linked PO is cancelled (same as UI)
      const activeReceipts = receipts.filter((r: any) => {
        const poId = Array.isArray(r.purchase_id) ? r.purchase_id[0] : 0;
        const po = poId ? poMap.get(poId) : null;
        return !po || po.state !== "cancel";
      });

      // Process rows
      const rows = activeReceipts.map((r: any) => {
        const firstMove = r.move_ids.length > 0 ? moveMap.get(r.move_ids[0]) : null;
        const productName = firstMove?.product_id
          ? Array.isArray(firstMove.product_id) ? firstMove.product_id[1] : String(firstMove.product_id)
          : r.x_studio_product_type
            ? Array.isArray(r.x_studio_product_type) ? r.x_studio_product_type[1] : String(r.x_studio_product_type)
            : "—";

        // PO# from linked purchase.order.name (e.g. PO/CAI/26/00110), fallback to origin
        const poId = Array.isArray(r.purchase_id) ? r.purchase_id[0] : 0;
        const po = poId ? poMap.get(poId) : null;
        const poName = po ? po.name : "";
        const origin = r.origin || "";
        const poNumber = poName || origin || "—";

        const currency = r.x_studio_purchase_currency
          ? Array.isArray(r.x_studio_purchase_currency) ? r.x_studio_purchase_currency[1] : ""
          : r.x_studio_currency_id
            ? Array.isArray(r.x_studio_currency_id) ? r.x_studio_currency_id[1] : ""
            : "";

        const warehouse = r.picking_type_id
          ? Array.isArray(r.picking_type_id) ? r.picking_type_id[1] : ""
          : r.location_dest_id
            ? Array.isArray(r.location_dest_id) ? r.location_dest_id[1] : ""
            : "";
        
        const m2oName = (field: any): string => {
          if (Array.isArray(field) && field.length >= 2) return String(field[1]);
          if (field && typeof field === "string") return field;
          return "";
        };

        const officer = r.user_id
          ? Array.isArray(r.user_id) ? r.user_id[1] : ""
          : "—";

        const loadingDate = r.x_studio_loading_datetime || r.scheduled_date || "";
        
        // WEIGHT: Try multiple sources (same as web page):
        // 1. picking.x_studio_net_weight_in_tons (picking-level weight in tons)
        // 2. stock.move.quantity (in kg, convert to tons)
        let netWeightTons = r.x_studio_net_weight_in_tons || 0;
        if (netWeightTons === 0 && firstMove) {
          const moveQty = firstMove.quantity || firstMove.product_uom_qty || 0;
          // Assume kg for now (most common in Odoo)
          netWeightTons = moveQty / 1000;
        }
        
        // Price resolution: PO line price is primary (separates trucking from fodder)
        // Fallback: stock.move price_unit → agreed_product_price_per_unit (last resort)
        let pricePerTon = 0;
        if (poId) {
          const productId = firstMove?.product_id
            ? Array.isArray(firstMove.product_id) ? firstMove.product_id[0] : firstMove.product_id
            : 0;
          if (productId) {
            const poLineKey = `${poId}_${productId}`;
            const poLinePrice = poLineMap.get(poLineKey);
            if (poLinePrice && poLinePrice > 0) pricePerTon = poLinePrice * 1000; // per kg → per ton
          }
        }
        if (pricePerTon === 0 && firstMove?.price_unit) {
          pricePerTon = firstMove.price_unit * 1000; // per kg → per ton
        }
        if (pricePerTon === 0) {
          pricePerTon = r.agreed_product_price_per_unit || 0; // last resort
        }
        const totalValue = netWeightTons * pricePerTon;
        const grade = r.grade || "—";

        // Trucking cost: assign to first receipt of each PO
        let truckingCost = 0;
        if (poId && !truckingCostAssigned.has(poId)) {
          truckingCost = truckingCostByPo.get(poId) || 0;
          if (truckingCost > 0) truckingCostAssigned.add(poId);
        }

        return {
          loadingDate,
          poNumber,
          shipmentRef: r.name,
          truckLoadSerial: r.truck_load_serial_tl || "—",
          containerNumber: r.x_studio_loadcontainer_number_1 || "—",
          product: productName,
          netWeightTons,
          pricePerTon,
          currency,
          totalValue,
          truckingCost,
          grade,
          warehouse: warehouse.replace(/:.*/, ""),
          officer,
        };
      });

      // Summary
      const totalNetWeight = rows.reduce((s: number, r: any) => s + r.netWeightTons, 0);
      const totalValue = rows.reduce((s: number, r: any) => s + r.totalValue, 0);
      const totalTruckingCost = rows.reduce((s: number, r: any) => s + r.truckingCost, 0);
      const avgPrice = totalNetWeight > 0 ? totalValue / (totalNetWeight * 1000) : 0;

      // Create PDF
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      // Register DM Sans fonts (matching website typography)
      doc.registerFont("DMSans", ASSET_PATHS.fonts.regular);
      doc.registerFont("DMSans-Medium", ASSET_PATHS.fonts.medium);
      doc.registerFont("DMSans-Bold", ASSET_PATHS.fonts.bold);

      // Set response headers
      const filename = `Supply_Statement_${supplierName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      doc.pipe(res);

      // ─── HEADER ────────────────────────────────────────────────────────
      const pageW = doc.page.width - 80; // margins

      // Company logo (PNG)
      try {
        doc.image(ASSET_PATHS.images.logo, 40, 30, { height: 36 });
      } catch {
        // Fallback to text if logo not found
        doc.fontSize(22).font("DMSans-Bold").fillColor(GREEN).text("PLATFARM", 40, 40);
      }
      doc.fontSize(7.5).font("DMSans").fillColor(TEXT_MUTED)
        .text("for Agritech and Agribusiness Ltd", 40, 70)
        .text("Abu Dhabi Global Market", 40, 80);

      // Right side: date + company
      const companyName = companyId === 3 || companyId === 4 || companyId === 5
        ? "Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY"
        : companyId === 1 || companyId === 2
          ? "UAE-PLATFARM"
          : "All Companies";
      doc.fontSize(8).font("DMSans").fillColor(TEXT_MUTED)
        .text(companyName, 40, 36, { align: "right", width: pageW })
        .text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, 40, 48, { align: "right", width: pageW });

      // Divider
      doc.moveTo(40, 96).lineTo(40 + pageW, 96).lineWidth(1.5).strokeColor(GREEN).stroke();

      // ─── TITLE ─────────────────────────────────────────────────────────
      doc.fontSize(15).font("DMSans-Bold").fillColor(TEXT_DARK)
        .text("Supply Statement", 40, 106);

      doc.fontSize(10.5).font("DMSans-Medium").fillColor(TERRACOTTA)
        .text(supplierName, 40, 124);

      const periodText = periodParam
        || (dateFrom && dateTo
          ? `${dateFrom} to ${dateTo}`
          : dateFrom
            ? `From ${dateFrom}`
            : dateTo
              ? `To ${dateTo}`
              : "All Time");
      doc.fontSize(8).font("DMSans").fillColor(TEXT_MUTED)
        .text(`Period: ${periodText}`, 40, 139);

      // ─── SUMMARY BOXES ─────────────────────────────────────────────────
      const boxY = 155;
      const boxW = (pageW - 40) / 5;
      const boxes = [
        { label: "RECEIPTS", value: String(rows.length) },
        { label: "NET WEIGHT", value: fK(totalNetWeight * 1000) },
        { label: "FODDER VALUE", value: fV(Math.round(totalValue)) },
        { label: "TRUCKING COST", value: totalTruckingCost > 0 ? fV(Math.round(totalTruckingCost)) : "—" },
        { label: "GRAND TOTAL", value: fV(Math.round(totalValue + totalTruckingCost)) },
      ];

      boxes.forEach((b, i) => {
        const bx = 40 + i * (boxW + 10);
        const isHighlight = b.label === "GRAND TOTAL";
        doc.roundedRect(bx, boxY, boxW, 45, 4).fillAndStroke(isHighlight ? "#E4EFE6" : LIGHT_BG, isHighlight ? GREEN : BORDER);
        doc.fontSize(7).font("DMSans-Bold").fillColor(GREEN)
          .text(b.label, bx + 10, boxY + 8, { width: boxW - 20 });
        doc.fontSize(14).font("DMSans-Bold").fillColor(isHighlight ? GREEN : TEXT_DARK)
          .text(b.value, bx + 10, boxY + 22, { width: boxW - 20 });
      });

      // ─── TABLE ─────────────────────────────────────────────────────────
      const tableY = boxY + 60;
      const cols = [
        { label: "#", width: 22, align: "left" as const },
        { label: "Date", width: 60, align: "left" as const },
        { label: "PO #", width: 72, align: "left" as const },
        { label: "Shipment", width: 72, align: "left" as const },
        { label: "Product", width: 100, align: "left" as const },
        { label: "Net Wt (t)", width: 52, align: "right" as const },
        { label: "Price/Ton", width: 52, align: "right" as const },
        { label: "Currency", width: 38, align: "left" as const },
        { label: "Fodder Value", width: 55, align: "right" as const },
        { label: "Trucking", width: 50, align: "right" as const },
        { label: "Grade", width: 40, align: "left" as const },
        { label: "Warehouse", width: 90, align: "left" as const },
        { label: "Officer", width: 70, align: "left" as const },
      ];

      // Adjust column widths to fit page
      const totalColW = cols.reduce((s, c) => s + c.width, 0);
      const scale = pageW / totalColW;
      cols.forEach((c) => (c.width = Math.floor(c.width * scale)));

      // Table header
      let cx = 40;
      doc.rect(40, tableY, pageW, 18).fill(GREEN);
      cols.forEach((c) => {
        doc.fontSize(6.5).font("DMSans-Bold").fillColor("#fff")
          .text(c.label, cx + 3, tableY + 5, { width: c.width - 6, align: c.align });
        cx += c.width;
      });

      // Table rows
      let ry = tableY + 18;
      const rowH = 16;
      const maxRowsPerPage = Math.floor((doc.page.height - 80 - ry) / rowH);

      rows.forEach((r: any, i: number) => {
        // Check if we need a new page
        if (ry + rowH > doc.page.height - 60) {
          doc.addPage();
          ry = 40;
          // Repeat header
          cx = 40;
          doc.rect(40, ry, pageW, 18).fill(GREEN);
          cols.forEach((c) => {
            doc.fontSize(6.5).font("DMSans-Bold").fillColor("#fff")
              .text(c.label, cx + 3, ry + 5, { width: c.width - 6, align: c.align });
            cx += c.width;
          });
          ry += 18;
        }

        // Alternate row background
        if (i % 2 === 0) {
          doc.rect(40, ry, pageW, rowH).fill("#FAFAF8");
        } else {
          doc.rect(40, ry, pageW, rowH).fill("#fff");
        }

        cx = 40;
        const dateStr = r.loadingDate
          ? new Date(r.loadingDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
          : "—";

        const cellData = [
          String(i + 1),
          dateStr,
          r.poNumber,
          r.shipmentRef,
          r.product,
          r.netWeightTons > 0 ? r.netWeightTons.toFixed(2) : "—",
          r.pricePerTon > 0 ? r.pricePerTon.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "\u2014",
          r.currency || "—",
          r.totalValue > 0 ? fV(Math.round(r.totalValue)) : "—",
          r.truckingCost > 0 ? fV(Math.round(r.truckingCost)) : "—",
          r.grade !== "—" ? r.grade.replace("grade_", "G") : "—",
          r.warehouse,
          r.officer,
        ];

        cellData.forEach((val, ci) => {
          const isNum = cols[ci].align === "right";
          doc.fontSize(6).font(isNum && ci === 5 ? "DMSans-Bold" : "DMSans").fillColor(TEXT_DARK)
            .text(val, cx + 3, ry + 4, { width: cols[ci].width - 6, align: cols[ci].align, lineBreak: false });
          cx += cols[ci].width;
        });

        ry += rowH;
      });

      // Totals row
      if (rows.length > 0) {
        if (ry + rowH > doc.page.height - 60) {
          doc.addPage();
          ry = 40;
        }
        doc.rect(40, ry, pageW, rowH + 2).fill("#E4EFE6");
        cx = 40;
        doc.fontSize(7).font("DMSans-Bold").fillColor(GREEN)
          .text(`TOTALS (${rows.length} receipts)`, cx + 3, ry + 4, { width: cols[0].width + cols[1].width + cols[2].width + cols[3].width + cols[4].width - 6 });

        // Net weight total
        cx = 40;
        for (let ci = 0; ci < 5; ci++) cx += cols[ci].width;
        doc.fontSize(7).font("DMSans-Bold").fillColor(GREEN)
          .text(totalNetWeight.toFixed(2), cx + 3, ry + 4, { width: cols[5].width - 6, align: "right" });

        // Avg price
        cx += cols[5].width;
        doc.fontSize(6).font("DMSans").fillColor(TEXT_MUTED)
          .text(`avg ${avgPrice.toFixed(2)}`, cx + 3, ry + 4, { width: cols[6].width - 6, align: "right" });

        // Total fodder value
        cx += cols[6].width + cols[7].width;
        doc.fontSize(7).font("DMSans-Bold").fillColor(GREEN)
          .text(fV(Math.round(totalValue)), cx + 3, ry + 4, { width: cols[8].width - 6, align: "right" });

        // Total trucking cost
        cx += cols[8].width;
        if (totalTruckingCost > 0) {
          doc.fontSize(7).font("DMSans-Bold").fillColor("#D4960A")
            .text(fV(Math.round(totalTruckingCost)), cx + 3, ry + 4, { width: cols[9].width - 6, align: "right" });
        }
      }

      // ─── FOOTER ────────────────────────────────────────────────────────
      const footerY = doc.page.height - 30;
      doc.fontSize(6).font("DMSans").fillColor(TEXT_LIGHT)
        .text("Platfarm for Agritech and Agribusiness Ltd | Abu Dhabi Global Market", 40, footerY, { align: "center", width: pageW })
        .text("This is a system-generated document.", 40, footerY + 10, { align: "center", width: pageW });

      doc.end();
    } catch (err: any) {
      console.error("[Supply Statement PDF] Error:", err);
      if (!res.headersSent) {
        res.status(500).send("Failed to generate PDF: " + (err.message || "Unknown error"));
      }
    }
  });
}
