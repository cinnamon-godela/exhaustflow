import { SimulationInputs, SimulationResult, ChillerNode, ChillerSpecs, CapacityAnalysis } from '../types';

/**
 * SURROGATE MODEL LOGIC
 * 
 * 1. Calculates ΔT_max using the user-provided regression equation.
 * 2. Uses the provided `dataset` to retrieve a representative spatial heat distribution.
 * 3. Scales the distribution so the peak matches the calculated ΔT_max.
 * 4. Calculates "Literature Benchmark" (Watson 2019).
 * 5. Calculates Capacity Derating & Redundancy Analysis.
 */

const DATA_START_INDEX = 4; // Index where chiller temps begin (C01 is at index 4)
const DATA_AMBIENT_K = 313.15; // Assumed ambient of the dataset (40C / 104F)
const DATASET_SIZE = 20;

// Helper to convert Delta C to Delta F
const toDeltaF = (deltaC: number) => deltaC * 1.8;
const ftToMeters = (ft: number) => ft * 0.3048;

// Now accepts 'dataset' and 'chillerSpecs'
export const calculateSimulation = (
    inputs: SimulationInputs, 
    dataset: number[][],
    specs: ChillerSpecs
): SimulationResult => {
    
    // Safety check for empty dataset
    const safeSpecs = specs || { 
        ratedCapacity: 500, ratedEnteringTemp: 95, deratingSlope: 1.5, lockoutTemp: 127, designLoad: 2000 
    };

    if (!dataset || dataset.length === 0) {
        return {
            grid: [],
            maxTempRise: 0,
            maxTotalTemp: inputs.ambientTemp,
            avgTempRise: 0,
            riskLevel: 'Low',
            benchmark: {
                source: "Watson & Charentenay (2019)",
                effectiveLengthMeters: 0,
                predictedMaxRiseF: 0,
                predictedAvgRiseF: 0
            },
            capacity: {
                totalRatedCapacity: 0,
                totalEffectiveCapacity: 0,
                capacityLossPct: 0,
                redundancyStatus: 0,
                redundancyLabel: 'INTACT',
                chillersAtRisk: 0,
                chillersLockedOut: 0
            }
        };
    }

    // --- STEP 1: PHYSICS-INFORMED REGRESSION ---
    const V = inputs.windSpeed;
    const Q_kcfm = inputs.flowRate; 
    let orientation = inputs.windDirection % 180;
    if (orientation > 90) orientation = 180 - orientation;
    const thetaRad = (inputs.windDirection * Math.PI) / 180;
    const Sr = inputs.rowSpacing;
    const Sc = inputs.colSpacing;

    let theoreticalMaxRiseC = 19.93 
        + (0.457 * V) 
        - (0.0825 * Q_kcfm) 
        + (0.072 * orientation) 
        - (0.359 * Sr * Math.abs(Math.cos(thetaRad))) 
        - (0.312 * Sc * Math.abs(Math.sin(thetaRad))); 

    theoreticalMaxRiseC = Math.max(theoreticalMaxRiseC, 0.1);
    const theoreticalMaxRiseF = toDeltaF(theoreticalMaxRiseC);

    // --- STEP 1.5: WATSON & CHARENTENAY (2019) BENCHMARK ---
    const CHILLER_LENGTH_FT = 16; 
    const CHILLER_WIDTH_FT = 7.5;
    const arrayLengthFt = (inputs.rows * CHILLER_LENGTH_FT) + ((inputs.rows - 1) * inputs.rowSpacing);
    const arrayWidthFt = (inputs.columns * CHILLER_WIDTH_FT) + ((inputs.columns - 1) * inputs.colSpacing);
    const Lpc_ft = Math.abs(arrayLengthFt * Math.cos(thetaRad)) + Math.abs(arrayWidthFt * Math.sin(thetaRad));
    const Lpc_m = ftToMeters(Lpc_ft);

    const watsonAvgC = 8.7 * Math.max((Lpc_m - 38.9) / 26.8, -1) + 9.0;
    const watsonMaxC = 18.7 * Math.max((Lpc_m - 38.9) / 26.8, -1) + 19.5;

    const benchmark = {
        source: "Watson & Charentenay (2019)" as const,
        effectiveLengthMeters: parseFloat(Lpc_m.toFixed(1)),
        predictedMaxRiseF: parseFloat(toDeltaF(Math.max(watsonMaxC, 0)).toFixed(1)),
        predictedAvgRiseF: parseFloat(toDeltaF(Math.max(watsonAvgC, 0)).toFixed(1))
    };

    // --- STEP 2: SPATIAL PATTERN LOOKUP ---
    const inputSpeed = inputs.windSpeed;
    const inputFlow = inputs.flowRate * 1000; 
    const inputRowSpacing = inputs.rowSpacing; 

    let minDistance = Number.MAX_VALUE;
    let closestRow = dataset[0];

    for (const row of dataset) {
        const dSpeed = (row[0] - inputSpeed) / 10;       
        const dFlow = (row[1] - inputFlow) / 120000;     
        const dOrient = (row[2] - orientation) / 90;     
        const dSpacing = (row[3] - inputRowSpacing) / 20;   
        const distSq = (dSpeed*dSpeed) + (dFlow*dFlow) + (dOrient*dOrient) + (dSpacing*dSpacing);
        if (distSq < minDistance) {
            minDistance = distSq;
            closestRow = row;
        }
    }

    // --- STEP 3: SCALING ---
    let datasetMaxRiseK = 0;
    const availablePoints = Math.min(DATASET_SIZE, closestRow.length - DATA_START_INDEX);
    for (let i = 0; i < availablePoints; i++) {
        const val = closestRow[DATA_START_INDEX + i] - DATA_AMBIENT_K;
        if (val > datasetMaxRiseK) datasetMaxRiseK = val;
    }
    if (datasetMaxRiseK < 0.1) datasetMaxRiseK = 0.1;
    const datasetMaxRiseF = toDeltaF(datasetMaxRiseK);
    const scalingFactor = theoreticalMaxRiseF / datasetMaxRiseF;

    // --- STEP 4: GENERATE GRID & CALCULATE CAPACITY ---
    const nodes: ChillerNode[] = [];
    let globalMaxRiseF = 0;
    let totalRiseSumF = 0;
    let activeChillerCount = 0;
    const totalNodes = inputs.rows * inputs.columns;
    const BASE_ROWS = 4;
    const BASE_COLS = 5;

    // Capacity Aggregators
    let totalEffectiveCapacity = 0;
    let chillersAtRisk = 0;
    let chillersLockedOut = 0;

    for (let i = 0; i < totalNodes; i++) {
        const row = Math.floor(i / inputs.columns);
        const col = i % inputs.columns;
        
        let baseRow = 0;
        let baseCol = 0;
        if (inputs.rows > 1) {
             const ratio = row / (inputs.rows - 1);
             baseRow = Math.round(ratio * (BASE_ROWS - 1));
        }
        if (inputs.columns > 1) {
             const ratio = col / (inputs.columns - 1);
             baseCol = Math.round(ratio * (BASE_COLS - 1));
        }

        const dataIndex = (baseRow * BASE_COLS) + baseCol;
        const safeIndex = Math.min(Math.max(dataIndex, 0), DATASET_SIZE - 1);
        const rawTempK = closestRow[DATA_START_INDEX + safeIndex];
        
        let baseRiseK = (rawTempK || DATA_AMBIENT_K) - DATA_AMBIENT_K;
        if (baseRiseK < 0) baseRiseK = 0;
        const baseRiseF = toDeltaF(baseRiseK);
        let tempRiseF = baseRiseF * scalingFactor;

        // EFT Modifiers
        if (inputs.eftBase) {
            tempRiseF *= 0.35; 
            if (tempRiseF > 3.0) tempRiseF = 3.0 + (tempRiseF - 3.0) * 0.3;
        }
        if (inputs.fanExtension) tempRiseF *= 0.85; 

        const finalTempF = inputs.ambientTemp + tempRiseF;
        const isActive = inputs.layout[i] ?? true;

        // --- CAPACITY CALCULATION ---
        let effectiveCap = 0;
        let deratingPct = 0;
        let status: ChillerNode['status'] = 'Healthy';

        if (isActive) {
            // Determine Lockout
            if (finalTempF >= safeSpecs.lockoutTemp) {
                effectiveCap = 0;
                deratingPct = 100;
                status = 'LockedOut';
                chillersLockedOut++;
            } else {
                // Determine Derating
                // Calculate degrees above rated
                const excessTemp = Math.max(0, finalTempF - safeSpecs.ratedEnteringTemp);
                // Calculate percentage loss (e.g., 1.5 * 10 deg = 15%)
                const lossPct = excessTemp * safeSpecs.deratingSlope;
                deratingPct = Math.min(lossPct, 100);
                
                // Calculate actual tons
                effectiveCap = safeSpecs.ratedCapacity * (1 - (deratingPct / 100));

                // Determine Status
                if (finalTempF >= safeSpecs.lockoutTemp - 5) {
                    status = 'AtRisk';
                    chillersAtRisk++;
                } else if (deratingPct > 10) {
                    status = 'Degraded';
                }
            }

            if (tempRiseF > globalMaxRiseF) globalMaxRiseF = tempRiseF;
            totalRiseSumF += tempRiseF;
            activeChillerCount++;
            totalEffectiveCapacity += effectiveCap;
        }

        nodes.push({
            id: `${row}-${col}`,
            index: i,
            row,
            col,
            tempRise: parseFloat(tempRiseF.toFixed(1)),
            totalTemp: isActive ? parseFloat(finalTempF.toFixed(1)) : inputs.ambientTemp,
            isMax: false,
            isActive,
            effectiveCapacity: effectiveCap,
            deratingPct: parseFloat(deratingPct.toFixed(1)),
            status
        });
    }

    const avgTempRiseF = activeChillerCount > 0 ? totalRiseSumF / activeChillerCount : 0;
    const maxTotalF = inputs.ambientTemp + globalMaxRiseF;

    if (activeChillerCount > 0) {
        nodes.forEach(n => {
            if (n.isActive && n.tempRise >= globalMaxRiseF - 0.2) n.isMax = true;
        });
    }

    // --- AGGREGATE RISK ANALYSIS ---
    const totalRatedCapacity = activeChillerCount * safeSpecs.ratedCapacity;
    const capacityLossPct = totalRatedCapacity > 0 
        ? ((totalRatedCapacity - totalEffectiveCapacity) / totalRatedCapacity) * 100
        : 0;
    
    // Redundancy calculation
    // effective_spare_capacity = total_effective - design_load
    const effectiveSpareCapacity = totalEffectiveCapacity - safeSpecs.designLoad;
    // How many full chillers is that?
    const redundancyStatus = effectiveSpareCapacity / safeSpecs.ratedCapacity;

    let redundancyLabel: CapacityAnalysis['redundancyLabel'] = 'INTACT';
    if (chillersLockedOut > 0 || totalEffectiveCapacity < safeSpecs.designLoad) {
        redundancyLabel = 'CRITICAL'; // Lockout Imminent or Load Lost
    } else if (effectiveSpareCapacity < 0) {
        redundancyLabel = 'LOST'; // Cannot meet load
    } else if (chillersAtRisk > 0 || redundancyStatus < 1.0) {
        // Warning if less than N+1 margin OR heat risk is high
        redundancyLabel = 'ERODED'; 
    }

    // Old simplified risk level (Mapped to new logic)
    let risk: SimulationResult['riskLevel'] = 'Low';
    if (redundancyLabel === 'ERODED') risk = 'Moderate';
    if (redundancyLabel === 'LOST') risk = 'High';
    if (redundancyLabel === 'CRITICAL') risk = 'Critical';

    return {
        grid: nodes,
        maxTempRise: parseFloat(globalMaxRiseF.toFixed(1)),
        maxTotalTemp: parseFloat(maxTotalF.toFixed(1)),
        avgTempRise: parseFloat(avgTempRiseF.toFixed(1)),
        riskLevel: risk,
        benchmark,
        capacity: {
            totalRatedCapacity,
            totalEffectiveCapacity,
            capacityLossPct,
            redundancyStatus,
            redundancyLabel,
            chillersAtRisk,
            chillersLockedOut
        }
    };
};