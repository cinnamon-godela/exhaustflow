import React, { useState, useMemo, useEffect } from 'react';
import { SimulationInputs, ChillerSpecs } from './types';
import { calculateSimulation } from './services/surrogateModel';
import { CHILLER_DATASET } from './services/chillerData'; 
import { fetchBaselineDataset } from './services/supabase'; 
import Controls from './components/Controls';
import HeatmapGrid from './components/HeatmapGrid';
import CutPlaneView from './components/CutPlaneView';
import StatsPanel from './components/StatsPanel';
import ChatInterface from './components/ChatInterface';
import SimulationHistory from './components/SimulationHistory';
import { Grid, Layers, Box, Database, Loader2 } from 'lucide-react';

type ViewMode = 'heatmap' | 'cutplane' | '3d';

const App: React.FC = () => {
    
    // Default to 4 rows x 5 cols (Baseline Dataset Configuration)
    const DEFAULT_ROWS = 4;
    const DEFAULT_COLS = 5;

    const [inputs, setInputs] = useState<SimulationInputs>({
        rows: DEFAULT_ROWS,
        columns: DEFAULT_COLS,
        rowSpacing: 12,
        colSpacing: 8,
        windSpeed: 4,         
        windDirection: 45,    
        flowRate: 140,        
        ambientTemp: 104,     
        layout: Array(DEFAULT_ROWS * DEFAULT_COLS).fill(true),
        eftBase: false,
        fanExtension: false
    });

    // New: Chiller Specs State
    const [chillerSpecs, setChillerSpecs] = useState<ChillerSpecs>({
        ratedCapacity: 500,     // tons
        ratedEnteringTemp: 95,  // F
        deratingSlope: 1.5,     // % per F
        lockoutTemp: 127,       // F
        designLoad: (DEFAULT_ROWS * DEFAULT_COLS - 1) * 500 // Default N+1 load
    });

    // Update default design load if chiller count changes significantly
    // (Optional QoL feature to keep defaults sensible)
    useEffect(() => {
        const totalChillers = inputs.rows * inputs.columns;
        // Only update if the current design load seems "default-ish" (N+1 of previous count)
        // or just keep it simple and let user adjust. 
        // Let's ensure design load is at least logically possible to visualize.
        const nPlusOneLoad = (totalChillers - 1) * chillerSpecs.ratedCapacity;
        if (Math.abs(chillerSpecs.designLoad - nPlusOneLoad) > 2000 && totalChillers > 0) {
             // Reset to N+1 if grid changes drastically
             setChillerSpecs(prev => ({...prev, designLoad: Math.max(0, nPlusOneLoad)}));
        }
    }, [inputs.rows, inputs.columns]);


    const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
    const [historyOpen, setHistoryOpen] = useState(false);

    // Dataset Management
    const [dataset, setDataset] = useState<number[][]>(CHILLER_DATASET);
    const [datasetSource, setDatasetSource] = useState<'Local' | 'Supabase'>('Local');
    const [isFetchingData, setIsFetchingData] = useState(true);

    // Fetch dataset from Supabase on mount
    useEffect(() => {
        const initDataset = async () => {
            const remoteData = await fetchBaselineDataset();
            if (remoteData) {
                setDataset(remoteData);
                setDatasetSource('Supabase');
            }
            setIsFetchingData(false);
        };
        initDataset();
    }, []);

    // Ensure layout array matches grid dimensions if they change
    useEffect(() => {
        const requiredSize = inputs.rows * inputs.columns;
        if (inputs.layout.length !== requiredSize) {
            setInputs(prev => ({
                ...prev,
                layout: Array(requiredSize).fill(true)
            }));
        }
    }, [inputs.rows, inputs.columns]);

    // Recalculate results when inputs, dataset, or specs changes
    const results = useMemo(() => 
        calculateSimulation(inputs, dataset, chillerSpecs), 
    [inputs, dataset, chillerSpecs]);

    // Comparison Simulation (What happens if we toggle EFT?)
    // If EFT is currently OFF, simulate ON. If ON, simulate OFF.
    const comparisonResults = useMemo(() => {
        const compInputs = { ...inputs, eftBase: !inputs.eftBase };
        return calculateSimulation(compInputs, dataset, chillerSpecs);
    }, [inputs, dataset, chillerSpecs]);


    const handleToggleNode = (index: number) => {
        const newLayout = [...inputs.layout];
        newLayout[index] = !newLayout[index];
        setInputs({ ...inputs, layout: newLayout });
    };

    const handleResetLayout = () => {
        setInputs({ ...inputs, layout: Array(inputs.rows * inputs.columns).fill(true) });
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
                currentResults={results}
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
                            onClick={() => setViewMode('cutplane')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                                viewMode === 'cutplane' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                            }`}
                        >
                            <Layers size={12} />
                            CFD Plane
                        </button>
                        <button 
                            onClick={() => setViewMode('3d')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                                viewMode === '3d' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                            }`}
                        >
                            <Box size={12} />
                            3D Model
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Data Source Indicator */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${datasetSource === 'Supabase' ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-zinc-800/50 border-zinc-700'}`}>
                            {isFetchingData ? (
                                <Loader2 size={10} className="animate-spin text-zinc-500"/>
                            ) : (
                                <Database size={10} className={datasetSource === 'Supabase' ? 'text-emerald-500' : 'text-zinc-500'} />
                            )}
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${datasetSource === 'Supabase' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                {isFetchingData ? 'Connecting...' : `${datasetSource} DB`}
                            </span>
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
                    <div className="mb-6 relative z-30">
                        <StatsPanel 
                            data={results} 
                            comparisonData={comparisonResults} 
                            isEftActive={inputs.eftBase}
                            chillerSpecs={chillerSpecs}
                        />
                    </div>

                    <div className="flex-grow border border-[#27272a] rounded-xl bg-black relative overflow-hidden shadow-2xl ring-1 ring-white/5 z-0">
                        {viewMode === 'heatmap' && (
                            <HeatmapGrid 
                                data={results} 
                                inputs={inputs} 
                                onToggleNode={handleToggleNode} 
                            />
                        )}
                        {viewMode === 'cutplane' && (
                            <CutPlaneView 
                                data={results} 
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
                results={results}
                onUpdate={setInputs}
            />

        </div>
    );
};

export default App;