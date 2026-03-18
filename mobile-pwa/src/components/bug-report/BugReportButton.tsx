import { useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { v4 as uuidv4 } from 'uuid';

const BUG_REPORT_BUCKET = 'bug-reports';

export function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 3 screenshots
    const remaining = 3 - screenshots.length;
    const newFiles = files.slice(0, remaining);

    setScreenshots(prev => [...prev, ...newFiles]);

    // Generate previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the bug you encountered.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload screenshots to Supabase storage
      const screenshotUrls: string[] = [];

      if (isSupabaseConfigured && screenshots.length > 0) {
        for (const file of screenshots) {
          const ext = file.name.split('.').pop() || 'png';
          const path = `${uuidv4()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from(BUG_REPORT_BUCKET)
            .upload(path, file, {
              contentType: file.type || 'image/png',
              cacheControl: '3600',
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from(BUG_REPORT_BUCKET)
              .getPublicUrl(path);
            screenshotUrls.push(urlData.publicUrl);
          }
        }
      }

      // Send bug report via API
      const reportData = {
        description: description.trim(),
        screenshotUrls,
        userEmail: user?.email || 'Unknown',
        userName: user?.name || 'Unknown',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
      };

      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error('Failed to send bug report');
      }

      setSubmitted(true);
      setDescription('');
      setScreenshots([]);
      setPreviews([]);

      // Auto-close after showing success
      setTimeout(() => {
        setSubmitted(false);
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      console.error('[BugReport] Submit error:', err);
      setError('Failed to send report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setError(null);
    }
  };

  return (
    <>
      {/* Floating Bug Report Button - left side, above bottom nav */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 left-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full shadow-lg transition-all active:scale-95"
          style={{
            backgroundColor: '#ef4444',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
          }}
          aria-label="Report a bug"
        >
          {/* Bug icon */}
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-white text-xs font-semibold">Report Bug</span>
        </button>
      )}

      {/* Bug Report Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div
            className="w-full max-w-[430px] bg-card rounded-t-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col animate-slideUp"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-4 h-4" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Report a Bug</h2>
                  <p className="text-xs text-text-muted">Help us improve the beta!</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Bug Report Sent!</h3>
                  <p className="text-sm text-text-muted mt-1">Thank you for helping us improve.</p>
                </div>
              ) : (
                <>
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      What happened?
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the bug... What were you doing? What did you expect to happen? What happened instead?"
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold resize-none"
                    />
                  </div>

                  {/* Screenshot Upload */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      Screenshots <span className="text-text-muted font-normal">(up to 3)</span>
                    </label>

                    {/* Preview grid */}
                    {previews.length > 0 && (
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {previews.map((preview, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                            <img src={preview} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeScreenshot(idx)}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {screenshots.length < 3 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 border-2 border-dashed border-border rounded-xl text-text-muted text-sm flex items-center justify-center gap-2 active:bg-muted/30 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                        Add Screenshot
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                </>
              )}
            </div>

            {/* Submit Button */}
            {!submitted && (
              <div className="p-4 border-t border-border safe-bottom">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !description.trim()}
                  className="w-full py-3.5 rounded-button font-semibold text-base text-white shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                  style={{
                    backgroundColor: '#ef4444',
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Bug Report'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
