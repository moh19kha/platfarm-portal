import jsPDF from "jspdf";
import { PLATFARM_LOGO_BASE64 } from "./logoBase64";
import { DM_SANS_REGULAR, DM_SANS_BOLD, DM_SANS_ITALIC } from "./dmSansFont";
import { type OfferData, calculateDeal } from "./generatePdf";

function registerDMSans(pdf: jsPDF) {
  pdf.addFileToVFS("DMSans-Regular.ttf", DM_SANS_REGULAR);
  pdf.addFont("DMSans-Regular.ttf", "DMSans", "normal");
  pdf.addFileToVFS("DMSans-Bold.ttf", DM_SANS_BOLD);
  pdf.addFont("DMSans-Bold.ttf", "DMSans", "bold");
  pdf.addFileToVFS("DMSans-Italic.ttf", DM_SANS_ITALIC);
  pdf.addFont("DMSans-Italic.ttf", "DMSans", "italic");
}

export interface ContractData extends OfferData {
  contractStartDate: string;
  chequeNumber: string;
  chequeIssuedBy: string;
  chequeBank: string;
  chequeDueDate: string;
  contractNumber: string;
  investorIdNumber: string;
  companyRepIdNumber: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Colors
const GREEN = [45, 90, 61] as const;
const GREEN_LIGHT = [74, 124, 89] as const;
const TERRACOTTA = [192, 113, 74] as const;
const DARK = [44, 62, 80] as const;
const GRAY = [102, 102, 102] as const;
const LIGHT_GRAY = [153, 153, 153] as const;
const TABLE_BG = [248, 250, 248] as const;
const TABLE_BORDER = [213, 229, 213] as const;
const HIGHLIGHT_BG = [238, 245, 238] as const;

function addAccentBar(pdf: jsPDF) {
  pdf.setFillColor(...GREEN);
  pdf.rect(0, 0, 105, 1.5, "F");
  pdf.setFillColor(...TERRACOTTA);
  pdf.rect(105, 0, 105, 1.5, "F");
}

function addFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const pageW = 210;
  const marginL = 20;
  const marginR = 20;
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, 280, pageW - marginR, 280);
  pdf.setFont("DMSans", "italic");
  pdf.setFontSize(6);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text("Murabaha Financing Agreement — Platfarm for Agritech and Agribusiness Ltd - Abu Dhabi", marginL, 284);
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageW - marginR, 284, { align: "right" });
}

function checkPageBreak(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > 272) {
    pdf.addPage();
    addAccentBar(pdf);
    return 14;
  }
  return y;
}

export async function generateContractPdf(data: ContractData): Promise<void> {
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

  // ===== PAGE 1 =====
  addAccentBar(pdf);
  y = 8;

  // Logo & Header
  const logoW = 22;
  const logoH = 6.3;
  try {
    pdf.addImage(PLATFARM_LOGO_BASE64, "PNG", marginL, y + 1, logoW, logoH);
  } catch (e) {
    console.warn("Could not add logo:", e);
  }

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
  pdf.text(formatDate(data.contractStartDate), pageW - marginR, y + 3, { align: "right" });
  pdf.setFontSize(7.5);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text(`Contract No: ${data.contractNumber}`, pageW - marginR, y + 7, { align: "right" });
  pdf.text("CN-5031199", pageW - marginR, y + 10.5, { align: "right" });

  y += 17;

  // Header line
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.6);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ===== TITLE =====
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(...DARK);
  pdf.text("Murabaha Financing Agreement", marginL, y);
  y += 6;

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text(`Islamic Commodity Financing \u2014 ${data.product}`, marginL, y);
  y += 8;

  // ===== PARTIES =====
  // Party 1 - Platfarm
  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.8);
  pdf.rect(marginL, y, contentW, 24, "F");
  pdf.line(marginL, y, marginL, y + 24);

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(6);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text("FIRST PARTY (AGENT / MUDARIB)", marginL + 5, y + 4.5);

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  pdf.text("Platfarm for Agritech and Agribusiness Ltd - Abu Dhabi", marginL + 5, y + 9.5);

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRAY);
  pdf.text("Represented by: Mohamed Khalil \u2014 Managing Director", marginL + 5, y + 13.5);
  if (data.companyRepIdNumber) {
    pdf.text(`ID / Passport No: ${data.companyRepIdNumber}`, marginL + 5, y + 17.5);
  }
  pdf.text("Address: Office 16-120, Floor 16, Al Khatem Tower, Abu Dhabi Global Market Square, Al Maryah Island, Abu Dhabi, UAE", marginL + 5, y + (data.companyRepIdNumber ? 21.5 : 17.5));

  y += (data.companyRepIdNumber ? 28 : 24);

  // Party 2 - Investor
  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(...TERRACOTTA);
  pdf.setLineWidth(0.8);
  pdf.rect(marginL, y, contentW, 16, "F");
  pdf.line(marginL, y, marginL, y + 16);

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(6);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text("SECOND PARTY (INVESTOR / RABB AL-MAL)", marginL + 5, y + 4.5);

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  pdf.text(data.investorName, marginL + 5, y + 9.5);

  if (data.investorIdNumber) {
    pdf.setFont("DMSans", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY);
    pdf.text(`ID / Passport No: ${data.investorIdNumber}`, marginL + 5, y + 13.5);
  }

  y += 20;

  // ===== PREAMBLE =====
  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const preamble = pdf.splitTextToSize(
    `This Murabaha Financing Agreement ("Agreement") is entered into on ${formatDate(data.contractStartDate)}, between the First Party and the Second Party (collectively referred to as the "Parties"), in accordance with the principles of Islamic Sharia, specifically the Murabaha (cost-plus financing) structure. Both Parties agree to be bound by the terms and conditions set forth herein.`,
    contentW
  );
  pdf.text(preamble, marginL, y);
  y += preamble.length * 3.8 + 6;

  // ===== ARTICLE 1: NATURE OF TRANSACTION =====
  y = checkPageBreak(pdf, y, 40);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 1 — Nature of the Transaction", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const art1p1 = pdf.splitTextToSize(
    `This Agreement governs a Murabaha financing arrangement whereby the Second Party (Investor) provides capital to the First Party (Platfarm) for the purchase and resale of the commodity described below. The First Party shall act as the purchasing and selling agent, procuring the commodity at the agreed purchase price and reselling it at the agreed selling price on behalf of the transaction.`,
    contentW
  );
  pdf.text(art1p1, marginL, y);
  y += art1p1.length * 3.8 + 3;

  const art1p2 = pdf.splitTextToSize(
    `In accordance with Islamic Murabaha principles, the cost of the commodity, the markup, and all associated terms are fully disclosed and agreed upon by both Parties prior to execution. This transaction is structured to ensure full transparency, mutual consent, and compliance with Sharia requirements.`,
    contentW
  );
  pdf.text(art1p2, marginL, y);
  y += art1p2.length * 3.8 + 6;

  // ===== ARTICLE 2: COMMODITY & TRANSACTION DETAILS =====
  y = checkPageBreak(pdf, y, 55);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 2 — Commodity & Transaction Details", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  // Transaction details table
  const detailRows = [
    ["Commodity", data.product],
    ["Quantity", `${data.quantity.toLocaleString()} Metric Tons`],
    ["Incoterm", data.incoterm],
    ["Purchase Price (per Ton)", `${fmt(data.costPerTon)} AED`],
    ["Total Purchase Cost (Investment)", `${fmt(calc.totalInvestment)} AED`],
    ["Estimated Selling Price (per Ton)", `${fmt(data.sellingPerTon)} AED`],
    ["Total Estimated Revenue", `${fmt(calc.totalRevenue)} AED`],
    ["Estimated Gross Profit", `${fmt(calc.grossProfit)} AED`],
    ["Collection Period", `${data.investmentPeriodDays} Days (${months} Month${months !== 1 ? "s" : ""})`],
  ];

  // Table header
  pdf.setFillColor(...GREEN);
  pdf.rect(marginL, y, contentW, 7, "F");
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text("TRANSACTION DETAILS", marginL + 6, y + 5);
  y += 7;

  detailRows.forEach((row, i) => {
    const rowH = 7.5;
    y = checkPageBreak(pdf, y, rowH);

    pdf.setFillColor(i % 2 === 0 ? TABLE_BG[0] : 255, i % 2 === 0 ? TABLE_BG[1] : 255, i % 2 === 0 ? TABLE_BG[2] : 255);
    pdf.rect(marginL, y, contentW, rowH, "F");

    pdf.setDrawColor(...TABLE_BORDER);
    pdf.setLineWidth(0.15);
    pdf.line(marginL, y + rowH, marginL + contentW, y + rowH);

    pdf.setFont("DMSans", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...GRAY);
    pdf.text(row[0], marginL + 6, y + 5.2);

    pdf.setFont("DMSans", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(row[1], pageW - marginR - 6, y + 5.2, { align: "right" });

    y += rowH;
  });

  // Border around table
  pdf.setDrawColor(...TABLE_BORDER);
  pdf.setLineWidth(0.3);
  const tableStartY = y - detailRows.length * 7.5 - 7;
  pdf.rect(marginL, tableStartY, contentW, detailRows.length * 7.5 + 7);

  y += 8;

  // ===== ARTICLE 3: PROFIT & LOSS SHARING =====
  y = checkPageBreak(pdf, y, 70);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 3 — Profit & Loss Sharing", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const art3p1 = pdf.splitTextToSize(
    `3.1  In adherence to the principles of Islamic Murabaha and Sharia-compliant financing, both Parties acknowledge and agree that the distribution of profit and the bearing of loss shall be governed by the following provisions:`,
    contentW
  );
  pdf.text(art3p1, marginL, y);
  y += art3p1.length * 3.8 + 3;

  const art3p2 = pdf.splitTextToSize(
    `3.2  Profit Distribution: Upon the successful completion of the sale and the receipt of proceeds from the buyer, the gross profit shall be distributed among the Parties as follows:`,
    contentW
  );
  pdf.text(art3p2, marginL, y);
  y += art3p2.length * 3.8 + 4;

  // Profit distribution table
  y = checkPageBreak(pdf, y, 40);
  const col1W = contentW * 0.55;
  const col2W = contentW * 0.2;
  const col3W = contentW * 0.25;

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("PARTY", marginL + 4, y + 4);
  pdf.text("SHARE", marginL + col1W + col2W / 2, y + 4, { align: "center" });
  pdf.text("ESTIMATED AMOUNT", pageW - marginR - 4, y + 4, { align: "right" });

  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.5);
  pdf.line(marginL, y + 6, pageW - marginR, y + 6);
  y += 10;

  const profitRows = [
    [`Investor (${data.investorName})`, `${data.investorSharePct}%`, `${fmt(calc.investorProfit)} AED`],
    ["Platfarm", `${data.platfarmSharePct}%`, `${fmt(calc.platfarmProfit)} AED`],
    ["General & Administrative (G&A)", `${data.gaSharePct}%`, `${fmt(calc.gaProfit)} AED`],
    ["Total Gross Profit", "100%", `${fmt(calc.grossProfit)} AED`],
  ];

  profitRows.forEach((row, i) => {
    const isTotal = i === profitRows.length - 1;
    const rowH = 8;
    y = checkPageBreak(pdf, y, rowH);

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

  y += 5;

  // Loss sharing clause
  y = checkPageBreak(pdf, y, 30);
  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  const art3p3 = pdf.splitTextToSize(
    `3.3  Loss Bearing: While the First Party has exercised, and shall continue to exercise, thorough due diligence in the selection of the commodity, the negotiation of purchase and sale terms, and the overall management of this transaction — and while the likelihood of a loss occurring is considered remote given the established commercial arrangements and secured buyer commitments — both Parties acknowledge, in the spirit of Islamic finance and in strict compliance with Murabaha principles, that no commercial transaction is entirely free of risk. In the unlikely event that the transaction results in a verified loss, such loss shall be borne equally by the First Party (Platfarm) and the Second Party (Investor), each bearing fifty percent (50%) of the total loss incurred, unless the loss is directly attributable to the gross negligence, willful misconduct, or breach of fiduciary duty by one Party, in which case the responsible Party shall bear the full extent of such loss.`,
    contentW
  );
  pdf.text(art3p3, marginL, y);
  y += art3p3.length * 3.8 + 3;

  y = checkPageBreak(pdf, y, 25);
  const art3p4 = pdf.splitTextToSize(
    `3.4  Evidence of Loss: In the event that a loss is claimed, the First Party shall be obligated to provide the Second Party with comprehensive and verifiable documentary evidence substantiating the nature, cause, and extent of such loss. This evidence shall include, but not be limited to, purchase and sale invoices, shipping documents, bank statements, market price records, and any other relevant commercial documentation. No loss shall be recognized or allocated between the Parties unless it is fully justified and supported by such documentation to the reasonable satisfaction of both Parties.`,
    contentW
  );
  pdf.text(art3p4, marginL, y);
  y += art3p4.length * 3.8 + 6;

  // ===== ARTICLE 4: INVESTOR RETURNS =====
  y = checkPageBreak(pdf, y, 65);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 4 — Estimated Investor Returns", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  const art4intro = pdf.splitTextToSize(
    `Based on the transaction parameters outlined above, the estimated returns for the Investor are summarized as follows. These figures are projections based on the agreed selling price and are subject to the actual outcome of the transaction:`,
    contentW
  );
  pdf.text(art4intro, marginL, y);
  y += art4intro.length * 3.8 + 4;

  // Investor returns table
  y = checkPageBreak(pdf, y, 60);
  pdf.setFillColor(...GREEN);
  pdf.rect(marginL, y, contentW, 7, "F");
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text("ESTIMATED INVESTOR RETURNS", marginL + 6, y + 5);
  y += 7;

  const returnRows = [
    ["Investment Amount (Principal)", `${fmt(calc.totalInvestment)} AED`],
    ["Investment Period", `${data.investmentPeriodDays} Days (${months} Month${months !== 1 ? "s" : ""})`],
    [`Investor Profit Share (${data.investorSharePct}%)`, `${fmt(calc.investorProfit)} AED`],
    ["Total Return to Investor", `${fmt(calc.totalReturnToInvestor)} AED`],
    ["Total Return on Investment (ROI)", `${calc.totalRoiPct.toFixed(2)}%`],
    ["Monthly ROI", `${calc.monthlyRoiPct.toFixed(2)}%`],
  ];

  returnRows.forEach((row, i) => {
    const isHighlight = i >= 4;
    const rowH = 8;
    y = checkPageBreak(pdf, y, rowH);

    if (isHighlight) {
      pdf.setFillColor(...HIGHLIGHT_BG);
    } else {
      pdf.setFillColor(...TABLE_BG);
    }
    pdf.rect(marginL, y, contentW, rowH, "F");

    pdf.setDrawColor(...TABLE_BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(marginL, y + rowH, marginL + contentW, y + rowH);

    pdf.setFont("DMSans", isHighlight ? "bold" : "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(row[0], marginL + 6, y + 6);

    pdf.setFont("DMSans", "bold");
    pdf.setFontSize(isHighlight ? 10.5 : 9.5);
    pdf.setTextColor(isHighlight ? GREEN[0] : DARK[0], isHighlight ? GREEN[1] : DARK[1], isHighlight ? GREEN[2] : DARK[2]);
    pdf.text(row[1], pageW - marginR - 6, y + 6, { align: "right" });

    y += rowH;
  });

  y += 8;

  // ===== ARTICLE 5: SECURITY CHEQUE =====
  y = checkPageBreak(pdf, y, 45);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 5 — Security Cheque & Repayment", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const chequeIssuer = data.chequeIssuedBy || "Platfarm for Agritech and Agribusiness Ltd - Abu Dhabi";
  const art5p1 = pdf.splitTextToSize(
    `5.1  As security for the invested capital, the First Party shall cause a post-dated cheque to be issued to the Second Party for the full investment amount (principal). The cheque shall be issued under the name and account of ${chequeIssuer}, and the company shall bear full legal and financial responsibility for the said cheque. The details of the security cheque are as follows:`,
    contentW
  );
  pdf.text(art5p1, marginL, y);
  y += art5p1.length * 3.8 + 4;

  // Cheque details table
  y = checkPageBreak(pdf, y, 30);
  const chequeRows = [
    ["Cheque Number", data.chequeNumber],
    ["Bank Name", data.chequeBank || "—"],
    ["Cheque Amount (Investment Principal)", `${fmt(calc.totalInvestment)} AED`],
    ["Cheque Due Date", formatDate(data.chequeDueDate)],
    ["Issued By (Company Account)", data.chequeIssuedBy || "Platfarm for Agritech and Agribusiness Ltd - Abu Dhabi"],
    ["Payable To", data.investorName],
  ];

  chequeRows.forEach((row, i) => {
    const rowH = 7.5;
    y = checkPageBreak(pdf, y, rowH);

    pdf.setFillColor(i % 2 === 0 ? TABLE_BG[0] : 255, i % 2 === 0 ? TABLE_BG[1] : 255, i % 2 === 0 ? TABLE_BG[2] : 255);
    pdf.rect(marginL, y, contentW, rowH, "F");
    pdf.setDrawColor(...TABLE_BORDER);
    pdf.setLineWidth(0.15);
    pdf.line(marginL, y + rowH, marginL + contentW, y + rowH);

    pdf.setFont("DMSans", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...GRAY);
    pdf.text(row[0], marginL + 6, y + 5.2);

    pdf.setFont("DMSans", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(row[1], pageW - marginR - 6, y + 5.2, { align: "right" });

    y += rowH;
  });

  y += 4;

  y = checkPageBreak(pdf, y, 15);
  const art5p2 = pdf.splitTextToSize(
    `5.2  The cheque serves as a guarantee of the principal investment amount. Upon the successful completion of the transaction and the distribution of profits as outlined in Article 3, the cheque shall be returned to the First Party. In the event that the transaction is not completed within the agreed timeframe, the Second Party retains the right to deposit the cheque on the due date.`,
    contentW
  );
  pdf.text(art5p2, marginL, y);
  y += art5p2.length * 3.8 + 6;

  // ===== ARTICLE 6: TERM & DURATION =====
  y = checkPageBreak(pdf, y, 30);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 6 — Term & Duration", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const art6p1 = pdf.splitTextToSize(
    `6.1  This Agreement shall commence on ${formatDate(data.contractStartDate)} and shall remain in effect for a period of ${data.investmentPeriodDays} days (approximately ${months} month${months !== 1 ? "s" : ""}), unless extended by mutual written consent of both Parties.`,
    contentW
  );
  pdf.text(art6p1, marginL, y);
  y += art6p1.length * 3.8 + 3;

  const art6p2 = pdf.splitTextToSize(
    `6.2  The First Party shall use its best efforts to complete the sale and collect proceeds within the agreed collection period. Any material delay shall be communicated to the Second Party in writing with a revised timeline.`,
    contentW
  );
  pdf.text(art6p2, marginL, y);
  y += art6p2.length * 3.8 + 6;

  // ===== ARTICLE 7: GOVERNING PRINCIPLES =====
  y = checkPageBreak(pdf, y, 30);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 7 — Governing Principles", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const art7p1 = pdf.splitTextToSize(
    `7.1  This Agreement is governed by the principles of Islamic Sharia, specifically the rules pertaining to Murabaha transactions as recognized by established Islamic jurisprudence. Any dispute arising from this Agreement shall first be resolved through amicable negotiation between the Parties.`,
    contentW
  );
  pdf.text(art7p1, marginL, y);
  y += art7p1.length * 3.8 + 3;

  const art7p2 = pdf.splitTextToSize(
    `7.2  In the event that a dispute cannot be resolved amicably, the Parties agree to submit the matter to arbitration in accordance with the rules of the Abu Dhabi Courts, whose decision shall be final and binding.`,
    contentW
  );
  pdf.text(art7p2, marginL, y);
  y += art7p2.length * 3.8 + 6;

  // ===== ARTICLE 8: GENERAL PROVISIONS =====
  y = checkPageBreak(pdf, y, 35);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 8 — General Provisions", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const art8p1 = pdf.splitTextToSize(
    `8.1  This Agreement constitutes the entire understanding between the Parties with respect to the subject matter hereof and supersedes all prior negotiations, representations, and agreements.`,
    contentW
  );
  pdf.text(art8p1, marginL, y);
  y += art8p1.length * 3.8 + 3;

  const art8p2 = pdf.splitTextToSize(
    `8.2  No amendment or modification of this Agreement shall be valid unless made in writing and signed by both Parties.`,
    contentW
  );
  pdf.text(art8p2, marginL, y);
  y += art8p2.length * 3.8 + 3;

  const art8p3 = pdf.splitTextToSize(
    `8.3  This Agreement is executed in two (2) original copies, one for each Party, each having equal legal force and effect.`,
    contentW
  );
  pdf.text(art8p3, marginL, y);
  y += art8p3.length * 3.8 + 8;

  // ===== ARTICLE 9: CONFIDENTIALITY =====
  y = checkPageBreak(pdf, y, 50);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Article 9 — Confidentiality", marginL, y);
  y += 1.5;
  pdf.setDrawColor(224, 224, 224);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);

  const art9p1 = pdf.splitTextToSize(
    `9.1  Both Parties hereby undertake and irrevocably agree to maintain the strictest and absolute confidentiality with respect to all terms, conditions, financial details, commercial arrangements, and any other information disclosed or arising under this Agreement (collectively, the "Confidential Information"). Neither Party shall, directly or indirectly, disclose, divulge, communicate, publish, or otherwise make available any Confidential Information to any third party, whether natural or legal person, without the prior express written consent of the other Party.`,
    contentW
  );
  pdf.text(art9p1, marginL, y);
  y += art9p1.length * 3.8 + 3;

  y = checkPageBreak(pdf, y, 20);
  const art9p2 = pdf.splitTextToSize(
    `9.2  This obligation of confidentiality shall survive the termination or expiration of this Agreement and shall remain in full force and effect indefinitely. Any breach of this confidentiality obligation shall entitle the aggrieved Party to seek all available legal remedies, including but not limited to injunctive relief and damages.`,
    contentW
  );
  pdf.text(art9p2, marginL, y);
  y += art9p2.length * 3.8 + 3;

  y = checkPageBreak(pdf, y, 15);
  const art9p3 = pdf.splitTextToSize(
    `9.3  For the avoidance of doubt, Confidential Information includes, without limitation, the investment amount, profit distribution structure, pricing terms, product details, counterparty identities, and any correspondence exchanged between the Parties in connection with this Agreement.`,
    contentW
  );
  pdf.text(art9p3, marginL, y);
  y += art9p3.length * 3.8 + 10;

  // ===== SIGNATURES =====
  y = checkPageBreak(pdf, y, 70);
  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("Signatures", marginL, y);
  y += 1.5;
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.5);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 5;

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  const sigIntro = pdf.splitTextToSize(
    `IN WITNESS WHEREOF, the Parties have executed this Murabaha Financing Agreement on the date first written above, each having read and understood all terms and conditions contained herein.`,
    contentW
  );
  pdf.text(sigIntro, marginL, y);
  y += sigIntro.length * 3.8 + 6;

  // Date line
  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...GRAY);
  pdf.text(`Date: ${formatDate(data.contractStartDate)}`, marginL, y);
  y += 8;

  // Two-column signatures
  const sigColW = contentW / 2 - 5;

  // Left: Platfarm
  y = checkPageBreak(pdf, y, 55);
  pdf.setFillColor(248, 249, 250);
  pdf.rect(marginL, y, sigColW, 50, "F");
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.5);
  pdf.line(marginL, y, marginL + sigColW, y);

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...GREEN_LIGHT);
  pdf.text("FIRST PARTY (AGENT / MUDARIB)", marginL + 5, y + 6);

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...DARK);
  pdf.text("Mohamed Khalil", marginL + 5, y + 13);

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRAY);
  pdf.text("Managing Director", marginL + 5, y + 17);
  pdf.text("Platfarm for Agritech and", marginL + 5, y + 21);
  pdf.text("Agribusiness Ltd - Abu Dhabi", marginL + 5, y + 25);
  if (data.companyRepIdNumber) {
    pdf.text(`ID No: ${data.companyRepIdNumber}`, marginL + 5, y + 29);
  }

  // Signature line
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.3);
  pdf.line(marginL + 5, y + 38, marginL + sigColW - 5, y + 38);
  pdf.setFont("DMSans", "italic");
  pdf.setFontSize(7);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text("Signature & Stamp", marginL + 5, y + 42);

  // Right: Investor
  const rightX = marginL + sigColW + 10;
  pdf.setFillColor(248, 249, 250);
  pdf.rect(rightX, y, sigColW, 50, "F");
  pdf.setDrawColor(...TERRACOTTA);
  pdf.setLineWidth(0.5);
  pdf.line(rightX, y, rightX + sigColW, y);

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...TERRACOTTA);
  pdf.text("SECOND PARTY (INVESTOR / RABB AL-MAL)", rightX + 5, y + 6);

  pdf.setFont("DMSans", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...DARK);
  pdf.text(data.investorName, rightX + 5, y + 13);

  pdf.setFont("DMSans", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRAY);
  pdf.text("Investor", rightX + 5, y + 17);
  if (data.investorIdNumber) {
    pdf.text(`ID No: ${data.investorIdNumber}`, rightX + 5, y + 21);
  }

  // Signature line
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.3);
  pdf.line(rightX + 5, y + 38, rightX + sigColW - 5, y + 38);
  pdf.setFont("DMSans", "italic");
  pdf.setFontSize(7);
  pdf.setTextColor(...LIGHT_GRAY);
  pdf.text("Signature", rightX + 5, y + 42);

  y += 55;

  // ===== ADD FOOTERS TO ALL PAGES =====
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    addFooter(pdf, p, totalPages);
  }

  // Download
  const investorSlug = data.investorName.replace(/\s+/g, "_");
  pdf.save(`Murabaha_Contract_${investorSlug}.pdf`);
}
