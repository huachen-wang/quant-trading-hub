import { protectedProcedure } from "../_core/trpc";

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return next();
});
