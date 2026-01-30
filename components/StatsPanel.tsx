import React from 'react';
import { SimulationResult } from '../types';
import { AlertTriangle, CheckCircle, Activity, Thermometer, BarChart3 } from 'lucide-react';

interface StatsPanelProps {
    data: SimulationResult;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ data }) => {
    
    const getRiskColor = (risk: string) => {
        switch(risk) {
            case 'Critical': return 'text-red-400 border-red-500/30 bg-red-500/10';
            case 'High': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
            case 'Moderate': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
            default: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
        }
    };

    return (
        <div className="grid grid-cols-3 gap-4">
            
            <div className="bg-[#18181b] p-3 rounded-lg border border-[#27272a] flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-1 relative z-10">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Peak Intake</span>
                    <Thermometer size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
                <div className="flex items-baseline gap-1 relative z-10">
                    <span className="text-2xl font-bold text-zinc-100">{data.maxTotalTemp}</span>
                    <span className="text-xs text-zinc-500">°C</span>
                </div>
            </div>

            <div className="bg-[#18181b] p-3 rounded-lg border border-[#27272a] flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-1 relative z-10">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Avg Rise</span>
                    <BarChart3 size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
                <div className="flex items-baseline gap-1 relative z-10">
                    <span className="text-2xl font-bold text-zinc-100">{data.avgTempRise}</span>
                    <span className="text-xs text-zinc-500">°C</span>
                </div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-center ${getRiskColor(data.riskLevel)}`}>
                <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Risk Status</span>
                     {data.riskLevel === 'Low' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                </div>
                <div className="flex items-center mt-1">
                    <span className="text-lg font-bold tracking-tight">{data.riskLevel}</span>
                </div>
            </div>

        </div>
    );
};

export default StatsPanel;