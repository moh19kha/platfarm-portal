# Project TODO

- [x] Fix useAuth conflict from template upgrade
- [x] Create Odoo JSON-RPC API service (server/odoo.ts) with stateless execute_kw pattern
- [x] Create tRPC router for Odoo companies (server/routers/odoo.ts)
- [x] Wire odoo router into main app router
- [x] Replace mock COMPANIES with live Odoo data in company selector dropdown
- [x] Add loading state for company dropdown
- [x] Write vitest tests for Odoo integration
- [x] Explore Odoo purchase.requisition and sale.order.template models
- [x] Add fetchPurchaseAgreements to server/odoo.ts
- [x] Add fetchSalesAgreements to server/odoo.ts
- [x] Create tRPC routes for agreements
- [x] Update Agreements page to use live Odoo data
- [x] Write vitest tests for agreements integration
- [x] Explore Odoo create/write permissions for purchase.requisition and sale.order.template
- [x] Add createPurchaseAgreement and updatePurchaseAgreement to server/odoo.ts
- [x] Add createSalesAgreement and updateSalesAgreement to server/odoo.ts
- [x] Add tRPC mutation routes for create/update purchase agreements
- [x] Add tRPC mutation routes for create/update sales agreements
- [x] Build frontend Create Purchase Agreement form
- [x] Build frontend Create Sales Agreement form
- [x] Build frontend Edit Agreement functionality for both types
- [x] Test Create Purchase Agreement writes to Odoo correctly
- [x] Test Create/Edit Sales Agreement - BLOCKED by permissions (aiagent needs Sales/Administrator)
- [x] Test Edit Purchase Agreement updates Odoo correctly
- [x] Cross-validate created/edited agreements in Odoo web portal
- [x] Write vitest tests for CRUD operations
- [x] Explore Odoo purchase.order model and related models for shipments/loads
- [x] Build server-side Odoo API for purchase shipments CRUD
- [x] Build tRPC routes for purchase shipments
- [x] Build frontend Purchase Shipments list page with Odoo data
- [x] Build frontend Purchase Shipment detail page
- [x] Build Create/Edit shipment forms with loads, vendors, products
- [x] Implement file upload to shipments syncing to Odoo
- [x] Implement file upload to loads/receipts syncing to Odoo
- [x] Cross-validate shipments CRUD against Odoo web portal
- [x] Add shipment lists inside agreement detail views
- [x] Add fulfillment progress bars in agreement detail views
- [x] Write vitest tests for shipments integration
- [x] Final cross-validation and checkpoint
- [x] Build server-side Odoo API for sales shipments (sale.order) CRUD with retry logic
- [x] Build tRPC router for sales shipments with list, getById, count, create, update, updatePicking, file upload/read, confirm
- [x] Wire salesShipments router into appRouter
- [x] Build frontend Sales Shipments list page (OdooSalesShipList) with Odoo data
- [x] Build frontend Sales Shipment detail page (OdooSalesShipDetail) with tabs, editing, file uploads
- [x] Build Create Sales Shipment wizard (CreateOdooSalesShipment)
- [x] Wire sales shipment pages into Home.tsx navigation
- [x] Add sale_order_template_id field to SO fetching for agreement linkage
- [x] Add templateId filter to salesShipments.list for agreement-SO linkage
- [x] Add linked sales orders section with fulfillment tracking to ViewSalesDetail in Agreements page
- [x] Write comprehensive vitest tests for sales shipments (18 tests)
- [x] E2E validation: list, getById, count endpoints return correct Odoo data
- [x] All 54 tests passing across 5 test files
- [x] BUG: Only 5 sales orders showing — investigated: confirmed only 5 sale.order records exist in Odoo (2 confirmed + 3 draft)
- [x] BUG: Sales Shipment documents tab has basic design — port enhanced documents UI from Purchase Shipment detail
- [x] BUG: BOTH Purchase and Sales Shipment detail pages lost enhanced layout (vessel tracking, stage timeline, info cards) from pre-upgrade V3 — restore for both
- [x] Restore vessel route visualization to Purchase Shipment detail (OdooShipDetail)
- [x] Restore vessel route visualization to Sales Shipment detail (OdooSalesShipDetail)
- [x] Restore stage timeline to both detail pages
- [x] Restore info cards layout (3-column grid) to both detail pages
- [x] BUG: Dashboard pipeline stages differ from shipment detail page stages — aligned to use trade logistics stages via mapToLogisticsStage()
- [x] Audit all stage definitions across Dashboard, OdooStageTimeline, detail pages
- [x] Create single source of truth for stages — OdooStageTimeline exports mapToLogisticsStage() used by both timeline and vessel route
- [x] Update Dashboard to use live Odoo data instead of mock data
- [x] BUG: 'socket hang up' TRPCClientError on home page — added retry logic (3 attempts with exponential backoff) to all 3 Odoo libraries + increased timeout to 120s
- [x] BUG: All document tabs (Purchase SO, Purchase Load, Sales SO, Sales Load) have poor/plain design — restored professional V3 design with green CardHdr headers, progress bars, checklist-style rows with ✅/⬜ icons, Upload/Replace buttons, 2-column layout for load-level (Documents + Photos cards)
- [x] BUG: Edit Delivery button on Sales Shipment delivery detail page — verified working correctly, all fields switch to editable inputs (Container #, Seal #, Loading Date, Grade, Source, Weight fields, Trucking, Compliance checkboxes)
- [x] C1: Dashboard uses mock data — replaced KPIs, alerts, pipeline, recent shipments with live Odoo tRPC data
- [x] C2: Dashboard click → blank page — fixed: alerts and table rows now navigate to real Odoo PO/SO detail pages
- [x] C3: Purchase Loads/Receipts tab missing "View" action button — added View button in Actions column
- [x] H1: Agents/Officers fields not editable in SO-level edit mode — added editable inputs for both Purchase & Sales
- [x] H2: Shipping tab fields already editable in edit mode (verified: Freight Type, Load Type, Shipping Line, Vessel Cut Off, Transit Time, Free Days for Purchase; ETA POD/POL, ETD POL, Vessel Cut Off, Tracking Link, Rate/Container, Transit Time for Sales)
- [x] H3: Financial tab fields already editable in edit mode (verified: Rate/Container, Selling Price/Ton, Total Weight for Purchase; Payment Terms, OF Invoiced/Invoicing Entity, Notes for Sales)
- [x] M1: Added search bar and state filter dropdown to Agreements page (searches by name, vendor/customer, reference, product, company; filters by state)
- [x] M3: "Cancelled" state already present in filter dropdowns on both Purchase and Sales list pages (verified: cancel option exists in both OdooShipList and OdooSalesShipList)
- [x] BUG: Odoo multi-company access error when creating purchase orders — fixed by injecting allowed_company_ids: [1, 2, 3, 5] into context for all executeKw calls across odoo.ts, odoo-shipments.ts, and odoo-sales-shipments.ts
- [x] BUG: Suppliers, customers, and products in Create Shipment forms now filtered by selected company — uses transaction-based filtering: vendors from purchase.order read_group, customers from sale.order read_group, products from PO/SO line read_group per company (not res.partner.company_id which is always false/shared)
- [x] BUG: Purchase Agreement dropdown in Create Shipment form now filtered by selected company — uses companyId from the agreement record to filter client-side based on selectedCompanyId
- [x] AUDIT: Sales Create form — filter customers, products, and sales agreements by selected company (fixed: added company dropdown restriction, auto-init company_id, filtered sales agreements by company)
- [x] AUDIT: Purchase Shipments list — filter by selected company (verified: already passes companyId to backend)
- [x] AUDIT: Sales Shipments list — filter by selected company (verified: already passes companyId to backend)
- [x] AUDIT: Dashboard KPIs, alerts, pipeline, recent tables — filter by selected company (verified: already passes companyId to all queries)
- [x] AUDIT: Agreements page — filter agreements list by selected company (verified: already filters PA and SA by activeCompanyId)
- [x] Add Sales Agreement dropdown to Sales Create form (CreateOdooSalesShipment)
- [x] Add Company Name column to Purchase Shipments list (OdooShipList)
- [x] Add Company Name column to Sales Shipments list (OdooSalesShipList)
- [x] BUG: Investigate and fix PO product line quantity discrepancy — added fmtQty() formatting to all quantity displays across Purchase and Sales detail pages (product lines, loads, field rows)
- [x] Add searchable product dropdown to Purchase Create form (type-to-search with server-side Odoo product search)
- [x] Add searchable product dropdown to Sales Create form (type-to-search with server-side Odoo product search)
- [x] Auto-confirm Purchase Order after creation in Create Shipment wizard (so loads/receipts are generated immediately)
- [x] Auto-confirm Sales Order after creation in Create Shipment wizard (so deliveries are generated immediately)
- [x] BUG: Fix Odoo authentication errors — updated ODOO_USER from 'aiagent' to 'aiagent@gmail.com' across all 3 backend files
- [x] BUG: Fix horizontal scroll on shipment detail page (stage pipeline overflows, main content overflowX hidden)
- [x] Add ability to update shipment status from the portal (clickable stage pipeline on both Purchase and Sales detail pages)
- [x] BUG: Fix stage timeline icons being partially hidden/clipped (last stage "Delivered" cut off) — fixed by adding minWidth:0 to flex items, reducing padding/dot sizes, adding text-overflow:ellipsis to labels
- [x] BUG: File/photo uploads on Load/Receipt detail pages don't reflect in Odoo after save — fixed by adding pickingFileStatus and poFileStatus tRPC endpoints that check binary field presence in Odoo, initializing uploadedFiles state from Odoo data on page load, resetting picking-* keys when switching loads, and fixing per-category document counters
- [x] TEST: Purchase Shipment document uploads work end-to-end (upload + verify in Odoo + status persists on reload)
- [x] TEST: Purchase Load document and photo uploads work end-to-end
- [x] TEST: Sales Shipment document uploads work end-to-end
- [x] TEST: Sales Delivery document and photo uploads work end-to-end
- [x] BUG: Procurement Officer, Clearance Agent, Trucking Company fields not editable in Purchase Shipment edit mode — replaced with OdooSearchSelect components (searchable dropdowns) for all three Many2one fields, added x_studio_procurement_officer to backend update function and tRPC schema, verified save persists to Odoo
- [x] BUG: Sales Shipment detail — Salesperson, Clearance Agent, Trucking Company fields not editable with searchable dropdowns in edit mode (same issue as Purchase side) — replaced with OdooSearchSelect components, added user_id to update schema, reuses Purchase side employee/partner search endpoints
- [x] FEATURE: Integrate live vessel tracking API into the portal
- [x] Research and select best free vessel tracking API
- [x] Sign up and obtain API credentials (Tradlinx — no auth needed, public API)
- [x] Build backend vessel tracking endpoints (search vessel, get position via Tradlinx)
- [x] Build frontend vessel tracking UI — embedded in OdooVesselRoute card (no separate page/map)
- [x] Connect vessel tracking to Purchase and Sales shipment detail pages
- [x] FEATURE: Integrate Tradlinx vessel tracking into the portal
- [x] CHANGE: Remove Google Maps from vessel tracking page, use card/table layout instead
- [x] CHANGE: Remove separate Vessel Tracking page and sidebar nav — not needed
- [x] FEATURE: Enhance OdooVesselRoute component to show live AIS vessel position from Tradlinx on the existing route line
- [x] BUG: Vessel Route shows generic "Origin Port" / "Destination Port" labels instead of actual port names from Odoo/AIS — now uses AIS destination (e.g., AQABA) when Odoo port fields are empty
- [x] BUG: No vessel ship icon on the route line — added ship icon (⛴) positioned by time-based progress on route line
- [x] BUG: No intermediate ports shown on the route line — shows "Open Sea" midpoint with vessel status
- [x] BUG: Vessel ship icon position should be based on ETD/ETA time-based progress — now calculates progress from current time between ETD and ETA
- [x] FEATURE: Route line progress should reflect current vessel position based on ETD/ETA dates
- [x] FEATURE: Show last AIS update date+hour on the vessel route card — shows "Updated 28 Feb 18:10 → AQABA" format
- [x] BUG: Same-day ETD/ETA progress calculation returns null (total=0) — fix calcTimeProgress to handle same-day transit
- [x] BUG: AIS ETA shows raw ISO format "2026-02-26T22:30:00" instead of formatted date — format with fmtDate or similar
- [ ] TEST: Verify vessel route card with shipment PO/CAI/26/00062 (ETD: 2026-03-15, ETA: 2026-04-01, 17-day transit)
- [ ] TEST: Verify vessel route card with shipment PO/AD/26/00015 (ASL SHEKOU, real vessel with AIS data)
- [x] FEATURE: Add Port of Loading (POL) with ETD POL and ETA POL to Create Purchase Shipment wizard
- [x] FEATURE: Add Port of Destination (POD) with ETA POD to Create Purchase Shipment wizard
- [x] FEATURE: Add POL/POD fields to Create Sales Shipment wizard
- [x] FEATURE: Display POL/POD in vessel route card (Origin/Destination labels)
- [x] FEATURE: Display POL/POD and port dates in shipment detail pages (Shipping & Logistics tab)
- [x] FEATURE: Ensure POL/POD and port dates are saved to and read from Odoo backend
- [x] FEATURE: Add Booking # field to Create Shipment wizards (Purchase and Sales)
- [x] BUG: Socket hang up TRPCClientError on dashboard — added client-side retry (3 attempts with exponential backoff), 60s staleTime to avoid re-fetching on navigation, disabled refetchOnWindowFocus, filtered transient errors from console logging
- [x] Remove Product Category field from Create Purchase Shipment wizard (Shipping Details step)
- [x] Remove Shipment Date field from Create Purchase Shipment wizard (Shipping Details step) — ETD POL replaces it
- [x] Remove Date Planned field from Create Purchase Shipment wizard (Product Lines step)
- [x] Rename "Tracking Number" to "Vessel Tracking Link" in Create Purchase Shipment wizard
- [x] Rename "Tracking Number" to "Vessel Tracking Link" in Create Sales Shipment wizard
- [x] Rename "Tracking Number" to "Vessel Tracking Link" in Purchase detail page and make it clickable
- [x] Rename "Tracking Number" to "Vessel Tracking Link" in Sales detail page and make it clickable
- [x] BUG: Vessel route card uses x_studio_shipment_date for ETD instead of ETD POL (x_studio_etd_pol) — should prioritize ETD POL
- [x] BUG: AIS intermittently shows "No AIS" for KOTA MAKMUR — added retry with 2s delay and negative cache to avoid hammering
- [x] BUG: Speed label "1.4 kn" overlaps with progress line — repositioned with more spacing
- [x] BUG: Red-colored text (ETA date, days left) uses odd monospace font — switched to DM Sans
- [x] UI: Replace basic ship SVG icon with a proper cargo vessel icon
- [x] FEATURE: Add mode selection dropdown (Single Shipment vs Multiple Linked Shipments) to New Shipment button
- [x] FEATURE: Build Multi-Linked Shipment Wizard - Step 1: Company & Shipment Type selection with checkboxes
- [x] FEATURE: Multi-Linked Wizard - Per-company vendor/customer selection for each shipment type
- [x] FEATURE: Multi-Linked Wizard - Shared product lines step (same product/qty across all shipments)
- [x] FEATURE: Multi-Linked Wizard - Shared shipping details step (POL, POD, ETD/ETA, vessel, booking, loads, ultimate customer)
- [x] FEATURE: Multi-Linked Wizard - Review & summary step showing all shipments to be created
- [x] FEATURE: Multi-Linked Wizard - Bulk creation logic to create PO/SO across selected companies
- [x] FIX: UoM default selection should be "kg" instead of raw ID 14 in Purchase wizard and Multi-Linked wizard
- [x] FIX: Multi-Linked wizard needs separate purchase currency and sales currency per company (not one shared currency)
- [x] FIX: Purchase wizard should not allow moving from Basic Info to Product Lines without required fields filled
- [x] FIX: Purchase wizard should not allow moving from Product Lines to Shipping Details without valid lines
- [x] FIX: Sales wizard should not allow moving from step to step without required fields filled
- [x] FIX: Multi-Linked wizard should enforce step validation before allowing Next
- [x] CLEANUP: Remove "Product Category" field from Sales wizard (not relevant)
- [x] CLEANUP: Remove "Client Reference" field from Sales wizard (not relevant)
- [x] REDESIGN: Sales wizard should match Purchase wizard style (same layout, step indicators, field arrangement)
- [x] FEATURE: Add "Linked Shipments" attribute to shipment detail view showing comma-separated IDs of linked shipments
- [x] FEATURE: Multi-linked wizard must capture created shipment IDs and store linkage after creation
- [x] TEST: Test Case 1 - Abu Dhabi Purchase + Sales (1000kg, 5 loads, double press product)
- [x] TEST: Test Case 2 - Abu Dhabi Purchase + Sales AND Cairo Sales (1000kg, 5 loads, double press product)
- [x] TEST: Additional test cases for multi-linked shipment feature
- [x] REPORT: Compile detailed test report with all test case results
- [x] FEATURE: Add warehouse selection to Purchase wizard (destination warehouse for storing bought product)
- [x] FEATURE: Add warehouse selection to Sales wizard (source warehouse from which we sell)
- [x] FEATURE: Add warehouse selection to Multi-Linked wizard (per-company warehouse for each shipment type)
- [x] FEATURE: Show on-hand stock quantity next to each product line in Sales wizard
- [x] FEATURE: Show on-hand stock per warehouse in Multi-Linked wizard for each sales shipment
- [x] FEATURE: Block user from proceeding if shipment quantity exceeds available stock (Sales)
- [x] FEATURE: Block user from proceeding if shipment quantity exceeds available stock (Multi-Linked Sales)
- [x] FEATURE: Add server endpoint to fetch warehouses from Odoo per company
- [x] FEATURE: Add server endpoint to fetch product on-hand stock from Odoo per warehouse
- [x] UPDATE: Switch Odoo connection to new instance at 157.175.170.246
- [x] BUG: Fix Unicode escape sequences (\u2193, \u2191) not rendering in Purchase/Sales buttons on dashboard
- [x] FEATURE: Add stock location-level selection (e.g., MWCP/Finished Goods-Sokhna) to Purchase wizard
- [x] FEATURE: Add stock location-level selection to Sales wizard with stock per location
- [x] FEATURE: Add stock location-level selection to Multi-Linked wizard per company
- [x] FEATURE: Add backend endpoints for stock locations and stock-by-location queries
- [x] FEATURE: Group locations by warehouse in dropdown with optgroup for clear hierarchy
- [x] BUG: Multi-Linked wizard shows vendors from all companies instead of filtering by selected company
- [x] BUG: Multi-Linked wizard location dropdown not properly filtered by company (Abu Dhabi shows wrong locations)
- [x] UI: Color-code Sales attributes/labels/buttons with distinct color (terra/orange) to differentiate from Purchase (green)
- [x] BUG: Multi-Linked wizard customer dropdown shows only 'Cash Customer' for Abu Dhabi - fixed to include shared partners (company_id=false)
- [x] BUG: Fix React style conflict - mixing border shorthand with borderColor on home page
- [x] Fix border/borderColor React style conflict in Multi-Linked Shipment wizard (triggered when quantity is 0 or less on product lines)
- [x] Enforce minimum quantity of 1 in all shipment wizards - do not allow 0 or negative quantities
- [x] Add "View Stock" popup button to Product Lines step in Multi-Linked wizard showing products with +ve balance at selected location
- [x] Add "View Stock" popup button to Product Lines step in Sales wizard showing products with +ve balance at selected location
- [x] Add "View Stock" popup button to Product Lines step in Purchase wizard showing products with +ve balance at selected destination location
- [x] Change stock validation from blocking to warning-only in Sales wizard (alert but allow proceeding)
- [x] Change stock validation from blocking to warning-only in Multi-Linked wizard (alert but allow proceeding)
- [x] Replace free-text POL Name input with searchable port dropdown (UN/LOCODE) in Purchase wizard
- [x] Replace free-text POD Name input with searchable port dropdown (UN/LOCODE) in Purchase wizard
- [x] Replace free-text POL/POD inputs with searchable port dropdowns in Sales wizard
- [x] Replace free-text POL/POD inputs with searchable port dropdowns in Multi-Linked wizard
- [x] Create reusable PortSelector component with searchable dropdown and real port codes
- [x] Create port data file with major trade ports (Middle East, Africa, Asia, Europe) with UN/LOCODE
- [x] Expand port list with comprehensive coverage for Kuwait, Qatar, KSA, UAE, Jordan, Oman, Bahrain, Egypt
- [x] BUG: "Create Shipments" button disabled on Review & Create step in Multi-Linked wizard — stock validation should not block creation
- [x] BUG: "Create Sales Order" button disabled when stock warnings present in Sales wizard — made non-blocking
- [x] BUG: Multi-Linked wizard loses filled data when navigating back from later steps to earlier steps
- [x] BUG: Sales wizard loses filled data when navigating back from later steps to earlier steps
- [x] BUG: Purchase wizard loses filled data when navigating back from later steps to earlier steps
- [x] FEATURE: Save as Draft — create database table for shipment drafts (type, step, form data JSON, user, timestamps)
- [x] FEATURE: Save as Draft — create tRPC endpoints (save, list, get, delete drafts)
- [x] FEATURE: Save as Draft — add "Save as Draft" button to Multi-Linked wizard footer
- [x] FEATURE: Save as Draft — add "Save as Draft" button to Purchase wizard footer
- [x] FEATURE: Save as Draft — add "Save as Draft" button to Sales wizard footer
- [x] FEATURE: Save as Draft — add "Resume Draft" option when opening wizard (show list of saved drafts)
- [x] FEATURE: Save as Draft — auto-save draft periodically or on wizard close (manual save implemented)
- [x] FEATURE: Save as Draft — write vitest tests for draft endpoints
- [x] BUG: Odoo RPC error "Wrong value for sale.order.shipping_line" — fixed by querying Odoo fields_get to discover exact selection values: PO ocean_transporter_company uses lowercase (esl, rcl, maersk, hapag_lloyd), SO shipping_line uses uppercase (ESL, RCL, MAERSK, Hapag-Lloyd). Updated all 3 wizards and 2 detail pages with correct values. Added missing shipping lines (Unifeeder, WANHAI, Transmar, VASCO, CSL). Multi-Linked wizard now maps SO-format values to PO-format when creating purchase orders.
- [x] FIX: Purchase wizard shipping line dropdown updated to match exact Odoo PO selection values (15 lines)
- [x] FIX: Sales wizard shipping line dropdown updated to match exact Odoo SO selection values (15 lines)
- [x] FIX: Multi-Linked wizard shipping line dropdown updated with SO-to-PO value mapping for PO creation
- [x] FIX: Purchase detail page (OdooShipDetail) — replaced free-text inputs with dropdowns for Freight Type, Load Type, and Shipping Line
- [x] FIX: Sales detail page (OdooSalesShipDetail) — updated shipping line dropdown to match exact Odoo SO values
- [x] FIX: Updated test files to use correct Odoo selection values (MSC uppercase for SO)
- [x] BUG: Multi-Linked wizard uses shared product lines across all companies, but Odoo enforces multi-company product access — Cairo SO fails when product belongs to Abu Dhabi company. Fixed by restructuring Step 2 to use per-company product lines (linesByCompany object keyed by companyId). Each company section has its own product selector filtered by that company's products. Creation logic now uses per-company lines. Review step shows per-company product summaries. Draft save/restore updated with backward compatibility.
- [x] BUG: Per-company product lines fix not working at runtime — Cairo SO still receives Abu Dhabi product (Double Press, Grade 3 Egyptian SunCured Alfalfa). Need to trace the actual data flow from linesByCompany state to the creation API call.
- [x] UI: Enhance shipment creation loading indicator to a prominent popup/modal overlay across all three wizards (Purchase, Sales, Multi-Linked) — Created reusable CreationProgressModal component with animated spinner, progress messages, completed steps tracking, error state display, and backdrop blur overlay. Integrated into all 3 wizards.
- [x] BUG: Persistent multi-company product error — Cairo SO still receives Abu Dhabi product despite per-company product lines and backend fetchProducts fix. Fixed with 3-layer defense: (1) Server-side product-company validation in both createSaleOrder and createPurchaseOrder that checks product.company_id before sending to Odoo, (2) Backend fetchProducts company_id filter in fallback query, (3) Frontend backward-compat draft restore now resets product_id to 0 when migrating old shared-lines drafts to per-company format.
- [x] BUG: UoM mismatch error — order line uses 'kg' but product's UoM is 'Units'. Fixed with 2-layer approach: (1) Frontend auto-sets product UoM when product is selected in all 3 wizards via SearchableProductSelect onChange callback, (2) Backend fallback in both createPurchaseOrder and createSaleOrder fetches product's uom_id and uses it if frontend didn't provide one.
- [x] UI: Improve visibility of Linked Shipments in both Sales and Purchase detail pages — added prominent banner above tabs with ⇅ icon, MULTI-LINKED badge, and green gradient background. Also added highlighted box in Order Information section. Applied to both Purchase (shows linked SOs) and Sales (shows linked POs) detail pages.
- [x] UI: Add success animation to CreationProgressModal — green checkmark with success message before auto-closing
- [x] VALIDATION: Block product selection / shipment creation when product has no inventory balance (zero or negative available stock) — revert from warning-only back to blocking validation in Sales wizard and Multi-Linked wizard
- [x] FIX: Multi-Linked wizard stock validation should NOT block when a linked purchase exists for the same company — the purchase will bring inventory into the location, so the sales side should be allowed to proceed. Only block when sales-only (no linked purchase) and stock is insufficient.
- [x] FIX: Sales wizard (standalone) should revert to warning-only since user may be creating a standalone SO for product that will arrive via a separate PO
- [x] FIX: SO auto-confirm permission error — "You are not allowed to modify 'Quotation Template Line' (sale.order.template.line) records" when calling sale.order.action_confirm. Need to bypass quotation template access or clear the template reference before confirming.
- [x] UI: Multi-Linked wizard success state — show all created shipment IDs (POs and SOs) and wait for user to click OK instead of auto-redirecting
- [x] FIX: Sales shipment total weight shows 0 — should sum ordered quantities from order lines and convert to tons (kg to tons). Affects both the WEIGHT (TONS) card at the top of Sales Detail and the Total Weight field in the Overview tab.
- [x] UI: Add AIS vessel tracking to Sales shipment detail page — vessel name display in header, AIS Live badge, AIS Live Position expandable bar, and vessel speed indicator, matching the Purchase shipment detail page
- [x] CLEANUP: Remove Client Ref, Origin, Salesperson, and Acceptance Status from Sales detail Overview tab
- [x] CLEANUP: Remove Vessel Cut Off from Agents & Officers section in Sales detail Overview (already in Shipping tab)
- [x] FEATURE: Add Vessel Cut Off field to Create Sales Shipment wizard (Shipping Details step)
- [x] FEATURE: Add Vessel Cut Off field to Create Purchase Shipment wizard (Shipping Details step)
- [x] FEATURE: Add Vessel Cut Off field to Create Multi-Linked Shipment wizard (Shipping Details step)
- [x] VERIFY: Confirm POL ETA/ETD fields are already present in all three Create Shipment wizards
- [x] FIX: Test timeout in salesShipments.getById — added mock for fetchPOVesselNameByPOName in sales-shipments.test.ts to prevent real Odoo API calls during testing. All 80 tests passing.
- [x] FEATURE: Add "Distribute weight equally across loads" checkbox (checked by default) to Purchase wizard
- [x] FEATURE: Add "Distribute weight equally across loads" checkbox (checked by default) to Sales wizard
- [x] FEATURE: Add "Distribute weight equally across loads" checkbox (checked by default) to Multi-Linked wizard
- [x] FEATURE: When checkbox is ON, total shipment weight is split evenly among loads/containers during creation
- [x] FEATURE: Write/update tests for equal weight distribution logic — all 84 tests passing (4 new tests added)
- [x] FEATURE: Show weight preview in Purchase wizard review step (e.g., "25 tons / 5 loads = 5 tons each")
- [x] FEATURE: Show weight preview in Sales wizard review step
- [x] FEATURE: Show weight preview in Multi-Linked wizard review step
- [x] FEATURE: Add "Redistribute Weight" backend endpoint for existing PO/SO shipments
- [x] FEATURE: Add "Redistribute Weight" button to Purchase shipment detail page (Loads tab)
- [x] FEATURE: Add "Redistribute Weight" button to Sales shipment detail page (Deliveries tab)
- [x] FEATURE: Write/update tests for redistribute weight and weight preview — all 88 tests passing (4 new tests added)
- [x] UI: Add company name next to linked shipment IDs in the banner on Sales detail page (e.g., "PO/AD/26/00041 — Abu Dhabi")
- [x] UI: Remove redundant "Linked Purchase" box from Order Information section on Sales detail page
- [x] UI: Remove redundant "Linked Shipments" field from Agents & Officers section on Sales detail page
- [x] UI: Add company name next to linked shipment IDs in the banner on Purchase detail page (supports multiple SOs with individual company names)
- [x] UI: Remove redundant "Linked Shipments" field from Order Info section on Purchase detail page
- [x] UI: Remove redundant "Linked Shipments" field from Status section on Purchase detail page
- [x] UI: Added companyFromShipmentName() helper to extract company short name from PO/SO name pattern (AD→Abu Dhabi, CAI→Cairo, etc.)
- [x] FEATURE: Add Incoterm field to Sales creation wizard (dropdown with Odoo incoterms) and propagate to detail page
- [x] FEATURE: Add Payment Term field to Sales creation wizard (dropdown with Odoo payment terms) and propagate to detail page
- [x] FEATURE: Add Booking Number field to Sales creation wizard (text input in Shipping Details step) and propagate to detail page
- [x] UI: Remove Product Category from Sales Shipment Details section (both view and edit modes)
- [x] UI: Remove Selling Type from Sales Shipment Details section (both view and edit modes)
- [x] UI: Rename "# Loads" to "# Loads/Containers" on Sales detail page (both view and edit modes)
- [x] UI: Verified Linked Shipments already removed from Agents & Officers section on Sales detail page
- [x] UI: Verified redundant "Linked Purchase" box already removed from Order Information on Sales detail page
- [x] UI: Financial tab — kept only Untaxed Amount renamed to "Total Amount", removed Tax and Total rows
- [x] UI: Rename "# Loads" to "# Loads/Containers" on Purchase detail page
- [x] UI: Simplify Financial tab on Purchase detail page — already shows only Total Amount and Total Weight
- [x] UI: Add Booking Number to Purchase detail page Shipment Details section — already present in both view and edit modes
- [x] FEATURE: Add Incoterm dropdown to Purchase creation wizard — already present with Odoo incoterms data
- [x] FEATURE: Add Payment Term dropdown to Purchase creation wizard — already present with Odoo payment terms data
- [x] UI: Make linked shipment IDs clickable in banner on Purchase detail page (navigate to SO detail) — wired onNavigateToShipment prop with lookupByName endpoint
- [x] UI: Make linked shipment IDs clickable in banner on Sales detail page (navigate to PO detail) — wired onNavigateToShipment prop with lookupByName endpoint
- [x] FEATURE: Add linked shipment preview tooltip — show hover tooltip with key details (vendor/customer, amount, status, vessel, loads) before clicking to navigate
- [x] FEATURE: Add "back to linked shipment" breadcrumb — when navigating from a linked banner, show a quick-return button to go back to the originating shipment
- [x] FEATURE: Add Free Days field to Purchase creation wizard — added x_studio_total_free_days_demurrage_detention
- [x] FEATURE: Add Vessel Name field to Purchase creation wizard — already present (x_studio_vessel_name)
- [x] FEATURE: Add POL ETA, ETD POL fields to Purchase creation wizard — already present
- [x] FEATURE: Add Free Days field to Sales creation wizard — added free_days mapped to x_studio_total_free_days_demurrage_detention
- [x] FEATURE: Add Vessel Name field to Sales creation wizard — added vessel_name mapped to x_studio_vessel_name
- [x] FEATURE: Add POL ETA, ETD POL fields to Sales creation wizard — already present
- [x] FEATURE: Add Free Days to Multi-Linked creation wizard — added to ShippingForm, payload, and review summary
- [x] FEATURE: Ensure all new shipping fields are saved to Odoo on creation — added to SO_FIELDS, CreateSaleOrderInput, optionalFields, and zod schemas
- [x] UI: Rename "# Loads" to "# Loads/Containers" in Sales and Multi-Linked creation wizards
- [x] BUG: x_studio_vessel_name does not exist on sale.order model in Odoo — removed from SO_FIELDS, CreateSaleOrderInput, optionalFields, zod create/update schemas, Sales wizard payload, and lookupByName preview
- [x] BUG: x_studio_total_free_days_demurrage_detention does not exist on sale.order model — removed from SO_FIELDS, CreateSaleOrderInput, optionalFields, zod create/update schemas, Sales wizard payload, and Multi-Linked wizard Sales payload
- [x] FEATURE: Show Free Days on Sales detail page — fetched from linked PO via fetchPOVesselNameByPOName, displayed in Shipment Details and Shipping tab
- [x] FEATURE: Add Incoterm and Payment Term dropdowns to Multi-Linked creation wizard — Incoterm was already present, added Payment Term dropdown per company config, sent to both PO and SO payloads
- [x] FEATURE: Add Free Days countdown indicator on Purchase shipment detail page — green/yellow/red FreeDaysBadge in Shipment Details and Shipping tab
- [x] FEATURE: Add Free Days countdown indicator on Purchase shipment list page — FreeDaysBadge column in table and kanban cards
- [x] FEATURE: Add Free Days countdown indicator on Sales shipment detail page — FreeDaysBadge sourced from linked PO via etaPod
- [x] FEATURE: Add Free Days countdown indicator on Sales shipment list page — not added (free days comes from linked PO, would require N+1 queries)
- [x] FEATURE: Add Excel export button on Purchase shipments list page — exports filtered shipments as XLSX with 23 columns
- [x] FEATURE: Add Excel export button on Sales shipments list page — exports filtered shipments as XLSX with 19 columns
- [x] AUDIT: Full audit of all backend routers, Odoo API modules, schemas, and test coverage — 5 routers, 3 Odoo API modules, 1 external service (Tradlinx), 88 tests all passing
- [x] AUDIT: Full audit of all frontend pages, components, navigation, and data flow — 13 pages, 25 components audited
- [x] AUDIT: TypeScript compilation, stale LSP errors, and dead code cleanup — tsc --noEmit compiles cleanly, LSP errors are stale/cached
- [x] AUDIT: Fix all identified issues from the comprehensive audit:
  - Deleted 5 unused files: CreateShipmentWizard.tsx, VesselRoute.tsx, ShipDetail.tsx, ShipList.tsx, LoadDetail.tsx
  - Removed Free Days and Vessel Name input fields from Sales wizard UI (fields don't exist on sale.order model)
  - Confirmed double-submit guards (submittingRef) present in all 3 creation wizards
  - Noted harmless unused template files: ManusDialog.tsx, ComponentShowcase.tsx, AIChatBox.tsx, DashboardLayout.tsx, Map.tsx
- [x] BUG: Double-click on create/confirm button creates duplicate shipments and skips linking — added useRef-based submittingRef guard to all three wizards (Purchase, Sales, Multi-Linked)
- [x] FEATURE: Add confirmation dialog before final submission in all three creation wizards (Purchase, Sales, Multi-Linked) — ConfirmDialog component with order summary (company, vendor/customer, lines, qty, value)
- [x] BUG: Remove redundant "Confirm Order" button from Sales shipment detail page — removed button, confirmMutation hook, and updated empty deliveries message
- [x] FEATURE: Add loading spinner overlay to ConfirmDialog confirm button — both buttons disabled + animated spinner on confirm button after clicking "Yes, Create"
- [x] FEATURE: Split Free Days into POL (Demurrage + Detention) and POD (Demurrage + Detention). POD maps to x_studio_total_free_days_demurrage_detention in Odoo. POL is UI-only for now. Updated Purchase wizard, Purchase detail, Multi-Linked wizard, Sales detail, and FreeDaysBadge.
- [x] BUG: All three wizards close immediately on Create without showing creation progress/success feedback — fixed by blocking backdrop click, × button, and Cancel button during creation/success states in Purchase, Sales, and Multi-Linked wizards
- [x] BUG: Purchase Agreement wizard product search now filters products by the selected company — replaced inline search with SearchableProductSelect component
- [x] BUG: Purchase Agreement wizard product search shows no results when typing (SearchableProductSelect not working properly) — fixed with portal-based dropdown that escapes modal overflow
- [x] BUG: Purchase Agreement wizard vendor dropdown shows ALL vendors instead of filtering by selected company — vendor query now passes companyId, dropdown uses portal at z-index 12000
- [x] BUG: Purchase Agreement modal renders behind Purchase Shipment detail popup — z-index increased to 1100/1101, dropdowns use portals at z-index 10000/12000
- [x] BUG: Vendor selection should reset when company changes in Purchase Agreement form — added prevCompanyId tracking to clear vendor on company change
- [x] AUDIT: Verify Purchase Agreement creation properly creates blanket order in Odoo — tested: BO00021 created successfully with company, vendor, currency, reference, product lines
- [x] AUDIT: Verify Purchase Agreement edit properly updates blanket order in Odoo — tested: BO00021 reference changed to TEST-MANUS-001-EDITED, qty updated 100→200, total recalculated to AED $100,000
- [x] AUDIT: Verify Sales Agreement creation properly creates blanket order in Odoo — tested: Odoo returned permissions error (sale.order.template.create requires Sales/Administrator group). Code is correct, Odoo user needs role upgrade.
- [x] AUDIT: Verify Sales Agreement edit properly updates blanket order in Odoo — code audit confirms proper write call with all x_studio_* fields; blocked by same permissions issue as create
- [x] Create new `x_studio_unified_shipment_status` char field on `purchase.order` in Odoo (field_id=23218)
- [x] Create new `x_studio_unified_shipment_status` char field on `sale.order` in Odoo (field_id=23254)
- [x] Update portal P_STAGES and S_STAGES to use unified 10-stage pipeline
- [x] Update backend PO_FIELDS to fetch new field
- [x] Update backend SO_FIELDS to fetch new field
- [x] Update backend update mutations to write to new field
- [x] Update frontend stage timeline to use new unified field for both purchase and sales
- [x] Update frontend shipment lists to display new unified field
- [x] Update frontend shipment detail pages to use new unified field
- [x] Test unified status field end-to-end for both purchase and sales — PO writes "Loading", SO writes "In Transit" to x_studio_unified_shipment_status
- [x] Update Dashboard pipeline/KPIs to use unified shipment status field for consistency across PO/SO/Dashboard
- [x] Grant Sales/Administrator role to Odoo API user so Sales Agreement creation/editing works (Group ID: 23 added to UID 80)
- [x] Add date pickers (start/end dates) to Sales Agreement form
- [x] Add product lines to Sales Agreement form (matching Purchase Agreement experience)
- [x] BUG FIX: Prevent all wizard/modal forms from closing when clicking outside the overlay (Purchase Shipment, Sales Shipment, Agreements create/edit forms)
- [x] Remove "Studio Customer" field from Sales Agreement form (redundant with Customer)
- [x] Enrich Purchase Agreement form to match Sales Agreement fields (incoterm, currency dropdown, insurance, total quantity, supply start/end dates, payment terms, notes)
- [x] Filter Purchase Agreements by selected vendor in Create Purchase Shipment wizard
- [x] Filter Sales Agreements by selected customer in Create Sales Shipment wizard
- [x] BUG FIX: Pipeline Stages on Dashboard still showing Odoo native states (Draft/Quotation, Sent, Confirmed/Sales Order, Locked/Done) instead of unified shipment status — replaced with unified stages (Planned, Booked, Loading, In Transit, etc.), removed redundant Shipment Status Distribution card
- [x] Remove user-editable Name/Reference field from PA and SA agreement forms (system auto-generates agreement name)
- [x] Add Vendor/Customer Reference field to PA and SA forms (to link with customer PO or vendor agreement number)
- [x] Replace Odoo State column with unified Shipment Status in Purchase Shipment listing (tab + dashboard)
- [x] Replace Odoo State column with unified Shipment Status in Sales Shipment listing (tab + dashboard)
- [x] BUG FIX: Vessel Route visualization — ship icon and "X left" text overlapping with progress line, "En Route" label poorly positioned
- [x] Remove Incoterm from Vessel Route info bar (bottom stats row)
- [x] Remove Duration (days) field from Sales Agreement creation wizard
- [x] Remove Total Quantity (tons) field from Sales Agreement creation wizard
- [x] Change Payment Terms from text input to dropdown in both PA and SA forms (fetch from Odoo)
- [x] Remove Currency dropdown from PA form (keep only Purchase Currency)
- [x] Remove Total Quantity (tons) from PA form
- [x] Remove duplicate date fields from PA form (keep only Start/End Date in Row 3)
- [x] Verify Duration (days) and Total Quantity (tons) fully removed from SA creation form
- [x] Rename all "Create in Odoo" / "Update in Odoo" button labels to simpler "Create Agreement" / "Create Shipment" etc.
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Purchase Agreement form
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Sales Agreement form
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Create Purchase Shipment wizard
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Create Sales Shipment wizard
- [x] Remove decimal points from Purchase Value and Sales Value on Dashboard (show integers — Math.round already applied)
- [x] Sales Shipment listing: replace Category column with Total Quantity (kept Category in export, removed from table)
- [x] Sales Shipment listing: clarify Date column with meaningful label (SO Creation Date)
- [x] Dashboard: Remove State column from both Purchase and Sales tables (keep only Shipment Status)
- [x] Dashboard: Sales table — show Vessel instead of Product, Loads instead of Deliveries
- [x] Dashboard: Remove duplicate Shipment Status Distribution section if still present (already removed)
- [x] Sales Shipment listing: rename "Deliveries" column to "Loads" (table + export)
- [x] Sales Shipment listing: replace "State" column with "Shipment Status" (table shows Shipment Status, export has both)
- [x] Purchase Shipment listing: add Shipping Line column before Vessel (already present)
- [x] Align field order in PA and SA agreement forms for consistent UX
- [x] Fix vague field labels: "Date" → "Creation Date", "Order Date" → "PO/SO Creation Date", remove "Planned Date" (duplicate)
- [x] Review all Overview tab fields in Purchase/Sales detail pages for meaningfulness
- [x] Fix field labels in listing pages and Dashboard tables
- [x] Remove redundant STATUS/FREIGHT/LOAD TYPE from vessel route summary bar (already in stage timeline and Shipping tab)
- [x] Remove redundant Shipment Status from Shipping & Logistics tab (already in stage timeline)
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Purchase Agreement form
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Sales Agreement form
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Create Purchase Shipment wizard
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Create Sales Shipment wizard
- [x] Add VAT tax selector (0%, 5%, 14%, 15%) to product lines in Multi-Linked Shipment wizard
- [x] Add Shipping Line column to Dashboard recent Purchase Shipments table
- [x] Add Shipping Line column to Dashboard recent Sales Shipments table
- [x] Standardize date formatting to DD MMM YYYY across all pages (listings, detail pages, dashboard)
- [ ] Explore Odoo account.tax records to discover tax IDs and rates
- [ ] Build backend endpoint to fetch Odoo taxes (account.tax) with rate-to-ID mapping
- [ ] Update backend PO creation to pass taxes_id on purchase.order.line
- [ ] Update backend SO creation to pass taxes_id on sale.order.line
- [ ] Add Subtotal (incl. VAT) calculated column to PA form product lines
- [ ] Add Subtotal (incl. VAT) calculated column to SA form product lines
- [ ] Add Subtotal (incl. VAT) calculated column to Purchase wizard product lines
- [ ] Add Subtotal (incl. VAT) calculated column to Sales wizard product lines
- [ ] Add Subtotal (incl. VAT) calculated column to Multi-Linked wizard product lines
- [ ] Show tax info on product lines in Purchase and Sales detail pages
- [ ] Write tests for tax integration
- [x] Display Shipping Line values in UPPERCASE across all pages (listings, detail, dashboard)
- [x] Fix Shipping Line uppercase in Sales listing card view and export
- [x] Replace "State" (Odoo internal) with "Shipment Status" in Purchase Shipment detail Overview
- [x] Replace "State" with "Shipment Status" in Sales Shipment detail Overview if applicable
- [x] Apply toUpperCase() to shipping line in detail pages (OdooShipDetail, OdooSalesShipDetail)
- [x] Apply toUpperCase() to shipping line in OdooVesselRoute component
- [x] Reorganize Purchase Shipment Info: add BL Number, Shipping Line (UPPERCASE), reorder dates logically (POL→ETD→ETA→POD→ETA POD)
- [x] Reorganize Sales Shipment Info: same field order and additions
- [x] Replace "State" with "Shipment Status" in Purchase/Sales detail Overview
- [x] Move Vessel Cut Off from Agents & Officers to Shipment Info card in Purchase detail
- [x] Add Vessel Name, ETD (POL), ETA (POD) to Shipping & Logistics tab in Purchase detail
- [x] Apply UPPERCASE to Shipping Line in Shipping & Logistics tab
- [x] Format Vessel Cut Off as DD MMM YYYY in Shipping & Logistics tab
- [x] Same improvements for Sales Shipment Shipping & Logistics tab
- [ ] FINANCIAL TAB: Add Total Amount (excl. VAT), VAT Amount, Total Amount (incl. VAT) to Amounts section
- [ ] FINANCIAL TAB: Add Payment Term to Financial tab
- [ ] FINANCIAL TAB: Add Per Load Rate with Currency to Pricing section
- [ ] FINANCIAL TAB: Add Payment Schedule section (Payment 1: %, Date, Method; Payment 2: %, Date, Method)
- [ ] FINANCIAL TAB: Fetch Odoo payment schedule fields (x_studio_payment_1_*, x_studio_payment_2_*)
- [ ] FINANCIAL TAB: Apply same Financial tab enhancements to Sales Shipment detail page
- [ ] FINANCIAL TAB: Make payment schedule fields editable in edit mode
- [x] RESTRUCTURE: Purchase Load detail page — convert from stacked cards to tabbed layout (Overview, Quality, Trucking, Documents)
- [x] RESTRUCTURE: Sales Delivery detail page — convert from stacked cards to tabbed layout matching Purchase Load
- [x] Show product name in Purchase Load detail summary bar
- [x] Show product name in Sales Delivery detail summary bar
- [x] UI: Redesign Load/Delivery summary bar — product name full-width row above other fields
- [x] FINANCIAL: Discover Odoo payment schedule fields (payment_term_id, x_studio_payment_*)
- [x] FINANCIAL: Add VAT fields (amount_untaxed, amount_tax, amount_total) to backend for Purchase
- [x] FINANCIAL: Add VAT fields to backend for Sales
- [x] FINANCIAL: Add payment term and per-load rate fields to backend
- [x] FINANCIAL: Enhance Purchase Financial tab UI (amounts w/wo VAT, payment term, rate, payment schedule)
- [x] FINANCIAL: Enhance Sales Financial tab UI (same enhancements)
- [x] FINANCIAL: Make financial fields editable in edit mode
- [x] TRUCKING: Add driver and driver contact editing to Purchase Load Trucking tab
- [x] TRUCKING: Add driver and driver contact editing to Sales Delivery Trucking tab
- [x] FINANCIAL EDIT: Make Rate/Container editable in edit mode (Purchase)
- [x] FINANCIAL EDIT: Make Selling Price/Ton editable in edit mode (Purchase)
- [x] FINANCIAL EDIT: Make Rate/Container editable in edit mode (Sales)
- [x] FINANCIAL EDIT: Make Selling Price/Ton editable in edit mode (Sales)
- [x] PAYMENT SCHEDULE: Discover Odoo payment schedule custom fields
- [x] PAYMENT SCHEDULE: Add payment schedule fields to backend
- [x] PAYMENT SCHEDULE: Add Payment Schedule section to Purchase Financial tab (Payment 1/2 with %, date, method)
- [x] PAYMENT SCHEDULE: Add Payment Schedule section to Sales Financial tab
- [x] PAYMENT SCHEDULE: Make payment schedule fields editable in edit mode (read-only from Odoo payment terms)
- [x] AIS: Make lat/long position clickable to open Google Maps in new tab (Purchase)
- [x] AIS: Make lat/long position clickable to open Google Maps in new tab (Sales)
- [x] QA TABS: Discover Odoo stock.picking fields for Procurement Source tab
- [x] QA TABS: Discover Odoo stock.picking fields for Quality Received tab
- [x] QA TABS: Add quality assessment fields to backend (PICKING_FIELDS, router)
- [x] QA TABS: Identify company IDs for Cairo, Sokhna, Alfaglobal (3=Cairo, 4=Sokhna, 5=Alfaglobal)
- [x] QA TABS: Build Procurement (Source) tab UI in Purchase Load detail
- [x] QA TABS: Build Quality (Received) tab UI in Purchase Load detail
- [x] QA TABS: Implement company-based visibility (Cairo/Sokhna/Alfaglobal only, not AbuDhabi/ADGM)
- [x] QA TABS: Ensure tabs do NOT appear on Sales shipment loads
- [x] AIS: Add Google Maps mini-map preview in AIS section showing vessel pin (Purchase)
- [x] AIS: Add Google Maps mini-map preview in AIS section showing vessel pin (Sales)
- [x] AIS: Add vessel route polyline (POL to POD) on Google Maps when clicking position
- [x] AIS: Make MMSI clickable to open MarineTraffic vessel page
- [x] AIS: Make IMO clickable to open VesselFinder vessel page
- [x] AIS: Mirror all vessel route enhancements to Sales shipment page
- [x] FINANCIAL: Add invoice/bill tracking on Purchase Financial tab (linked invoices with status/amounts)
- [x] FINANCIAL: Add invoice/bill tracking on Sales Financial tab (linked invoices with status/amounts)
- [x] FINANCIAL: Backend endpoint to fetch linked invoices/bills from Odoo (account.move)
- [x] QA PHOTOS: Add quality checker photo upload fields in Procurement (Source) tab
- [x] QA PHOTOS: Add quality checker photo upload fields in Quality (Received) tab
- [x] QA PHOTOS: Sync photo uploads to Odoo binary fields on stock.picking
- [x] QA GRADE: Add quality grade badge/score column on Purchase Loads/Receipts list
- [x] QA GRADE: Add quality grade badge/score column on Sales Deliveries list
- [x] QA REBUILD: Completely rebuild Procurement (Source) tab to match full Odoo layout
- [x] QA REBUILD: Add Purchase Information section (Purchasing Unit, Container Number, Net Weight, Currency, Agreed Price, Bales/Bags, Source, Farm/Field, Loaded Grade)
- [x] QA REBUILD: Add Trucking Information section (Driver Name, Contact, Driver License file, Trucking Cost Currency, Agreed Trucking Cost, Advance Payment, Long Stay Charges, Trucking Contract file, Weight Receipt file)
- [x] QA REBUILD: Add Quality Checker section (Left/Right/Back Side Pictures as file uploads)
- [x] QA REBUILD: Completely rebuild Quality (Received) tab to match full Odoo layout
- [x] QA REBUILD: Add Receiving Team section (Quality Supervisors, Offloading Drivers, Labor)
- [x] QA REBUILD: Add Arrival Information section (Truck Load Serial, Arrival DateTime, Total Received Bales, Clean Truck toggle, Truck Cover toggle, Proper Lashing toggle, Proper Stacking toggle, Load Pictures Right/Left/Back as files, Container/Truck Load Body Report file)
- [x] QA REBUILD: Add Quality Checks / Product Quality section (8 boolean toggles for quality checks)
- [x] QA REBUILD: Add Broken/Damaged Bales %, Moisture Bales %, Quality Report/Form Attachment file
- [x] QA REBUILD: Add Ladder Images (4 file uploads: 1-Right, 2-Right, 1-Left, 2-Left)
- [x] QA REBUILD: Add Accepted Load toggle
- [x] QA REBUILD: Add Grade Percentages section (Overall Received Grade, Premium %, Grade 1%, Standard %, Grade 3%, Quality Score)
- [x] QA REBUILD: Add NIR Analysis section (NIR Sample Reference, Crude Protein %, NIR ADF %, NIR NDF %)
- [x] FIX: Shipment Status should use unified shipment status field — edit mode now uses dropdown with UNIFIED_STAGES instead of free text input
- [x] FIX: FieldRow component treats 0 as falsy — now properly displays 0 values instead of showing "—"
- [x] FIX: Grade Percentages edit mode — Premium Grade was using wrong Odoo field (x_studio_grade_1_ instead of x_studio_premium_grade), Standard % was not editable
- [x] FIX: Added Loading DateTime field to Procurement (Source) tab
- [x] FIX: Agreed Trucking Cost now falls back to truckingFee when value is 0
- [x] FIX: Shipment Status edit mode changed from free text input to dropdown with UNIFIED_STAGES
- [x] BUG: MMSI link opens MarineTraffic homepage instead of vessel-specific page — fixed URL to /en/ais/details/ships/{mmsi}
- [x] BUG: IMO link opens VesselFinder homepage instead of vessel-specific page — fixed URL to /vessels/details/{imo}
- [x] UI: Google Maps mini-map should default to satellite view — added mapTypeId prop to MapView, set to 'satellite' in OdooVesselRoute
- [x] BUG: Fix React error #310 — moved invoicesQuery useQuery hook out of conditional IIFE in both OdooShipDetail and OdooSalesShipDetail; tsc --noEmit and pnpm build both pass with 0 errors
- [x] FIX: Stale LSP errors — old tsc watch process (Feb 28) was using TS 5.6.3 while project upgraded to 5.9.3; killed stale process, moved tsBuildInfoFile to ./.tsbuildinfo, fresh tsc watch now reports 0 errors with TS 5.9.3
- [x] FIX: Removed unused fetchPaymentTermLines import from salesShipments.ts
- [x] UPPERCASE: Apply toUpperCase() to Shipping Line in Purchase Shipment listing (OdooShipList)
- [x] UPPERCASE: Apply toUpperCase() to Shipping Line in Sales Shipment listing (OdooSalesShipList)
- [x] UPPERCASE: Apply toUpperCase() to Shipping Line in Dashboard tables (both Purchase and Sales)
- [x] UPPERCASE: Apply toUpperCase() to Shipping Line in Purchase Shipment detail info cards (OdooShipDetail)
- [x] UPPERCASE: Apply toUpperCase() to Shipping Line in Sales Shipment detail info cards (OdooSalesShipDetail)
- [x] UPPERCASE: Apply toUpperCase() to Shipping Line in OdooVesselRoute component
- [x] UPPERCASE: Apply toUpperCase() to Shipping Line in card view / export if applicable
- [x] REORG: Purchase Shipment Info — add BL Number field
- [x] REORG: Purchase Shipment Info — reorder dates logically (POL → ETD → ETA → POD → ETA POD)
- [x] REORG: Purchase Shipment Info — move Vessel Cut Off from Agents & Officers to Shipment Info card
- [x] REORG: Sales Shipment Info — add BL Number field
- [x] REORG: Sales Shipment Info — reorder dates logically
- [x] REORG: Sales Shipment Info — move Vessel Cut Off from Agents & Officers to Shipment Info card
- [x] Add BL Number column to Purchase Shipment listing table (OdooShipList)
- [x] Add BL Number column to Sales Shipment listing table (OdooSalesShipList)
- [x] Include BL Number in Excel export for both Purchase and Sales listings
- [x] Add BL # column to Dashboard Recent Purchase Shipments table
- [x] Add BL # column to Dashboard Recent Sales Shipments table
- [x] Add BL Number to search filter on Purchase listing (OdooShipList)
- [x] Add BL Number to search filter on Sales listing (OdooSalesShipList) — already present
- [x] Replace straight-line vessel route polylines with realistic sea-lane routes using maritime waypoints
- [x] Replace straight-line vessel route polylines with realistic sea-lane routes using maritime waypoints
- [x] Check/create BL Number field — PO uses `shipment_bl_number`, SO uses `x_studio_shipment_bl_number` — fixed router and frontend
- [x] Financial tab: Total Amount (excl/incl VAT), Payment Term, Payment Schedule already present in Purchase detail
- [x] Financial tab: Same enhancements already present in Sales detail
- [x] Fix text overlap in load detail Procurement (Source) and Trucking tabs — two-column layout values bleeding into adjacent labels
- [x] Add global search bar to Dashboard header for searching shipments by PO/SO number, vendor, BL, vessel
- [x] Add date range filter to Dashboard for filtering recent shipments by date
- [x] Wire search and date filters to Recent Purchase Shipments table
- [x] Wire search and date filters to Recent Sales Shipments table
- [x] Update vessel route polyline color to bright orange (#FF6B00) for visibility on blue sea water
- [x] Fix currency display bug — removed hardcoded $ from fmt() function, now shows EUR 11,290,259 / AED 37,049,414
- [x] Fix currency display across all pages — fmt() was the single source, fixed globally
- [x] Audit all pages for text overlap and fix any remaining issues — added minWidth:0 to FieldRow, fixed gap from 0 to 4px in grids
- [x] Add clickable pipeline stage quick-filter chips on Dashboard
- [x] Add Export button to Dashboard for downloading filtered results as Excel
- [x] Create shipment_status_log table to track status changes over time
- [x] Implement status change detection — redesigned with seed-first approach (silently records initial statuses, only notifies on actual transitions)
- [x] Send owner notification via notifyOwner() when shipment status changes — FIXED: was spamming, now uses seed-first logic
- [x] Build notification history/activity log page showing recent status changes — integrated into notification bell dropdown panel
- [x] Add notification bell icon in header with unread count badge, dropdown panel with notification list, mark-all-read, click-to-navigate
- [x] Re-enable notification triggers on explicit status update mutations (not on list fetches)
- [x] Write vitest tests for notification system (10 tests, 100 total tests passing)
- [x] Fix TypeScript errors: missing fetchPurchaseOrders import, ExcelColumn accessor→value property
- [x] Fix trucking cost currency display — use actual currency from Odoo data for trucking, commission, claim, product line amounts
- [x] Add notification_preferences table to schema (global stage transition toggles with enabledStages, notifyOwner, notifyInApp)
- [x] Build tRPC endpoints for get/update notification preferences
- [x] Build notification preferences UI panel (accessible from notification bell dropdown) — gear icon opens settings with All/None toggles, per-stage checkboxes, owner/in-app toggles
- [x] Wire preferences into checkAndNotifyStatusChanges to filter which transitions trigger notifications — loadPreferences() + isStageEnabled check + forceNotify mechanism
- [x] E2E test: trigger a status change on a real shipment, verify bell notification appears — PO/AD/26/00049 Not Set → Planned, bell shows badge "1"
- [x] E2E test: verify owner notification email is sent on status change — notified=1 confirmed in DB
- [x] Write vitest tests for notification preferences — 17 tests total (7 new), 107 tests passing across 8 test files
- [x] Add userId column to notification_preferences table and migrate DB
- [x] Update notification preferences tRPC endpoints to be per-user (get/update use ctx.user via protectedProcedure)
- [x] Update checkAndNotifyStatusChanges to accept userId param and load per-user preferences with global fallback
- [x] Update NotificationBell preferences UI with per-user indicator, reset button, and "My Notification Settings" header
- [x] Add fallback chain: user-specific → global row → hardcoded defaults (all stages enabled)
- [x] Write vitest tests for per-user notification preferences — 22 notification tests, 112 total tests passing
- [x] E2E test: verified preferences panel shows "Using Global Defaults" indicator, per-user save/reset flow
- [x] Create reusable loading components: TopProgressBar, ShimmerBox, TableSkeleton, PipelineSkeleton, AlertSkeleton, DetailPageSkeleton, StatCardSkeleton
- [x] Add page-level loading bar (animated top bar) during data fetch on all list/detail pages
- [x] Add skeleton loaders for Dashboard: KPI cards use ShimmerBox, alerts use AlertSkeleton, pipeline uses PipelineSkeleton
- [x] Add skeleton loaders for Purchase/Sales shipment list: toolbar shimmer + status tab shimmer + TableSkeleton with column headers
- [x] Add loading indicators for shipment detail pages: TopProgressBar + DetailPageSkeleton (header, tabs, info grid, table)
- [x] Enhanced Agreements page skeleton: TopProgressBar + ShimmerBox cards replacing old pulse animation
- [x] Users page uses local state only (no async fetch), no loading state needed
- [x] All tRPC query loading states now show visual feedback: shimmer skeletons + progress bars
- [x] Tested visually: Dashboard, Purchase/Sales lists, detail pages, Agreements, company dropdown all show proper loading states
- [x] Create PageTransition wrapper component with fade/slide CSS animations (220ms, two-phase exit/enter)
- [x] Integrate PageTransition into Home.tsx content area wrapping all page renders (keyed by page+shipmentId)
- [x] Added fade-slide animation type with subtle translateY for smooth page transitions
- [x] Tested transitions: Dashboard→Purchase→Sales→Dashboard all animate smoothly
- [x] Add backend tRPC endpoint (notifications.recentChanges) to fetch recent status changes since a given timestamp
- [x] Build StatusChangeToast component with 30s polling, auto-dismiss, and "View Shipment →" action button
- [x] Integrate toast system into Home.tsx app shell with navigation to shipment detail on click
- [x] Show toast with PO/SO badge, shipment ID, old→new status arrow, and "View Shipment →" button
- [x] Test toast notifications end-to-end — verified PO/AD/26/00049 Not Set → Planned toast appears in bottom-right
- [x] Write vitest tests for toast polling — 8 new tests, 120 total tests passing across 8 files
- [x] Remove "PO State" row from purchase shipment detail page (sales page didn't have it)
- [x] Clean up unused STATE_LABELS constants — audit confirmed all STATE_LABELS are still actively used (header badges, Excel exports, picking labels)
- [x] Consolidate STATE_LABELS into shared lib/stateLabels.ts module — 6 constants (PO_STATE_LABELS, SO_STATE_LABELS, PO_STATE_BADGE, SO_STATE_BADGE, PICKING_STATE_LABELS, PICKING_STATE_BADGE) moved from 6 files into 1 shared module
- [x] Consolidate STATE_COLORS into shared lib/stateLabels.ts module — 5 constants (PO_STATE_COLORS, SO_STATE_COLORS, SHIPMENT_STATUS_COLORS, STATE_BADGE_COLOR, getStageColor) moved from 4 files into shared module; removed 2 dead-code STATE_COLORS definitions
- [x] Remove kanban view and list/kanban toggle from Purchase Shipments list page (keep only table view)
- [x] Remove kanban view and list/kanban toggle from Sales Shipments list page (keep only table view)
- [x] Fix photo slots: clicking an already-uploaded image opens preview/download modal with Replace option; applied to all file slots in both Purchase and Sales detail pages
- [x] BUG: Preview modal not showing — fixed tRPC batch response parsing (was reading json?.result?.data?.content, needed json?.[0]?.result?.data?.json?.content)
- [x] BUG: Download not working — replaced data URI approach with Blob + URL.createObjectURL for reliable large file downloads
- [x] Change Photos section to row-based list design (same as Documents) in Purchase detail page
- [x] Change Photos section to row-based list design (same as Documents) in Sales detail page
- [x] Make linked shipment links (Linked Sales/Purchase Shipments) open in a new browser tab — added /purchase/:id and /sales/:id routes with standalone pages
- [x] Add dynamic browser tab titles on standalone detail pages (e.g., "PO/AD/26/00048 - Platfarm") and on all main pages
- [x] Add deep-link URL routes for list pages (/purchase, /sales, /agreements, /users) — URL syncs with page state
- [x] BUG: 404 on client-side routes in production — added /purchase, /sales, /agreements, /users routes in App.tsx; fixed server catch-all to skip /api/ routes
- [x] BUG: tRPC error "<!doctype" — server catch-all now skips /api/ routes so tRPC gets proper 404 instead of HTML
- [x] Add browser back/forward support — popstate listener syncs page state with URL; clears detail selections on back
- [x] Shareable detail links already work via /purchase/:id and /sales/:id standalone pages (opened in new tab)
- [ ] Audit: Check what procurement officer, quality receiver, and driver fields exist in Odoo at PO and picking (load/receipt) level
- [ ] Add procurement officer field to Purchase Shipment detail (shipment level) if not already present
- [ ] Add quality team receiver field to each load/receipt in Purchase Shipment detail
- [ ] Add driver/offloader field to each load/receipt in Purchase Shipment detail
- [ ] Ensure all personnel fields are editable and saved to Odoo for incentive calculations
- [x] Add Loading Team fields (quality_supervisor_ids, loading_driver_ids, labor_ids) to backend PICKING_FIELDS and resolve employee IDs to names
- [x] Add Loading Team section to Purchase Shipment detail UI (Quality Supervisors, Loading Drivers, Labor)
- [x] Enhanced search for Purchase Shipments: search by reference, booking number, BL number, container number, or truck load number
- [x] Enhanced search for Sales Shipments: search by reference, booking number, BL number, container number, or truck load number
- [x] Loading Team: Show each person with avatar/initial badge (like Odoo style)
- [x] Loading Team: Make Quality Supervisors, Loading Drivers, Labor editable with multi-select search (add/remove people)
- [x] Loading Team: Save many2many changes back to Odoo stock.picking
- [x] Enhanced search: Allow searching purchase shipments by vendor/supplier name (already included)
- [x] Enhanced search: Allow searching sales shipments by customer name (already included)
- [x] Rename "Loading Team" to "Receiving Team" in the load detail page
- [x] Move Receiving Team section from Overview tab to Quality (Received) tab
- [x] Move Trucking Attachments (Driver License, Trucking Contract, Weight Receipt) into the Trucking tab
- [x] Add Purchase Currency dropdown to Procurement (Source) tab
- [x] Consolidate load page tabs to: Overview, Procurement (Source), Trucking, Quality (Received)
- [x] Remove separate Quality tab — quality aspects covered in Procurement and Receiving tabs
- [x] Remove separate Documents tab — documents belong in their respective tabs (Procurement, Trucking, Receiving)
- [x] Fix: Search by container/truck load number with backslash (e.g. 1523\4925) returns no results — backslash escaped for Odoo ilike + fixed tRPC client usage
- [x] Rename "Loading Drivers" to "Off-Loading Drivers" in Receiving Team section
- [x] Remove "Ladder Image 2 – Left Side" from Ladder Images section in load detail
- [x] Move Commission and Deduction/Claim sections from Quality (Received) tab to a new separate tab
- [x] Make "Loaded Grade" a dropdown select in Procurement tab
- [x] Rename "Quality Checker" to "Load Picture @Source" in Procurement tab
- [x] Remove "Trucking Fees" text field from Trucking tab
- [x] Move "Truck Serial" from Overview tab Container card to Quality (Received) tab
- [x] BUG: Container number search (e.g. XYZ15234925) returns 0 results — fixed origin suffix stripping and added x_studio_container field to search domain
- [x] Update Loaded Grade dropdown with proper grade options from Odoo — dynamic options fetched via fields_get API
- [x] Add shipping line name to search (Purchase + Sales)
- [x] Add POL (Port of Loading) to search (Purchase + Sales)
- [x] Add POD (Port of Discharge) to search (Purchase + Sales)
- [x] Add product name to search (Purchase + Sales)
- [x] Add clearance agent name to search (Purchase + Sales)
- [x] Add trucking company name to search (Purchase + Sales)
- [x] Verify all search keys actually return correct results — tested WANHAI, ESL, MAERSK, RCL, PIL, XYZ15234925, AGRICO, Nafosa, Alfalfa in browser
- [x] Enhance Dashboard global search to cover all expanded fields (shipping line, POL, POD, product name, clearance agent, trucking company, container number)
- [x] Verify Dashboard search returns correct results for all field types — tested MAERSK, Alfalfa, Garda, Jebel Ali in browser
- [x] Create reusable search highlight utility component
- [x] Add search highlighting to Dashboard table rows
- [x] Add search highlighting to Purchase Shipments table rows
- [x] Add search highlighting to Sales Shipments table rows
- [x] Verify highlighting works correctly across all pages — tested WANHAI on Dashboard, ESL on Sales, Nafosa on Purchase
- [x] Redesign Sales delivery detail page with 4 tabs: Overview, Quality (Shipped), Trucking, Quality (Destination)
- [x] Overview tab: container info, seal, dates, status, basic shipment details
- [x] Quality (Shipped) tab: quality supervisor, labors, drivers, container images (sides/back), quality report, loaded bales list
- [x] Trucking tab: trucking agent, fee, and related parameters
- [x] Quality (Destination) tab: received quality data at customer side
- [x] Follow Purchase load page mindset for tab structure and design
- [x] Apply to all companies
- [x] Verify tabs work correctly in browser — tested all 4 tabs on WH/OUT/03304
- [x] Add column sorting to Purchase Shipments table (click headers to sort by PO date, amount, status, etc.)
- [x] Add column sorting to Sales Shipments table
- [x] Add column sorting to Dashboard tables
- [x] Rename Sales shipment tabs: "Deliveries" → "Loads / Deliveries", "Shipping" → "Shipping & Logistics"
- [x] Daily alerts for in-transit shipments missing critical documents (BL, Certificate of Origin, Delivery Note, Fumigation Certificate for PO; BOE, Tax Invoice, Governmental Docs for SO)
- [x] Add hard copy received checkboxes to Documents tab for tracking physical document delivery
- [x] Database schema for hard copy document tracking
- [x] Backend endpoint for checking/updating hard copy status
- [x] Frontend hard copy checkboxes in Documents tab (Purchase + Sales)
- [x] Scheduled daily alert job that checks in-transit shipments for missing documents (runs at 8 AM daily + on server startup)
- [x] Alert notification to owner when documents are missing (via notifyOwner + in-app alert log)
- [x] Add email notification channel for daily document alerts
- [x] Implement email sending service (Nodemailer with SMTP)
- [x] Send email alongside in-app notification when missing documents detected
- [x] Add configurable email recipients for document alerts (UI in Users > Email Alerts)
- [x] Write tests for email notification integration (174 tests passing)
- [x] Configure SMTP credentials (Gmail) for email alerts — hardcoded, verified working
- [x] Add loading spinners/indicators for hard copy checkbox toggles (InlineSpinner replaces checkbox while saving)
- [x] Add loading indicators for shipment status updates (MutationProgressBar on stage timeline)
- [x] Provide visual feedback during backend processing (1-2 sec delay)
- [x] BUG: Loading indicators disappear before data is actually refreshed — fixed: await invalidate() before clearing spinner/progress state
- [x] Add Hard Copy Summary dashboard widget
- [x] Backend endpoint for hard copy completion statistics across active shipments
- [x] Frontend widget showing completion rates (Purchase + Sales) with progress bars and per-shipment drill-down
- [x] Add success/error toast notifications after hard copy toggle
- [x] Add success/error toast notifications after status updatement status update
- [x] Apply to both Purchase and Sales detail pages
- [x] FIX: Hard Copy Summary widget now counts at shipment level — a shipment is "complete" only if ALL its docs have hard copies
- [x] Style toast notifications to match Platfarm design system (forest green left accent, DM Sans font, card background, consistent with StatusChangeToast)
- [x] BUG: Hard Copy Summary widget showed NaN% — was from stale cached version; current version works correctly with proper zero-guards (0 / 208 shipments complete)
- [x] CHANGE: Hard Copy Summary widget — show "shipments with missing documents" as primary metric, filter to Loaded/In Transit/Arrived at Port (pre-Customs Clearance), rename to "En-Route Shipments"
- [x] FEATURE: Add clickable missing-doc details in Hard Copy Summary drill-down — show specific missing document names (e.g., BL, Certificate of Origin) per shipment
- [x] BUG: Missing Documents expanded section is shifted/displaced — not aligned properly under the shipment row in the Hard Copy Summary widget
- [x] BUG: TRPCClientError — API returns HTML instead of JSON ("Unexpected token '<', '<!doctype'... is not valid JSON") — transient HMR issue, resolved
- [x] CHANGE: En-route Missing Documents widget — only track 5 critical clearance docs (BL, Packing List, Phyto, Fumigation, Telex Release); remove internal-use docs (Payment Parts, P&L, Certificate of Origin, etc.)
- [x] FEATURE: Add "Telex Release / BL Issued" boolean quick-toggle in the Missing Documents widget — sync with Odoo boolean field, show as toggle per shipment in drill-down
- [x] BUG: Telex Release / BL Issued toggle does not respond when clicked — fixed: added optimistic UI update for instant visual feedback
- [x] FEATURE: Surface telex_release_bl_issued field on Purchase and Sales shipment detail pages (same toggle as dashboard widget)
- [x] FEATURE: Add checkboxes for all 5 clearance docs (BL, Packing List, Phyto, Fumigation, Telex Release) in the Missing Documents widget drill-down — checking/unchecking updates Odoo and reflects on shipment detail page
- [x] FEATURE: Add Telex Release / BL Issued flag to shipment detail page — in Shipment & Logistics status card (Purchase direct, Sales inherited from linked PO)
- [x] CHANGE: Restructure Missing Documents widget — Purchase Orders only (remove Sales), two cards: Hard Copy Receiving + Soft Copy (File Uploaded)
- [x] FEATURE: Add container number and truck load number search to Sales shipments page (already existed)
- [x] FEATURE: Add container number and truck load number search to Dashboard search

- [x] BUG/FEATURE: Linked shipment clicks should open in a new browser tab (not navigate in-page)
- [x] CHANGE: Missing Documents widget — show total soft + hard copies combined (not just hard copies)
- [x] BUG: Dashboard crashes with TypeError: Cannot read properties of undefined (reading 'enRoute') in Missing Documents widget — added defensive null check
- [x] BUG: Clicking linked sales shipment banner on Purchase detail page does not open anything — fixed superjson input/output format in fetch calls
- [x] BUG: Sales detail linked shipment banner shows multiple PO/SO names as one banner instead of separate clickable banners; clicking does nothing — fixed by splitting comma-separated names into individual banners with correct PO/SO type detection
- [x] BUG: Linked shipment click opens standalone page without sidebar/navigation — fixed: handleNavigateToShipment already uses internal state navigation (setSelectedOdooShipmentId/setSelectedOdooSalesShipmentId + setPage) instead of window.open, keeping navigation within the portal with full sidebar/user switcher/company selector
- [x] FEATURE: Add "Back to source" breadcrumb when navigating via linked shipment banners — show "← Back to PO/AD/26/00035" so users can return to the originating shipment
- [x] BUG: New Sales Agreement form shows all customers instead of only those related to the selected company — fixed: pass companyId to trpc.odoo.customers.useQuery(), reset customer when company changes
- [x] BUG: New Purchase Agreement form shows all vendors instead of only those related to the selected company — fixed: added activeCompanyId fallback for vendor filtering, reset vendor when company changes
- [x] BUG: Linked Shipments table in Agreement detail shows "PO #" column header — fixed: changed to "Shipment #" for both Purchase and Sales agreement detail views
- [x] FEATURE: Create main home page (module launcher) with application icons/cards
- [x] FEATURE: Move current portal (Dashboard, Purchase/Sales Shipments, Agreements, Users) under "Purchase & Sales Shipments" module
- [x] FEATURE: Add "Purchase & Sales Shipments" icon/card on the home page that navigates to the current portal
- [x] FEATURE: Add "Home" link in sidebar to navigate back to module launcher
- [x] FEATURE: Enhance ModuleLauncher cards design — redesigned with accent stripe gradients, glassmorphism header, Active/Coming Soon badges, hover-transforming icons and arrow buttons, improved typography hierarchy, and professional footer
- [x] FEATURE: Replace "P" placeholder logo with actual Platfarm logo SVG in module launcher header and portal sidebar
- [x] FEATURE: Replace current ModuleLauncher with Claude's designed home page
- [x] FEATURE: Integrate Claude's designed login page (adapted for Manus OAuth redirect)
- [x] BUG: ModuleLauncher does not show Claude's login page design when user is logged out — fixed: faithfully implemented Claude's exact login view with split-screen layout, email/password fields, remember me, SSO button, morph transitions between login/portal states
- [x] CHANGE: Remove Manus OAuth from login flow — implement direct email/password authentication as Claude designed, Sign In button authenticates via form credentials with morph transition to portal
- [x] BUG: Login page and morph transitions broken — must copy Claude's PlatfarmHome.jsx exactly as-is with zero modifications

- [x] Remove Manus OAuth from ModuleLauncher - use Claude's exact local state login
- [x] Rewrite ModuleLauncher.tsx to match Claude's PlatfarmHome.jsx exactly
- [x] Login page shows split-screen with brand panel (left) + login form (right)
- [x] Morph transitions work between login and portal states
- [x] Open Module button navigates to /dashboard
- [x] No OAuth redirect on Sign In - just local state animation
- [x] Keep Claude's original inline SVG PlatfarmLogo component (works perfectly with color props)
- [x] BUG: Dashboard sidebar logo broken (still using CDN image) — replaced with shared PlatfarmLogo inline SVG component

## Double Press Production Module (Odoo Integrated)
- [x] Explore Odoo mrp.production model API at odoo.platfarm.io — fields, custom fields, stock moves
- [x] Build server/odoo-production.ts — Odoo JSON-RPC functions for manufacturing orders
- [x] Build server/routers/production.ts — tRPC procedures (list, getById, create, update, stageChange)
- [x] Wire production router into appRouter
- [x] Build ProductionDashboard page with live Odoo KPIs
- [x] Build ProductionList page with filters, search, sorting
- [x] Build ProductionDetail page with all tabs (Overview, Input/Output, Quality, Workforce, Machine, Diesel)
- [x] Build CreateProductionOrder wizard
- [x] Integrate into sidebar navigation and routing in Home.tsx
- [x] Add Double Press Production module to ModuleLauncher portal card
- [x] Write vitest tests for production backend procedures — 28 tests covering stats, list, count, getById, cross-validation, lookups, data integrity
- [x] Test all pages against live Odoo manufacturing data — verified dashboard, list, detail with all 6 tabs, search, filters, pagination
- [x] Final cross-validation and checkpoint — stats vs count match, list vs getById match, 226 total tests passing

## Style Alignment: Production → Shipment Consistency
- [x] Align Production detail page tabs to match Shipment tab style (bordered tabs, same font/size/spacing)
- [x] Align Production detail header bar to match Shipment header bar (breadcrumb, badges, Edit button style)
- [x] Align Production detail summary ribbon to match Shipment summary ribbon (same card background, typography)
- [x] Align Production detail card sections to match Shipment card sections (card borders, heading style, field rows)
- [x] Align Production detail buttons to match Shipment button style (Edit, state action buttons)
- [x] Align Production list page table style to match Shipment list page table style — already using same Card, Th, Td, SortTh, Badge components
- [x] Align Production dashboard cards/widgets to match Shipment dashboard style — already using same Card, Badge, KPI card patterns
- [x] Ensure consistent font sizes, colors, spacing, and border treatments across both modules — verified side-by-side in browser

## Module Launcher & Production Dashboard Fixes
- [x] Fix ModuleLauncher scroll: sticky header + green card on left, only module list scrolls on right
- [x] Fix green card size consistency — card should not change size when switching modules
- [x] Home sidebar button navigates to module launcher (/) not login page
- [x] Double Press Production icon: replace wrench/tools icon with alfalfa bale icon
- [x] Production Dashboard alerts: match shipment dashboard alert style (Card + CardHdr with scrollable list)
- [x] Production Dashboard alerts: add meaningful alerts (missing machine hours, missing diesel data, no bales recorded, abnormal diesel consumption)
- [x] Production Pipeline: fix alignment and layout — circle visualization with stage chips
- [x] Production Pipeline: clickable stages (Draft, Confirmed, In Progress, To Close, Done, Cancelled) filter the orders table with Clear Filter button

## Production Module Enhancements (Round 2)
- [x] Add Edit button to Production Order detail page (like shipment detail)
- [x] Workforce tab: match Loads page style with selectable labor/supervisors (add/remove people)
- [x] Add document upload sections within Production Order tabs (Quality docs, Machine docs, etc.)
- [x] Rename "New Manufacturing Order" to "New Production Order"
- [x] Finished Product field: searchable dropdown (type-to-search) not static dropdown
- [x] Bill of Materials: allow multiple BOMs selection
- [x] Add Source Warehouse selector to create wizard
- [x] Overhaul create wizard to include all tab data (shift details, workforce, quality, machine, diesel)
- [x] Fix Module Launcher: Open Module button trimmed/overlapped with card edges
- [x] Module list on right: show 5+ modules visible (extend beyond green card bottom)
- [x] Production Dashboard: Add search bar matching Purchase/Sales dashboard style
- [x] Production Dashboard: Add date range filter (From/To)
- [x] Production Dashboard: Add Export button
- [x] Production Order list: Add same search bar with date range and export
- [x] Enhanced search: Search by product, labor, supervisor, driver, input/output product
- [x] Restrict Production module to Sokhna & Cairo companies only
- [x] Implement actual document upload in Production Order tabs (not placeholder/coming soon)
- [x] Unify all toast/notification styles across the system (same style as shipment stage update toast)

## Production Analytics Charts
- [x] Production Trends Over Time chart (line/area chart — daily/weekly/monthly production volume)
- [x] Bales by Source chart (bar chart — Dakhla, Toshka, Farafrah, Owainat breakdown)
- [x] Diesel Efficiency chart (line chart — diesel consumption per ton over time)
- [x] Product Grade Distribution chart (pie/donut chart — Grade 1, Standard, Grade 1A, etc.)
- [x] Production Hours vs Output chart (scatter/bar — hours worked vs tons produced)
- [x] Monthly Production Summary chart (grouped bar — planned vs actual production)
- [x] Fix Production document upload to match shipment document upload style exactly (same card layout, icons, View/X buttons, Add More)

## Production Module Deep Audit (Field Coverage)
- [x] AUDIT: x_studio_no_produced_fairgrade_3_bales — added Fair Grade 3 bale count to getById transform, bales display, bales edit grid, totalBales calculation, list totalBales
- [x] AUDIT: x_studio_incentive_cancelation_details — added incentive cancellation details text to getById transform, view mode (shows when cancelled), edit mode (textarea when cancelled)
- [x] AUDIT: x_studio_facility_manager_attended — added facility manager attended flag to getById transform, view mode (BoolRow), edit mode (checkbox)
- [x] AUDIT: priority — added order priority to getById transform, view mode (Normal/Urgent), edit mode (dropdown)
- [x] AUDIT: origin — added source document reference to getById transform, displayed in System Info card
- [x] AUDIT: user_id — added responsible user to getById transform, displayed in System Info card
- [x] AUDIT: location_src_id — added source location to getById transform, displayed in System Info card
- [x] AUDIT: location_dest_id — added destination location to getById transform, displayed in System Info card
- [x] AUDIT: date_deadline — added deadline date to getById transform, displayed in System Info card
- [x] AUDIT: All new fields added to tRPC update schema and UpdateManufacturingOrderInput interface
- [x] AUDIT: BALE_GRADE_LABELS updated with fairGrade3 entry
- [x] AUDIT: 226 tests passing, tsc --noEmit clean (0 errors)

## Production Analytics Chart Edits
- [x] Change "Bales by Source" chart to "Tons by Source" (show tons produced per source instead of bales)
- [x] Remove "Quality Grade Distribution" pie chart entirely
- [x] Remove "Shift Performance" scatter chart entirely
- [x] Change "Production by Company" to show Tons only (remove Orders bars), rename to "Tons by Company"

## Bug Fixes
- [x] BUG: Dashboard search for supervisor name (e.g. "Ahmed") returns 0 results even though done shifts have that supervisor — fixed: enhanced list transform to resolve employee IDs and include supervisor/labor names for client-side search
- [x] BUG: Date filter "From" defaults to today's date, hiding all historical orders — verified: From defaults to empty string, user had manually entered today's date

## New Production Order Wizard & Detail Page Fixes
- [x] Reorder New Production Order wizard: Company first, then inputs/source/warehouse with availability check (like sales shipments) — reorganized into 7 steps
- [x] Add Edit button to Production Order detail page — was already present but only for draft/confirmed/progress states; extended canEdit to include done and to_close states

## Production Upload Style Fix
- [x] Ensure Production module document/photo uploads match the exact same style as Shipment module (Purchase/Sales loads)
- [x] Investigate Odoo MO binary fields available for document storage (found 6 binary fields on mrp.production)
- [x] Build backend endpoints for Production Odoo binary field upload/read (uploadMOFile, readMOFile, checkMOFileStatus)
- [x] Replace frontend Production document upload with shipment-style Preview/Replace per-field pattern (FilePreviewModal, uploadedFiles state, same row layout)

## Diesel Tab & I/O Tab Fixes
- [x] Remove Sleeve Bags Used and Strapping Units Used from Diesel & Materials tab (already shown in Input/Output)
- [x] Show location/warehouse (Source Location, Destination) for input and output products in the Input/Output tab

## Wizard Availability Check & Diesel Tab Rename
- [x] Add stock availability check in wizard Step 2 (Source & Warehouse) — show current stock levels for BOM input materials from Odoo
- [x] Build backend endpoint (bomAvailability) to fetch BOM lines + stock quant data by product IDs and location
- [x] Display availability table in wizard after product + warehouse are selected (shows Required/On Hand/Available/Status per component)
- [x] Rename "Diesel & Materials" tab to "Diesel" in ProductionDetail.tsx

## Remove BOM from Wizard
- [x] Remove Bill of Materials section from Create Production Order wizard (not needed, Odoo auto-selects)

## Destination Location in Wizard
- [x] Add destination location/warehouse field to wizard Step 1 (Company & Product) — same location data/pattern as shipments
- [x] Wire destination location to Odoo payload (location_dest_id)

## Input Source as Stock Location
- [x] Replace Input Material Source dropdown with same stock location dropdown used for Destination Location
- [x] Remove separate Source Warehouse field (merged into Input Material Source as stock location)
- [x] Wire location_src_id (input source location) to Odoo payload

## Tons by Company Chart Style
- [x] Convert "Tons by Company" chart from vertical bar to stacked horizontal bar chart
- [x] Show truncated company names (Cairo, Sokhna, Alfaglobal) instead of full names

## Production Analytics UI Enhancement
- [x] Redesign chart cards with refined styling (subtle shadows, rounded corners, better padding)
- [x] Improve chart headers with icon accents and better typography
- [x] Add summary KPI badges/stats within each chart card
- [x] Enhance color palette and gradient fills for charts
- [x] Improve tooltip and legend styling
- [x] Better grid layout and spacing between charts
- [x] Add value labels on stacked bar segments

## Dashboard Top KPI Cards Redesign
- [x] Replace existing KPI cards with: Total Orders, Input Quantity, Output Quantity, Production Hours, Labors/Shift, Drivers/Shift

## Bug Fix: tRPC returns HTML instead of JSON
- [ ] Fix tRPC error on /production/orders where API returns HTML (<!doctype) instead of JSON

## Production Orders Table - Additional Columns
- [x] Add diesel liters column to orders table
- [x] Add number of sleeves column to orders table
- [x] Add #labors column to orders table
- [x] Add supervisors column to orders table
- [x] Add #drivers column to orders table
- [x] Add min temp (max oil temperature) column to orders table
- [x] Add max temp column to orders table
- [x] Add sleeveBagsUsed and maxOilTemperature to list endpoint backend

## Supervisors Column Update
- [x] Change Supervisors column from names to # Supervisors (count)

## Avg Bale Weight Column
- [x] Add Avg Bale Weight column after Bales (produced qty / total bales)

## Dashboard Recent Orders Table - Match ProductionList Columns
- [x] Add Avg Wt, Diesel, Sleeves, # Labors, # Supervisors, # Drivers, Max Temp columns to dashboard recent orders table

## Sticky First Column - All Portal Tables
- [x] Make first column sticky on all tables across the entire portal

## Rename Destination Location
- [x] Rename "Destination Location" to "Output Production Location" across the portal

## Wizard Step 1 Improvements
- [x] Move "Quantity to Produce" from Step 2 to Step 1 (after Finished Product)
- [x] Rename "Destination Location" to "Output Production Location" on Step 1

## Input Product Selector on Step 2
- [x] Add Input Product searchable selector on Step 2 (same OdooSearchSelect as Finished Product)
- [x] Add input_product_id and input_product_name to form state
- [x] Wire input product to Odoo payload (raw material / component)
- [x] Show input product in Review section and Confirm dialog

## Step 2 Improvements - Stock Check & Input Quantity
- [ ] Add stock availability check button on Step 2 for selected input product at source location
- [x] Add Input Quantity field on Step 2
- [x] Rename Step 2 tab from "Source & Warehouse" to "Input Product & Source"

## Step 3 Packing Materials + Step 2 Improvements
- [x] Add Input Quantity field on Step 2
- [x] Add stock availability check button on Step 2 for input product at source location
- [x] Rename Step 2 tab from "Source & Warehouse" to "Input Product & Source"
- [x] Insert new Step 3 "Packing Materials" with sleeve bags quantity and strapping materials quantity fields
- [x] Update all subsequent step numbers (old 3→4, 4→5, 5→6, 6→7, 7→8)
- [x] Add packing materials to Review section and Confirm dialog
- [x] Wire packing materials to Odoo payload

## Wizard Restructure — Step 2, Step 3 Packing, Machine & Diesel cleanup
- [x] Rename Step 2 tab from "Source & Warehouse" to "Input Product & Source"
- [x] Reorder Step 2: Source Location first, then Input Product (warehouse before product)
- [x] Remove Sleeve Bags Used and Strapping Units Used from Machine & Diesel tab (Step 6/7)
- [x] Rename Machine & Diesel section to just "Machine & Diesel" (diesel only, no materials)
- [x] Insert new Step 3 "Packing Materials" with Sleeve Bags and Strapping quantity fields
- [x] Bump all subsequent step numbers (old 3→4, 4→5, 5→6, 6→7, 7→8)
- [x] Add packing materials to Review section
- [x] Add packing materials to Confirm dialog
- [x] Wire packing materials from new Step 3 to Odoo payload

## Quotation & Invoice Module (from provided code)
- [x] Extract and analyze provided module code (xcXSmntcVrFHXQoj.zip)
- [x] Integrate backend: quotations DB table + tRPC router with CRUD
- [x] Integrate backend: tRPC router for quotations and invoices
- [x] Integrate frontend: QuotationsHome shell with sidebar navigation
- [x] Integrate frontend: DocumentSelector, QuotationEditor, PaymentReceiptEditor, SavedDocuments
- [x] Integrate frontend: PDF export functionality (patched html2canvas for oklch)
- [x] Adapt styling to match Platfarm portal theme (C colors, FONT, MONO, sidebar+header pattern)
- [x] Wire navigation: add Quotation & Invoicing to ModuleLauncher and App.tsx routes
- [x] Test PDF export with full data (Quotation + Payment Receipt both working)
- [x] Test all CRUD operations end-to-end (Save + List + Edit + Delete)
- [x] Rename module from "Documents" to "Quotation & Invoicing" everywhere (ModuleLauncher, routes, page titles)

## Style Consistency Verification
- [x] QuotationsHome shell uses same sidebar+header pattern as ProductionHome
- [x] Uses portal C colors (forest, terra, sage, etc.) from @/lib/data
- [x] Uses portal FONT (DM Sans) for all text
- [x] Sidebar has Platfarm logo, Home link, module label, nav items, user info
- [x] Header bar has page title, role badge, and date
- [x] Document type cards use forest green accent (matching portal card style)
- [x] SavedDocuments table uses same styling pattern as production module tables
- [x] PDF export includes Platfarm branding (logo, signature, stamp)
- [x] Fix oklch color issue in html2canvas (patched library for Tailwind CSS 4 compatibility)
- [x] Remove "+ New Order" button from the Dashboard page

## Document Template Redesign
- [x] Redesign Quotation/Invoice document template to match portal design (DM Sans, C colors, refined spacing)
- [x] Redesign Payment Receipt document template to match portal design
- [x] Test PDF export for all three document types after redesign

## Module Card Visual Differentiation
- [x] Give each module card a distinct green-grade icon background color for visual differentiation
- [x] Link hero (big) card background color to each module's distinct icon color so they match when selected
- [x] Extract green color tones from experiencealula.com and blend into module card palette
- [x] Extract elegant colors from RCU Brand Guidelines and apply more distinct module card colors
- [x] Fix Double Press Production color — too similar to Purchase & Sales, needs a clearly distinct tone

## Investment Proposal Module
- [x] Install jsPDF dependency
- [x] Copy dmSansFont.ts and logoBase64.ts data files to portal lib folder
- [x] Create generatePdf.ts (finance offer PDF generator) in portal lib folder
- [x] Create generateContract.ts (Murabaha contract PDF generator) in portal lib folder
- [x] Create InvestmentProposal page component with deal form, live summary, and PDF generation
- [x] Register Investment Proposal module in ModuleLauncher with distinct color
- [x] Add route for Investment Proposal in App.tsx
- [x] Test module in browser and verify PDF generation works
- [x] BUG: Investment Proposal download buttons not visible/working — fixed by splitting summary card into scrollable content area + fixed bottom section for tabs and download buttons
- [x] Swap module card colors between Accounting and Investment Proposals

## Supply Chain Financials Module
- [x] Upload dashboard.html — served via Express /api/supply-chain-dashboard + blob URL approach
- [x] Create SupplyChainHome page with portal shell and iframe (blob URL isolates from Vite)
- [x] Register Supply Chain Financials module in ModuleLauncher with distinct color (#1A4A4A)
- [x] Add route for /supply-chain in App.tsx
- [x] Test module in browser and verify all 5 tabs, charts, inputs, and calculations work

## Business Case Calculation Tab (Supply Chain Financials)
- [x] Extract and analyze alfalfa press analysis project
- [x] Build business case tab HTML content with Platfarm styling (DM Sans, green/earth tones, Chart.js)
- [x] Add 6th tab button to supply-chain-dashboard.html navigation
- [x] Add tab switching logic for business-case tab
- [x] Add business case calculation JavaScript (all editable inputs, derived calculations, charts)
- [x] Test all calculations, charts, and tab navigation work correctly
- [x] Verify visual consistency with other 5 tabs

## Business Case Tab — Design & Color Fixes
- [x] Fix module card color duplication between Purchase & Sales Shipments and Double Press Production
- [x] Apply full Platfarm design system to Business Case tab (DM Sans font, C palette, CardHdr headers, consistent styling matching Quotation/Invoices module)
- [x] Verify visual consistency across all modules

## Business Case Tab — Faithful Reimplementation
- [x] Review original alfalfa-press-analysis Home.tsx to capture exact content, layout, and design
- [x] Remove current business case tab content and JS from supply-chain-dashboard.html
- [x] Re-inject the original project's exact HTML structure, calculations, and design as-is into the tab
- [x] Only change what's needed for tab integration (no Recharts → use Chart.js equivalent faithfully)
- [x] Verify all sections, inputs, calculations, charts match the original exactly

## Business Case Tab — Faithful Original Design Replica
- [x] Replace current Tailwind-based business case tab HTML with original inline-styled design
- [x] Use exact original palette: bg #f5f7f2, panel #ffffff, border #dde4d8, amber #b8860b, lime #4a8c1c, teal #0e7a5a, red #c0392b
- [x] Use Calibri + Inconsolata fonts as in original
- [x] Match exact layout: header with amber bar, 3-column inputs, donut+table side by side, etc.
- [x] Preserve all 7 sections exactly as original
- [x] Replace JS to use original inline-style DOM updates instead of Tailwind classes
- [x] Fix Business Case tab button vertical stretching — text wraps due to 6 tabs being too narrow
- [x] Remove Logout button and Welcome text from supply chain dashboard header
- [x] Remove Platfarm logo from supply chain dashboard header
- [x] Remove "Product, Double Pressing & Logistics" subtitle from dashboard header
- [x] Fix Business Case tab charts and tables being stretched vertically too much

## Business Case Tab — Chart Enhancement
- [x] Add data labels on bar chart bars (show dollar values on each bar)
- [x] Add data labels on sensitivity line chart (show values at each data point)
- [x] Add data labels on pie chart (show percentages/values)
- [x] Match original Recharts color scheme exactly (lime #4a8c1c, teal #0e7a5a, amber #b8860b)
- [x] Match original chart styling (grid lines, axis labels, legends, tooltips)
- [x] Verify all 3 charts match the original visual design

## Supply Chain Module — Full Style Overhaul & Testing
- [x] Add data labels on bar chart bars (show dollar values)
- [x] Add data labels on sensitivity chart (show values at data points)
- [x] Add data labels/percentages on pie chart segments
- [x] Audit entire Supply Chain module for style inconsistencies with other Platfarm modules
- [x] Overhaul module font from default to DM Sans (matching other modules)
- [x] Overhaul module color palette to match Platfarm design system
- [x] Overhaul card styles, headers, borders to match other modules
- [x] Test Tab 1: Facility Financials — inputs, calculations, charts, breakeven
- [x] Test Tab 2: Sokhna Export Analysis — all inputs and calculations
- [x] Test Tab 3: Dakhla Export Analysis — all inputs and calculations
- [x] Test Tab 4: Egypt Shipment P&L — all inputs and calculations
- [x] Test Tab 5: Int'l Shipments P&L — all inputs and calculations
- [x] Test Tab 6: Business Case — all inputs, calculations, charts, toggle, slider

## Supply Chain Module — Style Matching with Shipments Module
- [x] Remove duplicate "Supply Chain Financial Analysis" header from iframe content
- [x] Add CSS overrides to remap Tailwind utility classes to Platfarm design tokens
- [x] Transform all section headers (h2) to green gradient bar pattern matching Shipments module
- [x] Fix usernameDisplay null reference crash that killed entire IIFE
- [x] Add .hidden CSS class for Business Case tab visibility
- [x] Disable login redirect in iframe context
- [x] Verify all 6 tabs switch correctly with calculations, charts, and EGP conversions working
- [x] Visual verification: green gradient headers, consistent card styling, matching Shipments module look

## Supply Chain Module — Toggle Button Fix & Full Page-by-Page Audit
- [x] Fix toggle buttons (Single/Double, FOB/CIF/DDP, Sokhna/Dakhla, USD/EUR/AED, Direct Sell/Consignment) not visually updating on click
- [x] Audit Tab 1: Facility Financials — all fields, interactions, charts vs original
- [x] Audit Tab 2: Sokhna Export Analysis — all fields, interactions vs original
- [x] Audit Tab 3: Dakhla Export Analysis — all fields, interactions vs original
- [x] Audit Tab 4: Egypt Shipment P&L — all fields, interactions, toggles vs original
- [x] Audit Tab 5: Int'l Shipments P&L — all fields, interactions, toggles vs original
- [x] Audit Tab 6: Business Case — all fields, interactions, charts vs original
- [x] Fix any discrepancies found during audit (no issues found — all tabs pass)

## Supply Chain Module — Spacing Optimization
- [x] Reduce excessive gaps between cards and sections across all tabs
- [x] Tighten padding inside cards, section headers, and input groups
- [x] Reduce margins between the two-column layout (inputs vs summary panels)
- [x] Verify spacing improvements on all 6 tabs

## Supply Chain Module — Match Shipments Module Typography & Spacing
- [x] Study Shipments module computed styles (font sizes, line heights, card padding, gaps)
- [x] Match Supply Chain font sizes to Shipments (labels, values, headers, body text)
- [x] Match card padding, inner spacing, grid gaps to Shipments module
- [x] Match input field sizes and label styles to Shipments module
- [x] Match KPI card sizing and figure font sizes to Shipments module
- [x] Verify all 6 tabs look consistent with Shipments module

## HR Management Module
- [x] Build HR dashboard HTML (standalone, like Supply Chain pattern) — all pages, modals, wizard, data
- [x] Build HR Dashboard page — 5 KPIs, attendance ring, department breakdown, activity timeline, pending actions, employee roster
- [x] Build Employee Directory page — card view + table view toggle, search, company filter
- [x] Build Employee Profile page — green header, action bar, 7 tabs (Overview, Contract & Pay, Documents, Activity, Leaves, Discipline, Payslips)
- [x] Build Leave Management page — KPI stats, leave records table, leave balances table
- [x] Build Bonus & Fines page — KPI stats, records table with approve/reject
- [x] Build 5 CRUD modals — Log Leave, Log Bonus, Log Fine, Create Payslip, Upload Document
- [x] Build 6-step Add Employee Wizard (Identity, Personal, Work Setup, Contract, Documents, Review)
- [x] 6 seed employees with full data matching reference
- [x] Create HRHome.tsx shell with sidebar and iframe embedding
- [x] Register HR module in App.tsx routing
- [x] Update ModuleLauncher.tsx with active HR module card
- [x] Add server route to serve hr-dashboard.html
- [x] Add HR module to sidebar navigation in Home.tsx
- [x] Deep test all pages, tabs, modals, wizard, search, filters
- [x] Verify visual consistency with Shipments and Supply Chain modules
- [x] Fix HR Dashboard not loading on published/production version (route not serving HTML in production build) — fixed resolveDashboardPath() to try dist/public/ first, then fallback to client/public/

## HR Module — Odoo Integration
- [x] Explore Odoo HR models — 42 employees, 8 depts, 7 leave types, 609 expenses, 0 contracts/leaves/payslips
- [x] Build server/odoo-hr.ts with Odoo JSON-RPC calls for all HR models
- [x] Build server/routers/hr.ts tRPC router for HR endpoints
- [x] Wire HR router into appRouter
- [x] Update HR dashboard HTML to fetch live data from tRPC API
- [x] Test employee directory with live Odoo data (42 employees, real avatars, departments, companies)
- [x] Test leave management with live Odoo data (0d used, 21d allocated default, 42 low balance)
- [x] Test bonus/fines with live Odoo data (0 records — no fines model in Odoo)
- [x] Test payslips with live Odoo data (0 payslips in Odoo)
- [x] Test contracts with live Odoo data (0 contracts in Odoo)
- [x] Fix Used (Company) KPI calculation — was showing 882d, now correctly shows 0d
- [x] Fix production route for HR and Supply Chain dashboards (resolveDashboardPath helper)
- [x] Write vitest tests for HR Odoo integration (23 tests passing)

## HR Module — Ordering & Company Filter
- [x] Move HR module to come after Supply Chain in ModuleLauncher
- [x] Move HR module to come after Supply Chain in sidebar navigation
- [x] Expand company filter in HR dashboard to all 5 Odoo companies (not just 2)
- [x] Fix NaN display for Avg Leave Left when company has 0 employees

## HR Module — Company Selector Style Alignment
- [x] Examine Shipments module company selector implementation (style, behavior, positioning)
- [x] Align HR module company selector to match Shipments module exactly (same dropdown style, colors, fonts, positioning)
- [x] Ensure consistent look and feel across all modules (HR, Shipments, Supply Chain)

## Production Incentives Module (inside HR)
- [x] Add Incentives nav item to HR sidebar (after Bonus & Fines)
- [x] Build Incentives Dashboard page with KPI cards and quality ring chart
- [x] Build Calculations List page with table of all monthly calculations
- [x] Build Calculation Detail page with stage bar, metrics, FM controls, and employee lines by category
- [x] Build Rate Configuration page with category rates table and formula reference
- [x] Build Run Calculation modal with progress animation
- [x] Add incentive mock data (categories, rates, calculations with lines)
- [x] Add CSS styles for stage bar, category accordion, calculation progress

## Persistent Company Selection Across Modules
- [x] Store selected company in localStorage
- [x] Read company from localStorage on module load (HR, Shipments, Supply Chain)
- [x] Sync company selection changes to localStorage on switch

## Document Management System Module (Odoo Documents Integration)
- [x] Extract and analyze DMS reference files
- [x] Build Odoo Documents API integration (server-side) - folders, documents, tags, upload, download
- [x] Build DMS frontend - sidebar navigation, folder tree, document grid/list view
- [x] Implement document upload (files stored in Odoo, not frontend)
- [x] Implement document preview/download via Odoo API
- [x] Implement search, filter, and tag management
- [x] Add DMS to module launcher
- [x] Match Platfarm UI style (same look and feel as other modules)
- [x] Company filter in DMS module
- [x] Run vitest tests for DMS

## UI Fixes
- [x] Remove "Egypt Shipment Profit & Loss Analysis" title text from Egypt Shipment P&L tab in Supply Chain Financials

## Visual Consistency Audit
- [x] Ensure all modules share same colors, fonts, spacing, component styles
- [x] Audit sidebar behavior, company selector, headers, tables, cards, badges across all modules

## Investors Relationship Management (formerly Investment Proposals)
- [x] Rename "Investment Proposals" to "Investors Relationship Management" across ModuleLauncher, App.tsx, and InvestmentHome
- [x] Build Investment Cycles Management page integrated with Odoo CRM (Abu Dhabi company)
- [x] Fetch CRM stages from Odoo and display as pipeline/kanban
- [x] Display investment deals with stage tracking, documents, and details
- [x] Build deal detail page with investor info, contract details, documents, and stage history
- [x] Ensure visual consistency with all other modules

## DMS — Connect to Live Odoo Documents API
- [x] Update server-side odoo-documents.ts to use real Odoo RPC calls for folders, documents, tags
- [x] Update DMS tRPC router to return live Odoo data instead of mock
- [x] Update DMS frontend to fetch folders/documents/tags from tRPC API
- [x] Implement file upload to Odoo Documents via API (base64 encoding)
- [x] Implement file download/preview from Odoo Documents via API
- [x] Handle workspace-to-company mapping for folder tree
- [x] Test all DMS features with live Odoo data

## Investment Cycles — New Deal Form
- [x] Add "New Deal" button to Investment Cycles pipeline page
- [x] Build New Deal modal form with investor details (name, email, phone, company)
- [x] Add contract info fields (expected revenue, probability, priority, deadline)
- [x] Add document attachment support for new deals
- [x] Wire form to Odoo CRM API to create new crm.lead records
- [x] Test New Deal creation with live Odoo CRM
- [x] Backend: createCrmLead, searchPartners, uploadLeadAttachment, fetchLeadAttachments in odoo-crm.ts
- [x] Backend: CRM router endpoints (createLead, searchPartners, uploadAttachment, leadAttachments)
- [x] Frontend: Partner/investor search dropdown with live Odoo data (auto-fills email/phone)
- [x] Frontend: Pipeline stage selector, priority buttons, tags multi-select
- [x] Frontend: Description/notes textarea
- [x] Frontend: Document attachment drag-and-drop with file upload to Odoo
- [x] Frontend: Success/uploading states with progress indicator
- [x] Fix z.record() TS error in CRM router

## Investment Cycles — Fix Deal Display & Enrich Cards
- [ ] Investigate why portal shows only 2 deals while Odoo has 10+
- [ ] Fix backend to fetch all CRM leads (check filters/limits)
- [ ] Add additional fields to deal cards: investor type, dates, company, bank, paid amounts
- [ ] Match Odoo CRM card layout: name, amount, partner, company, dates, paid amount, stars, activity icons
- [ ] Test pipeline shows same deals as Odoo screenshot

## DMS Layout Improvements
- [x] Merge right sidebar (folder tree, workspaces, storage) under left sidebar into single column
- [x] Set list view as default view for document browsing (instead of grid)

## Incentives Calculation Bugs
- [x] Fix incentives calculation flickering/crash at step 5 "Applying rates & adjustments"
- [x] Expand period dropdown to show more than 4 months (show 12+ months)
- [x] Remove KPI cards row (Total Deals, Active Deals, Won Deals, Total Revenue, Avg Probability) from Investment Cycles page

## Fix fetchTagCategories Import Error
- [x] Fix DMS router import error for fetchTagCategories (was stale tsx cache, confirmed clean after server restart)

## Grant aiagent Full CRM Visibility
- [x] Investigate CRM record rules blocking aiagent from seeing all leads
- [x] Add aiagent to required CRM groups or modify record rules for full visibility (added company 4 Sokhna, group 128 KhalilOnly, Sales team membership)
- [x] Verify all CRM leads are visible after fix (only 2 leads exist in DB - STL leads from screenshot were deleted)

## Connect Incentives to Real Odoo Data
- [x] Build backend endpoints for incentive data: manufacturing orders count, quality inspections, purchase receipts, attendance
- [x] Wire incentives calculation modal to call real Odoo APIs instead of simulated animation
- [x] Calculate actual incentive amounts based on Odoo data
- [x] Display real calculation results in the incentives history table

## Fix tRPC superjson format in iframe dashboards
- [x] Fix trpcMutate in HR dashboard — wrap input in {"json": ...} for superjson compatibility (was causing BAD_REQUEST on incentive calculation)
- [x] Fix trpcQuery in HR dashboard — updated for consistency
- [x] Fix trpcMutate in DMS dashboard — same superjson wrapper fix
- [x] Fix trpcQuery in DMS dashboard — updated for consistency
- [x] Verified incentive calculation returns real Odoo data (37 MOs, 991 bales, 36 receipts for Feb 2026)

## Investment Cycles — Fix Deal Display & Enrich Cards (Round 2)
- [x] Investigate backend CRM filters — confirmed only 2 leads exist in Odoo (no filter issue)
- [x] Query Odoo directly — found 2 leads, both in Open ST/Investments stage
- [x] Backend already fetches all CRM leads correctly (no restrictive filters)
- [x] Added 14 custom x_studio_ fields to CRM lead fetching (investor type, bank, paid/remaining amounts, contract/maturity dates, profit rate, currency, national ID, address, notes)
- [x] Enriched frontend deal cards with: paid progress bar, investor type badge, bank info, contract dates, profit rate, contract reference
- [x] Added KPI summary row (Total Deals, Total Revenue, Total Paid, Remaining)
- [x] Enriched list view with 11 columns (Deal, Investor, Stage, Revenue, Paid, Remaining, Profit %, Bank, Contract Date, Maturity, Priority)
- [x] Enriched detail view with Investment Details section (2-column grid with all custom fields)
- [x] Updated search to include bank name and contract reference
- [x] All 249 tests passing

## Bug Fix — DMS Search Input Loses Focus
- [x] Fix search input in DMS dashboard losing focus after each keystroke (re-render issue)
- [x] Applied same focus-restore fix to HR dashboard setState function
- [x] Merged double setState calls in search onInput to single setState call

## Investment Cycles — Drag-and-Drop Stage Transitions
- [x] Backend endpoint already exists: crm.moveToStage mutation (calls Odoo write on crm.lead stage_id)
- [x] Implement drag-and-drop UI in the Kanban pipeline columns (HTML5 Drag and Drop API)
- [x] Show visual feedback during drag (dashed green border, drop zone highlights, opacity change)
- [x] Optimistically update the UI on drop with rollback on error (onMutate/onError/onSettled pattern)
- [x] Toast notifications on success/error
- [x] Fixed Odoo access rights: set x_studio_x_private_creator_only=False on CRM leads for AI Agent access
- [x] Tested moveToStage API via curl — confirmed working with Odoo

## UI Fix — Differentiate DMS and Supply Chain Financials Colors
- [x] Investigate current color schemes for Document Management and Supply Chain Financials
- [x] Update one or both modules to use distinct color palettes
- [x] Test both modules visually in browser

## Bug Fix — HR Expense Company Filtering
- [x] Mutasim (معتصم عبدالله) expense showing under Egypt company — root cause: 27 hardcoded EGP references
- [x] Investigate expense fetching/filtering logic for company_id
- [x] Fix activity timeline to respect company filter — replaced all EGP with dynamic getCurrency()

## Feature — Create New Investor from New Deal Form
- [x] Add "Create New Investor" option when partner search returns no results
- [x] Backend: tRPC endpoint to create new res.partner in Odoo (crm.createPartner)
- [x] Frontend: inline form in investor search dropdown with name, email, phone, company fields
- [x] Auto-select newly created investor in the deal form

## UI Fix — Add Company Selector to Investment Cycles
- [x] Add company selector dropdown to Investment Cycles page header (consistent with other modules)
- [x] Filter deals by selected company

## Loading Progress — Investment Cycles Module Transition
- [x] Create loading progress indicator for transition from ModuleLauncher card click to InvestmentCycles page fully loaded
- [x] Show smooth animated progress bar during route navigation + Odoo data fetch
- [x] Ensure consistent UX with Platfarm brand styling

## Investment Cycles — Three Feature Enhancements
- [x] Loading progress transition from module card click to Investment Cycles page ready
- [x] Create New Investor flow in NewDealModal when partner search returns no results
- [x] Company selector in Investment Cycles header to filter CRM leads by company

## Bug Fix — HR Expense Company Filtering (Mutasim)
- [x] Investigate how expenses are fetched and filtered by company_id
- [x] Identified root cause: all currency labels hardcoded as EGP, making UAE expenses look Egyptian
- [x] Fixed: added getCurrency() and currencyForCompany() helpers, replaced all 27 EGP references
- [x] Tested in browser: ADGM shows AED, Cairo shows EGP — verified correct

## Dynamic Salary Structure per Company
- [x] Make Salary Structure dropdown dynamic per company (UAE Employee for ADGM/Abu Dhabi, Egypt Employee for Cairo/Sokhna)
- [x] Update all company-specific labels in contract/payslip forms
- [x] Test with different company selections — verified ADGM shows UAE Employee, Cairo shows Egypt Employee

## Deal Detail View — Investment Cycles
- [x] Build deal detail view that opens when clicking a deal card in the pipeline
- [x] Show activity timeline, documents, investor info, deal metadata
- [x] Add stage transition buttons, document upload, add note form, activities section
- [x] Add back navigation to return to pipeline view
- [x] Test the detail view with real CRM data

## Inventory & Warehouse Module Integration
- [x] Copy JSX file as-is into InventoryModule.tsx with ts-nocheck
- [x] Add Home/back navigation button to sidebar
- [x] Add /inventory route in App.tsx
- [x] Activate module in ModuleLauncher (active: true, route: /inventory)
- [x] Update module card icon colors for consistency
- [x] Test all 4 tabs: Dashboard, Products, Stock Levels, Warehouses
- [x] Test Home button navigation back to Module Launcher
- [x] Test Open Module button from Module Launcher card

## Inventory — Connect to Live Odoo Data
- [x] Show real Odoo company names in company selector (same pattern as other modules)
- [x] Create odoo-inventory.ts backend with stock.quant and product.product API calls
- [x] Create inventory tRPC router with dashboard, stock levels, products, warehouses endpoints
- [x] Replace static seed data in InventoryModule.tsx with live tRPC queries
- [x] Test all tabs with live Odoo data

## Inventory Dashboard — Product Search
- [x] Add product-level search bar to Dashboard hero section
- [x] Filter "What We Have — By Product" section and product breakdown by search query
- [x] Filter hero legend, Stock By Warehouse, and Stock Valuation sections by search
- [x] Add empty state with "No products match" message and Clear Search button
- [x] Test search functionality in browser (product name, category, warehouse name, no-match)
- [x] Fix pre-existing bug: "What We Have" section empty for All Companies (negative totalQuantity from partner locations)

## Finance Module — Implementation
- [x] Create FinanceModule.tsx from provided JSX template (static data)
- [x] Add Finance route and navigation entry in App.tsx and ModuleLauncher.tsx
- [x] Fix JSX syntax error (unescaped > in ">20d" text)
- [x] Update ModuleLauncher accounting module to active Finance module with correct route and features
- [x] Test all 9 finance sub-pages (Health, Cash Overview, Receivables, Payables, Expenses, Expenditure, SOA, Export Fees, Inventory Valuation)
- [x] Verify all calculations, gauges, charts, and tables render correctly

## Finance Module — Connect to Live Odoo Data
- [x] Analyze static data structure and map each page to Odoo models
- [x] Create odoo-finance.ts backend service (account.move.line, account.payment, account.bank.statement, res.partner)
- [x] Create finance tRPC router with endpoints for all 9 sub-pages
- [x] Update company selector to use Odoo companies (matching Shipments pattern)
- [x] Rewrite FinanceModule.tsx to consume live tRPC data instead of static seed
- [x] Fix expenses endpoint error (account.account has no company_id field, code can be false)
- [x] Add Home button to Finance module sidebar (navigate back to Module Launcher)
- [x] Test all 9 finance sub-pages with live Odoo data
- [x] Match Finance module company selector look and feel to Shipments module (custom dropdown with initials, SWITCH COMPANY header, checkmarks)
- [x] Fix bank account balances in Cash Overview — use read_group on default_account_id for accurate Odoo balances
- [x] Fix CCC (Cash Conversion Cycle) chart bars stretched vertically on Financial Health page (use max of all values as denominator, cap height)
- [x] Fix bank account balances to reflect accurate current state — use journal_id + default_account_id grouped query to avoid cross-contamination from petty cash/sub-bank entries

## Finance Module — Fix Bank Balances to Match Odoo Dashboard
- [x] Compare portal bank balances vs Odoo Accounting Dashboard for Cairo company
- [x] Investigate why Banque Misr-USD shows 3,303,201 in portal vs $0.00 in Odoo
- [x] Investigate why Staff Petty Cash shows -21,750 in portal vs -30,750 in Odoo
- [x] Investigate why Banque Misr-EGP-027390 shows 29,902 in portal vs 24,058 in Odoo
- [x] Investigate why Cairo AGRI-Main Cash-EGP shows 66,983 in portal vs 7,356 in Odoo
- [x] Fix balance calculation to match Odoo's Accounting Dashboard exactly — now uses kanban_dashboard.account_balance
- [x] Verify fix for all companies — all 31 journals across 4 companies verified

## Finance Module Full Audit (Mar 12, 2026)

- [x] Audit Receivables page vs Odoo data and fix discrepancies
- [x] Audit Payables page vs Odoo data and fix discrepancies
- [x] Audit Expenses page vs Odoo data and fix discrepancies
- [x] Audit Expenditure page vs Odoo data and fix discrepancies
- [x] Audit SOA (customer + supplier) vs Odoo data and fix discrepancies — SOA data matches Odoo exactly
- [x] Audit Export Fees vs Odoo data and fix EGP 0 bug — fixed by using account id=4672 directly (code field is false in Odoo)
- [x] Add period filter to Export Fees page (30d, 90d, YTD, Custom)
- [x] Remove Inventory Valuation from Finance module sidebar/navigation
- [x] Fix all data discrepancies — payables limit 500→2000, receivables limit 500→2000, export fees account lookup fixed
- [x] Deep audit Financial Health page KPIs — logic validated, uses correct AR/AP/revenue/COGS from Odoo

## Full Module Audit — All 5 Companies (Mar 12, 2026)

- [x] Grant aiagent user access to company 4 (Sokhna-PLATFARM FOR AGRIBUSINESS) in Odoo
- [x] Fix all 10 service files to include company 4 in ALLOWED_COMPANY_IDS [1,2,3,4,5]
- [x] Fix AP pagination — fetchMovesAll paginates all 3,270 bills (EGP 177.2M, was capped at 2,000 = EGP 79.9M)
- [x] Fix Revenue & COGS to use read_group aggregation (no record-count ceiling)
- [x] Create x_studio_unified_shipment_status field on Odoo new server for purchase.order and sale.order
- [x] Verify DocAlert cron runs without errors after field creation
- [x] Fix sidebar logo consistency — InventoryModule and FinanceModule now use PlatfarmLogo SVG
- [x] HR Audit: 67 active employees across 5 companies — matches Odoo exactly
- [x] HR Audit: 0 leave requests in Odoo — portal correctly shows empty leave list
- [x] HR Audit: 608 expense records — portal fetches live from Odoo (no mock data)
- [x] HR Fix: Wire expenses fetch in loadData() to populate finesMock with real Odoo data
- [x] HR Fix: Fix raw JSON company display bug — sanitize localStorage value on state init
- [x] HR Fix: Add edit employee modal with save wired to hr.updateEmployee tRPC mutation
- [x] Inventory Audit: 18 stock quant records, total 12,369,410.92 units — matches Odoo exactly
- [x] Inventory Audit: Stock filtered to internal locations only (excludes virtual/partner/scrap)
- [x] Finance Re-Audit: AR EGP 58.9M (249 invoices) — matches Odoo
- [x] Finance Re-Audit: AP EGP 177.2M (3,268 bills incl. company 4) — matches Odoo
- [x] Finance Re-Audit: Export fees all-time EGP 76.1M — matches Odoo account 4672
- [x] Shipments Audit: 1,311 POs across all states — matches Odoo
- [x] Production Audit: 250 MOs, 244 done, 5,377,116 kg produced — matches Odoo

## Module Launcher UI Fixes (Mar 12, 2026)
- [x] Fix duplicate/similar module card colors — assign unique distinct color to each of the 11 modules

## Inventory Stock Levels — Location Filter (Mar 12, 2026)
- [ ] Add Location dropdown filter below Warehouse filter in Stock Levels page
- [ ] Location list should be dynamic — show only locations belonging to selected warehouse
- [ ] Default selection is "All" locations
- [ ] Filter order: Product → Warehouse → Location

## HR Bonus.Fine Separation (Mar 12, 2026)
- [x] Add fetchBonusFines function to odoo-hr.ts using the bonus.fine Odoo model
- [x] Add bonusFines tRPC procedure to server/routers/hr.ts
- [x] Update loadData() in hr-dashboard.html to fetch both hr.expense and bonus.fine in parallel
- [x] Map bonus.fine records to finesMock (type, category, topic, days, dailyRate, amount)
- [x] Map hr.expense records to expensesMock (separate from finesMock)
- [x] Update Recent Bonus & Fines dashboard panel to show only bonus.fine records
- [x] Update Discipline tab in employee profile to show real bonus.fine data with proper columns
- [x] Add Expenses tab in employee profile showing hr.expense records
- [x] Update Discipline page to have two sub-tabs: Bonus & Fines vs Expense Reimbursements

## Incentive Detail — Per-Employee Table (Mar 12, 2026)
- [x] Add "Incentive by Employee" flat table below "Incentive by Category" in incDetail page

## Periodic Meeting Integration (Mar 12, 2026)
- [x] Explore periodic.meeting model — fields, records, attendance lines
- [x] Add fetchPeriodicMeetings to odoo-hr.ts
- [x] Expose meetings via tRPC (hr.periodicMeetings)
- [x] Wire meeting attendance into incentive calculation (FM meetings attended = real count from Odoo)
- [x] Update incDetail page to show real meeting attendance from Odoo

## HR Nav — Periodic Meetings as top-level nav item (Mar 12, 2026)
- [x] Add Periodic Meetings as top-level nav item in HR module (same level as Employees, Leaves, Bonus & Fines, Incentives)

## Periodic Meetings — Standalone Module (Mar 12, 2026)
- [x] Remove Meetings from HR module sidebar nav
- [x] Create standalone PeriodicMeetings.tsx page component
- [x] Add Periodic Meetings to main portal sidebar navigation
- [x] Wire tRPC meetings data into the standalone page

## Periodic Meetings — Create & Task Progress (Mar 12, 2026)
- [x] Explore periodic.meeting create fields and meeting actions/tasks model
- [x] Add createMeeting tRPC procedure (write to Odoo)
- [x] Add getMeetingDetail tRPC procedure (fetch single meeting with actions)
- [x] Add updateMeetingAction tRPC procedure (update task progress)
- [x] Build New Meeting modal in hr-dashboard.html
- [x] Build Meeting Detail page with task progress update UI

## Periodic Meetings — Style Alignment with Shipment Module (Mar 12, 2026)
- [x] Audit shipment module style tokens (fonts, colors, sidebar, table, header)
- [x] Apply matching style to PeriodicMeetingsHome.tsx sidebar and shell
- [x] Apply matching style to hr-dashboard.html meetings page (table, cards, filters)

## Periodic Meetings — Action Points Efficiency Dashboard (Mar 12, 2026)
- [x] Add getMeetingActions tRPC procedure to fetch all action points across meetings
- [x] Build Action Points Dashboard page in hr-dashboard.html (KPIs, period filter, assignee breakdown, overdue table, completion trend, fulfillment per assignee with rate bars)
- [x] Add Dashboard nav entry to Periodic Meetings sidebar in PeriodicMeetingsHome.tsx

## New Meeting Modal — Attendee Selector Enhancement (Mar 12, 2026)
- [x] Replace checkbox attendee grid with avatar-chip selector (same pattern as shipments labor selector)
- [x] Filter staff list by currently selected company in the company selector
- [x] Add actionsDashboard nav entry to Periodic Meetings sidebar in PeriodicMeetingsHome.tsx
- [x] Add updateActionStatusFromDashboard helper function for inline status updates in dashboard

## Periodic Meetings — UI Design System Enhancement (Mar 12, 2026)
- [x] Rewrite PeriodicMeetingsHome.tsx with correct C.* color tokens and design system layout
- [x] Add .fsel CSS class for compact filter selects in hr-dashboard.html
- [x] Replace all inline filter select styles with .fsel class in meetings/actionsDashboard pages
- [x] Add weekly/adhoc/pending/in_progress/cancelled to badgeStyles in hr-dashboard.html
- [x] Replace all inline type/status badge spans with badge() function calls
- [x] Replace inline status update selects in dashboard and meetingDetail with .fsel class
- [x] Remove unused typeBg/typeColor/statusBg/statusC/statusB variable declarations

## BUG: Double card render after sign-in animation (Mar 12, 2026)
- [x] Diagnose why module cards reload/flash once after the sign-in transition animation completes
- [x] Fix the double render so cards appear once and stay stable

## Portal — Module Search Filter Bar (Mar 12, 2026)
- [x] Add search input above the module list that filters cards by title as user types

## System-Wide User Management & Access Control (Mar 12, 2026)
- [x] Audit existing shipments settings and current user/role schema
- [x] Design user_module_permissions table schema (userId, moduleId, canView, canCreate, canEdit, canDelete, updatedAt, updatedBy)
- [x] Extend drizzle schema with user_module_permissions table and push migration
- [x] Add admin-only tRPC procedures: listUsers, getUser, updateRole, setModulePermission, setAllPermissions, myPermissions
- [x] Build SystemUserMgmt.tsx admin panel with user list + per-module permission matrix
- [x] User list with avatar, name, email, role badge, and module access count
- [x] Permission matrix: 12 modules × 4 CRUD toggles + ALL toggle per row
- [x] Wire permission enforcement in portal module list (lock/grey-out inaccessible modules)
- [x] Add Settings gear icon to portal top bar (admin-only) that opens User Management panel
- [x] Settings also accessible from user dropdown menu (admin-only)
- [x] Write vitest tests for user management logic (8 tests passing)

## BUG: Settings button in Home.tsx (shipments portal) does nothing (Mar 12, 2026)
- [x] Import SystemUserMgmt into Home.tsx and use it when page === "users" for system admins
- [x] Add Settings gear button to Home.tsx header (admin-only, navigates to users page)
- [x] Make "User Management" sidebar nav item visible for system admins (bypasses old mock RBAC filter)
- [x] Non-admin users still see the old UserMgmt panel (no regression)

## Feature: User Invitation & Onboarding Flow (Mar 12, 2026)
- [x] Add `invitations` table to drizzle schema (token, email, role, invitedBy, status, expiresAt, acceptedAt, presetPermissions JSON)
- [x] Push DB migration with pnpm db:push (migration 0010 applied)
- [x] Add invite tRPC procedures: inviteUser, listInvitations, revokeInvitation, getByToken
- [x] Build branded invitation email HTML template (Platfarm branding, CTA button, expiry notice)
- [x] Add sendInvitationEmail helper in server/email.ts
- [x] Add "Invite User" button to SystemUserMgmt with 3-step modal (email + role → permissions → done)
- [x] Add Invitations tab to SystemUserMgmt with status table and Revoke action
- [x] Build /invite/:token onboarding landing page (branded, shows role + inviter + expiry + CTA)
- [x] Wire OAuth callback to auto-apply pre-configured permissions on first login
- [x] Invite token passed via redirect URI query param so server can retrieve it after OAuth
- [x] Write 14 vitest tests for invitation flow (all passing)

## BUG: /invite/:token returns 404 on published site (Mar 12, 2026)
- [x] Diagnosed: server SPA catch-all is correct, 404 is from old published build
- [x] Dev server confirmed working (HTTP 200 on /invite/:token)
- [ ] User needs to click Publish to deploy the latest checkpoint to production

## Feature: Custom Email/Password Auth & Onboarding (Mar 12, 2026)
- [x] Add passwordHash, status (active/inactive/pending) fields to users table
- [x] Push DB migration (0011 applied)
- [x] Install bcryptjs for password hashing
- [x] Build /api/auth/register endpoint: validate invite token, hash password, create user, apply permissions
- [x] Build /api/auth/login endpoint: verify email+password, issue JWT session cookie (jose HS256)
- [x] Build /api/auth/me endpoint: return current user from JWT cookie
- [x] Build /api/auth/logout endpoint: clear both Manus OAuth and local auth cookies
- [x] Update tRPC context to fall back to local auth session when Manus OAuth is absent
- [x] Rewrite /invite/:token page as a 2-step branded registration form (welcome → name+password → success)
- [x] Build /login page with split-panel design (branding left, form right) + Manus OAuth fallback
- [x] Update getLoginUrl() to point to /login instead of Manus OAuth
- [x] Write 13 vitest tests for auth logic (all passing)

## BUG: Login redirects back to login page instead of portal (Mar 12, 2026)
- [x] Diagnosed: login endpoint works (HTTP 200, cookie set), but platfarm_session cookie not sent by browser
- [x] Root cause: separate platfarm_session cookie had cross-origin/SameSite issues
- [x] Fix: reuse same app_session_id cookie and sdk.createSessionToken() format as Manus OAuth
- [x] Verified: auth.me now returns Mohamed Khalil correctly with the new session token
- [x] Simplified context.ts back to standard Manus OAuth only (no dual-cookie logic needed)

## BUG: Sign out does not work (Mar 12, 2026)
- [x] Diagnosed: handleLogout in ModuleLauncher.tsx was purely visual (CSS animation only), never called tRPC logout
- [x] Fixed: useAuth.ts logout now redirects to /login after clearing session
- [x] Fixed: ModuleLauncher.tsx handleLogout now calls authLogout() which clears the cookie and redirects

## Feature: Auto-select attendees company tab when company is selected in New Periodic Meeting modal (Mar 12, 2026)
- [x] Found the modal in hr-dashboard.html (rendered inside an iframe)
- [x] Added onchange="setState({nmSelCompany:this.value})" to nm_company select
- [x] Added pre-selection logic: nmInitCo uses current company filter or first company on modal open
- [x] Updated nmSelCo to use nmInitCo so attendees pool is pre-filtered immediately on modal open

## Feature: Clear selected attendees when company changes in New Periodic Meeting modal (Mar 13, 2026)
- [x] Updated nm_company onchange to also reset nmSelAttendees:[] and nmAttQuery:'' when company changes

## BUG: Permission toggles disabled for admin users in User Management (Mar 13, 2026)
- [x] Removed the admin role check that was disabling the permission matrix for admin users
- [x] isAdmin prop now always false — toggles enabled for all users
- [x] Stats summary bar (View/Create/Edit/Delete/Blocked counts) now shown for all users

## Feature: Login page — use company logo and remove Manus OAuth button (Mar 13, 2026)
- [x] Replaced orange square placeholder with real Platfarm SVG logo (wheat icon + wordmark)
- [x] Logo renders correctly on both left panel (white) and right panel (dark) with correct colors
- [x] Removed "Continue with Manus Account" button and divider from login page

## BUG: Save Changes button hidden for admin users in permission matrix (Mar 13, 2026)
- [x] Remove `selectedUser.role !== "admin"` condition that hides the Save button for admins
- [x] Save Changes button must always be visible for all users

## Feature: Password Reset Flow (Mar 13, 2026)
- [ ] Add password_reset_tokens table to drizzle schema (token, userId, expiresAt, usedAt)
- [x] Push schema migration
- [x] Add db helpers: createPasswordResetToken, getPasswordResetToken, markResetTokenUsed
- [x] Add POST /api/auth/request-reset endpoint (sends email with token link)
- [x] Add POST /api/auth/reset-password endpoint (validates token, updates password)
- [x] Add sendPasswordResetEmail() to email.ts
- [x] Build /forgot-password page (email input form)
- [x] Build /reset-password/:token page (new password + confirm form)
- [x] Add "Forgot password?" link to /login page
- [x] Register new routes in App.tsx

## Feature: User Deactivation Toggle (Mar 13, 2026)
- [x] Add updateUserStatus tRPC endpoint to userManagement router
- [x] Add Active/Inactive toggle to SystemUserMgmt user list
- [x] Block login for inactive users (already done in localAuth.ts — verify)
- [x] Show visual indicator (greyed out row) for inactive users in user list
- [x] BUG: Logo on login page and home page shows garbled "DF PLENERS" instead of real Platfarm logo — fix
- [x] Increase module list card dimensions on ModuleLauncher portal page for better readability
- [x] Sort Stock Quants table by Quantity on Hand descending (highest to lowest)
- [x] Set default company to Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY
- [x] Clickable column headers for sorting Stock Quants table (Product, On Hand, Reserved, Available, Value) with ascending/descending toggle
- [x] BUG: New Dakhla warehouse/location not showing in inventory dashboard — investigated: warehouse exists but has 0 stock quants in Odoo (no fix needed)
- [x] BUG: Location filter shows all locations even when a product category is selected — should only show locations that contain products of the selected category
- [x] Add stock type filter (Animal Fodder, Packing Materials, Oil & Fuel, Spare Parts, Others, All) to dashboard and warehouse pages
- [x] Set Alfalfa as default product filter on Stock Levels page
- [x] Add stock type selector (Animal Fodder, Packing Materials, Oil & Fuel, Spare Parts, Others) to dashboard and warehouse pages
- [x] Add location filter to Dashboard hero section (e.g. filter by Finished Goods, Raw Material, etc.)
- [x] Make Dashboard hero KPIs (total inventory, reserved, available, value) update dynamically based on all active filters
- [x] Convert Product filter on Stock Levels from single-select to multi-select
- [x] BUG: Stock type filter (Animal Fodder) hides Sleeve Bags data — stock type should only apply to dashboard/warehouse, not override product category on Stock Levels
- [x] Add stock type filter to Stock Levels page for consistency (same as Dashboard/Warehouses)
- [x] Fix stock type vs product category interaction: product category selection should work independently, stock type only pre-filters the view

## Feature: Mobile Responsive Inventory Module (Mar 14, 2026)
- [x] Make sidebar collapse to bottom tab bar on mobile
- [x] Make header responsive (compact company selector, smaller title)
- [x] Make stock type and filter pills scrollable horizontally on mobile
- [x] Make dashboard hero section stack vertically on mobile
- [x] Make dashboard product cards stack in single column on mobile
- [x] Make warehouse comparison chart responsive
- [x] Make stock quants table horizontally scrollable on mobile
- [x] Make detail side panel full-screen overlay on mobile
- [x] Make warehouse cards stack vertically on mobile
- [x] Ensure all text is readable at mobile viewport sizes
- [x] BUG: Stock Levels page title repeats all selected products and warehouse — too long and cluttered, simplify to just "Stock Levels"
- [x] BUG: Location filter on Stock Levels hides locations when stock type is selected (e.g. Raw Material disappears under Animal Fodder) — locations should be based on warehouse only, not stock type
- [x] BUG: Dashboard hero KPIs (total, reserved, available, value) don't filter by dashSearch — searching for a warehouse name should update the KPI totals to match only filtered items

## Feature: Mobile Responsive All Modules (Mar 14, 2026)
- [ ] Make Purchase Shipments list page mobile responsive
- [ ] Make Purchase Shipment detail page mobile responsive
- [ ] Make Sales Shipments list page mobile responsive
- [ ] Make Sales Shipment detail page mobile responsive
- [ ] Make Agreements page mobile responsive
- [ ] Make Supply Chain Financials module mobile responsive
- [ ] Make IRM module mobile responsive
- [ ] Make Quotation & Invoicing module mobile responsive
- [ ] Make Double Press Production module mobile responsive
- [ ] Make Home page mobile responsive
- [x] BUG: Dashboard search only matches product names — should also match warehouse and location names
- [x] Add Grade filter to Stock Levels page — extract grade from product name (Grade 1, Grade 3, Standard, etc.) and allow filtering by grade
- [x] Add Grade column to Stock Levels table
- [x] BUG: Dakhla warehouse card has no location filter — location filter should always appear on warehouse cards even when empty
- [x] BUG: CWDAK warehouse shows 0 stock despite having validated receipts — root cause: Odoo locations like CWDAK/Raw Material-Dakhla have warehouse_id=false (orphan locations). Fixed resolveWarehouse() to fallback-match by warehouse code prefix
- [x] BUG: CWDAK warehouse card only shows 1 location (CWDAK/Stock) — fixed warehouseLocations builder to also match orphan locations by code prefix, now shows all 7 CWDAK locations
- [x] Show all warehouses on dashboard (including empty ones) instead of filtering by kg > 0
- [x] Show stock items section and location dropdown on warehouse cards even when empty
- [x] BUG: Inventory dashboard API times out at 120s — fixed with server-side caching (2-min TTL), removed expensive computed fields, increased timeout to 180s with retry
- [x] BUG: Warehouse cards show fake capacity percentages (67%, 68%, 60%) and fabricated capacity numbers — no real capacity data exists in Odoo, remove capacity bars and percentage circles
- [x] Add color-coded grade badges to Stock Levels table (Grade 1 = green, Grade 3 = orange, Standard = grey, etc.)
- [x] BUG: Dashboard search "finished" shows nothing in Stock By Warehouse — search should also match location names within each warehouse
- [x] BUG: Stock By Warehouse shows total warehouse stock instead of filtered stock when dashboard search is active — fixed to recompute quantities from search-filtered quants
- [x] Set Cairo (Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY) as default company in FinanceModule on first load
- [x] Make SOA supplier/customer dropdown searchable — replaced native select with custom searchable dropdown with type-to-filter
- [x] Add Supply Split tab to Inventory module — show which supplier supplied which product with period filter, using stock.picking data from Odoo
- [ ] BUG: Duplicate React key "Main (empty)" error in FinanceModule — fix key uniqueness
- [ ] Add clear selection button to SOA searchable dropdown
- [ ] Enable multi-select for Warehouse, Location, and Grade filters on Stock Levels page
- [ ] TLS connection error on home page — transient Odoo network issue, not a code bug
- [x] Dashboard filters (Stock Type, Location) should affect the whole page, not just the green summary card
- [x] Enable multi-select for all dashboard filters (Stock Type, Location, Warehouse)
- [x] Add Warehouse as a filter row on the dashboard page
- [x] BUG: Stock By Warehouse section on Dashboard shows unfiltered warehouses when warehouse/location filters are active — fix to use dQ (filtered data)
- [x] BUG: Stock Valuation section kg data uses unfiltered cW — fix to use filtered dQ data
- [x] Add Product filter row on Dashboard page (between Stock Type and Warehouse)
- [x] Supply Split: Replace date pickers with preset time period buttons (Last 7 Days, 30 Days, 90 Days, All) plus Custom option with date pickers
- [x] Add % of Total Supply column to Supply Split table showing each supplier's share of total received quantity
- [x] Remove redundant Products tab from Inventory sidebar — Dashboard + Stock Levels already cover the same info
- [x] Add Supply Statement page to Inventory module — select supplier + period, show detailed receipts table
- [x] Supply Statement: show PO#, shipment#, load#, weight, purchase price, currency, date, product, receiving warehouse, procurement officer
- [x] Supply Statement: PDF export with company logo, name, and proper branding
- [x] Rename Supplier Statement to Supply Statement throughout UI and PDF
- [x] BUG: Supply Statement shows dashes for most fields (weight, price, currency, truck#, officer) — fixed by correcting domain array format for stock.move and purchase.order queries
- [x] BUG: PO# column in Supply Statement shows stock.picking.origin instead of actual PO number (e.g. PO/CAI/26/00110) from purchase.order.name — fixed to use purchase.order.name
- [x] Rename Price/Unit to Price/Ton in Supply Statement and ensure price is per ton — fixed computation
- [x] BUG: Supply Statement shows 0 values in PDF (price, weight, total) — FULLY FIXED: PDF generator now uses same data resolution logic as web page for both price (3-tier: picking → PO line → stock.move) and weight (picking field → stock.move quantity). PDF now matches web page values.
- [x] FIX: Supply Statement sidebar label changed from "Supply Stmt" abbreviation to full "Supply Statement" text
- [x] BUG: Supply Statement PDF shows "PO/" instead of actual PO numbers — FIXED by using purchase.order.name from poMap instead of origin field
- [x] UX: Changed quantity displays from kg to tons for better readability (1.93M kg → 1.93M t, 1.92M kg → 1.92M t)
- [x] BUG: Officer column not showing in PDF export — FIXED: Officer field is now included in PDF table (user_id fetched from Odoo, column defined and rendered)
- [x] BUG: React key error on /inventory page — FIXED by updating warehouse filter to use unique warehouse IDs (wh-${id}) as keys instead of label text, preventing duplicate "Main (empty)" keys
- [x] FEATURE: Set default filters on Inventory page to Animal Fodder stock type, Cairo warehouses (Main + Secondary), and Cairo company
- [x] FEATURE: Reorder Inventory sidebar navigation to: Dashboard, Warehouses, Stock Levels, Supply Split, Supply Statement
- [x] BUG: Default warehouse filter names didn't match Odoo data exactly — fixed "Secondary Warehouse Cairo Platform -Dakhla" (no space before Dakhla, regular hyphen) to match actual Odoo warehouse name
- [x] FEATURE: Add Animal Fodder stock type + Cairo warehouses as default filters on Dashboard page (dashWhs and pCats for dashboard) — keep Stock Levels defaults too
- [x] FEATURE: Clicking a product on Dashboard (By Product list + Stock Valuation rows) should navigate to Stock Levels tab pre-filtered to that product
- [x] FEATURE: Add Cost/Ton column to Stock Quants table on Stock Levels showing unit price per ton (px field converted to per-ton pricing)
- [x] FEATURE: Fix Cost/Ton calculation to be Value ÷ Available Quantity (not unit price), and make it sortable
- [x] BUG: Cost/Ton calculation was incorrect — was dividing value by kg instead of tons. Fixed by converting available quantity from kg to tons before division.
- [x] FEATURE: PDF export button already exists on Supply Statement page — backend endpoint `/api/supplier-statement-pdf` fully implemented with professional formatting
- [x] FEATURE: Add PDF export button to Statement of Account page (Finance module) to export supplier/customer statements as PDF
- [x] BUG: Text overlapping in Statement of Account PDF table — Fixed by adjusting column widths and adding text truncation with lineBreak: false to prevent overlapping.
- [x] FEATURE: Add multi-page handling with page breaks and proper headers on each page in Statement of Account PDF — table headers repeat on new pages and page numbers are shown at bottom of each page
- [x] FEATURE: Add hover tooltips to show full Ref and Description text in Statement of Account table — truncated cells show full text on hover using native title attribute
- [ ] FEATURE: Integrate Periodic Inventory module into Inventory & Warehouse — capture manual inventory submissions from team
- [ ] FEATURE: Create database schema for periodic inventory submissions (submission date, submitter, products, quantities, notes)
- [ ] FEATURE: Build backend API endpoints for periodic inventory CRUD operations
- [ ] FEATURE: Create UI for periodic inventory submissions dashboard showing recent submissions with product details
- [ ] FEATURE: Allow team to submit periodic inventory reports with one or multiple products per report
- [ ] FEATURE: Display periodic inventory submissions alongside system inventory analytics for comparison
- [ ] FEATURE: Integrate Periodic Inventory module into Inventory & Warehouse — capture manual inventory submissions from team and display recent submissions alongside system inventory analytics
  - [x] Create database schema for periodic inventory submissions and line items
  - [x] Create Odoo API helper to fetch periodic inventory data
  - [x] Create tRPC router with endpoints for submissions, detail, and date range queries
  - [x] Create UI component (PeriodicInventoryDashboard) to display recent submissions
  - [x] Add "Periodic" tab to Inventory module navigation
  - [x] Test periodic inventory dashboard and verify data loading
  - [x] Add filtering by warehouse, location, product category, and date range
  - [ ] Add export to PDF/CSV for periodic inventory submissions
  - [ ] Add comparison view between manual submissions and system inventory
- [x] BUG: Periodic Inventory tab exists in Inventory module top tabs but not in sidebar navigation — added to sidebar with 📝 icon and 'Periodic Inventory' label
- [x] BUG: Periodic Inventory page had poor UI — completely rebuilt with Platfarm design system (forest green headers, DM Sans/JetBrains Mono fonts, proper badges, stat cards, card headers, table styling)
- [x] BUG: Date dropdown now only shows dates with actual submissions (fetched from Odoo, deduplicated, latest first)
- [x] FEATURE: Rebuilt Periodic Inventory page with professional Platfarm UI matching other inventory pages — includes custom dropdowns, stat cards, submission cards with review status, line items tables with variance highlighting
- [x] FEATURE: Aggregate same-date submissions into one unified table instead of separate cards per submission
- [x] FEATURE: Replace Periodic Inventory dropdown filters (Warehouse, Location, Product) with Dashboard-style pill/chip toggle buttons — keep date as dropdown
- [x] BUG: Product filter pills show individual product template names instead of product categories (Animal Fodder, Packing Materials, Oil & Fuel, Spare Parts, Others) matching Dashboard grouping
- [x] BUG: Periodic Inventory shows 0 t for counted qty when bales > 0 — should estimate tonnage from avg bale weight parsed from weight range (e.g. 400-425 Kg → 412.5 kg/bale × bales)
- [x] FEATURE: Move Expenditure Distribution table into the Expenses page in Finance module
- [x] FEATURE: Remove standalone Expenditure page (now redundant) and its sidebar/route entry
- [x] UI: Move Distribution table above Categories and Monthly sections on Expenses page
- [x] BUG: Audit and fix data consistency on Expenses page — Distribution (from expenditure query, fixed 90d) vs Categories/Stats/Monthly (from expenses query, user-selectable period) may show different totals
- [x] FEATURE: Convert Monthly chart on Expenses page to stacked vertical bar chart with category breakdown (Cost of Sale, Other, Admin, etc.) and color legend
- [x] FIX: Monthly chart months now sorted chronologically instead of alphabetically
- [x] BUG: Cash Flow chart on Cash Overview page has two bars per month (dark green and light gray) but no legend explaining what each represents — added Inflows/Outflows legend
- [x] FEATURE: Add toggle to Bank Accounts table on Cash Overview to show only bank accounts (hide petty cash, cash settlement, etc.)
- [x] BUG: Monthly stacked bar chart hover tooltip shows proper full category breakdown for the hovered month
- [x] FEATURE: Add proper definitions/explanations for DSO, DIO, DPO, CCC terms in Cash Conversion Cycle section on Financial Health page
- [x] FEATURE: Create Sales Analytics page in Finance module — sales per customer during selectable period, analytics by quantity/tons total
- [x] UI: Add Currency column next to Total Value column on Supply Split page (By Supplier and By Product views)
- [x] BUG: Sales Analytics shows incorrect tonnage (585K tons) — switched from account.move to stock.picking (aiagent has no sale.order access), using x_studio_quantity_in_tons for correct tonnage, grouping by sale_id for shipment count, counting pickings with container numbers for container count
- [x] FEATURE: Add # Shipments trend chart to Sales Analytics page
- [x] FEATURE: Add # Containers exported trend chart to Sales Analytics page
- [x] BUG: Sales Analytics still showing wrong tonnage — root cause: aiagent CAN read sale.order.line (qty_delivered in kg ÷ 1000 = tons) and sale.order by ID (for date_order and number_of_loads); rewrote backend to use sale.order.line as authoritative tonnage source; restored Amount column with real price_subtotal data
- [x] FEATURE: Add sales distribution chart per ultimate customer in Sales Analytics (donut/pie chart showing % of tons and amount per customer)
- [x] FEATURE: Sales Analytics — show distribution per ultimate customer using x_studio_ultimate_customer (char field on sale.order); donut chart + horizontal bars; customer code prefix stripped
- [x] BUG: Sales Analytics shows empty data — root cause: aiagent has 0 accessible sale.order.line records for Cairo company; fixed by switching back to account.move (out_invoice) + account.move.line (quantity/1000=tons); 13 invoices accessible, correct tonnage (1750.86t total, Abu Dhabi 1469.71t, Yafa 192.33t, Sheasha 83.60t, Gamal Hanfy 5.22t)
- [ ] FEATURE: Add currency toggle to Sales Analytics — show amounts in original currency or USD-equivalent with configurable exchange rates (EGP/USD, etc.) [IN PROGRESS: DB schema + helpers done, frontend UI + conversion logic pending]

## Operations Dashboard Module (Sokhna Facility)

- [x] FEATURE: Create Operations Dashboard module structure (sidebar nav, main page layout) — full module with 5 sections, company selector, period bar
- [x] BACKEND: Add Odoo integration for facility data (stock.move, quality.check, production records) — created odoo-operations.ts with 12 functions
- [x] BACKEND: Add tRPC routes for operations data (supply, quality, production, export, logistics) — 5 parallel endpoints in server/routers/operations.ts
- [x] UI: Build Supply Chain section (daily supply by source, cost per ton, supplier rankings)
- [x] UI: Build Quality section (protein testing, quality grades, moisture analysis, visual vs protein)
- [x] UI: Build Production section (production performance, bale weight distribution, quality forms)
- [x] UI: Build Export section (daily shipments, customer distribution, product breakdown)
- [x] UI: Build Logistics section (truck weight, trucking costs, machine monitoring, fuel consumption)
- [x] FEATURE: Add date range filters to all sections (30d, 90d, YTD, custom)
- [ ] FEATURE: Add export/download functionality for operations reports
- [ ] TEST: Verify all charts load with live Odoo data
- [ ] TEST: Cross-validate dashboard data against Odoo web portal
- [x] BUG: Operations Dashboard defaults to "All Companies" causing very slow loading — fixed: default to Cairo (ID 3), removed All Companies option from dropdown
- [x] PERF: Operations Dashboard takes ages to load — fixed: block queries until company resolved, default period 30d, removed All Companies mode
- [x] BUG: Week labels now W10Y26 format (include year) across all 5 operations endpoints
- [x] BUG: Charts in chronological order — all daily/weekly/monthly data sorted using sortable keys (YYYY-WW for weeks, YYYY-MM for months, YYYY-MM-DD for daily)
- [ ] BUG: Avg Protein shows "–" for all suppliers in Supply Chain section — investigate x_studio_crude_protein_dry_matter_ field on stock.picking
- [x] UI: Grade Distribution pie chart labels cut off ("de 2" instead of "Grade 2") — clean up grade names and improve chart layout
- [x] FEATURE: Add avg price per ton trend chart to Supply Chain section
- [x] FEATURE: Add trucking cost/ton per source chart to Logistics section
- [x] UI: Enhance Grade Distribution chart — clean up grade names, better label layout with distinct colors
- [x] FEATURE: Add Weekly Trucking Cost/Ton Trend line chart to Logistics section
- [x] BUG: Logistics section 500 error — removed invalid field 'diesel_consumption_per_ton' from mrp.production query
- [x] BACKEND: Add cleanGrade() helper to format grade labels (grade_1 → Grade 1)
- [x] TEST: Add vitest tests for cleanGrade, weeklyPriceTrend, truckingCostPerTonBySource (8 tests passing)
- [x] CHANGE: Avg Price/Ton Trend chart → change to grouped bar chart (not line)
- [x] CHANGE: Avg Price/Ton Trend → always show in USD (convert EGP using live rate)
- [x] BUG: Avg Protein KPI card shows "—" — confirmed no NIR data in Odoo yet (field exists, all values 0.0); shows "No NIR data yet" message
- [x] CHANGE: Supplier Ranking table → Avg Protein column already present; shows "—" when no NIR data; Avg Cost/Load now shows in USD
- [x] BUG: Avg Cost/Ton shows $737.49 — fixed: now weighted avg ($183.65), smart currency validation added
- [x] BUG: Avg Cost/Ton still wrong ($730) — fixed: toUsd() now detects misclassified EGP prices (>$500 labeled USD), excludes junk (<$1)
- [x] BUG: Avg Protein uses wrong field — fixed: now uses cp_dry_matter_percentage (×100) with fallback to x_studio_crude_protein_dry_matter_
- [x] BUG: Quality section uses wrong field names — fixed: added nir_adf_percentage, nir_ndf_percentage with fallback; ADF/NDF columns added to Quality tables
- [x] UI: Supplier Ranking "Bar" column header is unclear — renamed to "Volume" across all tables
- [x] CHANGE: Protein Distribution buckets → <16%, 16-18%, 18-20%, 20-22%, >22%
- [x] FEATURE: Drill-down hover tooltips — show underlying references on hover across ALL sections (Supply, Quality, Production, Export, Logistics)
- [x] FEATURE: Add drill-down refs to Weekly Supply Trend chart hover tooltip
- [x] FEATURE: Add drill-down refs to Avg Price per Ton (USD) bar chart hover tooltip
- [x] BUG: CWDAK warehouse receipts not showing in Operations Dashboard — fixed: CWDAK records had empty x_studio_loading_datetime; added OR filter to use scheduled_date/date_done as fallback dates; now shows 27 loads (26 CWDAK + 1 MWCP) in 7-day view
- [x] BUG: Weekly Avg Protein Trend chart in Quality section missing drill-down hover tooltip — fixed: added refs tracking to weeklyProtein backend aggregation and switched to RefChartTooltip
- [x] FEATURE: Use product line weight (stock.move.line quantity in kg) as fallback when x_studio_net_weight_in_tons is 0 — CWDAK receipts now show correct tonnage (e.g. Ali Gomaa: 0t → 69.7t, total: 314t → 468.1t)
- [x] NOT A BUG: MWCP receipts correctly show source='Dakhla' from Odoo — material sourced from Dakhla, received at MWCP warehouse
- [x] FEATURE: Add warehouse column (MWCP vs CWDAK) to Supplier Ranking table — extracts warehouse prefix from picking reference, shows per-supplier warehouse(s)
- [x] FEATURE: Make hover tooltips (RefTooltip/RefChartTooltip) clickable so users can copy reference content to clipboard — click individual refs or use Copy All button
- [x] BUG: Odoo RPC error — Invalid field stock.picking.x_studio_etd_pol — fixed: refactored export section to query sale.order instead of stock.picking with correct field names (etd_pol, x_studio_total_shipment_weight_in_tons_sales, x_studio_unified_shipment_status)
- [x] BUG: Copy All button in RefTooltip — fixed: improved copyText to use textarea fallback (clipboard API can fail in tooltip overlays), added count feedback ("✓ 41 copied")
- [x] UI: Trucking Cost/Ton per Source chart — added $ prefix to Y-axis and tooltip values
- [x] UI: Weekly Trucking Cost/Ton Trend — converted to USD bar chart
- [x] UI: Added weekly Trucking Cost by Source trend bar chart (total cost per source per week, in USD)
- [x] AUDIT: Deep audit of Operations Dashboard — fixed moisture bucket (0-moisture records no longer inflate <10% bucket), removed unused SUPPLY_FIELDS (x_studio_trucking_fees, x_studio_gross_weight_in_tons, x_studio_quality_score, x_studio_loadcontainer_number_1), confirmed protein scale (cp_dry_matter_percentage ×100), confirmed price unit (per ton), confirmed trucking currency always EGP, NDF/moisture empty in Odoo for all MWCP/CWDAK pickings
- [x] BUG: Quality Analytics section only shows receipts with NIR/protein data — fixed: now iterates all pickings (not just withQuality), shows all 10 suppliers/3 sources with tonnage; protein/moisture buckets still only count records with actual data; KPIs show 17/45 loads (38% completion rate), 28 missing records
- [x] FEATURE: Add warehouse column (MWCP/CWDAK/WH) to Quality by Source, Quality by Grade, and Supplier Quality Ranking tables in Quality Analytics section
- [x] BUG: Weekly Avg Protein Trend tooltip shows 0.00% for weeks with no NIR data — fixed: allRefs now tracks ALL loads per week (not just protein loads), tooltip shows all load refs plus subLabel showing "X/Y loads with NIR" or "N loads — no NIR data"
- [x] FEATURE: Convert Weekly Supply Trend chart to vertical stacked bar chart per source (Dakhla/Toshka)
- [x] BUG: Operations page tRPC error "Unexpected token '<'" — server returning HTML error page instead of JSON (500 crash) — root cause: sandbox hibernation; fixed: added isTransientError() helper that catches HTML parse errors, network errors, and socket hang ups; retries up to 4x with exponential backoff; shows "Server is waking up, retrying…" toast instead of raw error
- [x] BUG: Supplier Ranking includes non-fodder items (sleeve bags, diesel, etc.) — fixed: added isFodderProduct() helper with NON_FODDER_KEYWORDS blocklist (fuel, diesel, sleeve, bag, product--, lubricant, spare part, chemical); filter applied to both supply and quality loops; product_id added to SUPPLY_FIELDS
- [x] FEATURE: Convert Tons by Source chart to pie chart (donut style, with % labels on slices and legend with % breakdown)
- [x] FEATURE: Click-through from Tons by Source pie chart to filter Supplier Ranking table by selected source — click slice to filter, dimmed unselected slices, clear filter badge in table header
- [x] FEATURE: Reorder Operations sidebar nav: Supply Chain → Logistics → Quality → Production → Export
- [x] FEATURE: Add Weekly Avg Protein Trend chart to Production section (quality-assessed bales, using x_studio_date from bale quality module) — fetches x_bale_quality_log, groups by week, shows avg protein % DM with 16% target reference line
- [x] BUG: Weekly Output Trend chart has no unit on Y-axis — fixed: title now "Weekly Output Trend (Bales)", Y-axis shows "b" suffix
- [x] FEATURE: Change Weekly Trucking Cost Trend to show Cost/Ton (USD) per week as a simple (non-stacked) bar chart — backend now computes totalCost/totalTons per week; chart uses single green bar with hover showing cost/ton, total cost, total tons
- [x] FEATURE: Convert Weekly Trucking Cost/Ton Trend (by source) from line chart to grouped bar chart — renamed to "Weekly Trucking Cost/Ton by Source", grouped bars with distinct colors per source, tooltip shows $/t per source
- [x] FEATURE: Remove Trucking Cost by Source, Cost/Ton per Source, and Weekly Cost/Ton Trend charts from Logistics section
- [x] FEATURE: Add Trucking Weight by Source (Tons) bar chart — avg weight per truck load by source (avgWeightPerLoad, totalTons, loads, refs in tooltip)
- [x] FEATURE: Move Weekly Machine Monitoring chart from Logistics section to Production section
- [x] FEATURE: Move Total Diesel and Avg Oil Temp KPI cards from Logistics to Production section (already in Production; removed from Logistics)
- [x] FEATURE: Move Weekly Machine Monitoring chart from Logistics to Production section (removed from Logistics; already in Production)
- [x] FEATURE: Remove Trucking Cost by Supplier table from Logistics section
- [x] FEATURE: Add weekly Trucking Cost/Ton by Source grouped bar chart trend to Logistics section — uses weeklyTruckingTrend + truckingTrendSources from backend, grouped bars with distinct colors per source, tooltip shows $/t per source
- [x] BUG: Logistics KPI "Avg Cost/Load" changed to "Avg Cost/Ton" — backend now tracks totalTruckingTons and returns avgTruckingCostPerTon = totalCost/totalTons
- [x] FEATURE: Protein Distribution chart renamed to "in Tons", Y-axis now shows "t" suffix (was already tracking tons in backend)
- [x] FEATURE: Sort Supplier Quality Ranking by avg protein descending (was sorted by tons)
- [x] FEATURE: Update Bale Weight Distribution buckets to: <350kg, 350-375kg, 375-400kg, 400-425kg, 425-450kg, >450kg
- [x] BUG: Bale Weight Distribution fixed — now fetches x_bale_quality_log with x_studio_bale_weight_in_kg, buckets each individual bale by weight; tooltip shows "bales" not "shifts"
- [x] FEATURE: Add Warehouse and Location dropdown filters to Supply Chain page (default: All) — dropdowns populated dynamically from availableWarehouses/availableLocations; selecting warehouse resets location; Clear button removes both filters; backend filters in-memory after cached fetch
- [x] BUG: Avg Cost/Ton is null (–) for most suppliers in Supplier Ranking table — fixed by fetching PO line price_unit (EGP/kg) from purchase.order.line when agreed_product_price_per_unit is 0 on the picking; _po_price_per_ton injected as fallback during fetchSupplyPickings enrichment
- [x] FEATURE: Add Weekly Avg Price/Ton trend line chart by supplier to Supply Chain page — one line per supplier, shows price trend over weeks, helps spot price increases
- [x] BUG: PDF export fails with 'Error generating PDF. Please try again.' in Quotation Editor
- [x] FIX: Location dropdown should only show locations belonging to the selected warehouse (Supply Chain filter)
- [x] FEATURE: Add price change badge (↑/↓ %) to Supplier Ranking table showing price change vs. previous week
- [x] FEATURE: Supplier select/deselect toggles on Weekly Avg Price/Ton chart
- [x] BUG: Incoterms field missing from QuotationEditor form editor panel
- [x] BUG: Incoterms not showing in Details preview card on QuotationEditor
- [ ] BUG: PDF export size=0 (PDFKit buffer not flushing synchronously)
- [x] BUG: Incoterms field missing from QuotationEditor form editor panel
- [x] BUG: Incoterms not showing in Details preview card
- [x] BUG: PDF export size=0 (PDFKit buffer not flushing)
- [x] BUG: PDF product table rows have fixed height causing text overlap when description wraps
- [x] FEATURE: Avg Trucking Cost/Ton KPI card to show per-source breakdown below the overall average
- [x] BUG: Trucking cost/ton inconsistency — per-source values lower than overall average
- [x] FEATURE: Add Procurement Officer searchable dropdown to Truck Loads in Purchase Shipments (Egypt companies)
- [x] FEATURE: Show Procurement Officer badge in truck loads table on shipment detail page
- [x] FEATURE: Internal Transfers page in Inventory & Warehouse tracking CWDAK→MWCP transfers — "Dakhla-Sokhna Moves" page added to Inventory module sidebar
- [x] BUG: Missing React key props in DakhlaSokhnaTransfers component lists — fixed by using React.Fragment with key on the cwdak row fragment
- [x] BUG: Not all modules listed in the user permissions table — added "Operations Dashboard" to PORTAL_MODULES (server) and MODULES (frontend)
- [ ] FEATURE: Forgot password / password reset flow — request reset via email, token-based reset link, new password form
- [x] FEATURE: Unify company selector appearance across all modules into a single shared CompanySelector component — shared CompanySelector + useCompanySelector hook; OperationsModule and FinanceModule refactored
- [x] FEATURE: Per-user company access control — DB schema (user_company_access table, pnpm db:push applied)
- [x] FEATURE: Per-user company access control — backend tRPC procedures (getUserCompanyAccess, setUserCompanyAccess, getAllCompanyAccess, myCompanyAccess)
- [x] FEATURE: Per-user company access control — useCompanySelector hook filters by allowed companies and uses user's default
- [x] FEATURE: Per-user company access control — Company Access sub-tab in User Management settings with checklist + default radio
- [x] BUG: Company selector shows wrong companies — fixed: Home.tsx was using its own unfiltered company list; added myCompanyAccess query to Home.tsx and fixed filtering + localStorage persistence to JSON format; also fixed race condition in useCompanySelector (return [] while loading instead of all companies)
- [x] BUG: Company selector filtering not applied in Production Dashboard and other modules — fixed: ProductionHome, InventoryModule, InvestmentCycles all now use myCompanyAccess filtering; dropdown renders from filtered allowedCompanies list
- [x] BUG: "All Companies" option still shows for restricted users in company selector — fixed: added isCompanyAdmin conditional to all 6 modules (Home, Operations, Finance, Production, Inventory, Investments) and useCompanySelector hook
- [x] BUG: Abu Dhabi company missing from test user's company selector despite being in allowed list

- [x] BUG: "All Companies" option still showing for restricted users (must only show for admins) — fixed across all modules
- [x] BUG: Restricted users see ALL companies instead of only their allowed ones — fixed: added reset effect in useCompanySelector and all inline selectors
- [x] Fix useCompanySelector hook to properly enforce company access control — added userIsAdmin check and ALL reset effect
- [x] Fix CompanySelector component to respect allowAll prop — already correct, passes allowAll to control visibility
- [x] Fix all modules (Home, Operations, Finance, Production, Inventory, Investments) company selectors — all 6 modules now conditionally show All Companies based on isCompanyAdmin/isAdmin
- [x] BUG/SECURITY: Fixed privilege escalation — when myCompanyAccess query returns undefined (loading/error), frontend was defaulting to admin access via `!accessData || ...`. Changed all 6 modules + shared hook to use `!!accessData && (...)` pattern — never grant admin when data is missing
- [x] BUG: Company access still not working on published site — ROOT CAUSE: hr-dashboard.html (standalone HTML served via iframe) had its own hardcoded company list with no access control. Fixed by: adding myCompanyAccess API call, odooId mapping to ALL_ODOO_COMPANIES, filtering companyObjects by allowedCompanyIds, hiding All Companies for non-admin, resetting stale localStorage. Also removed debug banner from ModuleLauncher.tsx.
- [x] BUG: Inventory module sidebar/layout structure changed — ROOT CAUSE: sed command corrupted sidebar width from 190 to 19 pixels. Fixed: restored const W = sc ? 48 : 190
- [x] BUG: Default company not working properly for restricted users — test user should default to Cairo (set as default in Company Access) but gets Abu Dhabi instead. Fix: admin-configured default ALWAYS overrides stale localStorage for restricted users. Updated all 7 locations: useCompanySelector hook, Home.tsx, ProductionHome.tsx, InventoryModule.tsx, InvestmentCycles.tsx, hr-dashboard.html. Admin users still respect localStorage; restricted users always get admin-configured default on page load.
- [x] UI: Reduce module cards height by 20% in ModuleLauncher.tsx
- [x] UI: Reduce gap/space between module cards by 10% in ModuleLauncher.tsx
- [x] UI: Further reduce gap between module cards by 10% (10px → 8px) in ModuleLauncher.tsx
- [x] BUG: erp.platfarm.io login not working — ROOT CAUSE: sameSite:"none" requires secure:true (HTTPS). When accessed over HTTP, browser rejects the cookie entirely, causing infinite login loop. Fix: cookie now uses sameSite:"lax" when not secure, sameSite:"none" when secure. SSL issue is DNS/platform-level (user needs CNAME or wait for cert provisioning).
- [x] Add Offline Operations module: inject provided JSX component as-is, register route, add to module launcher
- [x] Update Offline Operations module with user's updated JSX file (as-is injection)
- [x] Connect Offline Operations module to live Odoo data: created server/odoo-offline-ops.ts data layer + server/routers/offlineOps.ts tRPC router. Fetches pf.procurement (RCV), pf.quality (QC), pf.pressing (DPR), pf.shipping (TRF) from Odoo. Field names verified via fields_get introspection. Live data replaces hardcoded arrays in OfflineOpsModule.tsx.
- [x] Add company selector to Offline Operations module header (same pattern as other modules) — companyId passed to tRPC allData query for server-side filtering by company_id domain
- [x] BUG: Offline Operations company_id filter causes Odoo RPC error — pf.* models don't have company_id field, removed invalid domain filter from all four fetch functions (pf.procurement, pf.quality, pf.pressing, pf.shipping)
- [x] BUG: Offline Operations sidebar missing Platfarm logo and Home link — replaced placeholder P-box with PlatfarmLogo component, added Home nav item with setLocation("/"), imported useLocation from wouter
- [ ] Add "Create Shipment" wizard to Offline Operations procurement detail panel: pre-fills from procurement data, reuses mobile attachments, creates linked shipment in Odoo with back-reference to procurement record, button only shown if no shipment yet linked
- [ ] FEATURE: Create Shipment from Procurement — correctly implement concept: (1) extend CreateOdooShipment with initialValues+procurementRef props, (2) add tRPC linkProcurement procedure to write back PO id to pf.procurement, (3) add conditional button in RCV Review tab, (4) copy procurement attachments to new PO
- [ ] FEATURE: Create Shipment from Procurement — add origin field to PO creation, add procurementData prop to CreateOdooShipment wizard, add copyAttachments + markProcurementConverted tRPC procedures, add Create Shipment button to RCV detail panel with converted badge
- [x] FEATURE: Quality assessment data from procurement shipment is pre-filled into the purchase shipment wizard (notes field contains structured QC summary: moisture, protein, color, leaf ratio, density, verdict, final grade, grade split, inspector, bale height, avg weight)
- [x] FEATURE: ProcurementData interface added to CreateOdooShipment with optional qcData field
- [x] FEATURE: buildQualityNotes() pure function generates structured PO notes from procurement + QC data
- [x] FEATURE: "Create Shipment from Procurement" button added to RCV Review tab (detTab===4) in OfflineOpsModule
- [x] FEATURE: After PO creation, procurement is marked as converted (notes tag + in-memory badge)
- [x] FEATURE: copyQualityAttachments procedure added to offlineOps router — copies QC attachments to PO
- [x] FEATURE: allData query enriched to return full qcData per procurement for wizard pre-fill
- [x] FEATURE: Shipments router create mutation now returns { id, name } (PO name for back-referencing)
- [x] TEST: 21 unit tests for buildQualityNotes and conversion data validation — all passing
- [x] FEATURE: Convert Press Operation to Production Order — build server-side createProductionOrder, linkPressingToMO, copyPressingAttachments procedures
- [x] FEATURE: Build CreateOdooProductionOrder wizard component with press data pre-fill (mirroring CreateOdooShipment)
- [x] FEATURE: Add "Convert to Production Order" button to OfflineOpsModule DPR detail panel (Review tab)
- [x] FEATURE: After MO creation, mark pressing as converted with badge showing MO reference
- [x] TEST: 29 unit tests for press→MO conversion data flow — all passing
- [x] RENAME: "Press Ops" / "Press Operations" → "Pressing Shifts" across all UI labels, nav items, table headers, badges, dashboard cards, detail panels, and page titles
- [x] UI: Add "Converted → PO/XXXX" badge column to Procurement list table for records already converted to a Purchase Order
- [x] UI: Add "Converted → MO/XXXX" badge column to Pressing Shifts list table for records already converted to a Production Order
- [x] UI: Show linked PO/MO reference prominently in the detail panel header for converted Procurement and Pressing Shift records
- [x] ODOO: Create x_studio_linked_po (Char) field on pf.procurement model to store linked PO reference (e.g. "PO/00042")
- [x] ODOO: Create x_studio_linked_po_id (Integer) field on pf.procurement model to store linked PO Odoo ID
- [x] ODOO: Create x_studio_linked_mo (Char) field on pf.pressing model to store linked MO reference (e.g. "WH/MO/00018")
- [x] ODOO: Create x_studio_linked_mo_id (Integer) field on pf.pressing model to store linked MO Odoo ID
- [x] SERVER: Update linkProcurementToPO to write x_studio_linked_po and x_studio_linked_po_id on the procurement record
- [x] SERVER: Update linkPressingToMO to write x_studio_linked_mo and x_studio_linked_mo_id on the pressing record
- [x] SERVER: Update transformProcurement to read and expose linkedPoName and linkedPoId fields
- [x] SERVER: Update transformPressing to read and expose linkedMoName and linkedMoId fields
- [x] UI: Show "→ PO/XXXX" conversion badge in Procurement list table and detail header using linkedPoName field
- [x] UI: Show "→ MO/XXXX" conversion badge in Pressing Shifts list table and detail header using linkedMoName field
- [x] RENAME: "Quality" sidebar nav item and all related labels → "Quality Reports" in Offline Operations module
- [x] UI: Add "Quality Report" subtitle to QC detail panel header (similar to "Procurement Receipt" subtitle on RCV records)
- [x] UI: Update Offline Operations module card on home screen — replace "Quality" with "Quality Reports" in sub-section tags
- [x] UI: Add Warehouse and Location filter pills to Supply Split page, derived from actual data, filtering KPIs and table rows
- [x] BUG: Supply Split warehouse/location filter labels don't match Dashboard labels — fixed by using warehouse_id.name directly from purchase.order (stock.warehouse model, same as Dashboard) and stock.location.complete_name for location labels
- [x] BUG: Supply Split location filter pills show wrong locations — confirmed acceptable: locations differ from Dashboard because they reflect PO destination locations (not stock locations)
- [x] BUG: Supply Statement includes receipts from cancelled POs (e.g. PO/CAI/26/00111) — fixed by filtering out receipts whose linked purchase.order has state=cancel (Supply Split was already correct with state in [purchase, done])
- [x] BUG: Supply Statement PDF export shows different total value than UI (1.96M on screen vs 2.05M in PDF) — fixed by adding same cancel filter to PDF export (supplier-statement-pdf.ts)
- [x] BUG: Supply Statement ignores trucking cost PO line items — fixed: trucking cost now shown as separate column, fodder value uses PO line price only
- [x] FEATURE: Add separate Trucking Cost column to Supply Statement — show trucking PO line subtotal (10106-Local Freight & Trucking) per PO on first receipt row, separate from animal fodder cost, in both UI table and PDF export
- [x] FIX: Supply Statement price resolution must use PO line price (price_unit from purchase.order.line, per kg × 1000 = per ton) as primary source, NOT agreed_product_price_per_unit from receipt — so trucking cost stays separate
- [x] BUG: Supply Statement PDF has wrong/ugly fonts and missing company logo — fixed: embedded DM Sans (Regular, Medium, Bold) matching website typography, added Platfarm PNG logo to PDF header
- [x] BUG: PDF export returns HTTP 500 on production (erp.platfarm.io) — fixed by adding `cp -r server/assets dist/assets` to the build script so fonts and logo are copied to dist/ on every deployment
- [x] BUG: Supplier Ranking shows wrong tonnage for receipts with kg unit (e.g. WH/IN/04439 shows 7,254t instead of 7.254t) — fixed via move line weight fix above
- [x] BUG: Operations Supply weight uses x_studio_net_weight_in_tons from picking header (can have wrong values like 7254 instead of 7.254) — fixed: always use stock.move.line quantity with kg→ton conversion as authoritative weight source (Mohamed Sayed Abd-Allah Sayed now shows 41.404t instead of 7,254t)
- [x] FIX: Logistics trucking cost now uses PO trucking line price_subtotal as primary source, falls back to x_studio_trucking_fee — total unchanged at $8,686 confirming data consistency
- [x] FIX: Deployment failure caused by server/assets/ (fonts + images, ~368KB) being committed to git — fixed by uploading all assets to CDN, creating assets-cdn.ts loader that downloads to /tmp at runtime, updating supplier-statement-pdf.ts and quotation-pdf.ts to use CDN paths, removing server/assets/ from git tracking and .gitignore, and removing cp -r server/assets dist/assets from build script
- [ ] BUG: Sales Shipments page shows 0 orders when Cairo company is selected — investigate company filter logic in sales shipments backend
- [ ] BUG: HR module Table toggle button does nothing when clicked — investigate view toggle state in HR page
- [ ] BUG: HR module Table toggle button does nothing when clicked — investigate view toggle state in HR page
- [ ] BUG: HR Management header appears twice (once from DashboardLayout, once from inside HRHome page) — remove the duplicate inner header
- [x] BUG: HR Management header appears twice — fixed by removing duplicate outer header from HRHome.tsx (iframe has its own)
- [x] BUG: HR module Table toggle button does nothing — fixed by loading iframe directly from /api/hr-dashboard instead of blob URL
- [x] BUG: Sales Shipments shows 0 orders for Cairo-PLATFARM company — fixed: Odoo aiagent user needed multi-company access; now sees 409 orders (224 Abu Dhabi, 160 Cairo-PLATFARM, 25 AlfaGlobal)
- [x] BUG: HR Table toggle still not working on production — fixed: iframe now loaded directly from /api/hr-dashboard with postMessage navigation
- [x] BUG: Employee Directory page gets stuck/frozen while other HR pages (Dashboard, Leaves, etc.) work fine — fixed with postMessage-based iframe navigation
- [x] FIX: Employee Directory page not loading when clicked from HR sidebar — fixed: added postMessage listener to hr-dashboard.html and dual navigation (postMessage + direct setState) in HRHome.tsx for reliable iframe communication
- [x] Create new standalone Employee Listing page with simple, clean design (separate from existing Employee Directory)
- [x] Employee Listing: Fetch employee data from Odoo API via tRPC
- [x] Employee Listing: Add route /employee-listing and sidebar navigation entry
- [x] Employee Listing: Clean table/card layout with search, department filter
- [x] BUG: Employee Listing page has no sidebar — fixed: added full HR sidebar matching HRHome
- [x] BUG: Employee Listing broken avatar images — fixed: EmployeeAvatar component validates base64 and falls back to colored initials
- [x] Employee Listing: clicking an employee should navigate to the existing Employee Directory profile page (iframe-based) instead of showing a simple drawer — implemented via sessionStorage + postMessage for reliable cross-page navigation
- [x] IMPROVE: HR module loading screen — replaced plain spinner with professional skeleton UI (sidebar, top bar, KPI cards, content cards with shimmer animations) matching shipment module quality
- [x] Add company selector to Employee Listing page to filter employees by company (matching other HR pages) + added Company column to table
- [x] FIX: Employee Listing uses its own inline company dropdown — replaced with global CompanySelector component (top-right header) matching all other portal pages
- [x] Hide Employee Directory from HR sidebar — Employee Listing replaces it
- [x] FEATURE: Company Documents in Document Management module
- [x] Research Odoo Documents module API (documents.document model, fields, tags, folders)
- [x] Create portal DB schema for company document expiry tracking (company_id, doc_type, odoo_doc_id, expiry_date, reminder flags)
- [x] Build Odoo Documents API helpers (fetch/upload documents, link to companies)
- [x] Build tRPC routes for company documents CRUD + expiry management
- [x] Build frontend: Company Documents UI — per-company checklist with 6 required doc types
- [x] Each document: edit modal with expiry date, issue date, reference number, notes, status indicators
- [x] Integrate Company Documents into Document Management module navigation
- [ ] Build daily cron job to check expiry dates and send email reminders (30d, 14d, 7d before expiry)
- [ ] Write vitest tests for company documents backend
- [x] FEATURE: Link existing Odoo Documents to Company Documents expiry tracker
- [x] Build backend: Odoo document search/browse by folder and company (searchOdooDocuments endpoint)
- [x] Build backend: Link Odoo document ID to company document record (linkOdooDocument endpoint)
- [x] Update frontend: Add "Link from Odoo" button in edit modal with folder browsing and search
- [x] Show linked Odoo document info (file name, size, upload date, uploader) on document cards
- [x] Add view/download linked Odoo document from Company Documents page
- [x] IMPROVE: Add folder dropdown selector to Link from Odoo modal — browse Odoo folder tree like a file browser before searching documents
- [x] Build getFolderTree backend endpoint to fetch Odoo folder hierarchy
- [x] Build folder dropdown UI component in Link from Odoo modal
- [ ] Write vitest tests for getFolderTree endpoint
- [x] RENAME: Change "Company Documents" to "Mandatory Company Documents" throughout the portal (sidebar, page title, subtitle, breadcrumbs)
- [x] IMPROVE: Dashboard company selector — replace with global CompanySelector component matching rest of portal
- [x] IMPROVE: Integrate Mandatory Company Documents section into the Dashboard page itself
- [x] IMPROVE: Clean up Dashboard — remove empty workspaces (0 files AND 0 folders), removed Favorites/File Types/Storage Ring bottom row
- [x] FIX: Make DMS Dashboard company selector fully match the global CompanySelector component (same visual style, layout, behavior)
- [x] FIX: DMS Dashboard company selector must match the main Dashboard header style — large green circle avatar, full company name, prominent header-bar placement (not the small compact style)
- [x] REMOVE: Remove "Mandatory Company Documents" sidebar nav item from DMS since it's now integrated into the Dashboard
- [x] BUG: Dashboard mandatory docs section only shows stats — need to show actual document cards (Company Registration, VAT, Tax, etc.) per company below the stats
- [x] BUG: Company selector in DMS header doesn't sync with iframe content — switching companies should update dashboard data
- [x] BUG: Dashboard mandatory doc cards not clickable — need edit/link modal with folder dropdown and Odoo document linking (same as CompanyDocuments page)
- [x] BUG: Clicking a mandatory doc card should open a modal to set expiry, reference, link Odoo document with folder tree browser
- [x] BUG: Mandatory doc cards only show for Cairo-PLATFARM — should auto-create default 6 document types for any company that doesn't have records yet, so all companies show their mandatory docs on the dashboard
- [ ] BUG: Mandatory Company Documents section disappears when switching to Abu Dhabi (or other non-Cairo companies) — auto-initialization not triggering on company switch, only on initial page load
- [x] BUG: Upload button disabled in Upload Files modal even when file is selected — fixed: h() function was setting disabled="false" as string attribute (any presence of disabled attr disables element), now properly handles boolean attrs
- [x] FEATURE: Add Office Lease Contract as mandatory document for ALL companies
- [x] FEATURE: Add Medical Insurance Policy as mandatory document for ALL companies
- [x] FEATURE: Add Export Certificate as mandatory document for Egypt companies (Cairo-PLATFARM, Sokhna-PLATFARM, Cairo-AlfaGlobal)
- [x] FEATURE: Add Tax Portal Registration as mandatory document for Egypt companies
- [x] FEATURE: Add Social Insurance as mandatory document for Egypt companies
- [x] FEATURE: Add Company Establishment Card as mandatory document for UAE companies (ABU DHABI-PLATFARM, ADGM-PLATFARM)
- [x] FEATURE: Add Housing Lease Contract as mandatory document for ADGM company only
- [x] Update auto-initialization to create country-specific document types per company
- [x] Remove Favorites item from DMS sidebar navigation
- [x] FEATURE: Daily cron job to check documents expiring within 30 days and send email with company name, document name, expiry date, days to expire — recipients are users with DMS module access
- [x] FEATURE: Renewal History — database schema for document_renewal_history table
- [x] FEATURE: Renewal History — backend tRPC procedures (create renewal, list history per document)
- [x] FEATURE: Renewal History — UI: renewal modal with file upload, old/new version tracking
- [x] FEATURE: Renewal History — UI: history timeline showing all past renewals per document
- [x] FEATURE: Renewal History — integrate with document cards (renew button, version indicator)
- [x] FEATURE: Renewal History — preserve old document versions (keep old Odoo doc ID + new one)
- [ ] FEATURE: Renewal History — vitest coverage for renewal logic
- [ ] BUG: Publishing (deploying) clears Odoo document links (odooDocumentId) — linked documents become unlinked after publish
- [x] FEATURE: Add Civil Defense as mandatory document type for Sokhna company only
- [ ] BUG: Document expiry cron sends multiple emails (one per recipient) instead of one consolidated email to all recipients
- [x] BUG: Activity Log on employee profile shows expenses from wrong employee — fixed: buildActivityLog() now filters by employee ID/name when on profile page
- [ ] HR: Add Nationality field to Edit Employee modal
- [ ] HR BUG: Contract Details Edit button not working
- [ ] HR: Add Compensation (EGP/month) section Edit functionality (Base Wage, Housing Allowance, Transport Allowance, Other Allowances)
- [ ] HR: Add Nationality field to Edit Employee modal
- [ ] HR: Fix Contract Details Edit button not working
- [ ] HR: Add Compensation section Edit functionality (Base Wage, Housing Allowance, Transport Allowance, Other Allowances)
- [ ] HR: Build vacation/leave balance system — annual leave allocation per employee (days per year/month)
- [ ] HR: Ensure leaves are logged and deducted from employee balance
- [ ] HR: Comprehensive audit of HR module for solidity
- [x] BUG: OfflineOpsModule crashes with "Cannot read properties of undefined (reading 'ppl')" on /offline-ops page
- [x] FIX: Document expiry cron must send exactly ONE consolidated email per day to all DMS users (not one email per recipient)
- [x] FEATURE: New Transfer wizard on Transfers page — create Odoo internal transfers (stock.picking)
- [x] FEATURE: Backend — fetch warehouses (stock.warehouse) and locations (stock.location) from Odoo
- [x] FEATURE: Backend — fetch products (product.product) with search from Odoo
- [x] FEATURE: Backend — create internal transfer via Odoo stock.picking API
- [x] FEATURE: Frontend — New Transfer button + wizard modal with source/dest warehouse & location selectors
- [x] FEATURE: Frontend — Product search/select with autocomplete
- [x] FEATURE: Frontend — Weight input (kg/tons toggle) and bales count
- [x] FEATURE: Default warehouses: MWCP (Sokhna) and CPDAK (Dakhla), default location: finished product
- [x] UI: Update Offline Ops sidebar icons to match mobile app (🏠 Home, 📊 Dashboard, 🌿 Procurement plant image, 🔍 Quality Reports, ⚙️ Pressing Shifts, 📦 Transfers)
- [x] CHANGE: Move "New Transfer" button from top-level Transfers page into the shipment detail panel (right-side drawer)
- [x] CHANGE: Pre-fill transfer wizard with shipment's product, weight, and bales data from the selected record
- [x] CHANGE: Remove standalone "+ New Transfer" button from the Transfers section header
- [x] FEATURE: Backend endpoint to check stock.quant available qty for a product at a source location
- [x] FEATURE: Show stock availability icon in transfer wizard — click to see available qty at source location
- [x] FEATURE: Validate transfer qty does not exceed available stock before creating Odoo stock.picking
- [x] CHANGE: Simplify transfer wizard to single-product mode — remove "Add Product Line" multi-line pattern, use form fields directly for review/submit
- [x] FEATURE: Add "Browse Available Stock" button in transfer wizard — shows all products with stock at source location with qty and unit
- [x] CHANGE: Auto-validate (button_validate) the internal transfer immediately after action_confirm — complete the transfer in one step, no separate "Receive" action needed
- [x] BUG: Contract Details Edit button not working on HR employee detail page
- [x] FEATURE: Compensation Edit modal — allow editing Base Wage, Housing Allowance, Transport Allowance, Other Allowances via Odoo hr.contract
- [x] FEATURE: Contract Details Edit modal — edit start/end dates, social insurance ref via Odoo hr.contract
- [x] FEATURE: Map Odoo contract allowance fields (l10n_eg_housing_allowance, l10n_eg_transportation_allowance, l10n_eg_other_allowances, l10n_ae_*) to employee profile
- [x] FEATURE: Map l10n_eg_social_insurance from Odoo contract to employee socialIns field
- [x] FEATURE: Live total gross calculation in Compensation Edit modal
- [x] FEATURE: UAE vs Egypt allowance field routing — automatically uses l10n_ae_* or l10n_eg_* based on company
- [x] FEATURE: Petty Cash & Expenses module — standalone HTML dashboard (like HR module)
- [x] FEATURE: PC&E Dashboard page — KPI cards, top-up requests table, pending approval table
- [x] FEATURE: PC&E Petty Cash page — employee balances, top-up/adjustment, requests tab
- [x] FEATURE: PC&E Expenses page — expense reports table with full lifecycle (submitted→approved→done/refused)
- [x] FEATURE: PC&E Reminders page — CRUD for employee reminders (daily/weekly/monthly)
- [x] FEATURE: PC&E Detail panels — employee PC detail, expense detail, request detail (right drawer)
- [x] FEATURE: PC&E Backend — Odoo API functions for petty cash transactions, expenses, reminders
- [x] FEATURE: PC&E Backend — tRPC router with all endpoints
- [x] FEATURE: PC&E Integration — route, sidebar nav, module launcher card
- [x] FEATURE: PC&E Global company selector integration
- [x] FEATURE: PC&E Vitest tests
- [x] BUG: PCE company selector needs to be more prominent and properly sync with the global company selector
- [x] FEATURE: Integrate Petty Cash page with Odoo pf.petty.cash model instead of local DB tables
- [x] FEATURE: Fetch petty cash transactions/requests from pf.petty.cash Odoo model
- [x] FEATURE: Update PCE tRPC router to use Odoo pf.petty.cash for transactions and requests
- [x] FEATURE: Update PCE dashboard HTML to display Odoo petty cash data
- [x] BUG: PCE module sidebar and page colors changed from established design — must match HR module sidebar exactly
- [x] BUG: PCE sidebar has different style from main app sidebar — remove module label, remove subtitles, match compact layout
- [x] FEATURE: Keep Expenses page on hr.expense.sheet (native Odoo) with correct states (draft/submit/approve/done/cancel)
- [x] FEATURE: Integrate pf.petty.cash.request Odoo model for top-up requests (states: draft/submitted/approved/refused)
- [x] FEATURE: Keep Petty Cash transactions on pf.petty.cash (states: draft/confirmed)
- [x] FEATURE: Update Dashboard KPIs to reflect correct states from all 3 models
- [x] FEATURE: Fix dev server error — missing fetchPettyCashByType export
- [x] AUDIT: Verify state/status consistency across Odoo models, DB schema, tRPC router, and frontend HTML for all 3 models
- [x] BUG: Expense detail panel stepper used "refused" instead of "cancel" for hr.expense.sheet state — fixed 3 occurrences in pce-dashboard.html
- [x] BUG: Comment in odoo-expenses.ts missing post/done states — fixed to include all 6 states
- [x] BUG: Comment in pce.ts missing post state — fixed to include all 6 states
- [x] BUG: 3 failing tests — test expectations used old endpoint names (expenseSheets→expenses, processRequest→approveRequest/refuseRequest) — fixed
- [x] BUG: Petty cash requests created in Odoo mobile app not showing in PCE web portal — mobile shows 8 requests (including "test 5" for 500 AED) but web shows "No requests"
- [x] BUG: Approved petty cash request doesn't update employee balance — fixed by using Odoo action_approve/action_refuse workflow methods instead of direct write (action_approve auto-creates pf.petty.cash top-up transaction)
- [x] INVESTIGATE: aiagent user access rights — access is correct (Expense Manager group gives full read); only 2 requests exist in Odoo database, not 8
- [x] BUG: Expenses page missing Draft state — REVERTED: user confirmed system has no draft state, removed Draft KPI card and filter tab
- [x] BUG: Approve button on expense detail panel doesn't work — fixed: wrong Odoo method names (approve_expense_sheets→action_approve_expense_sheets, refuse_sheet→action_refuse_expense_sheets, reset_expense_sheets→action_reset_expense_sheets)
- [x] FIX: Remove Draft state from Expenses page — removed Draft KPI card and Draft filter tab
- [x] FIX: Added error handling to all approve/refuse/reject functions — trpcMutate now throws with extracted Odoo error message, all action functions show specific error in toast
- [ ] FIX: Switch expense approve/refuse/reset from Odoo action methods to direct write — Odoo disconnected from accounts/banks, PCE is management-only (no ledger posting)
- [ ] REDESIGN: Remove hr.expense.sheet from PCE portal entirely
- [ ] REDESIGN: Use pf.petty.cash model for both petty cash top-ups AND expense claim deductions
- [ ] REDESIGN: Handle petty cash and expense claims as separate flows (not the same thing)
- [ ] REDESIGN: Ensure correct relationship between petty cash balance and expense deductions
- [ ] FIX: Expenses page must keep original UI states (Pending Review, Approved, Paid, Refused) while using pf.petty.cash model — check if model supports these states or needs custom mapping
- [ ] Add expense states (submitted, approved, paid, refused) to pf.petty.cash Odoo model selection field (waiting for other agent to upgrade Odoo module)
- [x] Update backend tRPC endpoints to use new expense states (submitExpense, approveExpense, payExpense, refuseExpense, resetExpense)
- [x] Update frontend KPI cards, filters, and action buttons for expense states (5 KPIs, 6 filter pills, full workflow actions)
- [x] Add state transition action methods in Odoo (submit, approve, pay, refuse, reset via write API)
- [ ] Test full expense workflow end-to-end (blocked until Odoo model states are added)
- [x] FIX: Remove Draft state from expense deductions — expenses start directly at 'submitted' (Pending Review) when created, no Draft step
- [ ] FIX: Switch Expenses page from pf.petty.cash to hr.expense.sheet model — expenses and petty cash are separate Odoo models
- [ ] Explore hr.expense.sheet fields and states in Odoo
- [ ] Update backend odoo-expenses.ts to fetch from hr.expense.sheet
- [ ] Update pce.ts tRPC router for hr.expense.sheet endpoints
- [ ] Update frontend Expenses page to display hr.expense.sheet data with correct states (To Submit, Submitted, Approved, Not Paid, Paid)
- [ ] Remove expense_deduction logic from pf.petty.cash — keep pf.petty.cash for top-ups and adjustments only
- [ ] FIX: Expense statuses not updating properly on portal — investigate Odoo response vs portal display
- [x] FIX: DMS renewal API error when linking document from Odoo Documents — two issues: (1) field name mismatch documentId→companyDocumentId, (2) linkOdooDocument/renew/upsert/uploadAndLink endpoints used adminOnly but regular users need access — changed to protectedProcedure
- [x] FIX: After OAuth login, users redirected to .manus.space instead of erp.platfarm.io — hardcoded erp.platfarm.io in server redirect middleware, OAuth redirect URI, and invitation URLs
- [x] FIX: Redirect loop on erp.platfarm.io — removed server-side redirect (Host header behind proxy doesn't match), replaced with client-side JS redirect in all HTML files (index.html, dms, hr, pce, supply-chain dashboards)
- [x] FIX: erp.platfarm.io redirect loop — changed all redirect scripts to use window.location.protocol instead of hardcoded https://, so redirect works on both HTTP and HTTPS
- [x] FIX: Login redirect loop — caused by protocol mismatch: redirect forced https:// but page was on http://, cookie set on http:// was lost on https:// redirect
- [x] FIX: Regression — custom email/password login page was not published (code was correct, just needed publish)
- [x] FIX: Login works in Chrome but redirect loop in other browsers (Safari, Firefox) — changed SameSite from 'none' to 'lax' in cookies.ts; Safari ITP and Firefox ETP block SameSite=None cookies
- [x] FIX: Unauthenticated users see old "Sign in with Platfarm" OAuth button on root page — changed ModuleLauncher to redirect to /login when not authenticated, also updated main.tsx and DashboardLayout fallbacks
- [x] FIX: PCE Top-Up Request approve/reject buttons cause 2-3 page reloads before action completes
- [x] FIX: PCE dashboard iframe redirect loop on Chrome — removed canonical redirect scripts entirely from all 4 dashboard HTML files (pce, hr, dms, supply-chain) since they're always served via /api/* inside iframes; the React shell handles canonical domain enforcement
- [x] FIX: PCE approve/reject buttons cause 2-3 page reloads — added _actionBusy guard, batched data fetches into single render, added loading indicator on buttons
- [x] FIX: Module shell pages show hardcoded "Ahmed K. / Administrator" instead of actual logged-in user — updated all 9 pages (Home, PCEHome, HRHome, DMSHome, ProductionHome, SupplyChainHome, QuotationsHome, InvestmentHome, EmployeeListing) to use useAuth() for real user name, initials, and role display
- [x] FIX: After login, user briefly sees landing page before being redirected to home page — added loading screen in ModuleLauncher while auth resolves + set sessionStorage flag in Login.tsx before redirect
- [x] FEATURE: Admin/accountant direct petty cash top-up — added directTopUp backend mutation (creates + auto-confirms transaction) and frontend form on Petty Cash page with employee selector, amount, reason, and notes fields
- [x] FEATURE: Accrual-based leave balance system — calculate leave balance dynamically based on joining date, monthly vacation rate, and taken days
- [x] Investigate current leave data model (schema, backend, frontend)
- [x] DB: Added leaveSettings table with odooEmployeeId, annualLeaveDays, joiningDate, notes
- [x] Update backend to calculate accrued leave balance (months_worked * monthly_rate - taken_days) — added getAllLeaveSettings, upsertLeaveSetting, calculateLeaveBalance endpoints
- [x] Update frontend Leaves tab to display dynamic accrued, used, and remaining balance — shows accrued vs allocated, monthly rate, months worked, configure button for admin to set annual days and joining date
