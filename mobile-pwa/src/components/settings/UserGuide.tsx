import { useState, useMemo, type ChangeEvent } from 'react';
import { helpSections, searchHelp, getArticleById } from '@/data/helpContent';
import type { HelpArticle as HelpArticleType } from '@/data/helpContent';
import { HelpArticle } from './HelpArticle';
import { useTutorialStore } from '@/stores/tutorialStore';

interface UserGuideProps {
  onBack: () => void;
}

export function UserGuide({ onBack }: UserGuideProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeArticle, setActiveArticle] = useState<HelpArticleType | null>(null);
  const [articleHistory, setArticleHistory] = useState<HelpArticleType[]>([]);
  const { resetTutorial } = useTutorialStore();

  const searchResults = useMemo(() => searchHelp(searchQuery), [searchQuery]);
  const isSearching = searchQuery.trim().length > 0;

  const navigateToArticle = (id: string) => {
    const article = getArticleById(id);
    if (article) {
      if (activeArticle) {
        setArticleHistory((prev: HelpArticleType[]) => [...prev, activeArticle]);
      }
      setActiveArticle(article);
    }
  };

  const handleArticleBack = () => {
    if (articleHistory.length > 0) {
      const prev = articleHistory[articleHistory.length - 1];
      setArticleHistory((h: HelpArticleType[]) => h.slice(0, -1));
      setActiveArticle(prev);
    } else {
      setActiveArticle(null);
    }
  };

  const handleRestartTutorial = () => {
    resetTutorial();
  };

  // Show article detail view
  if (activeArticle) {
    return (
      <HelpArticle
        article={activeArticle}
        onBack={handleArticleBack}
        onNavigateToArticle={navigateToArticle}
      />
    );
  }

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
            <h1 className="text-lg font-semibold text-text-primary">Help & Guide</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        {/* Search bar */}
        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search help topics..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-text-primary placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
            >
              <svg className="w-4 h-4 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results */}
        {isSearching ? (
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-text-muted">No results found for "{searchQuery}"</p>
              </div>
            ) : (
              searchResults.map((article: HelpArticleType) => (
                <button
                  key={article.id}
                  onClick={() => { setActiveArticle(article); setArticleHistory([]); }}
                  className="w-full card flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <svg className="w-4 h-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-sm text-text-secondary text-left">{article.title}</span>
                  <svg className="w-4 h-4 text-text-light ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Section Cards */}
            <div className="space-y-3">
              {helpSections.map((section) => (
                <SectionCard
                  key={section.id}
                  title={section.title}
                  iconPath={section.icon}
                  articles={section.articles}
                  onArticleSelect={(article: HelpArticleType) => { setActiveArticle(article); setArticleHistory([]); }}
                />
              ))}
            </div>

            {/* Replay Tutorial */}
            <div className="mt-8 pt-6 border-t border-border">
              <div className="text-center">
                <p className="text-sm text-text-muted mb-3">Need a refresher?</p>
                <button
                  onClick={handleRestartTutorial}
                  className="px-6 py-3 rounded-button gold-gradient text-white font-semibold text-sm shadow-lg active:scale-[0.98] transition-transform"
                >
                  Restart Tutorial
                </button>
                <p className="text-xs text-text-light mt-2">
                  This will replay the welcome tutorial from the beginning.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Section Card with expandable article list
interface SectionCardProps {
  title: string;
  iconPath: string;
  articles: HelpArticleType[];
  onArticleSelect: (article: HelpArticleType) => void;
}

function SectionCard({ title, iconPath, articles, onArticleSelect }: SectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-gold-100/50 flex items-center justify-center text-gold flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted">{articles.length} {articles.length === 1 ? 'article' : 'articles'}</p>
        </div>
        <svg
          className={`w-5 h-5 text-text-light transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => onArticleSelect(article)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-background active:bg-background transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-text-light flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-sm text-text-secondary text-left">{article.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
