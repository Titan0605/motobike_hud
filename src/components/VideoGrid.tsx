import type { ReactNode } from "react";
import type { ChannelId, VmsLayout } from "../config/channels";

interface VideoGridProps {
  layout: VmsLayout;
  focusedId: ChannelId;
  renderTile: (id: ChannelId) => ReactNode;
}

/** Grilla fija simple: 1x1 = canal enfocado, 2x1 = CH1-CH2, 2x2 = CH1-CH4 */
export const VideoGrid = ({ layout, focusedId, renderTile }: VideoGridProps) => {
  if (layout === "1x1") {
    return <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-2 p-2">{renderTile(focusedId)}</div>;
  }

  if (layout === "2x1") {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-2 p-2 sm:grid-cols-2 sm:grid-rows-1">
        {renderTile(1)}
        {renderTile(2)}
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-4 gap-2 p-2 sm:grid-cols-2 sm:grid-rows-2">
      {renderTile(1)}
      {renderTile(2)}
      {renderTile(3)}
      {renderTile(4)}
    </div>
  );
};
