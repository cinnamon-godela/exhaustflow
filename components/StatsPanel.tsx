import React, { useState } from 'react';
import { SimulationResult, ChillerSpecs } from '../types';
import { ChevronDown, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface StatsPanelProps {
    data: SimulationResult;
    comparisonData: SimulationResult;
    isEftActive: boolean;
    chillerSpecs: ChillerSpecs;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ data, comparisonData, isEftActive }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(Math.round(num));
    
    const lossPct = data.capacity.capacityLossPct;
    const isEfficiencyGood = lossPct < 2.0;
    const isEfficiencyPoor = lossPct > 10.0;

    const currentCap = data.capacity.totalEffectiveCapacity;
    const otherCap = comparisonData.capacity.totalEffectiveCapacity;
    const capacityDelta = isEftActive ? currentCap - otherCap : otherCap - currentCap;
    const deltaLabel = isEftActive ? "Capacity Preserved" : "Recovery Potential";

    return (
        <div className="flex flex-col gap-2">
            {/* Compact metric strip — Apple-style: one bar, numbers forward */}
            <div className="flex items-center rounded-xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
                <div className="flex-1 flex items-center justify-around min-h-0 py-2 px-4 gap-6">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold tabular-nums text-zinc-100">{data.maxTotalTemp}</span>
                        <span className="text-[10px] text-zinc-500">°F</span>
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider ml-0.5">Peak</span>
                    </div>
                    <div className="w-px h-5 bg-zinc-700/80" />
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold tabular-nums text-zinc-100">{data.avgTempRise}</span>
                        <span className="text-[10px] text-zinc-500">°F</span>
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider ml-0.5">Avg rise</span>
                    </div>
                    <div className="w-px h-5 bg-zinc-700/80" />
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-baseline gap-1.5 hover:opacity-90 transition-opacity"
                    >
                        <span className={`text-lg font-semibold tabular-nums ${isEfficiencyPoor ? 'text-orange-400' : isEfficiencyGood ? 'text-emerald-400' : 'text-zinc-200'}`}>
                            {lossPct.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Loss</span>
                        <ChevronDown size={12} className={`text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Expandable: compact */}
            <div className={`
                overflow-hidden transition-all duration-300 ease-out rounded-lg border border-zinc-800/80 bg-zinc-900/60
                ${isExpanded ? 'max-h-[320px] opacity-100' : 'max-h-0 opacity-0 border-0'}
            `}>
                <div className="p-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Activity size={12} /> Capacity
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">Rated {formatNumber(data.capacity.totalRatedCapacity)} t</span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs">
                        <span className="text-zinc-300 font-medium">{formatNumber(currentCap)} t effective</span>
                        <span className="text-orange-400/90">−{formatNumber(data.capacity.totalRatedCapacity - currentCap)} t</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                        <div className="h-full bg-zinc-400" style={{ width: `${(currentCap / data.capacity.totalRatedCapacity) * 100}%` }} />
                        <div className="h-full bg-orange-900/50" style={{ width: `${100 - (currentCap / data.capacity.totalRatedCapacity) * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                        <span className="text-[10px] text-zinc-500">{isEftActive ? "EFT recovering capacity." : "EFT would reduce loss."}</span>
                        <span className="flex items-center gap-1 text-emerald-400/90">
                            {isEftActive ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                            <span className="text-xs font-semibold">{formatNumber(Math.abs(capacityDelta))} t</span>
                            <span className="text-[10px] text-emerald-600/80">{deltaLabel}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPanel;