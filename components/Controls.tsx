import React, { useEffect, useState } from 'react';
import { SimulationInputs } from '../types';
import { Wind, Thermometer, ArrowUpRight, Ruler, Grid3X3, Sun, Activity, Settings2, ShieldCheck, Fan, LayoutGrid, Maximize } from 'lucide-react';

interface ControlsProps {
    inputs: SimulationInputs;
    onChange: (newInputs: SimulationInputs) => void;
    onResetLayout: () => void;
}

const Controls: React.FC<ControlsProps> = ({ inputs, onChange, onResetLayout }) => {
    
    const handleChange = (key: keyof SimulationInputs, value: number | boolean) => {
        onChange({ ...inputs, [key]: value });
    };

    const ControlRow = ({ 
        label, icon: Icon, value, min, max, step, unit, field 
    }: { 
        label: string, icon: any, value: number, min: number, max: number, step: number, unit: string, field: keyof SimulationInputs 
    }) => {
        const [localValue, setLocalValue] = useState(value.toString());

        useEffect(() => {
            setLocalValue(value.toString());
        }, [value]);

        const handleBlur = () => {
            let val = parseFloat(localValue);
            if (isNaN(val)) val = min;
            val = Math.min(Math.max(val, min), max);
            handleChange(field, val);
            setLocalValue(val.toString());
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleBlur();
                (e.target as HTMLInputElement).blur();
            }
        };

        const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newVal = parseFloat(e.target.value);
            setLocalValue(newVal.toString());
            handleChange(field, newVal);
        };

        return (
            <div className="group flex flex-col gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.05]">
                <div className="flex justify-between items-center">
                    <label className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors flex items-center gap-2 uppercase tracking-wide">
                        <Icon size={12} className="text-zinc-600 group-hover:text-zinc-500" /> {label}
                    </label>
                    <div className="flex items-center gap-1">
                        <input 
                            type="number"
                            value={localValue}
                            onChange={(e) => setLocalValue(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className="w-16 bg-transparent text-right text-xs font-mono text-zinc-200 focus:text-blue-400 outline-none border-b border-transparent focus:border-blue-500/50 transition-all p-0.5 selection:bg-blue-500/30"
                        />
                        <span className="text-[10px] text-zinc-600 font-mono select-none w-6 text-right">{unit}</span>
                    </div>
                </div>
                
                {/* Slider */}
                <div className="h-6 flex items-center relative">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={typeof value === 'number' ? value : min}
                        onChange={onSliderChange}
                        className="
                            w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer
                            focus:outline-none focus:ring-1 focus:ring-blue-500/30
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-4
                            [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-zinc-300
                            [&::-webkit-slider-thumb]:border-2
                            [&::-webkit-slider-thumb]:border-[#18181b]
                            [&::-webkit-slider-thumb]:shadow-lg
                            [&::-webkit-slider-thumb]:transition-transform
                            hover:[&::-webkit-slider-thumb]:scale-110
                            hover:[&::-webkit-slider-thumb]:bg-white
                            active:[&::-webkit-slider-thumb]:scale-110
                            active:[&::-webkit-slider-thumb]:bg-blue-400
                        "
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#18181b] select-none">
            {/* BRANDING HEADER */}
            <div className="pt-5 pb-3 px-5 border-b border-[#27272a] bg-[#18181b] flex flex-col">
                <div className="flex items-start gap-2.5">
                    {/* Logo */}
                     <div className="mt-1 relative w-8 h-8 flex-shrink-0 text-[#0070f3]">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                             <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                            <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 12.9598 6.22537 13.867 6.62608 14.6715" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-50"/>
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex flex-col leading-none">
                            <span className="text-[17px] font-bold italic text-zinc-100 tracking-tight">ExhaustFlow</span>
                            <span className="text-[17px] font-light italic text-zinc-100 tracking-tight -mt-0.5">Technologies</span>
                        </div>
                         <span className="text-[10px] text-[#0070f3] font-medium tracking-widest uppercase mt-1 ml-auto">Simple Science</span>
                    </div>
                </div>
            </div>

            {/* Sub Header */}
            <div className="h-8 min-h-[32px] flex items-center gap-2 px-6 border-b border-[#27272a] bg-[#1a1a1e]">
                <Settings2 size={12} className="text-zinc-600" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Model Configuration</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin">
                
                {/* Hardware Modification Section */}
                 <div className="space-y-3">
                    <div className="px-3 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        <ShieldCheck size={10} /> Hardware Config
                    </div>

                    {/* EFT Base Toggle */}
                    <div 
                        onClick={() => handleChange('eftBase', !inputs.eftBase)}
                        className={`
                            mx-1 group relative p-3 rounded-xl border transition-all cursor-pointer
                            ${inputs.eftBase 
                                ? 'bg-emerald-950/10 border-emerald-900/50 hover:bg-emerald-950/20' 
                                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                            }
                        `}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold transition-colors ${inputs.eftBase ? "text-emerald-400" : "text-zinc-400"}`}>
                                    EFT Base Mitigation
                                </span>
                            </div>
                            <div className={`
                                w-8 h-4 rounded-full p-0.5 transition-colors duration-300
                                ${inputs.eftBase ? 'bg-emerald-600' : 'bg-zinc-700'}
                            `}>
                                <div className={`
                                    w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300
                                    ${inputs.eftBase ? 'translate-x-4' : 'translate-x-0'}
                                `} />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Vertical discharge base reduction strategy.
                        </p>
                    </div>

                    {/* Discharge Extension Toggle */}
                    <div 
                        onClick={() => handleChange('fanExtension', !inputs.fanExtension)}
                        className={`
                            mx-1 group relative p-3 rounded-xl border transition-all cursor-pointer
                            ${inputs.fanExtension 
                                ? 'bg-blue-950/10 border-blue-900/50 hover:bg-blue-950/20' 
                                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                            }
                        `}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Fan size={14} className={inputs.fanExtension ? "text-blue-500" : "text-zinc-600"}/>
                                <span className={`text-xs font-semibold transition-colors ${inputs.fanExtension ? "text-blue-400" : "text-zinc-400"}`}>
                                    Discharge Extension
                                </span>
                            </div>
                            <div className={`
                                w-8 h-4 rounded-full p-0.5 transition-colors duration-300
                                ${inputs.fanExtension ? 'bg-blue-600' : 'bg-zinc-700'}
                            `}>
                                <div className={`
                                    w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300
                                    ${inputs.fanExtension ? 'translate-x-4' : 'translate-x-0'}
                                `} />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                            12" extension w/ straightener. Increases plume height by ~4ft.
                        </p>
                    </div>
                </div>

                {/* Section: Geometry */}
                <div className="space-y-1">
                    <div className="px-3 mb-2 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        <LayoutGrid size={10} /> Array Geometry
                    </div>

                    <ControlRow 
                        label="Rows (Height)" 
                        icon={Grid3X3} 
                        value={inputs.rows} 
                        min={1} max={10} step={1} 
                        unit="qty" 
                        field="rows" 
                    />
                    <ControlRow 
                        label="Columns (Width)" 
                        icon={Grid3X3} 
                        value={inputs.columns} 
                        min={1} max={10} step={1} 
                        unit="qty" 
                        field="columns" 
                    />
                    <ControlRow 
                        label="Row Spacing" 
                        icon={Maximize} 
                        value={inputs.rowSpacing} 
                        min={5} max={50} step={0.5} 
                        unit="ft" 
                        field="rowSpacing" 
                    />
                    <ControlRow 
                        label="Col Spacing" 
                        icon={Maximize} 
                        value={inputs.colSpacing} 
                        min={5} max={50} step={0.5} 
                        unit="ft" 
                        field="colSpacing" 
                    />
                </div>

                {/* Section: Environment */}
                <div className="space-y-1">
                    <div className="px-3 mb-2 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        <Sun size={10} /> Environmental
                    </div>
                    
                    <ControlRow 
                        label="Ambient Temp" 
                        icon={Sun} 
                        value={inputs.ambientTemp} 
                        min={20} max={50} step={0.5} 
                        unit="°C" 
                        field="ambientTemp" 
                    />

                    <ControlRow 
                        label="Wind Speed" 
                        icon={Wind} 
                        value={inputs.windSpeed} 
                        min={0} max={20} step={0.1} 
                        unit="m/s" 
                        field="windSpeed" 
                    />

                    <ControlRow 
                        label="Wind Direction" 
                        icon={ArrowUpRight} 
                        value={inputs.windDirection} 
                        min={0} max={360} step={1} 
                        unit="°" 
                        field="windDirection" 
                    />
                </div>

                {/* Section: System */}
                <div className="space-y-1">
                    <div className="px-3 mb-2 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        <Activity size={10} /> System Specs
                    </div>

                    <ControlRow 
                        label="Flow Rate" 
                        icon={Thermometer} 
                        value={inputs.flowRate} 
                        min={30} max={200} step={1} 
                        unit="kCFM" 
                        field="flowRate" 
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[#27272a] bg-[#18181b]">
                <button 
                    onClick={onResetLayout}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium rounded-md transition-all border border-zinc-800 hover:border-zinc-700"
                >
                    <Grid3X3 size={12} />
                    Reset Grid Layout
                </button>
            </div>
        </div>
    );
};

export default Controls;