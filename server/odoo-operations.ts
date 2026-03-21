import { executeKw } from "./odoo";

/**
 * Operations Dashboard Backend
 * Fetches data from Odoo for Sokhna facility operations:
 * - Supply chain (stock.move, purchase.order.line)
 * - Quality (quality.check, bale quality records)
 * - Production (mrp.production, stock.move)
 * - Export (sale.order, stock.picking)
 * - Logistics (stock.picking, fleet.vehicle)
 */

// ─── SUPPLY CHAIN ──────────────────────────────────────────────────────────

export async function fetchDailySupplyBySource(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch daily supply by source (Dakhla, Farafrah, Toshka)
   * Uses stock.move filtered by:
   * - company_id
   * - date between fromDate and toDate
   * - location_dest_id = warehouse stock location
   * Groups by date and source location
   */
  const domain = [
    ["company_id", "=", companyId],
    ["date", ">=", fromDate],
    ["date", "<=", toDate],
    ["state", "=", "done"],
    ["location_id.name", "in", ["Dakhla", "Farafrah", "Toshka"]],
  ];

  const moves = (await executeKw("stock.move", "search_read", [domain], {
    fields: [
      "id",
      "date",
      "location_id",
      "product_qty",
      "product_uom",
      "x_studio_net_weight_tons",
    ],
    limit: 10000,
  })) as any[];

  // Group by date and source
  const grouped: Record<string, Record<string, number>> = {};
  for (const move of moves) {
    const date = move.date.split(" ")[0]; // YYYY-MM-DD
    const source = move.location_id[1] || "Unknown";
    if (!grouped[date]) grouped[date] = {};
    grouped[date][source] = (grouped[date][source] || 0) + (move.x_studio_net_weight_tons || 0);
  }

  return Object.entries(grouped).map(([date, sources]) => ({
    date,
    ...sources,
  }));
}

export async function fetchCostPerTon(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch cost per ton by source
   * Uses purchase.order.line with cost calculation
   */
  const domain = [
    ["order_id.company_id", "=", companyId],
    ["order_id.date_order", ">=", fromDate],
    ["order_id.date_order", "<=", toDate],
    ["order_id.state", "in", ["purchase", "done"]],
  ];

  const lines = (await executeKw("purchase.order.line", "search_read", [domain], {
    fields: [
      "id",
      "order_id",
      "product_qty",
      "price_unit",
      "product_uom",
      "x_studio_source_location",
    ],
    limit: 10000,
  })) as any[];

  // Calculate cost per ton
  const grouped: Record<string, Record<string, number>> = {};
  for (const line of lines) {
    const date = line.order_id[1].split(" ")[0]; // Extract date from order name
    const source = line.x_studio_source_location || "Unknown";
    const costPerTon = line.price_unit * 1000; // Assuming price_unit is per kg
    if (!grouped[date]) grouped[date] = {};
    grouped[date][source] = costPerTon;
  }

  return Object.entries(grouped).map(([date, sources]) => ({
    date,
    ...sources,
  }));
}

export async function fetchSupplierRankings(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch supplier rankings by quantity and protein
   */
  const domain = [
    ["company_id", "=", companyId],
    ["date", ">=", fromDate],
    ["date", "<=", toDate],
    ["state", "=", "done"],
  ];

  const moves = (await executeKw("stock.move", "search_read", [domain], {
    fields: [
      "id",
      "partner_id",
      "product_qty",
      "x_studio_net_weight_tons",
      "x_studio_protein_content",
    ],
    limit: 10000,
  })) as any[];

  // Group by supplier
  const suppliers: Record<string, { qty: number; protein: number; count: number }> = {};
  for (const move of moves) {
    const supplier = move.partner_id[1] || "Unknown";
    if (!suppliers[supplier]) suppliers[supplier] = { qty: 0, protein: 0, count: 0 };
    suppliers[supplier].qty += move.x_studio_net_weight_tons || 0;
    suppliers[supplier].protein += move.x_studio_protein_content || 0;
    suppliers[supplier].count += 1;
  }

  return Object.entries(suppliers)
    .map(([name, data]) => ({
      name,
      qty: data.qty,
      protein: data.count > 0 ? data.protein / data.count : 0,
    }))
    .sort((a, b) => b.qty - a.qty);
}

// ─── QUALITY ──────────────────────────────────────────────────────────────

export async function fetchQualityRecords(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch quality check records
   * Uses quality.check model
   */
  const domain = [
    ["company_id", "=", companyId],
    ["x_studio_date", ">=", fromDate],
    ["x_studio_date", "<=", toDate],
  ];

  const records = (await executeKw("quality.check", "search_read", [domain], {
    fields: [
      "id",
      "x_studio_date",
      "x_studio_protein_content",
      "x_studio_moisture",
      "x_studio_visual_grade",
      "x_studio_source_location",
      "x_studio_supplier",
      "x_studio_bale_weight",
    ],
    limit: 10000,
  })) as any[];

  return records;
}

export async function fetchProteinUntested(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Count bales with missing protein test
   */
  const domain = [
    ["company_id", "=", companyId],
    ["x_studio_date", ">=", fromDate],
    ["x_studio_date", "<=", toDate],
    ["x_studio_protein_content", "=", false],
  ];

  const records = (await executeKw("quality.check", "search_read", [domain], {
    fields: ["id", "x_studio_date"],
    limit: 10000,
  })) as any[];

  // Group by date
  const grouped: Record<string, number> = {};
  for (const record of records) {
    const date = record.x_studio_date.split(" ")[0];
    grouped[date] = (grouped[date] || 0) + 1;
  }

  return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}

// ─── PRODUCTION ──────────────────────────────────────────────────────────

export async function fetchProductionPerformance(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch production performance (produced vs quality assessed)
   * Uses mrp.production and quality.check
   */
  const domain = [
    ["company_id", "=", companyId],
    ["x_studio_production_date_start_of_shift", ">=", fromDate],
    ["x_studio_production_date_start_of_shift", "<=", toDate],
    ["state", "=", "done"],
  ];

  const productions = (await executeKw("mrp.production", "search_read", [domain], {
    fields: [
      "id",
      "x_studio_production_date_start_of_shift",
      "product_qty",
      "x_studio_quality_assessed_qty",
    ],
    limit: 10000,
  })) as any[];

  // Group by date
  const grouped: Record<string, { produced: number; assessed: number }> = {};
  for (const prod of productions) {
    const date = prod.x_studio_production_date_start_of_shift.split(" ")[0];
    if (!grouped[date]) grouped[date] = { produced: 0, assessed: 0 };
    grouped[date].produced += prod.product_qty || 0;
    grouped[date].assessed += prod.x_studio_quality_assessed_qty || 0;
  }

  return Object.entries(grouped).map(([date, data]) => ({
    date,
    produced: data.produced,
    qualityAssessed: data.assessed,
  }));
}

export async function fetchBaleWeightDistribution(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch bale weight distribution (7 ranges)
   */
  const domain = [
    ["company_id", "=", companyId],
    ["x_studio_date", ">=", fromDate],
    ["x_studio_date", "<=", toDate],
  ];

  const records = (await executeKw("quality.check", "search_read", [domain], {
    fields: ["id", "x_studio_bale_weight"],
    limit: 10000,
  })) as any[];

  const ranges = {
    "<400": 0,
    "400-420": 0,
    "420-440": 0,
    "440-460": 0,
    "460-480": 0,
    "480-500": 0,
    ">500": 0,
  };

  for (const record of records) {
    const weight = record.x_studio_bale_weight || 0;
    if (weight < 400) ranges["<400"]++;
    else if (weight < 420) ranges["400-420"]++;
    else if (weight < 440) ranges["420-440"]++;
    else if (weight < 460) ranges["440-460"]++;
    else if (weight < 480) ranges["460-480"]++;
    else if (weight < 500) ranges["480-500"]++;
    else ranges[">500"]++;
  }

  return Object.entries(ranges).map(([range, count]) => ({ range, count }));
}

// ─── EXPORT ──────────────────────────────────────────────────────────────

export async function fetchDailyExportShipments(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch daily export shipments (sale.order + stock.picking)
   * Uses date_done/scheduled_date as the authoritative date
   */
  const domain: any[] = [
    ["company_id", "=", companyId],
    ["state", "=", "done"],
    "|",
    "&", ["date_done", ">=", fromDate], ["date_done", "<=", toDate],
    "&", ["scheduled_date", ">=", fromDate], ["scheduled_date", "<=", toDate],
  ];

  const pickings = (await executeKw("stock.picking", "search_read", [domain], {
    fields: [
      "id",
      "date_done",
      "scheduled_date",
      "sale_id",
      "x_studio_number_of_containers",
      "x_studio_total_weight_tons",
    ],
    limit: 10000,
  })) as any[];

  // Group by date
  const grouped: Record<string, any> = {};
  const shipmentIds = new Set<number>();

  for (const picking of pickings) {
    const date = (picking.date_done || picking.scheduled_date || "").split(" ")[0];
    if (!grouped[date]) grouped[date] = { shipments: 0, containers: 0, tons: 0, _counted: false };

    if (picking.sale_id) shipmentIds.add(picking.sale_id[0]);
    grouped[date].containers += picking.x_studio_number_of_containers || 0;
    grouped[date].tons += picking.x_studio_total_weight_tons || 0;
  }

  // Count unique shipments per date
  for (const picking of pickings) {
    const date = (picking.date_done || picking.scheduled_date || "").split(" ")[0];
    if (picking.sale_id && !grouped[date]._counted) {
      grouped[date].shipments = shipmentIds.size;
      grouped[date]._counted = true;
    }
  }

  return Object.entries(grouped).map(([date, data]) => ({
    date,
    shipments: data.shipments || 0,
    containers: data.containers,
    tons: data.tons,
  }));
}

export async function fetchExportByCustomer(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch export tonnage by ultimate customer
   */
  const domain: any[] = [
    ["company_id", "=", companyId],
    ["state", "=", "done"],
    "|",
    "&", ["date_done", ">=", fromDate], ["date_done", "<=", toDate],
    "&", ["scheduled_date", ">=", fromDate], ["scheduled_date", "<=", toDate],
  ];

  const pickings = (await executeKw("stock.picking", "search_read", [domain], {
    fields: [
      "id",
      "sale_id",
      "x_studio_ultimate_customer",
      "x_studio_total_weight_tons",
    ],
    limit: 10000,
  })) as any[];

  // Group by ultimate customer
  const customers: Record<string, number> = {};
  for (const picking of pickings) {
    const customer = picking.x_studio_ultimate_customer || "Unknown";
    customers[customer] = (customers[customer] || 0) + (picking.x_studio_total_weight_tons || 0);
  }

  return Object.entries(customers)
    .map(([name, tons]) => ({ name, tons }))
    .sort((a, b) => b.tons - a.tons);
}

export async function fetchExportedProducts(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch exported products by tonnage
   */
  const domain: any[] = [
    ["company_id", "=", companyId],
    ["state", "=", "done"],
    ["date", ">=", fromDate],
    ["date", "<=", toDate],
  ];

  const moves = (await executeKw("stock.move", "search_read", [domain], {
    fields: [
      "id",
      "product_id",
      "product_qty",
      "product_uom",
      "x_studio_net_weight_tons",
    ],
    limit: 10000,
  })) as any[];

  // Group by product
  const products: Record<string, number> = {};
  for (const move of moves) {
    const product = move.product_id[1] || "Unknown";
    products[product] = (products[product] || 0) + (move.x_studio_net_weight_tons || 0);
  }

  return Object.entries(products)
    .map(([name, tons]) => ({ name, tons }))
    .sort((a, b) => b.tons - a.tons);
}

// ─── LOGISTICS ──────────────────────────────────────────────────────────

export async function fetchTruckingMetrics(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch trucking metrics (avg weight, cost per ton)
   */
  const domain = [
    ["company_id", "=", companyId],
    ["date", ">=", fromDate],
    ["date", "<=", toDate],
    ["state", "=", "done"],
  ];

  const moves = (await executeKw("stock.move", "search_read", [domain], {
    fields: [
      "id",
      "date",
      "location_id",
      "x_studio_net_weight_tons",
      "x_studio_trucking_cost",
    ],
    limit: 10000,
  })) as any[];

  // Group by date and source
  const grouped: Record<string, Record<string, { weight: number; cost: number; count: number }>> = {};
  for (const move of moves) {
    const date = move.date.split(" ")[0];
    const source = move.location_id[1] || "Unknown";
    if (!grouped[date]) grouped[date] = {};
    if (!grouped[date][source]) grouped[date][source] = { weight: 0, cost: 0, count: 0 };
    grouped[date][source].weight += move.x_studio_net_weight_tons || 0;
    grouped[date][source].cost += move.x_studio_trucking_cost || 0;
    grouped[date][source].count += 1;
  }

  return Object.entries(grouped).map(([date, sources]) => ({
    date,
    ...Object.fromEntries(
      Object.entries(sources).map(([source, data]) => [
        source,
        {
          avgWeight: data.count > 0 ? data.weight / data.count : 0,
          costPerTon: data.weight > 0 ? data.cost / data.weight : 0,
        },
      ])
    ),
  }));
}

export async function fetchMachineMonitoring(
  companyId: number,
  fromDate: string,
  toDate: string
) {
  /**
   * Fetch machine monitoring data (oil temp, pressure, diesel consumption)
   */
  const domain = [
    ["company_id", "=", companyId],
    ["x_studio_date", ">=", fromDate],
    ["x_studio_date", "<=", toDate],
  ];

  const records = (await executeKw("fleet.vehicle.odometer", "search_read", [domain], {
    fields: [
      "id",
      "x_studio_date",
      "x_studio_oil_temperature",
      "x_studio_oil_pressure",
      "x_studio_diesel_liters",
      "x_studio_production_tons",
    ],
    limit: 10000,
  })) as any[];

  // Group by date
  const grouped: Record<string, any> = {};
  for (const record of records) {
    const date = record.x_studio_date.split(" ")[0];
    if (!grouped[date]) grouped[date] = { temp: 0, pressure: 0, diesel: 0, tons: 0 };
    grouped[date].temp = record.x_studio_oil_temperature || 0;
    grouped[date].pressure = record.x_studio_oil_pressure || 0;
    grouped[date].diesel = record.x_studio_diesel_liters || 0;
    grouped[date].tons = record.x_studio_production_tons || 0;
  }

  return Object.entries(grouped).map(([date, data]) => ({
    date,
    oilTemp: data.temp,
    oilPressure: data.pressure,
    dieselLiters: data.diesel,
    productionTons: data.tons,
    literPerTon: data.tons > 0 ? data.diesel / data.tons : 0,
  }));
}
