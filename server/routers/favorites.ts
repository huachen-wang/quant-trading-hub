import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const favoriteInput = z.object({
  productKind: z.enum(["strategy", "promo"]),
  productId: z.number(),
});

export const favoritesRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.getUserFavorites(ctx.user.id)),
  isFavorited: protectedProcedure
    .input(favoriteInput)
    .query(({ ctx, input }) => db.isFavorited(ctx.user.id, input.productKind, input.productId)),
  add: protectedProcedure
    .input(favoriteInput)
    .mutation(({ ctx, input }) => db.addFavorite(ctx.user.id, input.productKind, input.productId)),
  remove: protectedProcedure
    .input(favoriteInput)
    .mutation(({ ctx, input }) => db.removeFavorite(ctx.user.id, input.productKind, input.productId)),
});
