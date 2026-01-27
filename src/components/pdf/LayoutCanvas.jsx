import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A4 Page: 210mm x 297mm (at 96 DPI, ~794px x 1123px)
 * Scale: 1mm = ~3.78px (at 96 DPI)
 * For visual editor: use simpler scale, e.g., 1mm = 2px for compact view
 */
const MM_TO_PX = 2; // 1mm = 2px in editor (can be adjusted for zoom)
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export default function LayoutCanvas({ layout, onBlockChange, selectedBlock, onSelectBlock, showGrid = true, showGuides = true }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  if (!layout) return null;

  const margins = layout.margins_mm;
  const canvasWidth = A4_WIDTH_MM * MM_TO_PX;
  const canvasHeight = A4_HEIGHT_MM * MM_TO_PX;

  // Convert mm to px
  const mmToPx = (mm) => mm * MM_TO_PX;

  // Grid background
  const gridSize = 10; // mm
  const gridPatternId = 'layout-grid';

  // Draggable block
  const handleBlockMouseDown = (e, blockName) => {
    if (resizing) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragging(blockName);
    setDragOffset({ x, y });
    onSelectBlock(blockName);
  };

  const handleCanvasMouseMove = (e) => {
    if (!dragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const block = getBlockByName(dragging);
    if (!block) return;

    const newX = Math.max(0, Math.round((x - dragOffset.x) / MM_TO_PX));
    const newY = Math.max(0, Math.round((y - dragOffset.y) / MM_TO_PX));

    onBlockChange(dragging, { ...block, x_mm: newX, y_mm: newY });
  };

  const handleCanvasMouseUp = () => {
    setDragging(null);
  };

  const getBlockByName = (name) => {
    if (name === 'seller') return layout.header?.blocks?.seller;
    if (name === 'buyer') return layout.header?.blocks?.buyer;
    if (name === 'meta') return layout.header?.blocks?.meta;
    if (name === 'table') return layout.table;
    if (name === 'totals') return { x_mm: margins.left, y_mm: 240, w_mm: A4_WIDTH_MM - margins.left - margins.right };
    if (name === 'footer') return { x_mm: margins.left, y_mm: A4_HEIGHT_MM - layout.footer?.height_mm, w_mm: A4_WIDTH_MM - margins.left - margins.right };
    return null;
  };

  const blocks = [
    { name: 'seller', label: 'Seller Info', color: 'bg-blue-100 border-blue-400' },
    { name: 'buyer', label: 'Customer Info', color: 'bg-green-100 border-green-400' },
    { name: 'meta', label: 'Document Meta', color: 'bg-yellow-100 border-yellow-400' },
    { name: 'table', label: 'Line Items Table', color: 'bg-purple-100 border-purple-400' },
    { name: 'totals', label: 'Totals Section', color: 'bg-orange-100 border-orange-400' },
    { name: 'footer', label: 'Footer Area', color: 'bg-red-100 border-red-400' },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="bg-white border-2 border-slate-300 relative shadow-lg"
        style={{
          width: canvasWidth + 40,
          height: canvasHeight + 40,
          overflow: 'auto'
        }}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        {/* Actual Page */}
        <div
          className="relative bg-white"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            backgroundImage: showGrid
              ? `
                  repeating-linear-gradient(
                    0deg,
                    #f0f0f0 0,
                    #f0f0f0 1px,
                    transparent 1px,
                    transparent ${mmToPx(gridSize)}px
                  ),
                  repeating-linear-gradient(
                    90deg,
                    #f0f0f0 0,
                    #f0f0f0 1px,
                    transparent 1px,
                    transparent ${mmToPx(gridSize)}px
                  )
                `
              : 'none',
            backgroundPosition: `0 0, 0 0`,
            margin: '20px',
          }}
        >
          {/* Margin guides */}
          {showGuides && (
            <>
              {/* Top margin */}
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-red-300"
                style={{ top: mmToPx(margins.top) }}
              />
              {/* Left margin */}
              <div
                className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-300"
                style={{ left: mmToPx(margins.left) }}
              />
              {/* Right margin */}
              <div
                className="absolute top-0 bottom-0 border-r-2 border-dashed border-red-300"
                style={{ right: mmToPx(margins.right) }}
              />
              {/* Bottom margin */}
              <div
                className="absolute left-0 right-0 border-b-2 border-dashed border-red-300"
                style={{ bottom: mmToPx(margins.bottom) }}
              />
            </>
          )}

          {/* Draggable blocks */}
          {blocks.map((blockDef) => {
            const block = getBlockByName(blockDef.name);
            if (!block) return null;

            return (
              <div
                key={blockDef.name}
                className={cn(
                  'absolute border-2 cursor-move flex items-center justify-center text-xs font-semibold transition-all',
                  blockDef.color,
                  selectedBlock === blockDef.name && 'ring-2 ring-offset-1 ring-blue-500'
                )}
                style={{
                  left: mmToPx(block.x_mm),
                  top: mmToPx(block.y_mm),
                  width: mmToPx(block.w_mm),
                  height: mmToPx(block.h_mm),
                }}
                onMouseDown={(e) => handleBlockMouseDown(e, blockDef.name)}
              >
                <div className="pointer-events-none text-center">
                  <div>{blockDef.label}</div>
                  <div className="text-[10px] opacity-75">
                    {block.x_mm}, {block.y_mm} mm
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {blocks.map((blockDef) => (
          <div key={blockDef.name} className="flex items-center gap-2">
            <div className={cn('w-4 h-4 border-2', blockDef.color)} />
            <span>{blockDef.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}