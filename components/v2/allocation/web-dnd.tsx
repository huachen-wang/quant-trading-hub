import { Platform } from "react-native";
import type { DragEvent, ReactNode } from "react";
import type { StrategyDropVerdict } from "@/lib/v2/allocation";

export const STRATEGY_DRAG_MIME = "application/x-eaxau-strategy-id";

// dataTransfer.getData is unreadable during dragover in Chromium, so the
// currently dragged id is mirrored here for live target evaluation.
let currentDraggedStrategyId: string | null = null;

export function DraggableStrategy({
  strategyId,
  disabled = false,
  onDragStateChange,
  children,
}: {
  strategyId: string;
  disabled?: boolean;
  onDragStateChange?: (draggingId: string | null) => void;
  children: ReactNode;
}) {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <div
      draggable={!disabled}
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        currentDraggedStrategyId = strategyId;
        event.dataTransfer.setData(STRATEGY_DRAG_MIME, strategyId);
        event.dataTransfer.effectAllowed = "copy";
        onDragStateChange?.(strategyId);
      }}
      onDragEnd={() => {
        currentDraggedStrategyId = null;
        onDragStateChange?.(null);
      }}
      style={{ cursor: disabled ? "not-allowed" : "grab" }}
    >
      {children}
    </div>
  );
}

export function StrategyDropTarget({
  evaluate,
  onDropStrategy,
  onHoverChange,
  children,
}: {
  evaluate: (strategyId: string) => StrategyDropVerdict;
  onDropStrategy: (strategyId: string) => void;
  onHoverChange?: (hover: { strategyId: string; verdict: StrategyDropVerdict } | null) => void;
  children: ReactNode;
}) {
  if (Platform.OS !== "web") return <>{children}</>;

  const readDraggedId = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(STRATEGY_DRAG_MIME)) return null;
    return currentDraggedStrategyId;
  };

  return (
    <div
      onDragOver={(event: DragEvent<HTMLDivElement>) => {
        const strategyId = readDraggedId(event);
        if (!strategyId) return;
        const verdict = evaluate(strategyId);
        if (verdict.allowed) {
          // preventDefault marks the target as a valid drop zone; rejected
          // strategies skip it so the browser shows the not-allowed cursor.
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
        onHoverChange?.({ strategyId, verdict });
      }}
      onDragLeave={(event: DragEvent<HTMLDivElement>) => {
        const related = event.relatedTarget as Node | null;
        if (related && event.currentTarget.contains(related)) return;
        onHoverChange?.(null);
      }}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        const strategyId =
          event.dataTransfer.getData(STRATEGY_DRAG_MIME) || currentDraggedStrategyId;
        onHoverChange?.(null);
        if (!strategyId) return;
        event.preventDefault();
        onDropStrategy(strategyId);
      }}
    >
      {children}
    </div>
  );
}
