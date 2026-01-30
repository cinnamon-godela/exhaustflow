import { SimulationInputs, SimulationResult, ChillerNode } from '../types';
import { CHILLER_DATASET } from './chillerData';

/**
 * SURROGATE MODEL LOGIC
 * Replaces pure physics approximation with a Data-Driven Nearest Neighbor lookup 
 * from the provided dataset.
 * 
 * Dataset Format: [Windspeed, CFM, Orientation, Spacing, C1...C20]
 */

const DATA_START_INDEX = 4; // Index where chiller temps begin (C01 is at index 4)
const DATA_AMBIENT_K = 313.15; // Assumed ambient of the dataset (40C)
const DATASET_SIZE = 20;

export const calculateSimulation = (inputs: SimulationInputs): SimulationResult => {
    
    // 1. Normalize Inputs for Distance Calculation
    // We normalize roughly to 0-1 range to weigh factors equally
    
    const inputSpeed = inputs.windSpeed;     // 0-20
    const inputFlow = inputs.flowRate * 1000; // Dataset CFM is absolute, Input is kCFM
    
    // Use Row Spacing as the primary proxy for the "Spacing" dataset feature
    // which primarily drives wake interference.
    const inputSpacing = inputs.rowSpacing;     // 5-50
    
    // Dataset Orientation appears to be 0-90. 
    // We map 360 inputs to 0-90 quadrant for lookup.
    const inputOrient = Math.abs(inputs.windDirection % 90); 

    let minDistance = Number.MAX_VALUE;
    let closestRow = CHILLER_DATASET[0];

    // 2. Find Nearest Neighbor
    // Naive O(N) search is fine for ~250 rows.
    for (const row of CHILLER_DATASET) {
        const dSpeed = (row[0] - inputSpeed) / 20;       // Scale ~20
        const dFlow = (row[1] - inputFlow) / 100000;     // Scale ~100k
        const dOrient = (row[2] - inputOrient) / 90;     // Scale ~90
        const dSpacing = (row[3] - inputSpacing) / 50;   // Scale ~50

        // Euclidean Distance Squared
        const distSq = (dSpeed*dSpeed) + (dFlow*dFlow) + (dOrient*dOrient) + (dSpacing*dSpacing);
        
        if (distSq < minDistance) {
            minDistance = distSq;
            closestRow = row;
        }
    }

    // 3. Map Data to Nodes
    const nodes: ChillerNode[] = [];
    let globalMaxRise = 0;
    let totalRiseSum = 0;
    let activeChillerCount = 0;

    const totalNodes = inputs.rows * inputs.columns;

    for (let i = 0; i < totalNodes; i++) {
        const row = Math.floor(i / inputs.columns);
        const col = i % inputs.columns;
        
        // Dataset only has 20 points. We map index i to dataset index.
        // If grid is larger than 20, we wrap around using modulo to fill the grid.
        // This acts as a tiling surrogate strategy.
        const dataIndex = i % DATASET_SIZE;

        // Dataset value (Kelvin)
        const rawTempK = closestRow[DATA_START_INDEX + dataIndex];
        
        // Calculate Rise relative to dataset ambient
        let tempRise = rawTempK - DATA_AMBIENT_K;
        if (tempRise < 0) tempRise = 0; // Clamp negative physics artifacts

        // Apply Modifiers (EFT Base / Extension)
        if (inputs.eftBase) {
            tempRise *= 0.65; // ~35% reduction
        }
        if (inputs.fanExtension) {
            tempRise *= 0.85; // ~15% reduction
        }

        // Apply User Ambient
        const finalTemp = inputs.ambientTemp + tempRise;

        // Active State Check
        const isActive = inputs.layout[i] ?? true;

        if (isActive) {
            if (tempRise > globalMaxRise) globalMaxRise = tempRise;
            totalRiseSum += tempRise;
            activeChillerCount++;
        }

        nodes.push({
            id: `${row}-${col}`,
            index: i,
            row,
            col,
            tempRise: parseFloat(tempRise.toFixed(1)),
            totalTemp: isActive ? parseFloat(finalTemp.toFixed(1)) : inputs.ambientTemp,
            isMax: false,
            isActive
        });
    }

    const avgTempRise = activeChillerCount > 0 ? totalRiseSum / activeChillerCount : 0;
    const maxTotal = inputs.ambientTemp + globalMaxRise;

    // Mark max
    if (activeChillerCount > 0) {
        nodes.forEach(n => {
            if (n.isActive && n.tempRise >= globalMaxRise - 0.1) n.isMax = true;
        });
    }

    // Risk Assessment
    let risk: SimulationResult['riskLevel'] = 'Low';
    if (maxTotal > 40) risk = 'Moderate';
    if (maxTotal > 43) risk = 'High';
    if (maxTotal > 46) risk = 'Critical';

    return {
        grid: nodes,
        maxTempRise: parseFloat(globalMaxRise.toFixed(1)),
        maxTotalTemp: parseFloat(maxTotal.toFixed(1)),
        avgTempRise: parseFloat(avgTempRise.toFixed(1)),
        riskLevel: risk
    };
};