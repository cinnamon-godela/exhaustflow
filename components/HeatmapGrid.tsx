import React from 'react';
import { SimulationResult, SimulationInputs } from '../types';
import { MoveRight } from 'lucide-react';

interface HeatmapGridProps {
    data: SimulationResult;
    inputs: SimulationInputs;
    onToggleNode: (index: number) => void;
}

const HeatmapGrid: React.FC<HeatmapGridProps> = ({ data, inputs, onToggleNode }) => {
    
    // RELATIVE COLOR SCALE
    const getThermalColor = (tempF: number) => {
        const base = inputs.ambientTemp;
        const stops: [number, number, number, number][] = [
            [base + 0, 0, 0, 100],      
            [base + 2, 0, 0, 255],      
            [base + 5, 0, 255, 255],    
            [base + 8, 0, 255, 0],      
            [base + 12, 255, 255, 0],   
            [base + 18, 255, 140, 0],   
            [base + 25, 255, 0, 0],     
            [base + 35, 100, 0, 0]      
        ];

        let lower = stops[0];
        let upper = stops[stops.length - 1];

        if (tempF <= lower[0]) return `rgb(${lower[1]},${lower[2]},${lower[3]})`;
        if (tempF >= upper[0]) return `rgb(${upper[1]},${upper[2]},${upper[3]})`;

        for (let i = 0; i < stops.length - 1; i++) {
            if (tempF >= stops[i][0] && tempF <= stops[i+1][0]) {
                lower = stops[i];
                upper = stops[i+1];
                break;
            }
        }

        const t = (tempF - lower[0]) / (upper[0] - lower[0]);
        const r = Math.round(lower[1] + (upper[1] - lower[1]) * t);
        const g = Math.round(lower[2] + (upper[2] - lower[2]) * t);
        const b = Math.round(lower[3] + (upper[3] - lower[3]) * t);

        return `rgb(${r},${g},${b})`;
    };

    const getTextColor = (tempF: number) => {
        const rise = tempF - inputs.ambientTemp;
        if (rise < 4 || rise > 15) return 'text-white/90';
        return 'text-black/80';
    };

    const flowRotation = inputs.windDirection;
    const colGapPx = Math.max(inputs.colSpacing * 3, 10);
    const rowGapPx = Math.max(inputs.rowSpacing * 3, 10);
    const containerPaddingPx = Math.max(inputs.colSpacing * 4, 80);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full relative select-none bg-zinc-900/50">
            
            {/* Title Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/80 px-4 py-1 rounded border border-zinc-700 text-zinc-300 font-bold tracking-widest text-sm uppercase flex gap-2 z-10">
                <span>{inputs.eftBase ? "EFT Base: ON" : "EFT Base: OFF"}</span>
                <span className="text-zinc-600">|</span>
                <span>{inputs.fanExtension ? "Ext: ON" : "Ext: OFF"}</span>
            </div>

            {/* Wind Indicator */}
            <div className="absolute top-6 right-6 flex flex-col items-center gap-2 z-20 pointer-events-none">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Flow Vector</span>
                <div 
                    className="transition-transform duration-300 ease-out"
                    style={{ transform: `rotate(${flowRotation}deg)` }}
                >
                    <div className="bg-zinc-800/80 backdrop-blur p-3 rounded-full border border-zinc-600 shadow-2xl">
                            <MoveRight size={24} className="text-blue-400" />
                    </div>
                </div>
                <div className="text-xs font-mono text-zinc-400 border border-zinc-700 bg-zinc-900 px-2 py-0.5 rounded">{inputs.windDirection}°</div>
            </div>

            {/* Main Diagram */}
            <div 
                className="relative bg-[#18181b] rounded-xl border border-[#27272a] shadow-2xl transition-all max-w-full max-h-full overflow-auto"
                style={{ padding: `${containerPaddingPx}px` }}
            >
                {/* Labels */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-zinc-600 font-bold tracking-[0.2em] uppercase whitespace-nowrap">
                    Row Index
                </div>
                
                {/* Dynamic Grid */}
                <div 
                    className="grid transition-all duration-300 ease-out"
                    style={{
                        gridTemplateColumns: `repeat(${inputs.columns}, minmax(0, 1fr))`,
                        columnGap: `${colGapPx}px`,
                        rowGap: `${rowGapPx}px`
                    }}
                >
                    {data.grid.map((node) => {
                        const tempF = node.totalTemp;
                        return (
                            <div key={node.id} className="relative flex flex-col items-center group">
                                <button
                                    onClick={() => onToggleNode(node.index)}
                                    className={`
                                        w-24 h-8 md:w-32 md:h-10 lg:w-40 lg:h-12
                                        transition-all duration-300
                                        flex flex-col items-center justify-center 
                                        relative rounded-sm overflow-hidden
                                        ${node.isActive 
                                            ? 'shadow-lg hover:scale-105 hover:z-10 border border-black/10' 
                                            : 'border border-dashed border-zinc-700 bg-zinc-900/30 hover:bg-zinc-800/50'
                                        }
                                        ${node.status === 'LockedOut' ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-black' : ''}
                                    `}
                                    style={{ 
                                        backgroundColor: node.isActive ? getThermalColor(tempF) : undefined 
                                    }}
                                >
                                    {node.isActive ? (
                                        <>
                                            <span className={`text-xs md:text-sm font-bold drop-shadow-sm font-mono relative z-10 ${getTextColor(tempF)}`}>
                                                {tempF.toFixed(1)} °F
                                            </span>
                                            
                                            {/* Locked Out Overlay */}
                                            {node.status === 'LockedOut' && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-0">
                                                    <div className="w-full h-[1px] bg-red-500 absolute rotate-45" />
                                                    <div className="w-full h-[1px] bg-red-500 absolute -rotate-45" />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest pointer-events-none">
                                            OFF
                                        </span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend - Dynamic based on Ambient */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 bg-zinc-900/90 backdrop-blur px-5 py-3 rounded-xl border border-zinc-700 shadow-2xl z-20">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Intake Temperature (°F)</span>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-400 font-mono">{inputs.ambientTemp}</span>
                    <div className="w-64 h-4 rounded-sm border border-white/10" 
                         style={{ background: 'linear-gradient(to right, #000064, #0000ff, #00ffff, #00ff00, #ffff00, #ff8c00, #ff0000)' }}>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">{inputs.ambientTemp + 25}+</span>
                </div>
            </div>
            
        </div>
    );
};

export default HeatmapGrid;