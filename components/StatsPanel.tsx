import React, { useState } from 'react';
import { SimulationResult, ChillerSpecs } from '../types';
import { Thermometer, BarChart3, ChevronDown, ArrowUpRight, ArrowDownRight, Activity, Percent } from 'lucide-react';

interface StatsPanelProps {
    data: SimulationResult;
    comparisonData: SimulationResult;
    isEftActive: boolean;
    chillerSpecs: ChillerSpecs;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ data, comparisonData, isEftActive, chillerSpecs }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Formatting
    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(Math.round(num));
    
    // Capacity Metrics
    const lossPct = data.capacity.capacityLossPct;
    const isEfficiencyGood = lossPct < 2.0;
    const isEfficiencyPoor = lossPct > 10.0;

    // Delta Logic
    // If EFT is OFF: We compare (Target: EFT ON) - (Current: EFT OFF) -> Potential Gain
    // If EFT is ON:  We compare (Current: EFT ON) - (Target: EFT OFF) -> Capacity Saved
    const currentCap = data.capacity.totalEffectiveCapacity;
    const otherCap = comparisonData.capacity.totalEffectiveCapacity;
    
    const capacityDelta = isEftActive 
        ? currentCap - otherCap // Saved vs baseline
        : otherCap - currentCap; // Potential gain vs baseline

    const deltaLabel = isEftActive ? "Capacity Preserved" : "Recovery Potential";

    return (
        <div className="flex flex-col gap-4">
            
            {/* TOP ROW: Primary KPIs */}
            <div className="grid grid-cols-3 gap-4">
                
                {/* 1. Peak Intake */}
                <div className="bg-[#18181b] p-3 rounded-lg border border-[#27272a] flex flex-col relative overflow-hidden group hover:border-zinc-600 transition-colors">
                    <div className="flex items-center justify-between mb-1 relative z-10">
                        <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Peak Intake</span>
                        <Thermometer size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-2xl font-bold text-zinc-100">{data.maxTotalTemp}</span>
                        <span className="text-xs text-zinc-500">°F</span>
                    </div>
                </div>

                {/* 2. Avg Rise */}
                <div className="bg-[#18181b] p-3 rounded-lg border border-[#27272a] flex flex-col relative overflow-hidden group hover:border-zinc-600 transition-colors">
                    <div className="flex items-center justify-between mb-1 relative z-10">
                        <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Avg Rise</span>
                        <BarChart3 size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-2xl font-bold text-zinc-100">{data.avgTempRise}</span>
                        <span className="text-xs text-zinc-500">°F</span>
                    </div>
                </div>

                {/* 3. CAPACITY IMPACT (Replaced Risk Status) */}
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="bg-[#18181b] p-3 rounded-lg border border-[#27272a] flex flex-col justify-center cursor-pointer hover:border-zinc-500 transition-all group"
                >
                    <div className="flex items-center justify-between mb-1">
                         <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            Recirculation Loss
                         </span>
                         <Percent size={14} className="text-zinc-600 group-hover:text-zinc-400" />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-bold ${isEfficiencyPoor ? 'text-orange-400' : isEfficiencyGood ? 'text-emerald-400' : 'text-zinc-200'}`}>
                                {lossPct.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-zinc-500 font-medium">
                                CAPACITY DERATED
                            </span>
                        </div>
                        <ChevronDown size={14} className={`text-zinc-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>

            {/* EXPANDABLE ANALYSIS PANEL */}
            <div className={`
                overflow-hidden transition-all duration-500 ease-in-out border border-[#27272a] bg-[#18181b]/95 backdrop-blur rounded-xl
                ${isExpanded ? 'max-h-[500px] opacity-100 mb-2 shadow-xl' : 'max-h-0 opacity-0 border-0'}
            `}>
                <div className="p-5 flex flex-col gap-5">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-zinc-400" />
                            <span className="text-sm font-bold text-zinc-200 tracking-wide uppercase">Capacity Efficiency Analysis</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                            RATED TOTAL: {formatNumber(data.capacity.totalRatedCapacity)} TONS
                        </div>
                    </div>

                    {/* Main Bar Chart */}
                    <div className="space-y-3">
                         <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-xs text-zinc-400">Effective Capacity</span>
                                <span className="text-xl font-bold text-white font-mono">
                                    {formatNumber(currentCap)} <span className="text-sm text-zinc-500">tons</span>
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-zinc-400">Recirculation Penalty</span>
                                <span className="text-sm font-bold text-orange-400 font-mono">
                                    -{formatNumber(data.capacity.totalRatedCapacity - currentCap)} tons
                                </span>
                            </div>
                        </div>
                        
                        {/* Bar */}
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                            <div 
                                className="h-full bg-zinc-400"
                                style={{ width: `${(currentCap / data.capacity.totalRatedCapacity) * 100}%` }}
                            />
                            <div 
                                className="h-full bg-orange-900/50"
                                style={{ width: `${100 - (currentCap / data.capacity.totalRatedCapacity) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* EFT Comparison / ROI Box */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                {isEftActive ? "EFT Performance" : "Projected EFT Impact"}
                            </h4>
                            <div className="text-xs text-zinc-400 max-w-[200px] leading-relaxed">
                                {isEftActive 
                                    ? "Discharge mitigation is actively recovering capacity." 
                                    : "Deploying EFT Base would reduce recirculation loss."}
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                             <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                {isEftActive ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                                <span className="text-lg font-bold">
                                    {formatNumber(Math.abs(capacityDelta))} tons
                                </span>
                             </div>
                             <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider">
                                {deltaLabel}
                             </span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default StatsPanel;