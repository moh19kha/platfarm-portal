// ═══════════════════════════════════════════════════════════════════════════
// Vessel Tracking Router — Tradlinx integration
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { searchVessels, getVesselPosition, searchVesselWithPosition } from "../tradlinx";

export const vesselTrackingRouter = router({
  // Search vessels by name, MMSI, IMO, or Call Sign
  search: publicProcedure
    .input(z.object({ keyword: z.string().min(2) }))
    .query(async ({ input }) => {
      const results = await searchVessels(input.keyword);
      return results;
    }),

  // Get vessel position and details by vesselId
  getPosition: publicProcedure
    .input(
      z.object({
        vesselId: z.number(),
        vesselName: z.string().optional(),
        mmsi: z.string().optional(),
        imo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const position = await getVesselPosition(
        input.vesselId,
        input.vesselName,
        input.mmsi,
        input.imo
      );
      return position;
    }),

  // Search and get position in one call (convenience)
  searchWithPosition: publicProcedure
    .input(z.object({ keyword: z.string().min(2) }))
    .query(async ({ input }) => {
      const position = await searchVesselWithPosition(input.keyword);
      return position;
    }),
});
