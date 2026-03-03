import { FileSpreadsheet, DollarSign, Clock } from 'lucide-react';
import { Modal, Card } from '@/components/ui';
import { useProjectStore, useBreakdownStore, useBudgetStore, useTimesheetStore } from '@/stores';
import {
  exportBreakdownXLSX,
  exportBudgetXLSX,
  exportTimesheetXLSX,
  downloadBlob,
} from '@/services/exportService';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const { currentProject, scenes, characters } = useProjectStore();
  const { sceneBreakdowns, looks } = useBreakdownStore();
  const { categories, entries: budgetEntries } = useBudgetStore();
  const { entries: timesheetEntries } = useTimesheetStore();

  const projectName = currentProject?.name || 'project';

  const handleExportBreakdown = () => {
    const blob = exportBreakdownXLSX({
      scenes,
      characters,
      breakdowns: sceneBreakdowns,
      looks,
    });
    downloadBlob(blob, `${projectName}_breakdown.xlsx`);
    onClose();
  };

  const handleExportBudget = () => {
    const blob = exportBudgetXLSX(categories, budgetEntries);
    downloadBlob(blob, `${projectName}_budget.xlsx`);
    onClose();
  };

  const handleExportTimesheet = () => {
    const blob = exportTimesheetXLSX(timesheetEntries);
    downloadBlob(blob, `${projectName}_timesheet.xlsx`);
    onClose();
  };

  const exports = [
    {
      icon: <FileSpreadsheet className="w-8 h-8 text-gold" />,
      title: 'Full Breakdown',
      description: 'All scenes, characters, looks, and breakdown notes as XLSX',
      action: handleExportBreakdown,
    },
    {
      icon: <DollarSign className="w-8 h-8 text-success" />,
      title: 'Budget Report',
      description: 'Department budget with categories and totals as XLSX',
      action: handleExportBudget,
    },
    {
      icon: <Clock className="w-8 h-8 text-info" />,
      title: 'Timesheet',
      description: 'All timesheet entries with hours and costs as XLSX',
      action: handleExportTimesheet,
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Export" maxWidth="max-w-lg">
      <div className="space-y-3">
        {exports.map((exp) => (
          <Card
            key={exp.title}
            hover
            padding="md"
            onClick={exp.action}
            className="flex items-center gap-4"
          >
            <div className="shrink-0">{exp.icon}</div>
            <div>
              <div className="font-medium text-text-primary">{exp.title}</div>
              <div className="text-sm text-text-secondary">{exp.description}</div>
            </div>
          </Card>
        ))}
      </div>
    </Modal>
  );
}
