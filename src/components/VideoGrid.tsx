import type { ReactNode } from "react";
import type { ChannelId, GridColumns, VmsLayout } from "../config/channels";

interface VideoGridProps {
  layout: VmsLayout;
  focusedId: ChannelId;
  columns: GridColumns;
  renderTile: (id: ChannelId) => ReactNode;
}

const idsFor = (layout: VmsLayout, focusedId: ChannelId): ChannelId[] =>
  layout === "1x1" ? [focusedId] : layout === "2x1" ? [1, 2] : [1, 2, 3, 4];

// Clases estáticas (Tailwind no admite nombres dinámicos).
const columnClass: Record<GridColumns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

/**
 * Grilla de canales. `columns` define cuántas columnas tiene la grilla; las filas se
 * reparten el alto disponible. Menos columnas = contenedores más anchos.
 */
export const VideoGrid = ({ layout, focusedId, columns, renderTile }: VideoGridProps) => {
  const ids = idsFor(layout, focusedId);
  return (
    <div className={`grid min-h-0 flex-1 auto-rows-fr ${columnClass[columns]} gap-2 p-2`}>
      {ids.map((id) => renderTile(id))}
    </div>
  );
};
