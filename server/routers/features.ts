import { getPublicFeatureFlags } from "../../constants/features";
import { publicProcedure, router } from "../_core/trpc";

export const featuresRouter = router({
  get: publicProcedure.query(() => getPublicFeatureFlags()),
});
