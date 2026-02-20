export interface SimulationInputs {
    rows: number;          // Number of rows (grid height)
    columns: number;       // Number of columns (grid width)
    rowSpacing: number;    // Feet (Distance between rows)
    colSpacing: number;    // Feet (Distance between columns)
    windSpeed: number;     // m/s (Continuous)
    windDirection: number; // Degrees 0-360
    flowRate: number;      // kCFM (Continuous)
    ambientTemp: number;   // Degrees Fahrenheit
    layout: boolean[];     // Grid active state (true = Chiller, false = Inlet/Gap)
    eftBase: boolean;      // Enable EFT Base for reduced re-entrainment
    fanExtension: boolean; // Enable Discharge Extension / Flow Straightener
}

export interface ChillerSpecs {
    ratedCapacity: number;      // Tons per chiller (e.g., 500)
    ratedEnteringTemp: number;  // °F (e.g., 95)
    deratingSlope: number;      // % capacity loss per °F above rated (e.g., 1.5)
    lockoutTemp: number;        // °F (e.g., 127)
    designLoad: number;         // Total tons required by facility
}

export interface ChillerNode {
    id: string;
    index: number;
    row: number;
    col: number;
    tempRise: number; // Degrees Fahrenheit
    totalTemp: number; // Absolute Intake Temp (Ambient + Rise)
    isMax: boolean;
    isActive: boolean;
    // New Capacity Fields
    effectiveCapacity: number; // Tons
    deratingPct: number;       // % loss
    status: 'Healthy' | 'Degraded' | 'AtRisk' | 'LockedOut';
}

export interface LiteratureBenchmark {
    source: "Watson & Charentenay (2019)";
    effectiveLengthMeters: number; // The physical length of the array along the wind vector
    predictedMaxRiseF: number;    // Prediction from Eq(3)
    predictedAvgRiseF: number;    // Prediction from Eq(2)
}

export interface CapacityAnalysis {
    totalRatedCapacity: number;     // Sum of nameplate
    totalEffectiveCapacity: number; // Sum of actual
    capacityLossPct: number;        // % Total Loss
    redundancyStatus: number;       // Equivalent chillers (e.g., 1.5 chillers surplus)
    redundancyLabel: 'INTACT' | 'ERODED' | 'LOST' | 'CRITICAL';
    chillersAtRisk: number;         // Count > lockout - 5
    chillersLockedOut: number;      // Count > lockout
}

export interface SimulationResult {
    grid: ChillerNode[];
    maxTempRise: number;
    maxTotalTemp: number;
    avgTempRise: number;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    benchmark: LiteratureBenchmark;
    capacity: CapacityAnalysis;
    /** Index into the dataset array for the matched row (for debugging: which DB entry the outputs refer to). */
    matchedRowIndex: number;
}