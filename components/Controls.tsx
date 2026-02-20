import React, { useEffect, useState } from 'react';
import { SimulationInputs, ChillerSpecs } from '../types';
import type { InputRanges } from '../services/datasetRanges';
import { clamp } from '../services/datasetRanges';
import { Wind, Thermometer, ArrowUpRight, Grid3X3, Sun, Activity, ShieldCheck, Fan, LayoutGrid, Maximize, Database, Cpu, ChevronDown, ChevronRight, Type, Hash } from 'lucide-react';

interface ControlsProps {
    inputs: SimulationInputs;
    chillerSpecs: ChillerSpecs;
    onChange: (newInputs: SimulationInputs) => void;
    onSpecsChange: (newSpecs: ChillerSpecs) => void;
    onResetLayout: () => void;
    onOpenHistory: () => void;
    fixedArrayRows: number;
    fixedArrayCols: number;
    /** Ranges from the loaded dataset; when set, the four inputs are confined to these bounds */
    inputRanges?: InputRanges;
    /** Load a single row by DB ID and reverse-populate the four inputs (debugging) */
    onLoadById?: (id: string | number) => void;
    isLoadingById?: boolean;
    loadByIdError?: string | null;
    /** Clear the "viewing by ID" override when user edits the four inputs */
    onClearOverride?: () => void;
    /** Run/record ID the current results are mapped to (shown when using Quick Input) */
    matchedRunId?: string | number | null;
}

const Controls: React.FC<ControlsProps> = ({ inputs, chillerSpecs, onChange, onSpecsChange, onResetLayout, onOpenHistory, fixedArrayRows, fixedArrayCols, inputRanges, onLoadById, isLoadingById, loadByIdError, onClearOverride, matchedRunId }) => {
    
    const [isSpecsExpanded, setIsSpecsExpanded] = useState(false);
    const [isGeometryExpanded, setIsGeometryExpanded] = useState(false);
    const [isEnvExpanded, setIsEnvExpanded] = useState(false);
    const [isQuickInputExpanded, setIsQuickInputExpanded] = useState(true);
    const [isLoadByIdExpanded, setIsLoadByIdExpanded] = useState(false);
    const [loadByIdInput, setLoadByIdInput] = useState('');

    // Quick Input: local text values; sync from inputs. CFM shown as CFM (not kCFM).
    const [quickWindSpeed, setQuickWindSpeed] = useState(inputs.windSpeed.toString());
    const [quickFlowRate, setQuickFlowRate] = useState((inputs.flowRate * 1000).toString());
    const [quickOrientation, setQuickOrientation] = useState(inputs.windDirection.toString());
    const [quickRowSpacing, setQuickRowSpacing] = useState(inputs.rowSpacing.toString());
    useEffect(() => {
        setQuickWindSpeed(inputs.windSpeed.toString());
        setQuickFlowRate((inputs.flowRate * 1000).toString()); // keep Quick Input in CFM
        setQuickOrientation(inputs.windDirection.toString());
        setQuickRowSpacing(inputs.rowSpacing.toString());
    }, [inputs.windSpeed, inputs.flowRate, inputs.windDirection, inputs.rowSpacing]);

    const handleChange = (key: keyof SimulationInputs, value: number | boolean) => {
        if (key === 'windSpeed' || key === 'flowRate' || key === 'windDirection' || key === 'rowSpacing') {
            onClearOverride?.();
        }
        onChange({ ...inputs, [key]: value });
    };

    const handleSpecChange = (key: keyof ChillerSpecs, value: number) => {
        onSpecsChange({ ...chillerSpecs, [key]: value });
    };

    const ControlRow = ({ 
        label, icon: Icon, value, min, max, step, unit, onChangeVal, disabled = false 
    }: { 
        label: string, icon: any, value: number, min: number, max: number, step: number, unit: string, onChangeVal: (val: number) => void, disabled?: boolean 
    }) => {
        const [localValue, setLocalValue] = useState(value.toString());
        const [isDragging, setIsDragging] = useState(false);

        useEffect(() => {
            if (!isDragging) {
                setLocalValue(value.toString());
            }
        }, [value, isDragging]);

        const commitChange = (valStr: string) => {
            if (disabled) return;
            let val = parseFloat(valStr);
            if (isNaN(val)) val = min;
            val = Math.min(Math.max(val, min), max);
            onChangeVal(val);
        };

        const handleBlur = () => {
            setIsDragging(false);
            commitChange(localValue);
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleBlur();
                (e.target as HTMLInputElement).blur();
            }
        };

        const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (disabled) return;
            setLocalValue(e.target.value);
            setIsDragging(true);
        };

        const onSliderRelease = () => {
            setIsDragging(false);
            commitChange(localValue);
        };

        return (
            <div className={`group flex flex-col gap-3 p-3 rounded-lg transition-colors border border-transparent ${disabled ? 'opacity-50 pointer-events-none' : 'hover:bg-white/[0.02] hover:border-white/[0.05]'}`}>
                <div className="flex justify-between items-center">
                    <label className={`text-[11px] font-medium flex items-center gap-2 uppercase tracking-wide ${disabled ? 'text-zinc-500' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                        <Icon size={12} className={disabled ? 'text-zinc-600' : 'text-zinc-600 group-hover:text-zinc-500'} /> {label}
                    </label>
                    <div className="flex items-center gap-1">
                        <input 
                            type="number"
                            value={localValue}
                            onChange={(e) => !disabled && setLocalValue(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            disabled={disabled}
                            readOnly={disabled}
                            className="w-16 bg-transparent text-right text-xs font-mono text-zinc-200 focus:text-yellow-400 outline-none border-b border-transparent focus:border-yellow-500/50 transition-all p-0.5 selection:bg-yellow-500/30 disabled:opacity-70"
                        />
                        <span className="text-[10px] text-zinc-600 font-mono select-none w-6 text-right">{unit}</span>
                    </div>
                </div>
                
                <div className="h-6 flex items-center relative">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={localValue}
                        onChange={onSliderChange}
                        onPointerUp={onSliderRelease}
                        onTouchEnd={onSliderRelease}
                        disabled={disabled}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-yellow-500/30 disabled:opacity-60 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#18181b] [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 hover:[&::-webkit-slider-thumb]:bg-white active:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:bg-yellow-400 disabled:[&::-webkit-slider-thumb]:cursor-not-allowed"
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#18181b] select-none">
            {/* BRANDING HEADER */}
            <div className="pt-5 pb-3 px-5 border-b border-[#27272a] bg-[#18181b] flex flex-col">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-1.5 min-w-0">
                        <div className="mt-0.5 relative w-8 h-8 flex-shrink-0 text-[#0070f3]">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                                <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 12.9598 6.22537 13.867 6.62608 14.6715" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-50"/>
                            </svg>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex flex-col leading-none">
                                <span className="text-[17px] font-bold italic text-zinc-100 tracking-tight">ExhaustFlow</span>
                                <span className="text-[17px] font-light italic text-zinc-100 tracking-tight -mt-0.5">Technologies</span>
                            </div>
                            <span className="text-[10px] text-[#0070f3] font-medium tracking-widest uppercase mt-1">Simple Science</span>
                        </div>
                    </div>
                <button 
                    onClick={onOpenHistory}
                    className="text-zinc-500 hover:text-yellow-400 transition-colors p-1 shrink-0"
                    title="Load/Save History"
                >
                    <Database size={14} />
                </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin">
                
                {/* Hardware Modification Section — greyed out (data-driven config only) */}
                 <div className="space-y-3 opacity-50 pointer-events-none">
                    <div className="px-3 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        <ShieldCheck size={10} /> Hardware Config
                    </div>

                    {/* EFT Base Toggle */}
                    <div 
                        className={`
                            mx-1 group relative p-3 rounded-xl border transition-all cursor-not-allowed
                            ${inputs.eftBase 
                                ? 'bg-emerald-950/10 border-emerald-900/50' 
                                : 'bg-zinc-900/50 border-zinc-800'
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
                            Vertical discharge technology.
                            <br/>
                            <span className={inputs.eftBase ? "text-emerald-500/80 font-medium" : ""}>
                                • Maximizes Flow Uniformity
                            </span>
                            <br/>
                            <span className={inputs.eftBase ? "text-emerald-500/80 font-medium" : ""}>
                                • Increases Capacity (up to 25%)
                            </span>
                        </p>
                    </div>

                    {/* Discharge Extension Toggle */}
                    <div 
                        className={`
                            mx-1 group relative p-3 rounded-xl border transition-all cursor-not-allowed
                            ${inputs.fanExtension 
                                ? 'bg-yellow-950/10 border-yellow-900/50' 
                                : 'bg-zinc-900/50 border-zinc-800'
                            }
                        `}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Fan size={14} className={inputs.fanExtension ? "text-yellow-500" : "text-zinc-600"}/>
                                <span className={`text-xs font-semibold transition-colors ${inputs.fanExtension ? "text-yellow-400" : "text-zinc-400"}`}>
                                    Discharge Extension
                                </span>
                            </div>
                            <div className={`
                                w-8 h-4 rounded-full p-0.5 transition-colors duration-300
                                ${inputs.fanExtension ? 'bg-yellow-500' : 'bg-zinc-700'}
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

                {/* Section: Quick Input — type the four variables and find nearest match */}
                <div className="space-y-1">
                    <button 
                        onClick={() => setIsQuickInputExpanded(!isQuickInputExpanded)}
                        className="w-full px-3 mb-2 flex items-center justify-between group hover:bg-zinc-800/50 rounded py-1 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 uppercase tracking-widest transition-colors">
                            <Type size={10} /> Quick Input
                        </div>
                        {isQuickInputExpanded 
                            ? <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" /> 
                            : <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                        }
                    </button>

                    {isQuickInputExpanded && (
                        <div className="animate-in slide-in-from-top-2 fade-in duration-200 p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-3">
                            <p className="text-[10px] text-zinc-500">
                                Enter wind speed (m/s), CFM, wind direction (°), and row spacing (ft). Then apply to see intake temperatures across the chiller grid.
                            </p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Wind Speed</label>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={quickWindSpeed}
                                            onChange={(e) => setQuickWindSpeed(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (document.getElementById('quick-input-apply') as HTMLButtonElement)?.click(); } }}
                                            step={0.1}
                                            className="w-full bg-zinc-800/80 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-200 focus:border-yellow-500/50 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">m/s</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">CFM</label>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={quickFlowRate}
                                            onChange={(e) => setQuickFlowRate(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (document.getElementById('quick-input-apply') as HTMLButtonElement)?.click(); } }}
                                            step={1}
                                            placeholder="e.g. 67890"
                                            title="CFM (e.g. 67890); or kCFM if &lt; 1000"
                                            className="w-full bg-zinc-800/80 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-200 focus:border-yellow-500/50 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">CFM</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Orientation</label>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={quickOrientation}
                                            onChange={(e) => setQuickOrientation(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (document.getElementById('quick-input-apply') as HTMLButtonElement)?.click(); } }}
                                            step={1}
                                            className="w-full bg-zinc-800/80 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-200 focus:border-yellow-500/50 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">°</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Row Spacing</label>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={quickRowSpacing}
                                            onChange={(e) => setQuickRowSpacing(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (document.getElementById('quick-input-apply') as HTMLButtonElement)?.click(); } }}
                                            step={0.5}
                                            className="w-full bg-zinc-800/80 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-200 focus:border-yellow-500/50 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">ft</span>
                                    </div>
                                </div>
                            </div>
                            {!inputRanges && (
                                <p className="text-[10px] text-amber-500/90">Loading data ranges…</p>
                            )}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (!inputRanges) return;
                                    const windSpeed = clamp(parseFloat(quickWindSpeed) || 0, inputRanges.windSpeed.min, inputRanges.windSpeed.max);
                                    const flowInput = parseFloat(quickFlowRate) || 0;
                                    const flowRate = flowInput >= 1000 ? flowInput / 1000 : flowInput; // Quick Input is CFM → kCFM for state
                                    const flowRateClamped = clamp(flowRate, inputRanges.flowRateKcfm.min, inputRanges.flowRateKcfm.max);
                                    const windDirection = clamp(parseFloat(quickOrientation) || 0, inputRanges.orientation.min, inputRanges.orientation.max);
                                    const rowSpacingRaw = clamp(parseFloat(quickRowSpacing) || 0, inputRanges.rowSpacing.min, inputRanges.rowSpacing.max);
                                    const rowSpacing = Math.round(rowSpacingRaw * 2) / 2; // snap to 0.5 ft
                                    onClearOverride?.();
                                    onChange({ ...inputs, windSpeed, flowRate: flowRateClamped, windDirection, rowSpacing });
                                }}
                            >
                                <button
                                    id="quick-input-apply"
                                    type="submit"
                                    disabled={!inputRanges}
                                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors border border-blue-500/50 disabled:border-zinc-700"
                                >
                                    Simulate
                                </button>
                                {matchedRunId != null && (
                                    <div className="pt-2 border-t border-zinc-800/80">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Results from run ID </span>
                                        <span className="text-[10px] font-mono text-zinc-300 font-medium">{matchedRunId}</span>
                                    </div>
                                )}
                            </form>
                        </div>
                    )}
                </div>

                {/* Section: Load by ID — fetch one row by DB ID and reverse-populate inputs (debugging) */}
                {onLoadById != null && (
                    <div className="space-y-1">
                        <button 
                            onClick={() => setIsLoadByIdExpanded(!isLoadByIdExpanded)}
                            className="w-full px-3 mb-2 flex items-center justify-between group hover:bg-zinc-800/50 rounded py-1 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 uppercase tracking-widest transition-colors">
                                <Hash size={10} /> Load by ID
                            </div>
                            {isLoadByIdExpanded 
                                ? <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" /> 
                                : <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                            }
                        </button>
                        {isLoadByIdExpanded && (
                            <div className="animate-in slide-in-from-top-2 fade-in duration-200 p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-3">
                                <p className="text-[10px] text-zinc-500">
                                    Enter a scenario ID (1–44849) to load that configuration and view its results.
                                </p>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Scenario ID</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={loadByIdInput}
                                            onChange={(e) => setLoadByIdInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = loadByIdInput.trim(); if (v) onLoadById(v); } }}
                                            placeholder="e.g. 12345"
                                            className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-200 focus:border-yellow-500/50 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            disabled={isLoadingById || !loadByIdInput.trim()}
                                            onClick={() => onLoadById(loadByIdInput.trim())}
                                            className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors border border-emerald-500/50"
                                        >
                                            {isLoadingById ? (
                                                <>
                                                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Load…
                                                </>
                                            ) : (
                                                'Load'
                                            )}
                                        </button>
                                    </div>
                                </div>
                                {loadByIdError && (
                                    <p className="text-[10px] text-amber-400" role="alert">{loadByIdError}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Section: Equipment Specs (NEW) */}
                <div className="space-y-1">
                    <button 
                        onClick={() => setIsSpecsExpanded(!isSpecsExpanded)}
                        className="w-full px-3 mb-2 flex items-center justify-between group hover:bg-zinc-800/50 rounded py-1 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 uppercase tracking-widest transition-colors">
                            <Cpu size={10} /> Equipment Specs
                        </div>
                        {isSpecsExpanded 
                            ? <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" /> 
                            : <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                        }
                    </button>

                    {isSpecsExpanded && (
                        <div className="animate-in slide-in-from-top-2 fade-in duration-200 space-y-1">
                            <ControlRow 
                                label="CFM (Chiller Airflow)" 
                                icon={Fan} 
                                value={inputs.flowRate} 
                                min={inputRanges?.flowRateKcfm?.min ?? 50} 
                                max={inputRanges?.flowRateKcfm?.max ?? 300} 
                                step={10} 
                                unit="kCFM" 
                                onChangeVal={(v) => handleChange('flowRate', v)}
                            />
                            <div className="opacity-50 pointer-events-none">
                                <ControlRow 
                                    label="Rated Capacity" 
                                    icon={Activity} 
                                    value={chillerSpecs.ratedCapacity} 
                                    min={100} max={2000} step={50} 
                                    unit="tons" 
                                    onChangeVal={(v) => handleSpecChange('ratedCapacity', v)}
                                    disabled
                                />
                                <ControlRow 
                                    label="Rated Entering Air" 
                                    icon={Thermometer} 
                                    value={chillerSpecs.ratedEnteringTemp} 
                                    min={80} max={115} step={1} 
                                    unit="°F" 
                                    onChangeVal={(v) => handleSpecChange('ratedEnteringTemp', v)}
                                    disabled
                                />
                                <ControlRow 
                                    label="Design Load" 
                                    icon={Activity} 
                                    value={chillerSpecs.designLoad} 
                                    min={500} max={20000} step={100} 
                                    unit="tons" 
                                    onChangeVal={(v) => handleSpecChange('designLoad', v)}
                                    disabled
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Section: Geometry */}
                <div className="space-y-1">
                    <button 
                        onClick={() => setIsGeometryExpanded(!isGeometryExpanded)}
                        className="w-full px-3 mb-2 flex items-center justify-between group hover:bg-zinc-800/50 rounded py-1 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 uppercase tracking-widest transition-colors">
                            <LayoutGrid size={10} /> Array Geometry
                        </div>
                        {isGeometryExpanded 
                            ? <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" /> 
                            : <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                        }
                    </button>

                    {isGeometryExpanded && (
                        <div className="animate-in slide-in-from-top-2 fade-in duration-200 space-y-1">
                            {/* Fixed 5×4 array — read-only */}
                            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
                                <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                                    <Grid3X3 size={12} className="text-zinc-600" /> Chiller Array
                                </div>
                                <div className="mt-2 text-lg font-mono font-bold text-zinc-300 tabular-nums">
                                    {fixedArrayRows} × {fixedArrayCols}
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1">Fixed (data-driven)</p>
                            </div>
                            <div className="opacity-50 pointer-events-none">
                                <ControlRow 
                                    label="Rows (Height)" 
                                    icon={Grid3X3} 
                                    value={inputs.rows} 
                                    min={1} max={10} step={1} 
                                    unit="qty" 
                                    onChangeVal={(v) => handleChange('rows', v)}
                                    disabled
                                />
                                <ControlRow 
                                    label="Columns (Width)" 
                                    icon={Grid3X3} 
                                    value={inputs.columns} 
                                    min={1} max={10} step={1} 
                                    unit="qty" 
                                    onChangeVal={(v) => handleChange('columns', v)}
                                    disabled
                                />
                            </div>
                            <ControlRow 
                                label="Row Spacing" 
                                icon={Maximize} 
                                value={inputs.rowSpacing} 
                                min={inputRanges?.rowSpacing?.min ?? 5} 
                                max={inputRanges?.rowSpacing?.max ?? 50} 
                                step={0.5} 
                                unit="ft" 
                                onChangeVal={(v) => handleChange('rowSpacing', v)}
                            />
                            <div className="opacity-50 pointer-events-none">
                                <ControlRow 
                                    label="Col Spacing" 
                                    icon={Maximize} 
                                    value={inputs.colSpacing} 
                                    min={5} max={50} step={0.5} 
                                    unit="ft" 
                                    onChangeVal={(v) => handleChange('colSpacing', v)}
                                    disabled
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Section: Environment */}
                <div className="space-y-1">
                     <button 
                        onClick={() => setIsEnvExpanded(!isEnvExpanded)}
                        className="w-full px-3 mb-2 flex items-center justify-between group hover:bg-zinc-800/50 rounded py-1 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 uppercase tracking-widest transition-colors">
                            <Sun size={10} /> Environmental
                        </div>
                        {isEnvExpanded 
                            ? <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" /> 
                            : <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                        }
                    </button>

                    {isEnvExpanded && (
                        <div className="animate-in slide-in-from-top-2 fade-in duration-200 space-y-1">
                            <ControlRow 
                                label="Wind Speed" 
                                icon={Wind} 
                                value={inputs.windSpeed} 
                                min={inputRanges?.windSpeed?.min ?? 0} 
                                max={inputRanges?.windSpeed?.max ?? 20} 
                                step={0.1} 
                                unit="m/s" 
                                onChangeVal={(v) => handleChange('windSpeed', v)}
                            />
                            <ControlRow 
                                label="Orientation" 
                                icon={ArrowUpRight} 
                                value={inputs.windDirection} 
                                min={inputRanges?.orientation?.min ?? 0} 
                                max={inputRanges?.orientation?.max ?? 360} 
                                step={1} 
                                unit="°" 
                                onChangeVal={(v) => handleChange('windDirection', v)}
                            />
                            <div className="opacity-50 pointer-events-none">
                                <ControlRow 
                                    label="Ambient Temp" 
                                    icon={Sun} 
                                    value={inputs.ambientTemp} 
                                    min={60} max={120} step={1} 
                                    unit="°F" 
                                    onChangeVal={(v) => handleChange('ambientTemp', v)}
                                    disabled
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions — Reset greyed out (fixed 5×4 array) */}
            <div className="p-4 border-t border-[#27272a] bg-[#18181b]">
                <button 
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-zinc-900/50 text-zinc-500 text-xs font-medium rounded-md border border-zinc-800 opacity-50 cursor-not-allowed"
                >
                    <Grid3X3 size={12} />
                    Reset Grid Layout
                </button>
            </div>
        </div>
    );
};

export default Controls;