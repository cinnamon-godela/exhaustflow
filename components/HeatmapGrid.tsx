import React from 'react';
import { SimulationResult, SimulationInputs } from '../types';
import { MoveRight } from 'lucide-react';

/** Convert °F to Kelvin */
const fToK = (f: number) => (f - 32) * (5 / 9) + 273.15;

interface HeatmapGridProps {
    data: SimulationResult;
    inputs: SimulationInputs;
    onToggleNode: (index: number) => void;
    /** When true, cells are read-only (no toggle); used for fixed 5×4 array. */
    layoutLocked?: boolean;
    /** Display temperatures in °F or K */
    tempUnit?: 'F' | 'K';
}

const HeatmapGrid: React.FC<HeatmapGridProps> = ({ data, inputs, onToggleNode, layoutLocked = false, tempUnit = 'F' }) => {
    
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

    const flowRotation = inputs.windDirection;
    const colGapPx = Math.max(inputs.colSpacing * 3, 10);
    const rowGapPx = Math.max(inputs.rowSpacing * 3, 10);
    const containerPaddingPx = Math.max(inputs.colSpacing * 4, 80);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full relative select-none bg-zinc-900/50">
            
            {/* Title Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
                <div className="bg-zinc-900/80 px-4 py-1 rounded border border-zinc-700 text-zinc-300 font-bold tracking-widest text-sm uppercase flex gap-2">
                    <span>{inputs.eftBase ? "EFT Base: ON" : "EFT Base: OFF"}</span>
                    <span className="text-zinc-600">|</span>
                    <span>{inputs.fanExtension ? "Ext: ON" : "Ext: OFF"}</span>
                </div>
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Baseline data: EFT Base ON</span>
            </div>

            {/* Wind Indicator */}
            <div className="absolute top-6 right-6 flex flex-col items-center gap-2 z-20 pointer-events-none">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Flow Vector</span>
                <div 
                    className="transition-transform duration-300 ease-out"
                    style={{ transform: `rotate(${flowRotation}deg)` }}
                >
                    <div className="bg-zinc-800/80 backdrop-blur p-3 rounded-full border border-zinc-600 shadow-2xl">
                            <MoveRight size={24} className="text-yellow-400" />
                    </div>
                </div>
                <div className="text-xs font-mono text-zinc-400 border border-zinc-700 bg-zinc-900 px-2 py-0.5 rounded">{inputs.windDirection}°</div>
            </div>

            {/* Main Diagram */}
            <div 
                className="relative bg-[#18181b] rounded-xl border border-[#27272a] shadow-2xl transition-all max-w-full max-h-full overflow-auto"
                style={{ padding: `${containerPaddingPx}px` }}
            >
                {/* Visual Column Labels (4 3 2 1) */}
                <div className="absolute top-8 left-0 right-0 flex justify-around px-20 pointer-events-none">
                    {[4, 3, 2, 1].map(num => (
                        <span key={num} className="text-red-500 font-bold text-lg">{num}</span>
                    ))}
                </div>

                {/* Labels */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-zinc-600 font-bold tracking-[0.2em] uppercase whitespace-nowrap">
                    Row Index
                </div>
                
                {/* The Fixed 5x4 Grid */}
                <div 
                    className="grid transition-all duration-300 ease-out"
                    style={{
                        // Forces 4 columns as per your physical layout
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

                        /** * CORE FIX: Explicitly set gridColumn and gridRow based on ID
                         * Chiller 1 (index 0) -> Column 4, Row 1
                         * Chiller 4 (index 3) -> Column 1, Row 1
                         * This forces the 4 3 2 1 RTL layout visually.
                         */
                        const colPos = 4 - (node.index % 4);
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
                                            ? layoutLocked ? 'shadow-lg border border-black/10' : 'shadow-lg hover:scale-105 hover:z-10 border border-black/10'
                                            : 'border border-dashed border-zinc-700 bg-zinc-900/30'
                                        }
                                        ${!layoutLocked && !node.isActive ? 'hover:bg-zinc-800/50' : ''}
                                        ${layoutLocked ? 'cursor-default' : ''}
                                    `}
                                    style={{ 
                                        backgroundColor: node.isActive ? getThermalColor(tempF) : undefined 
                                    }}
                                >
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

            {/* Legend */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 bg-zinc-900/90 backdrop-blur px-5 py-3 rounded-xl border border-zinc-700 shadow-2xl z-20">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                    Intake temp ({tempUnit === 'K' ? 'K' : '°F'})
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-400 font-mono">
                        {tempUnit === 'K' ? fToK(inputs.ambientTemp).toFixed(1) : inputs.ambientTemp}
                    </span>
                    <div className="w-40 h-3 rounded-sm border border-white/10" 
                         style={{ background: 'linear-gradient(to right, rgb(0,100,255), rgb(255,50,0))' }}>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                        {tempUnit === 'K' ? fToK(inputs.ambientTemp + 25).toFixed(1) : inputs.ambientTemp + 25}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default HeatmapGrid;