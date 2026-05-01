import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useScriptieChatStore, type ScriptieMessage } from '@/stores/scriptieChatStore';

interface ScriptieChatProps {
  projectId: string;
}

type ChatMode = 'team' | 'scriptie';

const EMPTY_MESSAGES: ScriptieMessage[] = [];

const SUGGESTIONS = [
  { label: "Today's question", prompt: 'What scenes need wigs prepped?' },
  { label: 'Look usage', prompt: 'Which characters appear in the most scenes?' },
  { label: 'Budget status', prompt: 'How much budget is left, and what categories have I been spending in?' },
];

export function ScriptieChat({ projectId }: ScriptieChatProps) {
  const isOpen = useScriptieChatStore((s) => s.isOpen);
  const isLoading = useScriptieChatStore((s) => s.isLoading);
  const toggleOpen = useScriptieChatStore((s) => s.toggleOpen);
  const close = useScriptieChatStore((s) => s.close);
  const sendMessage = useScriptieChatStore((s) => s.sendMessage);
  const clearMessages = useScriptieChatStore((s) => s.clearMessages);
  const messages = useScriptieChatStore(
    (s) => s.messagesByProject[projectId] ?? EMPTY_MESSAGES,
  );

  const [mode, setMode] = useState<ChatMode>('team');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && mode === 'scriptie') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading, mode]);

  useEffect(() => {
    if (isOpen && mode === 'scriptie') inputRef.current?.focus();
  }, [isOpen, mode]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || isLoading) return;
    setInput('');
    await sendMessage(projectId, t);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="scriptie-fab"
          onClick={toggleOpen}
          aria-label="Open project chat"
          title="Project chat"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      {isOpen && (
        <>
          <div className="scriptie-backdrop" onClick={close} />
          <aside className="scriptie-panel" role="dialog" aria-label="Project chat">
            <div className="scriptie-header">
              <div className="scriptie-title">
                <span className="scriptie-status-dot" />
                <span className="scriptie-title-text">
                  <span className="heading-italic">Project</span>{' '}
                  <span className="heading-regular">Chat</span>
                </span>
              </div>
              <div className="scriptie-header-actions">
                {mode === 'scriptie' && (
                  <button
                    type="button"
                    className="scriptie-icon-btn"
                    onClick={() => clearMessages(projectId)}
                    title="Clear conversation"
                    aria-label="Clear conversation"
                    disabled={messages.length === 0}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  className="scriptie-icon-btn"
                  onClick={close}
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="scriptie-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'team'}
                className={`scriptie-tab ${mode === 'team' ? 'active' : ''}`}
                onClick={() => setMode('team')}
              >
                Team Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'scriptie'}
                className={`scriptie-tab ${mode === 'scriptie' ? 'active' : ''}`}
                onClick={() => setMode('scriptie')}
              >
                <span className="scriptie-tab-main">Ask Scriptie</span>
                <span className="scriptie-tab-sub">Project assistant</span>
              </button>
            </div>

            {mode === 'team' ? (
              <TeamChatPanel />
            ) : (
              <ScriptiePanel
                messages={messages}
                isLoading={isLoading}
                input={input}
                inputRef={inputRef}
                messagesEndRef={messagesEndRef}
                onChange={setInput}
                onKeyDown={onKeyDown}
                onSend={() => send(input)}
                onSuggestion={send}
              />
            )}
          </aside>
        </>
      )}
    </>
  );
}

function TeamChatPanel() {
  return (
    <>
      <div className="scriptie-body scriptie-body--placeholder">
        <div className="scriptie-placeholder">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <div className="scriptie-placeholder-title">Team Chat</div>
          <p className="scriptie-placeholder-desc">
            Synced project messaging for your team. Share updates, notes, and coordinate on set.
          </p>
          <div className="scriptie-placeholder-tag">Coming soon</div>
        </div>
      </div>
      <div className="scriptie-input-row">
        <textarea
          className="scriptie-input"
          placeholder="Message your team…"
          rows={1}
          disabled
        />
        <button type="button" className="scriptie-send" disabled aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </>
  );
}

interface ScriptiePanelProps {
  messages: ScriptieMessage[];
  isLoading: boolean;
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onSuggestion: (text: string) => void;
}

function ScriptiePanel({
  messages,
  isLoading,
  input,
  inputRef,
  messagesEndRef,
  onChange,
  onKeyDown,
  onSend,
  onSuggestion,
}: ScriptiePanelProps) {
  return (
    <>
      <div className="scriptie-body">
        {messages.length === 0 && !isLoading && (
          <div className="scriptie-welcome">
            <div className="scriptie-welcome-title">Hi, I'm Scriptie</div>
            <p className="scriptie-welcome-desc">
              I know this project's scenes, characters, looks, breakdowns, schedule, and budget. Ask me anything.
            </p>
            <div className="scriptie-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="scriptie-suggestion"
                  onClick={() => onSuggestion(s.prompt)}
                >
                  <span className="scriptie-suggestion-label">{s.label}</span>
                  <span className="scriptie-suggestion-prompt">{s.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`scriptie-msg scriptie-msg--${m.role}`}>
            <div className="scriptie-msg-bubble">{formatContent(m.content)}</div>
          </div>
        ))}

        {isLoading && (
          <div className="scriptie-msg scriptie-msg--assistant">
            <div className="scriptie-msg-bubble scriptie-msg-bubble--typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="scriptie-input-row">
        <textarea
          ref={inputRef}
          className="scriptie-input"
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Scriptie about this project…"
          rows={1}
          disabled={isLoading}
        />
        <button
          type="button"
          className="scriptie-send"
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </>
  );
}

function formatContent(content: string): ReactNode[] {
  return content.split('\n').flatMap((line, lineIdx, lines) => {
    const out: ReactNode[] = [];
    const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      if (match.index > lastIndex) out.push(line.slice(lastIndex, match.index));
      if (match[2]) out.push(<strong key={`${lineIdx}-b-${match.index}`}>{match[2]}</strong>);
      else if (match[3]) out.push(<em key={`${lineIdx}-i-${match.index}`}>{match[3]}</em>);
      else if (match[4]) out.push(<code key={`${lineIdx}-c-${match.index}`} className="scriptie-code">{match[4]}</code>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) out.push(line.slice(lastIndex));
    if (lineIdx < lines.length - 1) out.push(<br key={`br-${lineIdx}`} />);
    return out;
  });
}
