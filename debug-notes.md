# Operations Dashboard Verification Notes

## Supply Chain Section
- Avg Price per Ton Trend chart: WORKING - Shows Dakhla and Toshka price trends over weeks W7-W10 Y26
- Grade Distribution: Now uses donut chart with legend showing "Grade 2 (83%)" and "grade_1 (17%)"

## Logistics Section (After fix)
- KPIs: Total Trucking Cost 455,000 (16 loads), Avg Cost/Load 28,438, Total Diesel 150L, Avg Oil Temp 43C (Max 50C)
- Trucking Cost by Source: Bar chart showing Dakhla and Toshka (existing, working)
- Trucking Cost/Ton per Source: NEW BAR CHART - showing Dakhla ~1800 and Toshka ~450 cost/ton (WORKING)
- Weekly Trucking Cost/Ton Trend: NEW LINE CHART - showing 2 sources over W7-W10 Y26 (WORKING)
- Weekly Machine Monitoring: Line chart showing Max Oil Temp and Diesel (existing, working)
- Supplier Trucking Table: 6 suppliers with costs (existing, working)

## Bug Fixed
- Removed invalid field 'diesel_consumption_per_ton' from mrp.production model query (caused 500 error)

## Remaining
- Grade label "grade_1" should be cleaned up to "Grade 1" in supply chain
