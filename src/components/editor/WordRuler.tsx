/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Microsoft Word Horizontal Ruler with Dynamic Paper Width, cm/in Ticks & Draggable Margins
 */

import React, { useState, useRef } from 'react';
import { MeasurementUnit } from '../../types/manuscript';
import {
  CM_PER_INCH,
  PX_PER_INCH,
  pxToCm,
  pxToIn,
  formatLength,
} from '../../services/pageLayout';

interface WordRulerProps {
  widthPx: number;
  marginLeftPx: number;
  marginRightPx: number;
  unit: MeasurementUnit;
  zoomLevel: number;
  onMarginsChange: (leftCm: number, rightCm: number) => void;
}

export const WordRuler: React.FC<WordRulerProps> = ({
  widthPx,
  marginLeftPx,
  marginRightPx,
  unit,
  zoomLevel,
  onMarginsChange,
}) => {
  const [draggingSide, setDraggingSide] = useState<'left' | 'right' | null>(null);
  const [dragLeftPx, setDragLeftPx] = useState<number>(marginLeftPx);
  const [dragRightPx, setDragRightPx] = useState<number>(marginRightPx);
  const dragStartRef = useRef<{
    clientX: number;
    startLeftPx: number;
    startRightPx: number;
  } | null>(null);

  const activeLeftPx = draggingSide ? dragLeftPx : marginLeftPx;
  const activeRightPx = draggingSide ? dragRightPx : marginRightPx;
  const scale = Math.max(0.25, zoomLevel / 100);

  const handlePointerDown = (side: 'left' | 'right', e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingSide(side);
    setDragLeftPx(marginLeftPx);
    setDragRightPx(marginRightPx);
    dragStartRef.current = {
      clientX: e.clientX,
      startLeftPx: marginLeftPx,
      startRightPx: marginRightPx,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingSide || !dragStartRef.current) return;
    const deltaPx = (e.clientX - dragStartRef.current.clientX) / scale;
    const minMargin = 24;
    const minContent = 160;

    if (draggingSide === 'left') {
      const maxLeft = widthPx - dragStartRef.current.startRightPx - minContent;
      const clamped = Math.round(
        Math.max(minMargin, Math.min(maxLeft, dragStartRef.current.startLeftPx + deltaPx))
      );
      setDragLeftPx(clamped);
    } else {
      const maxRight = widthPx - dragStartRef.current.startLeftPx - minContent;
      const clamped = Math.round(
        Math.max(minMargin, Math.min(maxRight, dragStartRef.current.startRightPx - deltaPx))
      );
      setDragRightPx(clamped);
    }
  };

  const handlePointerUp = () => {
    if (!draggingSide) return;
    const finalLeftCm = pxToCm(dragLeftPx);
    const finalRightCm = pxToCm(dragRightPx);
    setDraggingSide(null);
    dragStartRef.current = null;
    onMarginsChange(finalLeftCm, finalRightCm);
  };

  // Build unit ticks across entire paper width relative to left margin zero-origin
  const unitPx = unit === 'in' ? PX_PER_INCH : PX_PER_INCH / CM_PER_INCH;
  const ticks: { xPx: number; label?: string; major: boolean }[] = [];

  // Ticks from left margin outward to 0 and inward to widthPx
  const maxUnitsRight = Math.ceil((widthPx - activeLeftPx) / unitPx);
  const maxUnitsLeft = Math.floor(activeLeftPx / unitPx);

  for (let i = -maxUnitsLeft; i <= maxUnitsRight; i++) {
    const x = activeLeftPx + i * unitPx;
    if (x >= 8 && x <= widthPx - 8) {
      ticks.push({
        xPx: x,
        label: String(Math.abs(i)),
        major: true,
      });
    }
    const halfX = x + unitPx * 0.5;
    if (halfX >= 8 && halfX <= widthPx - 8) {
      ticks.push({
        xPx: halfX,
        major: false,
      });
    }
  }

  return (
    <div
      className="relative h-6 bg-slate-100 border border-slate-300 select-none text-[9px] text-slate-600 font-mono shadow-2xs mb-2 rounded-t-xs no-print shrink-0"
      style={{ width: `${widthPx}px` }}
    >
      {/* Shaded Margin Zones */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-slate-200/90 border-r border-slate-300/80"
        style={{ width: `${activeLeftPx}px` }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 bg-slate-200/90 border-l border-slate-300/80"
        style={{ width: `${activeRightPx}px` }}
      />

      {/* Active Body White Track */}
      <div
        className="absolute top-0 bottom-0 bg-white/95"
        style={{
          left: `${activeLeftPx}px`,
          width: `${Math.max(0, widthPx - activeLeftPx - activeRightPx)}px`,
        }}
      />

      {/* Scale Ticks */}
      {ticks.map((t, idx) => (
        <div
          key={idx}
          className="absolute bottom-0 flex flex-col items-center pointer-events-none"
          style={{ left: `${t.xPx}px`, transform: 'translateX(-50%)' }}
        >
          {t.major && t.label !== undefined && (
            <span className="text-[8.5px] leading-none text-slate-500 mb-0.5">{t.label}</span>
          )}
          <div
            className={`w-px ${t.major ? 'h-2 bg-slate-400' : 'h-1 bg-slate-300'}`}
          />
        </div>
      ))}

      {/* Draggable Left Margin Handle */}
      <div
        role="slider"
        aria-label="Left Margin"
        onPointerDown={e => handlePointerDown('left', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ left: `${activeLeftPx}px`, transform: 'translateX(-50%)' }}
        className="absolute top-0 bottom-0 w-3 flex flex-col items-center justify-center cursor-ew-resize z-20 group"
        title={`Left Margin: ${
          unit === 'in' ? `${pxToIn(activeLeftPx).toFixed(2)} in` : formatLength(pxToCm(activeLeftPx), 'cm')
        } (drag to adjust)`}
      >
        <div
          className={`w-2.5 h-3.5 rounded-xs border shadow-2xs transition ${
            draggingSide === 'left'
              ? 'bg-blue-600 border-blue-800 scale-110'
              : 'bg-slate-400 border-slate-600 group-hover:bg-blue-500'
          }`}
        />
        {draggingSide === 'left' && (
          <>
            <div className="fixed top-20 bottom-0 w-px border-l border-dashed border-blue-500/80 pointer-events-none" />
            <div className="absolute -bottom-6 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-50">
              L: {formatLength(pxToCm(activeLeftPx), unit)}
            </div>
          </>
        )}
      </div>

      {/* Draggable Right Margin Handle */}
      <div
        role="slider"
        aria-label="Right Margin"
        onPointerDown={e => handlePointerDown('right', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ left: `${widthPx - activeRightPx}px`, transform: 'translateX(-50%)' }}
        className="absolute top-0 bottom-0 w-3 flex flex-col items-center justify-center cursor-ew-resize z-20 group"
        title={`Right Margin: ${
          unit === 'in' ? `${pxToIn(activeRightPx).toFixed(2)} in` : formatLength(pxToCm(activeRightPx), 'cm')
        } (drag to adjust)`}
      >
        <div
          className={`w-2.5 h-3.5 rounded-xs border shadow-2xs transition ${
            draggingSide === 'right'
              ? 'bg-blue-600 border-blue-800 scale-110'
              : 'bg-slate-400 border-slate-600 group-hover:bg-blue-500'
          }`}
        />
        {draggingSide === 'right' && (
          <>
            <div className="fixed top-20 bottom-0 w-px border-l border-dashed border-blue-500/80 pointer-events-none" />
            <div className="absolute -bottom-6 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-50">
              R: {formatLength(pxToCm(activeRightPx), unit)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
