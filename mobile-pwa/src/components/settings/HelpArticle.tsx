import type { HelpArticle as HelpArticleType } from '@/data/helpContent';
import { getArticleById } from '@/data/helpContent';

interface HelpArticleProps {
  article: HelpArticleType;
  onBack: () => void;
  onNavigateToArticle: (id: string) => void;
}

export function HelpArticle({ article, onBack, onNavigateToArticle }: HelpArticleProps) {
  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button onClick={onBack} className="p-1 -ml-1">
              <svg className="w-5 h-5 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-text-primary truncate">{article.title}</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-6">
        {/* Steps */}
        <div className="card">
          <ol className="space-y-3">
            {article.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/10 text-gold text-xs font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Tip */}
        {article.tip && (
          <div className="mt-4 rounded-xl bg-gold/5 border border-gold/20 p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-gold">Tip: </span>
                {article.tip}
              </p>
            </div>
          </div>
        )}

        {/* Related Topics */}
        {article.relatedIds && article.relatedIds.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Related Topics</h3>
            <div className="space-y-2">
              {article.relatedIds.map((id) => {
                const related = getArticleById(id);
                if (!related) return null;
                return (
                  <button
                    key={id}
                    onClick={() => onNavigateToArticle(id)}
                    className="w-full card flex items-center gap-3 active:scale-[0.98] transition-transform"
                  >
                    <svg className="w-4 h-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <span className="text-sm text-text-secondary">{related.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
