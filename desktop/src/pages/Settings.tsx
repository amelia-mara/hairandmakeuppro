import { useState } from 'react';
import {
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Shield,
  Wifi,
  WifiOff,
  Database,
  Settings2,
} from 'lucide-react';
import { Button, Card, Input, Select, Checkbox, Modal, Badge } from '@/components/ui';

export default function Settings() {
  const [autoSave, setAutoSave] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState('30');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearData = () => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith('prep-happy')
    );
    keys.forEach((k) => localStorage.removeItem(k));
    setShowClearConfirm(false);
    window.location.reload();
  };

  const handleExportAll = () => {
    /* TODO: Gather all store data, serialize to JSON, and download */
    const allData: Record<string, string> = {};
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('prep-happy')) {
        allData[k] = localStorage.getItem(k) ?? '';
      }
    });
    const blob = new Blob([JSON.stringify(allData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prep-happy-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
    /* TODO: File picker for importing JSON backup */
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-text-primary tracking-wide">
        SETTINGS
      </h1>

      {/* General */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            General
          </h2>
        </div>
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Auto-save</p>
              <p className="text-xs text-text-muted mt-0.5">
                Automatically save your work at regular intervals
              </p>
            </div>
            <Checkbox
              checked={autoSave}
              onChange={() => setAutoSave(!autoSave)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Auto-save interval</p>
              <p className="text-xs text-text-muted mt-0.5">
                How often to save when auto-save is enabled
              </p>
            </div>
            <div className="w-40">
              <Select
                options={[
                  { value: '15', label: '15 seconds' },
                  { value: '30', label: '30 seconds' },
                  { value: '60', label: '1 minute' },
                  { value: '300', label: '5 minutes' },
                ]}
                value={autoSaveInterval}
                onChange={(e) => setAutoSaveInterval(e.target.value)}
                disabled={!autoSave}
              />
            </div>
          </div>
        </Card>
      </section>

      {/* AI Features */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            AI Features
          </h2>
          <Badge variant="default">Coming Soon</Badge>
        </div>
        <Card padding="md" className="space-y-4 opacity-60">
          <Select
            label="AI Provider"
            options={[
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'openai', label: 'OpenAI' },
            ]}
            value="anthropic"
            disabled
          />
          <Input
            label="API Key"
            type="password"
            placeholder="Enter API key..."
            disabled
          />
          <Select
            label="Model"
            options={[
              { value: 'claude-sonnet', label: 'Claude Sonnet' },
              { value: 'claude-haiku', label: 'Claude Haiku' },
            ]}
            value="claude-sonnet"
            disabled
          />
          <p className="text-xs text-text-muted">
            AI-assisted breakdown analysis and look suggestions will be
            available in a future update.
          </p>
        </Card>
      </section>

      {/* Sync */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Sync
          </h2>
          <Badge variant="default">Placeholder</Badge>
        </div>
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <WifiOff className="w-4 h-4 text-text-muted" />
              </div>
              <div>
                <p className="text-sm text-text-primary">
                  Checks Happy Mobile
                </p>
                <p className="text-xs text-text-muted">
                  Status: Not connected
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              disabled
            >
              Sync Now
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted border-t border-border-subtle pt-3">
            <span>Last sync: Never</span>
          </div>
          <p className="text-xs text-text-muted">
            Mobile sync will be available in a future update. Connect your
            Checks Happy mobile app to sync breakdowns to set.
          </p>
        </Card>
      </section>

      {/* Data */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Data
          </h2>
        </div>
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportAll}
            >
              Export All Data
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={handleImportData}
            >
              Import Data
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Export your entire project library as a JSON backup file, or import
            a previous backup to restore data.
          </p>
          <div className="border-t border-border-subtle pt-4">
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setShowClearConfirm(true)}
            >
              Clear All Data
            </Button>
            <p className="text-xs text-text-muted mt-2">
              Permanently delete all projects, breakdowns, budgets, timesheets,
              and settings. This action cannot be undone.
            </p>
          </div>
        </Card>
      </section>

      {/* Clear data confirmation modal */}
      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Data?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleClearData}>
              Clear Everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          This will permanently delete all projects, breakdowns, budgets,
          timesheets, and settings. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
