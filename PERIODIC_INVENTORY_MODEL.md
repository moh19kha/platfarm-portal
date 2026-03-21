# Periodic Inventory Model (periodic.inventory)

## Overview
The periodic.inventory model in Odoo represents manual inventory submissions from the team. Each submission can contain one or multiple products and includes supervisor and accounting review workflows.

## Key Fields

### Header Fields
- **name** (char): Sequence number in format `PINV/YYYY/MM/####` (e.g., `PINV/2026/03/0015`)
- **date** (date): Submission date
- **state** (selection): Current state - `draft`, `supervisor_review`, `accounting_review`, `done`, `cancelled`
- **company_id** (many2one): Company reference
- **location_id** (many2one): Stock location where inventory was counted
- **warehouse_id** (many2one): Warehouse reference

### Inventory Details
- **inventory_type** (selection): Type of inventory (e.g., `animal_fodder`)
- **reporting_unit** (selection): Unit of measurement (e.g., `bales`, `tons`, `kg`)
- **product_category_id** (many2one): Product category for this submission
- **grade** (selection): Grade/quality level (e.g., `Grade 1`, `Grade 3`)
- **weight_range** (selection): Weight range (e.g., `425-450`)
- **country_id** (many2one): Country of origin
- **line_ids** (one2many): Line items containing product details and quantities

### Submission Info
- **requested_by** (many2one): User who submitted the inventory
- **request_date** (datetime): When the submission was created
- **notes** (text): Additional notes/comments

### Supervisor Review
- **supervisor_review_status** (selection): `pending`, `approved`, `rejected`
- **supervisor_id** (many2one): Supervisor who reviewed
- **supervisor_review_date** (datetime): When supervisor reviewed
- **supervisor_notes** (text): Supervisor comments
- **supervisor_review_display** (char): Display text (e.g., "✓ Done", "○ Pending")

### Accounting Review
- **accounting_review_status** (selection): `pending`, `approved`, `rejected`
- **accountant_id** (many2one): Accountant who reviewed
- **accounting_review_date** (datetime): When accountant reviewed
- **accounting_notes** (text): Accountant comments
- **accounting_review_display** (char): Display text

### Metadata
- **total_products** (integer): Count of products in this submission
- **total_quantity** (float): Total quantity across all line items
- **show_inventory_lines** (boolean): Whether to display line items
- **create_uid** (many2one): Creator user
- **create_date** (datetime): Creation timestamp
- **write_uid** (many2one): Last modifier user
- **write_date** (datetime): Last modification timestamp

## Line Items (periodic.inventory.line)
Each submission can have multiple line items via `line_ids`. Each line contains:
- Product reference
- Quantity counted
- Unit of measurement
- Notes/comments

## Workflow States
1. **draft** - Initial submission state
2. **supervisor_review** - Waiting for supervisor approval
3. **accounting_review** - Waiting for accounting approval
4. **done** - Fully approved and finalized
5. **cancelled** - Submission cancelled

## Sample Data
- Total records in system: 5+ (as of 2026-03-14)
- Latest submission: PINV/2026/03/0015 (2026-03-14)
- Inventory types: animal_fodder
- Reporting units: bales, tons, kg
- Grades: Grade 1, Grade 3
- Weight ranges: 425-450, etc.

## Integration Points
- Can be queried via Odoo JSON-RPC API
- Model name: `periodic.inventory`
- Related model for lines: `periodic.inventory.line`
- Accessible to authenticated users with appropriate permissions
