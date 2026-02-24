import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useBillingStore } from '@/stores/billingStore';
import { useAuthStore } from '@/stores/authStore';
import type {
  ExportDocument,
  ExportDocumentType,
  ExportProgress,
  ExportDeliveryMethod,
  UserTier,
} from '@/types';
import { EXPORT_DOCUMENTS } from '@/types';

interface ProjectExportScreenProps {
  onBack: () => void;
  onExportComplete?: () => void;
  onNavigateToBilling?: () => void;
}

// Tiers that can generate invoices
const INVOICE_TIERS: UserTier[] = ['supervisor', 'designer'];

export function ProjectExportScreen({ onBack, onExportComplete, onNavigateToBilling }: ProjectExportScreenProps) {
  const { currentProject, lifecycle, sceneCaptures } = useProjectStore();
  const { isBillingComplete } = useBillingStore();
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<ExportDocument[]>(
    EXPORT_DOCUMENTS.map(doc => ({ ...doc }))
  );

  // Check if user can generate invoices
  const canGenerateInvoice = user && INVOICE_TIERS.includes(user.tier);
  const invoiceSelected = documents.find(d => d.id === 'invoice_summary')?.selected;
  const billingComplete = isBillingComplete();
  const [deliveryMethod, setDeliveryMethod] = useState<ExportDeliveryMethod>('download');
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    status: 'idle',
    progress: 0,
  });

  // Calculate estimated file size based on selections
  const calculateEstimatedSize = (): string => {
    let totalBytes = 0;
    const selectedDocs = documents.filter(d => d.selected);

    selectedDocs.forEach(doc => {
      switch (doc.id) {
        case 'continuity_bible':
          // Estimate based on characters and photos
          totalBytes += 2 * 1024 * 1024; // Base 2MB
          break;
        case 'scene_breakdown':
          totalBytes += 50 * 1024; // ~50KB CSV
          break;
        case 'character_lookbooks':
          totalBytes += (currentProject?.characters.length || 0) * 1024 * 1024; // ~1MB per character
          break;
        case 'photo_archive':
          // Count photos
          const photoCount = Object.values(sceneCaptures).reduce((count, capture) => {
            let photos = 0;
            if (capture.photos.front) photos++;
            if (capture.photos.left) photos++;
            if (capture.photos.right) photos++;
            if (capture.photos.back) photos++;
            photos += capture.additionalPhotos.length;
            return count + photos;
          }, 0);
          totalBytes += photoCount * 500 * 1024; // ~500KB per photo
          break;
        case 'timesheets':
          totalBytes += 200 * 1024; // ~200KB
          break;
        case 'invoice_summary':
          totalBytes += 100 * 1024; // ~100KB
          break;
      }
    });

    if (totalBytes < 1024 * 1024) {
      return `~${Math.round(totalBytes / 1024)} KB`;
    }
    return `~${Math.round(totalBytes / (1024 * 1024))} MB`;
  };

  // Toggle document selection
  const toggleDocument = (docId: ExportDocumentType) => {
    setDocuments(docs =>
      docs.map(d => d.id === docId ? { ...d, selected: !d.selected } : d)
    );
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    const allSelected = documents.every(d => d.selected);
    setDocuments(docs => docs.map(d => ({ ...d, selected: !allSelected })));
  };

  // Get format badge color
  const getFormatBadgeClass = (format: string) => {
    switch (format) {
      case 'pdf':
        return 'bg-red-100 text-red-700';
      case 'csv':
      case 'excel':
        return 'bg-green-100 text-green-700';
      case 'zip':
      case 'pdf_zip':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Get format display name
  const getFormatDisplayName = (format: string) => {
    switch (format) {
      case 'pdf':
        return 'PDF';
      case 'csv':
        return 'CSV';
      case 'excel':
        return 'Excel';
      case 'zip':
        return 'ZIP';
      case 'pdf_zip':
        return 'PDF (zip)';
      default:
        return format.toUpperCase();
    }
  };

  // Handle export
  const handleExport = async () => {
    const selectedDocs = documents.filter(d => d.selected).map(d => d.id);
    if (selectedDocs.length === 0) return;

    setExportProgress({ status: 'preparing', progress: 0 });

    try {
      // Simulate export progress for now
      // In production, this would call actual export utilities
      for (let i = 0; i < selectedDocs.length; i++) {
        const doc = selectedDocs[i];
        setExportProgress({
          status: 'generating',
          currentDocument: doc,
          progress: Math.round((i / selectedDocs.length) * 80),
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setExportProgress({ status: 'packaging', progress: 90 });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate and download the export package
      await generateExportPackage(selectedDocs);

      setExportProgress({ status: 'complete', progress: 100 });

      // Wait a moment then call completion callback
      setTimeout(() => {
        onExportComplete?.();
      }, 1500);
    } catch (error) {
      setExportProgress({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Export failed',
      });
    }
  };

  // Generate export package (placeholder - will be implemented with actual export utilities)
  const generateExportPackage = async (selectedDocs: ExportDocumentType[]) => {
    // Import and use the export utilities
    const { generateContinuityBiblePDF } = await import('@/utils/exportUtils');
    const { generateSceneBreakdownCSV } = await import('@/utils/exportUtils');

    const exports: { filename: string; content: string; mimeType: string }[] = [];

    if (!currentProject) return;

    for (const docType of selectedDocs) {
      switch (docType) {
        case 'continuity_bible':
          const bibleHtml = generateContinuityBiblePDF(currentProject, sceneCaptures);
          exports.push({
            filename: `${currentProject.name}_Continuity_Bible.html`,
            content: bibleHtml,
            mimeType: 'text/html',
          });
          break;
        case 'scene_breakdown':
          const csvContent = generateSceneBreakdownCSV(currentProject, sceneCaptures);
          exports.push({
            filename: `${currentProject.name}_Scene_Breakdown.csv`,
            content: csvContent,
            mimeType: 'text/csv',
          });
          break;
        // Add more document types as they're implemented
      }
    }

    // Download each export
    for (const exp of exports) {
      const blob = new Blob([exp.content], { type: exp.mimeType === 'text/html' ? 'text/html;charset=utf-8' : exp.mimeType });
      const url = URL.createObjectURL(blob);

      if (exp.mimeType === 'text/html') {
        // Open HTML files in new window for print
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
          newWindow.addEventListener('load', () => {
            setTimeout(() => newWindow.print(), 500);
          });
        }
      } else {
        // Download other files
        const a = document.createElement('a');
        a.href = url;
        a.download = exp.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      URL.revokeObjectURL(url);
    }
  };

  const selectedCount = documents.filter(d => d.selected).length;
  const allSelected = documents.every(d => d.selected);

  // Get wrap date for display
  const getWrapDate = () => {
    if (lifecycle.wrappedAt) {
      return new Date(lifecycle.wrappedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (!currentProject) return null;

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Export Project</h1>
              <p className="text-xs text-text-muted">{currentProject.name} • Wrapped {getWrapDate()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        {/* Export Options Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light">
            SELECT DOCUMENTS
          </h2>
          <button
            onClick={toggleSelectAll}
            className="text-sm font-medium text-gold active:opacity-70 transition-opacity"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Document Checklist */}
        <div className="space-y-2 mb-6">
          {documents.map(doc => (
            <button
              key={doc.id}
              onClick={() => toggleDocument(doc.id)}
              className={`w-full card flex items-start gap-3 text-left transition-all ${
                doc.selected ? 'border-2 border-gold bg-gold/5' : ''
              }`}
            >
              {/* Checkbox */}
              <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                doc.selected ? 'bg-gold border-gold' : 'border-border'
              }`}>
                {doc.selected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-text-primary">{doc.name}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${getFormatBadgeClass(doc.format)}`}>
                    {getFormatDisplayName(doc.format)}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{doc.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Billing Details Prompt - shown when invoice is selected */}
        {invoiceSelected && canGenerateInvoice && onNavigateToBilling && (
          <div className={`mb-6 p-4 rounded-xl border ${
            billingComplete
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                billingComplete ? 'bg-green-100' : 'bg-amber-100'
              }`}>
                {billingComplete ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${billingComplete ? 'text-green-700' : 'text-amber-700'}`}>
                  {billingComplete ? 'Billing details complete' : 'Billing details incomplete'}
                </p>
                <p className={`text-xs mt-0.5 ${billingComplete ? 'text-green-600' : 'text-amber-600'}`}>
                  {billingComplete
                    ? 'Your personal info, bank details, and VAT settings will appear on the invoice.'
                    : 'Complete your billing details to generate professional invoices.'}
                </p>
                <button
                  onClick={onNavigateToBilling}
                  className={`mt-2 text-xs font-medium ${billingComplete ? 'text-green-700' : 'text-amber-700'} underline`}
                >
                  {billingComplete ? 'Edit billing details' : 'Complete billing details'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Tier Restriction - shown when invoice selected but user doesn't have access */}
        {invoiceSelected && !canGenerateInvoice && (
          <div className="mb-6 p-4 rounded-xl border bg-gray-50 border-gray-200">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gold/10">
                <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">
                  Supervisor Feature
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Upgrade to Supervisor or Designer to generate professional invoices with your billing details.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Method */}
        <div className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            DELIVERY METHOD
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'download', label: 'Save to Device', icon: 'download' },
              { id: 'share', label: 'Share', icon: 'share' },
            ].map(method => (
              <button
                key={method.id}
                onClick={() => setDeliveryMethod(method.id as ExportDeliveryMethod)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  deliveryMethod === method.id
                    ? 'border-gold bg-gold/5'
                    : 'border-border bg-card'
                }`}
              >
                <div className={`w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                  deliveryMethod === method.id ? 'bg-gold text-white' : 'bg-gray-100 text-text-muted'
                }`}>
                  {method.icon === 'download' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  )}
                </div>
                <span className="text-xs font-medium text-text-primary">{method.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Export Progress */}
        {exportProgress.status !== 'idle' && (
          <div className="mb-6 p-4 bg-card rounded-xl border border-border">
            {exportProgress.status === 'error' ? (
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm text-error font-medium">{exportProgress.error}</p>
              </div>
            ) : exportProgress.status === 'complete' ? (
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-text-primary font-medium">Export Complete!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-primary font-medium">
                    {exportProgress.status === 'preparing' && 'Preparing export...'}
                    {exportProgress.status === 'generating' && `Generating ${documents.find(d => d.id === exportProgress.currentDocument)?.name || ''}...`}
                    {exportProgress.status === 'packaging' && 'Packaging files...'}
                  </span>
                  <span className="text-sm text-text-muted">{exportProgress.progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress.progress}%` }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={selectedCount === 0 || ['preparing', 'generating', 'packaging'].includes(exportProgress.status)}
          className={`w-full py-4 rounded-button font-semibold text-base shadow-lg transition-all ${
            selectedCount === 0
              ? 'bg-gray-200 text-text-light cursor-not-allowed'
              : ['preparing', 'generating', 'packaging'].includes(exportProgress.status)
              ? 'bg-gold/70 text-white cursor-wait'
              : 'gold-gradient text-white active:scale-[0.98]'
          }`}
        >
          {['preparing', 'generating', 'packaging'].includes(exportProgress.status) ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Exporting...
            </span>
          ) : (
            <>
              Export {selectedCount > 0 ? `${selectedCount} Selected` : 'Documents'}
              {selectedCount > 0 && (
                <span className="ml-2 opacity-80">({calculateEstimatedSize()})</span>
              )}
            </>
          )}
        </button>

        {/* Project Stats */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <h3 className="text-xs font-semibold text-text-muted uppercase mb-3">Project Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-text-primary">{currentProject.scenes.length}</div>
              <div className="text-xs text-text-muted">Scenes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text-primary">{currentProject.characters.length}</div>
              <div className="text-xs text-text-muted">Characters</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text-primary">{currentProject.looks.length}</div>
              <div className="text-xs text-text-muted">Looks</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
