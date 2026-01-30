export interface SimulationInputs {
    rows: number;          // Number of rows (grid height)
    columns: number;       // Number of columns (grid width)
    rowSpacing: number;    // Feet (Distance between rows)
    colSpacing: number;    // Feet (Distance between columns)
    windSpeed: number;     // m/s (Continuous)
    windDirection: number; // Degrees 0-360
    flowRate: number;      // kCFM (Continuous)
    ambientTemp: number;   // Degrees Celsius (New)
    layout: boolean[];     // Grid active state (true = Chiller, false = Inlet/Gap)
    eftBase: boolean;      // Enable EFT Base for reduced re-entrainment
    fanExtension: boolean; // Enable Discharge Extension / Flow Straightener
}

export interface ChillerNode {
    id: string;
    index: number;
    row: number;
    col: number;
    tempRise: number; // Degrees Celsius
    totalTemp: number; // Absolute Intake Temp (Ambient + Rise)
    isMax: boolean;
    isActive: boolean;
}

export interface SimulationResult {
    grid: ChillerNode[];
    maxTempRise: number;
    maxTotalTemp: number;
    avgTempRise: number;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
}