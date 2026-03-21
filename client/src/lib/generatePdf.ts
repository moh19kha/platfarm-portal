// jsPDF is loaded dynamically — the 390 KB bundle only downloads when a PDF is generated
import type { jsPDF as JsPDFInstance } from "jspdf";
import { PLATFARM_LOGO_BASE64 } from "./logoBase64";
import { DM_SANS_REGULAR, DM_SANS_BOLD, DM_SANS_ITALIC } from "./dmSansFont";

function registerDMSans(pdf: JsPDFInstance) {
  pdf.addFileToVFS("DMSans-Regular.ttf", DM_SANS_REGULAR);
  pdf.addFont("DMSans-Regular.ttf", "DMSans", "normal");
  pdf.addFileToVFS("DMSans-Bold.ttf", DM_SANS_BOLD);
  pdf.addFont("DMSans-Bold.ttf", "DMSans", "bold");
  pdf.addFileToVFS("DMSans-Italic.ttf", DM_SANS_ITALIC);
  pdf.addFont("DMSans-Italic.ttf", "DMSans", "italic");
}

export interface OfferData {
  investorName: string;
  product: string;
  quantity: number;
  incoterm: string;
  costPerTon: number;
  sellingPerTon: number;
  investmentPeriodDays: number;
  investorSharePct: number;
  platfarmSharePct: number;
  gaSharePct: number;
  date: string;
  refNumber: string;
}

export interface CalculatedData {
  totalInvestment: number;
  totalRevenue: number;
  grossProfit: number;
  grossProfitPerTon: number;
  grossMarginPct: number;
  markupPct: number;
  investorProfit: number;
  platfarmProfit: number;
  gaProfit: number;
  totalReturnToInvestor: number;
  totalRoiPct: number;
  monthlyRoiPct: number;
}

export function calculateDeal(data: OfferData): CalculatedData {
  const totalInvestment = data.costPerTon * data.quantity;
  const totalRevenue = data.sellingPerTon * data.quantity;
  const grossProfit = totalRevenue - totalInvestment;
  const grossProfitPerTon = data.sellingPerTon - data.costPerTon;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const markupPct = totalInvestment > 0 ? (grossProfit / totalInvestment) * 100 : 0;
  const investorProfit = grossProfit * (data.investorSharePct / 100);
  const platfarmProfit = grossProfit * (data.platfarmSharePct / 100);
  const gaProfit = grossProfit * (data.gaSharePct / 100);
  const totalReturnToInvestor = totalInvestment + investorProfit;
  const months = data.investmentPeriodDays / 30;
  const totalRoiPct = totalInvestment > 0 ? (investorProfit / totalInvestment) * 100 : 0;
  const monthlyRoiPct = months > 0 ? totalRoiPct / months : 0;

  return {
    totalInvestment,
    totalRevenue,
    grossProfit,
    grossProfitPerTon,
    grossMarginPct,
    markupPct,
    investorProfit,
    platfarmProfit,
    gaProfit,
    totalReturnToInvestor,
    totalRoiPct,
    monthlyRoiPct,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Colors
const GREEN = [45, 90, 61] as const;      // #2D5A3D
const GREEN_LIGHT = [74, 124, 89] as const; // #4A7C59
const TERRACOTTA = [192, 113, 74] as const; // #C0714A
const DARK = [44, 62, 80] as const;        // #2c3e50
const GRAY = [102, 102, 102] as const;
const LIGHT_GRAY = [153, 153, 153] as const;
const TABLE_BG = [248, 250, 248] as const;
const TABLE_BORDER = [213, 229, 213] as const;
const HIGHLIGHT_BG = [238, 245, 238] as const;

// Logo is embedded as base64 to avoid cross-origin issues

export async function generateOfferPdf(data: OfferData): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const calc = calculateDeal(data);
  const months = Math.round(data.investmentPeriodDays / 30);
  const investorLastName = data.investorName.trim().split(" ").pop() || data.investorName;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  registerDMSans(pdf);
  const pageW = 210;
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  // ===== ACCENT BAR =====
  pdf.setFillColor(...TERRACOTTA);
  pdf.rect(0, 0, 105, 1.5, "F");
  pdf.setFillColor(...GREEN);
  pdf.rect(0, 0, 105, 1.5, "F");
  // gradient effect: green left, terracotta right
  pdf.setFillColor(...GREEN);
  pdf.rect(0, 0, 105, 1.5, "F");
  pdf.setFillColor(...TERRACOTTA);
  pdf.rect(105, 0, 105, 1.5, "F");

  y = 8;

  // ===== LOGO & HEADER =====
  // Logo is 400x115px (aspect ratio ~3.48:1)
  const logoW = 22;
  const logoH = 6.3;
  try {
    pdf.addImage(PLATFARM_LOGO_BASE64, "PNG", marginL, y + 1, logoW, logoH);
  } catch (e) {
    console.warn("Could not add logo to PDF:", e);
  }

  // Company name next to logo
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...DARK);
  pdf.text("PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD - ABU DHABI", marginL + logoW + 3, y + 3);

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(136, 136, 136);
  pdf.text("Abu Dhabi, United Arab Emirates", marginL + logoW + 3, y + 6.5);
  pdf.text("Abu Dhabi Department of Economic Development", marginL + logoW + 3, y + 9.5);
  pdf.text("CN-5031199", marginL + logoW + 3, y + 12.5);

  // Date & Ref on right
  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...GRAY);
  pdf.text(formatDate(data.date), pageW - marginR, y + 3, { align: "right" });
  pdf.setFontSize(7.5);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text(`Ref: ${data.refNumber}`, pageW - marginR, y + 7, { align: "right" });
  pdf.text("CN-5031199", pageW - marginR, y + 10.5, { align: "right" });

  y += 17;

  // Header line
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.6);
  pdf.line(marginL, y, pageW - marginR, y);

  y += 8;

  // ===== TITLE =====
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...DARK);
  pdf.text("Investment Proposal", marginL, y);

  y += 6;
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text(`${data.product} Shipment Financing \u2014 ${data.investmentPeriodDays}-Day Cycle`, marginL, y);

  y += 8;

  // ===== ADDRESSEE =====
  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.8);
  pdf.rect(marginL, y, contentW, 12, "F");
  pdf.line(marginL, y, marginL, y + 12);

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(6);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text("PREPARED FOR", marginL + 5, y + 4.5);

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  pdf.text(data.investorName, marginL + 5, y + 9.5);

  y += 16;

  // ===== BODY TEXT =====
  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  pdf.text(`Dear Mr. ${investorLastName},`, marginL, y);

  y += 5;
  const para1 = pdf.splitTextToSize(
    `We are pleased to present this investment opportunity for the financing of a ${data.quantity.toLocaleString()}-metric-ton ${data.product} shipment. This deal offers a clear and profitable structure with a total investment cycle of approximately ${data.investmentPeriodDays} days, from the deployment of capital to the full return of principal and profit.`,
    contentW
  );
  pdf.text(para1, marginL, y);
  y += para1.length * 3.8 + 2;

  const para2 = pdf.splitTextToSize(
    `We are seeking a total investment of ${fmt(calc.totalInvestment)} AED to cover the full ${data.incoterm} cost of the ${data.product} shipment. Based on a secured selling price, the transaction is projected to generate a gross profit of ${fmt(calc.grossProfit)} AED.`,
    contentW
  );
  pdf.text(para2, marginL, y);
  y += para2.length * 3.8 + 4;

  // ===== INVESTOR SUMMARY SECTION =====
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Investor Summary", marginL, y);
  y += 1;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 3;

  // Summary table header
  pdf.setFillColor(...GREEN);
  pdf.rect(marginL, y, contentW, 7, "F");
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Your Investment at a Glance", marginL + 6, y + 5);
  y += 7;

  // Summary table rows
  const summaryRows = [
    ["Investment Amount", `${fmt(calc.totalInvestment)} AED`],
    ["Investment Period", `${data.investmentPeriodDays} Days (${months} Months)`],
    [`Your Profit Share (${data.investorSharePct}%)`, `${fmt(calc.investorProfit)} AED`],
    ["Total Return to Investor", `${fmt(calc.totalReturnToInvestor)} AED`],
    ["Total Return on Investment (ROI)", `${calc.totalRoiPct.toFixed(2)}%`],
    ["Monthly ROI", `${calc.monthlyRoiPct.toFixed(2)}%`],
  ];

  summaryRows.forEach((row, i) => {
    const isHighlight = i >= 4;
    const rowH = 8;

    if (isHighlight) {
      pdf.setFillColor(...HIGHLIGHT_BG);
    } else {
      pdf.setFillColor(...TABLE_BG);
    }
    pdf.rect(marginL, y, contentW, rowH, "F");

    // Border
    pdf.setDrawColor(...TABLE_BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(marginL, y + rowH, marginL + contentW, y + rowH);

    // Label
    pdf.setFont("DMSans", isHighlight ? "bold" : "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(row[0], marginL + 6, y + 6);

    // Value
    pdf.setFont("DMSans", "bold");
    pdf.setFontSize(isHighlight ? 10.5 : 9.5);
    pdf.setTextColor(isHighlight ? GREEN[0] : DARK[0], isHighlight ? GREEN[1] : DARK[1], isHighlight ? GREEN[2] : DARK[2]);
    pdf.text(row[1], pageW - marginR - 6, y + 6, { align: "right" });

    y += rowH;
  });

  // Border around summary
  pdf.setDrawColor(...TABLE_BORDER);
  pdf.setLineWidth(0.3);
  const summaryStartY = y - summaryRows.length * 8 - 7;
  pdf.rect(marginL, summaryStartY, contentW, summaryRows.length * 8 + 7);

  y += 8;

  // ===== CHECK IF WE NEED A NEW PAGE =====
  // Estimate remaining content height: ~90mm for profit section + conclusion + signature
  if (y > 195) {
    pdf.addPage();
    // Re-draw accent bar on new page
    pdf.setFillColor(...GREEN);
    pdf.rect(0, 0, 105, 1, "F");
    pdf.setFillColor(...TERRACOTTA);
    pdf.rect(105, 0, 105, 1, "F");
    y = 12;
  }

  // ===== PROFIT DISTRIBUTION =====
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Profit Distribution Structure", marginL, y);
  y += 2;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 6;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  const profitPara = pdf.splitTextToSize(
    `Upon the successful completion of the sale and receipt of funds from the buyer within the ${data.investmentPeriodDays}-day cycle, the gross profit of ${fmt(calc.grossProfit)} AED will be distributed as follows:`,
    contentW
  );
  pdf.text(profitPara, marginL, y);
  y += profitPara.length * 3.8 + 4;

  // Profit table header
  const col1W = contentW * 0.55;
  const col2W = contentW * 0.2;
  const col3W = contentW * 0.25;

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("PARTY", marginL + 4, y + 4);
  pdf.text("SHARE", marginL + col1W + col2W / 2, y + 4, { align: "center" });
  pdf.text("AMOUNT", marginL + contentW - 4, y + 4, { align: "right" });

  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.5);
  pdf.line(marginL, y + 6, pageW - marginR, y + 6);
  y += 10;

  // Profit table rows
  const profitRows = [
    [`Investor (${data.investorName})`, `${data.investorSharePct}%`, `${fmt(calc.investorProfit)} AED`],
    ["Platfarm", `${data.platfarmSharePct}%`, `${fmt(calc.platfarmProfit)} AED`],
    ["General & Administrative (G&A)", `${data.gaSharePct}%`, `${fmt(calc.gaProfit)} AED`],
    ["Total Gross Profit", "100%", `${fmt(calc.grossProfit)} AED`],
  ];

  profitRows.forEach((row, i) => {
    const isTotal = i === profitRows.length - 1;
    const rowH = 8;

    pdf.setFont("DMSans", isTotal ? "bold" : "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(row[0], marginL + 4, y + 5.5);

    pdf.setFont("DMSans", "normal");
    pdf.text(row[1], marginL + col1W + col2W / 2, y + 5.5, { align: "center" });

    pdf.setFont("DMSans", "bold");
    pdf.text(row[2], pageW - marginR - 4, y + 5.5, { align: "right" });

    if (isTotal) {
      pdf.setDrawColor(...GREEN);
      pdf.setLineWidth(0.5);
    } else {
      pdf.setDrawColor(238, 238, 238);
      pdf.setLineWidth(0.2);
    }
    pdf.line(marginL, y + rowH, pageW - marginR, y + rowH);

    y += rowH;
  });

  y += 6;

  // ===== CONCLUSION =====
  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const conc1 = pdf.splitTextToSize(
    "This financing opportunity offers a secure, transparent, and profitable short-term deployment of capital. The deal structure is straightforward, with costs and revenues clearly defined, minimizing risk and maximizing clarity.",
    contentW
  );
  pdf.text(conc1, marginL, y);
  y += conc1.length * 3.8 + 2;

  const conc2 = pdf.splitTextToSize(
    "We are confident in the successful execution of this transaction and look forward to partnering with you. Please do not hesitate to contact us to discuss this proposal further or to proceed with the financing agreement.",
    contentW
  );
  pdf.text(conc2, marginL, y);
  y += conc2.length * 3.8 + 8;

  // Check if signature fits on current page
  if (y > 260) {
    pdf.addPage();
    pdf.setFillColor(...GREEN);
    pdf.rect(0, 0, 105, 1, "F");
    pdf.setFillColor(...TERRACOTTA);
    pdf.rect(105, 0, 105, 1, "F");
    y = 12;
  }

  // ===== SIGNATURE =====
  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  pdf.text("Sincerely,", marginL, y);
  y += 5;

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.text("Platfarm for Agritech and Agribusiness Ltd - Abu Dhabi", marginL, y);
  y += 4;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRAY);
  pdf.text("Abu Dhabi, United Arab Emirates", marginL, y);
  y += 3.5;
  pdf.text("Abu Dhabi Department of Economic Development", marginL, y);
  y += 3.5;
  pdf.text("CN-5031199", marginL, y);
  y += 8;

  // ===== FOOTER =====
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.5);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 4;

  pdf.setFont("DMSans", "italic");
  pdf.setFontSize(6.5);
  pdf.setTextColor(...LIGHT_GRAY);
  const disclaimer = pdf.splitTextToSize(
    "Disclaimer: This document is for informational purposes only and does not constitute a formal offer to sell or a solicitation of an offer to buy any security. The projections contained herein are based on assumptions that are subject to change and are not guaranteed.",
    contentW
  );
  pdf.text(disclaimer, marginL, y);

  // Download
  const investorSlug = data.investorName.replace(/\s+/g, "_");
  pdf.save(`Finance_Offer_${investorSlug}.pdf`);
}
