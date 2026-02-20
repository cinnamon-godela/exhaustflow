import { SimulationInputs, SimulationResult, ChillerNode, ChillerSpecs, CapacityAnalysis } from '../types';

/**
 * SURROGATE MODEL LOGIC (DATA-DRIVEN)
 *
 * Temperature output is a direct display of chiller temperatures from the database:
 * 1. Lookup: find the closest row in the dataset (from Supabase chiller_baseline) by
 *    Wind Speed (m/s), CFM (flow_rate), Orientation (°), Row Spacing (ft).
 * 2. Display: use that row’s temperature array (Kelvin) as-is — convert to °F.
 * 3. No regression scaling: shown temps are the DB temps for the matched configuration.
 * 4. Literature benchmark and capacity/derating are still computed for context.
 *
 * --- DB TEMPERATURE → GRID CELL MAPPING ---
 * Each dataset row has: [wind_speed, flow_rate, orientation, spacing, T0, T1, ..., T19].
 * The 20 temperatures are in ROW-MAJOR order for a 4×5 grid:
 *   - Indices 0–4:  row 0 (top),    columns 0–4 left to right
 *   - Indices 5–9:  row 1,          columns 0–4
 *   - Indices 10–14: row 2,         columns 0–4
 *   - Indices 15–19: row 3 (bottom), columns 0–4
 * So: grid cell (row, col) uses DB temperature at index (row * 5 + col).
 * Example: cell at row 2, col 3 uses closestRow[DATA_START_INDEX + 2*5+3] = T13.
 */

const DATA_START_INDEX = 4; // Index where chiller temps begin (row has 4 params then T0..T19)
const DATA_AMBIENT_K = 313.15; // Assumed ambient of the dataset (40C / 104F)
const DATASET_SIZE = 20;

const kelvinToF = (K: number) => (K - 273.15) * (9 / 5) + 32;
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
            },
            matchedRowIndex: -1
        };
    }

    // Orientation for lookup: 0–180° symmetric
    let orientation = inputs.windDirection % 180;
    if (orientation > 90) orientation = 180 - orientation;
    const thetaRad = (inputs.windDirection * Math.PI) / 180;

    // --- WATSON & CHARENTENAY (2019) BENCHMARK (reference only) ---
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

    // --- LOOKUP: closest row in DB by Wind Speed, CFM, Orientation, Row Spacing ---
    const inputSpeed = inputs.windSpeed;
    const inputFlow = inputs.flowRate * 1000; // kCFM → CFM to match DB flow_rate
    const inputRowSpacing = inputs.rowSpacing;

    let minDistance = Number.MAX_VALUE;
    let closestRow = dataset[0];
    let matchedRowIndex = 0;

    for (let i = 0; i < dataset.length; i++) {
        const row = dataset[i];
        const dSpeed = (row[0] - inputSpeed) / 10;
        const dFlow = (row[1] - inputFlow) / 120000;
        const dOrient = (row[2] - orientation) / 90;
        const dSpacing = (row[3] - inputRowSpacing) / 20;
        const distSq = (dSpeed * dSpeed) + (dFlow * dFlow) + (dOrient * dOrient) + (dSpacing * dSpacing);
        if (distSq < minDistance) {
            minDistance = distSq;
            closestRow = row;
            matchedRowIndex = i;
        }
    }

    // --- DIRECT DISPLAY: use this row’s chiller temperatures from the database (no scaling) ---

    // --- GENERATE GRID & CALCULATE CAPACITY ---
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

    // Grid is fixed 4×5; cell (row, col) → DB temp index = row*5+col (row-major)
    for (let i = 0; i < totalNodes; i++) {
        const row = Math.floor(i / inputs.columns);
        const col = i % inputs.columns;
        const dataIndex = (row * BASE_COLS) + col; // 0..19, matches DB T0..T19
        const safeIndex = Math.min(Math.max(dataIndex, 0), DATASET_SIZE - 1);
        const rawTempK = closestRow[DATA_START_INDEX + safeIndex] ?? DATA_AMBIENT_K;

        // Direct display: temperature from database (Kelvin → °F), no regression scaling
        const finalTempF = kelvinToF(rawTempK);
        const tempRiseF = finalTempF - inputs.ambientTemp;
        const riseForStats = Math.max(0, tempRiseF);
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

            if (riseForStats > globalMaxRiseF) globalMaxRiseF = riseForStats;
            totalRiseSumF += riseForStats;
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
        },
        matchedRowIndex
    };
};