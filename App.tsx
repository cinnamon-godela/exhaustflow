import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SimulationInputs, ChillerSpecs } from './types';
import { calculateSimulation } from './services/surrogateModel';
import { CHILLER_DATASET } from './services/chillerData'; 
import { fetchBaselineDataset, fetchBaselineRowById } from './services/supabase';
import { getChillerApiUrl, fetchChillerPrediction } from './services/chillerApi';
import { getInputRanges, clamp } from './services/datasetRanges'; 
import Controls from './components/Controls';
import HeatmapGrid from './components/HeatmapGrid';
import CutPlaneView from './components/CutPlaneView';
import StatsPanel from './components/StatsPanel';
import ChatInterface from './components/ChatInterface';
import SimulationHistory from './components/SimulationHistory';
import { Grid, Layers, Box, Database, Loader2 } from 'lucide-react';

type ViewMode = 'heatmap' | 'cutplane' | '3d';

/** Placeholder row (ambient temps in K) when API is configured but no response yet — ensures we never show DB data. */
function buildPlaceholderRow(inputs: SimulationInputs): number[] {
    const ambientK = (inputs.ambientTemp - 32) * (5 / 9) + 273.15;
    return [
        inputs.windSpeed,
        inputs.flowRate * 1000,
        inputs.windDirection,
        inputs.rowSpacing,
        ...Array(20).fill(ambientK),
    ];
}

const App: React.FC = () => {
    
    // Fixed 5×4 chiller array (driven by Supabase baseline data)
    const FIXED_ROWS = 5;
    const FIXED_COLS = 4;

    const [inputs, setInputs] = useState<SimulationInputs>({
        rows: FIXED_ROWS,
        columns: FIXED_COLS,
        rowSpacing: 12,
        colSpacing: 8,
        windSpeed: 4,
        windDirection: 45,
        flowRate: 140,
        ambientTemp: 104,
        layout: Array(FIXED_ROWS * FIXED_COLS).fill(true),
        eftBase: true, // Baseline data is for EFT Base ON
        fanExtension: false
    });

    // New: Chiller Specs State
    const [chillerSpecs, setChillerSpecs] = useState<ChillerSpecs>({
        ratedCapacity: 500,     // tons
        ratedEnteringTemp: 95,  // F
        deratingSlope: 1.5,     // % per F
        lockoutTemp: 127,       // F
        designLoad: (FIXED_ROWS * FIXED_COLS - 1) * 500 // N+1 for 5×4
    });

    // Design load fixed for 5×4 array (N+1)
    useEffect(() => {
        const totalChillers = FIXED_ROWS * FIXED_COLS;
        const nPlusOneLoad = (totalChillers - 1) * chillerSpecs.ratedCapacity;
        if (Math.abs(chillerSpecs.designLoad - nPlusOneLoad) > 2000) {
            setChillerSpecs(prev => ({ ...prev, designLoad: Math.max(0, nPlusOneLoad) }));
        }
    }, [chillerSpecs.ratedCapacity]);


    const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [tempUnit, setTempUnit] = useState<'F' | 'K'>('F');

    // Dataset Management — start with local; Supabase overwrites when fetch succeeds
    const [dataset, setDataset] = useState<number[][]>(CHILLER_DATASET);
    const [datasetSource, setDatasetSource] = useState<'Local' | 'Supabase'>('Local');
    const [datasetRowCount, setDatasetRowCount] = useState<number | null>(null);
    const [datasetRowIds, setDatasetRowIds] = useState<(string | number)[] | null>(null);
    const [datasetError, setDatasetError] = useState<string | null>(null);
    const [isFetchingData, setIsFetchingData] = useState(true);

    // Load by ID: show exact DB row and reverse-populate the four inputs (for debugging)
    const [overrideRow, setOverrideRow] = useState<number[] | null>(null);
    const [overrideId, setOverrideId] = useState<string | number | null>(null);
    const [loadByIdError, setLoadByIdError] = useState<string | null>(null);
    const [isLoadingById, setIsLoadingById] = useState(false);

    // Prediction API (replaces database lookup when VITE_CHILLER_API_URL is set)
    const chillerApiUrl = getChillerApiUrl();
    const [useDatabaseFallback, setUseDatabaseFallback] = useState(false);
    const effectiveChillerApiUrl = chillerApiUrl && !useDatabaseFallback ? chillerApiUrl : null;
    const [apiRow, setApiRow] = useState<number[] | null>(null);
    const [apiLoading, setApiLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const loadFromSupabase = React.useCallback(async () => {
        setDatasetError(null);
        setIsFetchingData(true);
        const result = await fetchBaselineDataset();
        setIsFetchingData(false);
        if (result.ok) {
            setDataset(result.data);
            setDatasetSource('Supabase');
            setDatasetRowCount(result.rowCount);
            setDatasetRowIds(result.rowIds);
        } else {
            setDatasetSource('Local');
            setDatasetError(result.error);
            setDatasetRowCount(null);
            setDatasetRowIds(null);
            // Keep existing dataset (local) so the app still runs
        }
    }, []);

    // Fetch from Supabase when using database (no API URL, or user chose "Use database instead" after API failure)
    useEffect(() => {
        if (effectiveChillerApiUrl) return;
        loadFromSupabase();
    }, [effectiveChillerApiUrl, loadFromSupabase]);

    // When chiller API is set and not overridden, the four inputs drive the chiller prediction API.
    const apiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!effectiveChillerApiUrl) {
            setApiRow(null);
            setApiError(null);
            return;
        }
        if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
        apiDebounceRef.current = setTimeout(async () => {
            setApiLoading(true);
            setApiError(null);
            const result = await fetchChillerPrediction(effectiveChillerApiUrl, {
                windSpeed: inputs.windSpeed,
                cfm: inputs.flowRate * 1000,
                orientation: inputs.windDirection,
                spacing: inputs.rowSpacing,
            });
            setApiLoading(false);
            if (result.ok) {
                setApiRow(result.row);
            } else {
                setApiRow(null);
                setApiError(result.error);
            }
            apiDebounceRef.current = null;
        }, 300);
        return () => {
            if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
        };
    }, [effectiveChillerApiUrl, inputs.windSpeed, inputs.flowRate, inputs.windDirection, inputs.rowSpacing]);

    // Keep layout fixed at 5×4 (20 cells, all on)
    const layoutSize = FIXED_ROWS * FIXED_COLS;
    useEffect(() => {
        if (inputs.layout.length !== layoutSize) {
            setInputs(prev => ({ ...prev, layout: Array(layoutSize).fill(true) }));
        }
    }, [layoutSize]);

    // Data-driven input ranges (confine sliders to ranges we have data for)
    const inputRanges = useMemo(() => getInputRanges(dataset), [dataset]);

    // Clamp the four inputs to database parameter bounds (bounce to min/max if out of range)
    useEffect(() => {
        setInputs((prev) => ({
            ...prev,
            windSpeed: clamp(prev.windSpeed, inputRanges.windSpeed.min, inputRanges.windSpeed.max),
            flowRate: clamp(prev.flowRate, inputRanges.flowRateKcfm.min, inputRanges.flowRateKcfm.max),
            windDirection: clamp(prev.windDirection, inputRanges.orientation.min, inputRanges.orientation.max),
            rowSpacing: clamp(prev.rowSpacing, inputRanges.rowSpacing.min, inputRanges.rowSpacing.max),
        }));
    }, [inputRanges]);

    // Recalculate results when inputs, dataset, or specs changes
    const results = useMemo(() => 
        calculateSimulation(inputs, dataset, chillerSpecs), 
    [inputs, dataset, chillerSpecs]);

    // When chiller API is active, results come only from API. Otherwise override row or dataset.
    const displayResults = useMemo(() => {
        if (effectiveChillerApiUrl) {
            const row = apiRow ?? buildPlaceholderRow(inputs);
            return calculateSimulation(inputs, [row], chillerSpecs);
        }
        if (overrideRow != null) {
            return calculateSimulation(inputs, [overrideRow], chillerSpecs);
        }
        return results;
    }, [effectiveChillerApiUrl, apiRow, inputs, overrideRow, results, chillerSpecs]);

    const handleLoadById = React.useCallback(async (id: string | number) => {
        setLoadByIdError(null);
        setIsLoadingById(true);
        const out = await fetchBaselineRowById(id);
        setIsLoadingById(false);
        if (!out.ok) {
            setLoadByIdError(out.error);
            return;
        }
        const [ws, cfm, or, sp] = out.row;
        const ranges = getInputRanges(dataset);
        setOverrideRow(out.row);
        setOverrideId(out.id);
        setInputs((prev) => ({
            ...prev,
            windSpeed: clamp(ws, ranges.windSpeed.min, ranges.windSpeed.max),
            flowRate: clamp(cfm / 1000, ranges.flowRateKcfm.min, ranges.flowRateKcfm.max),
            windDirection: clamp(or, ranges.orientation.min, ranges.orientation.max),
            rowSpacing: clamp(sp, ranges.rowSpacing.min, ranges.rowSpacing.max),
        }));
    }, [dataset]);

    const handleClearOverride = React.useCallback(() => {
        setOverrideRow(null);
        setOverrideId(null);
        setLoadByIdError(null);
    }, []);

    // Comparison Simulation (What happens if we toggle EFT?)
    const comparisonResults = useMemo(() => {
        const compInputs = { ...inputs, eftBase: !inputs.eftBase };
        const data = effectiveChillerApiUrl
            ? [apiRow ?? buildPlaceholderRow(inputs)]
            : overrideRow != null
                ? [overrideRow]
                : dataset;
        return calculateSimulation(compInputs, data, chillerSpecs);
    }, [effectiveChillerApiUrl, apiRow, inputs, dataset, overrideRow, chillerSpecs]);

    // Which run/record ID the current results map to (for Quick Input and header)
    const matchedRunId = useMemo(() => {
        if (effectiveChillerApiUrl) return 'API';
        if (overrideId != null) return overrideId;
        if (displayResults.matchedRowIndex < 0) return null;
        if (datasetRowIds && displayResults.matchedRowIndex < datasetRowIds.length) return datasetRowIds[displayResults.matchedRowIndex];
        return `Row ${displayResults.matchedRowIndex + 1}`;
    }, [effectiveChillerApiUrl, overrideId, datasetRowIds, displayResults.matchedRowIndex]);

    // Layout is fixed 5×4; toggles disabled
    const handleToggleNode = (_index: number) => { /* no-op: layout locked */ };

    const handleResetLayout = () => {
        setInputs(prev => ({ ...prev, layout: Array(FIXED_ROWS * FIXED_COLS).fill(true) }));
    };

    const handleLoadSimulation = (loadedInputs: SimulationInputs) => {
        setInputs(loadedInputs);
    };

    return (
        <div className="h-screen w-screen bg-[#09090b] text-zinc-300 flex overflow-hidden relative">
            
            <SimulationHistory 
                isOpen={historyOpen} 
                onClose={() => setHistoryOpen(false)}
                currentInputs={inputs}
                currentResults={displayResults}
                onLoad={handleLoadSimulation}
            />

            {/* COLUMN 1: LEFT SIDEBAR (CONTROLS) */}
            <div className="w-80 flex-shrink-0 border-r border-[#27272a] bg-[#18181b] overflow-y-auto z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
                <Controls 
                    inputs={inputs}
                    chillerSpecs={chillerSpecs}
                    onChange={setInputs} 
                    onSpecsChange={setChillerSpecs}
                    onResetLayout={handleResetLayout}
                    onOpenHistory={() => setHistoryOpen(true)}
                    fixedArrayRows={FIXED_ROWS}
                    fixedArrayCols={FIXED_COLS}
                    inputRanges={inputRanges ?? undefined}
                    onLoadById={effectiveChillerApiUrl ? undefined : handleLoadById}
                    isLoadingById={isLoadingById}
                    loadByIdError={loadByIdError}
                    onClearOverride={handleClearOverride}
                    matchedRunId={matchedRunId}
                />
            </div>

            {/* COLUMN 2: CENTER CANVAS (VISUALIZATION) */}
            <div className="flex-grow flex flex-col min-w-0 bg-[#09090b] relative z-0">
                
                {/* Center Header / Tabs */}
                <div className="h-14 border-b border-[#27272a] flex items-center justify-between px-6 bg-[#09090b] select-none">
                    <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-lg border border-zinc-800">
                         <button 
                            onClick={() => setViewMode('heatmap')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                                viewMode === 'heatmap' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                            }`}
                        >
                            <Grid size={12} />
                            Thermal Map
                        </button>
                        <button 
                            disabled
                            className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md opacity-50 cursor-not-allowed text-zinc-600"
                        >
                            <Layers size={12} />
                            CFD Plane
                        </button>
                        <button 
                            disabled
                            className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md opacity-50 cursor-not-allowed text-zinc-600"
                        >
                            <Box size={12} />
                            3D Model
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Data source status: API when configured, else Supabase/Local */}
                        <div className={`flex items-center gap-2 px-2 py-1 rounded border ${
                            effectiveChillerApiUrl && apiRow != null ? 'bg-violet-950/20 border-violet-900/50' 
                            : datasetSource === 'Supabase' ? 'bg-emerald-950/20 border-emerald-900/50' 
                            : 'bg-zinc-800/50 border-zinc-700'
                        }`}>
                            {effectiveChillerApiUrl ? (
                                apiLoading ? (
                                    <Loader2 size={10} className="animate-spin text-violet-400"/>
                                ) : (
                                    <Database size={10} className={apiRow != null ? 'text-violet-500' : 'text-zinc-500'} />
                                )
                            ) : isFetchingData ? (
                                <Loader2 size={10} className="animate-spin text-zinc-500"/>
                            ) : (
                                <Database size={10} className={datasetSource === 'Supabase' ? 'text-emerald-500' : 'text-zinc-500'} />
                            )}
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                effectiveChillerApiUrl && apiRow != null ? 'text-violet-400' 
                                : datasetSource === 'Supabase' ? 'text-emerald-400' 
                                : 'text-zinc-500'
                            }`}>
                                {effectiveChillerApiUrl 
                                    ? (apiLoading ? 'Loading…' : apiRow != null ? 'API' : apiError ? 'API error' : '…')
                                    : isFetchingData ? 'Loading…' : datasetSource === 'Supabase' 
                                        ? `Ready${datasetRowCount != null ? ` (${datasetRowCount})` : ''}` 
                                        : 'Offline'}
                            </span>
                            {!effectiveChillerApiUrl && !isFetchingData && (
                                <button
                                    type="button"
                                    onClick={loadFromSupabase}
                                    className="text-[9px] text-zinc-500 hover:text-yellow-400 transition-colors underline"
                                    title="Refresh data"
                                >
                                    Refresh
                                </button>
                            )}
                        </div>
                        {(datasetError || (chillerApiUrl && apiError)) && (
                            <div className="max-w-md px-2 py-1.5 rounded border border-amber-900/50 bg-amber-950/20 space-y-1" title={chillerApiUrl && apiError ? apiError : datasetError ?? ''}>
                                <span className="text-[9px] text-amber-400 block break-words">{chillerApiUrl && apiError ? apiError : datasetError}</span>
                                {chillerApiUrl && apiError && (
                                    <button
                                        type="button"
                                        onClick={() => { setUseDatabaseFallback(true); loadFromSupabase(); }}
                                        className="text-[9px] text-amber-300 hover:text-amber-200 underline"
                                    >
                                        Use database instead
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Run ID: which record the current results map to */}
                        {matchedRunId != null && (
                            <div className="px-2 py-1 rounded border border-zinc-700 bg-zinc-800/50" title="Record used for the temperatures shown">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Run ID </span>
                                <span className="text-[9px] font-mono text-zinc-300">{matchedRunId}</span>
                            </div>
                        )}

                        {/* Temperature unit: °F or K for viewer */}
                        <div className="flex items-center gap-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-800/50">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Temp:</span>
                            <button
                                type="button"
                                onClick={() => setTempUnit('F')}
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${tempUnit === 'F' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                °F
                            </button>
                            <button
                                type="button"
                                onClick={() => setTempUnit('K')}
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${tempUnit === 'K' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                K
                            </button>
                        </div>

                        <div className="text-[10px] text-zinc-600 font-mono flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                            SURROGATE SOLVER v2.1
                        </div>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-grow relative overflow-hidden flex flex-col p-6">
                    {/* Stats Overlay */}
                    <div className="mb-3 relative z-30">
                        <StatsPanel 
                            data={displayResults} 
                            comparisonData={comparisonResults} 
                            isEftActive={inputs.eftBase}
                            chillerSpecs={chillerSpecs}
                        />
                    </div>

                    <div className="flex-grow border border-[#27272a] rounded-xl bg-black relative overflow-hidden shadow-2xl ring-1 ring-white/5 z-0">
                        {viewMode === 'heatmap' && (
                            <HeatmapGrid 
                                data={displayResults} 
                                inputs={inputs} 
                                onToggleNode={handleToggleNode}
                                layoutLocked
                                tempUnit={tempUnit}
                            />
                        )}
                        {viewMode === 'cutplane' && (
                            <CutPlaneView 
                                data={displayResults} 
                                inputs={inputs} 
                            />
                        )}
                        {viewMode === '3d' && (
                            <div className="w-full h-full relative bg-[#09090b]">
                                {/* Blocker for Sketchfab Header/Tag */}
                                <div className="absolute top-0 left-0 w-full h-12 bg-[#09090b] z-20 pointer-events-none" />
                                
                                <iframe 
                                    title="Data Center Thermal Map" 
                                    className="w-full h-full relative z-10"
                                    frameBorder="0" 
                                    allowFullScreen 
                                    allow="autoplay; fullscreen; xr-spatial-tracking" 
                                    src="https://sketchfab.com/models/b691bef94d26472e9d43103cefa0f383/embed?autostart=1&camera=0&preload=1&transparent=1&ui_theme=dark" 
                                />

                                {/* Blocker for Sketchfab Footer/Banner */}
                                <div className="absolute bottom-0 left-0 w-full h-10 bg-[#09090b] z-20 pointer-events-none" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* FLOATING CHAT INTERFACE */}
            <ChatInterface 
                inputs={inputs}
                results={displayResults}
                onUpdate={setInputs}
                inputRanges={inputRanges ?? undefined}
            />

        </div>
    );
};

export default App;