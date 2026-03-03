export interface TimesheetEntry {
  id: string;
  date: string;
  personName: string;
  role: string;
  hoursWorked: number;
  hourlyRate: number;
  overtime: number;
  notes?: string;
}

export interface WeekSummary {
  totalHours: number;
  totalOvertime: number;
  totalCost: number;
  entries: TimesheetEntry[];
}
