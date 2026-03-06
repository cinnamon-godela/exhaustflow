import React from 'react';
import { SimulationResult, SimulationInputs } from '../types';
import { getChillerLabel, getApiChillerNumberForDisplayIndex } from '../services/chillerApi';

/** Convert °F to Kelvin */
const fToK = (f: number) => (f - 32) * (5 / 9) + 273.15;

const WIND_LEGEND_W = 64;
const WIND_LEGEND_H = 44;

/** Tiny chiller yard (rectangle) with arrow moving smoothly around its perimeter. 0°=right, 45°=top-right, 90°=top. */
const WindIndicatorTopRight: React.FC<{
  windOrientation: number;
  windSpeed: number;
  onWindDirectionChange?: (angle: number) => void;
}> = ({ windOrientation, windSpeed, onWindDirectionChange }) => {
  const deg = Math.min(90, Math.max(0, windOrientation));
  const w = WIND_LEGEND_W;
  const h = WIND_LEGEND_H;
  const cx = w / 2;
  const cy = h / 2;
  const rx = 22;
  const ry = 14;
  const x1 = cx - rx;
  const x2 = cx + rx;
  const y1 = cy - ry;
  const y2 = cy + ry;

  let left = 0.5;
  let top = 0.5;
  if (deg <= 45) {
    left = 1;
    top = 0.5 * (1 - deg / 45);
  } else {
    left = 1 - 0.5 * (deg - 45) / 45;
    top = 0;
  }
  const px = x1 + (x2 - x1) * left;
  const py = y1 + (y2 - y1) * top;
  const dx = cx - px;
  const dy = cy - py;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const arrowLen = 10;
  const wing = 2.5;
  const tipX = arrowLen;
  const tipY = 0;
  const ax = tipX - wing;
  const ay = -wing;
  const bx = tipX - wing;
  const by = wing;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onWindDirectionChange) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const y = ((e.clientY - rect.top) / rect.height) * h;
    const clickAngle = (Math.atan2(cy - y, x - cx) * 180) / Math.PI;
    const wind = Math.min(90, Math.max(0, clickAngle));
    onWindDirectionChange(Math.round(wind));
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={`h-10 w-14 text-amber-400 ${onWindDirectionChange ? 'cursor-pointer hover:opacity-90' : ''}`}
          onClick={onWindDirectionChange ? handleClick : undefined}
          title={onWindDirectionChange ? 'Click to set wind direction. 0° from right, 45° from top-right, 90° from top.' : `Wind from ${deg}°`}
          aria-hidden
        >
          <rect x={x1} y={y1} width={rx * 2} height={ry * 2} fill="none" stroke="#52525b" strokeWidth="1" rx="1.5" />
          <g
            style={{
              transform: `translate(${px}px, ${py}px) rotate(${angleDeg}deg)`,
              transformOrigin: '0 0',
              transition: 'transform 0.25s ease-out',
            }}
          >
            <line x1={0} y1={0} x2={arrowLen} y2={0} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <polygon points={`${tipX},${tipY} ${ax},${ay} ${bx},${by}`} fill="currentColor" />
          </g>
        </svg>
        <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{deg}° · {windSpeed} m/s</span>
      </div>
    </div>
  );
};

interface HeatmapGridProps {
    data: SimulationResult;
    inputs: SimulationInputs;
    onToggleNode: (index: number) => void;
    /** When true, cells are read-only (no toggle); used for fixed 5×4 array. */
    layoutLocked?: boolean;
    /** Display temperatures in °F or K */
    tempUnit?: 'F' | 'K';
    /** Optional: when user interacts with wind legend, set wind direction (0–90). */
    onWindDirectionChange?: (angle: number) => void;
}

const HeatmapGrid: React.FC<HeatmapGridProps> = ({ data, inputs, onToggleNode, layoutLocked = false, tempUnit = 'F', onWindDirectionChange }) => {
    
    // Thermal color logic: blue → red
    const getThermalColor = (tempF: number) => {
        const base = inputs.ambientTemp;
        const rise = tempF - base;
        const maxRise = 25;
        const t = Math.min(1, Math.max(0, rise / maxRise));

        const r = Math.round(0 + 255 * t);
        const g = Math.round(100 + (50 - 100) * t);
        const b = Math.round(255 - 255 * t);
        return `rgb(${r},${g},${b})`;
    };

    const getTextColor = (tempF: number) => {
        return 'text-white/95';
    };

    // Wind orientation: 0° = from Chiller 1 side (right), 45° = diagonal 1→20, 90° = perpendicular to row 0 (from top)
    const windOrientation = Math.min(90, Math.max(0, inputs.windDirection));
    const colGapPx = Math.max(inputs.colSpacing * 3, 10);
    const rowGapPx = Math.max(inputs.rowSpacing * 3, 10);
    const containerPaddingPx = Math.max(inputs.colSpacing * 4, 80);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full relative select-none bg-zinc-900/50">
            
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 text-[10px] text-zinc-500">
                <span>{inputs.eftBase ? 'EFT Base: ON' : 'EFT Base: OFF'}</span>
                <span className="text-zinc-700">·</span>
                <span>{inputs.fanExtension ? 'Ext: ON' : 'Ext: OFF'}</span>
            </div>

            <WindIndicatorTopRight
                windOrientation={windOrientation}
                windSpeed={inputs.windSpeed}
                onWindDirectionChange={onWindDirectionChange}
            />

            {/* Main diagram: minimal container */}
            <div 
                className="relative max-w-full max-h-full overflow-auto"
                style={{ padding: `${containerPaddingPx}px` }}
            >
                <div className="absolute left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-zinc-600 font-bold tracking-[0.2em] uppercase whitespace-nowrap">
                    Row Index
                </div>
                
                <div
                    className="grid transition-all duration-300 ease-out"
                    style={{
                        gridTemplateColumns: `repeat(4, minmax(0, 1fr))`,
                        columnGap: `${colGapPx}px`,
                        rowGap: `${rowGapPx}px`,
                    }}
                >
                    {data.grid.map((node) => {
                        const tempF = node.totalTemp;
                        const displayTemp = tempUnit === 'K' ? fToK(tempF) : tempF;
                        const unitLabel = tempUnit === 'K' ? ' K' : ' °F';
                        const Cell = layoutLocked ? 'div' : 'button';

                        /** * CORE LOGIC: Standard 1-2-3-4 columns
                         * index 0 (C1) -> Column 1 (Far Left)
                         * index 3 (C4) -> Column 4 (Far Right)
                         */
                        const colPos = (node.index % 4) + 1;
                        const rowPos = Math.floor(node.index / 4) + 1;

                        return (
                            <div 
                                key={node.id} 
                                className="relative flex flex-col items-center group"
                                style={{ 
                                    gridColumnStart: colPos, 
                                    gridRowStart: rowPos 
                                }}
                            >
                                <Cell
                                    {...(!layoutLocked && { onClick: () => onToggleNode(node.index) })}
                                    className={`
                                        w-24 h-8 md:w-32 md:h-10 lg:w-40 lg:h-12
                                        transition-all duration-300
                                        flex flex-col items-center justify-center 
                                        relative rounded-sm overflow-hidden
                                        ${node.isActive 
                                            ? layoutLocked ? 'shadow-sm' : 'shadow-sm hover:scale-105 hover:z-10'
                                            : 'border border-dashed border-zinc-700/50 bg-zinc-900/20'
                                        }
                                        ${!layoutLocked && !node.isActive ? 'hover:bg-zinc-800/50' : ''}
                                        ${layoutLocked ? 'cursor-default' : ''}
                                    `}
                                    style={{ 
                                        backgroundColor: node.isActive ? getThermalColor(tempF) : undefined 
                                    }}
                                >
                                    <span className="absolute left-1 top-1 z-20 min-w-[14px] rounded bg-black/50 px-1 text-center text-[10px] font-bold font-mono text-white shadow-sm" title={`API: ${getChillerLabel(getApiChillerNumberForDisplayIndex(node.index) - 1)}`}>
                                        {getApiChillerNumberForDisplayIndex(node.index)}
                                    </span>
                                    {node.isActive ? (
                                        <span className={`text-xs md:text-sm font-bold drop-shadow-sm font-mono relative z-10 ${getTextColor(tempF)}`}>
                                            {displayTemp.toFixed(1)}{unitLabel}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest pointer-events-none">
                                            OFF
                                        </span>
                                    )}
                                </Cell>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend: intake temp only */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Intake temp</span>
                <span className="text-[9px] font-mono text-zinc-400">{tempUnit === 'K' ? fToK(inputs.ambientTemp).toFixed(1) : inputs.ambientTemp}</span>
                <div className="w-28 h-2 rounded-sm" style={{ background: 'linear-gradient(to right, rgb(0,100,255), rgb(255,50,0))' }} />
                <span className="text-[9px] font-mono text-zinc-400">{tempUnit === 'K' ? fToK(inputs.ambientTemp + 25).toFixed(1) : inputs.ambientTemp + 25}</span>
            </div>
        </div>
    );
};

export default HeatmapGrid;