import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Section from '../ui/Section'
import { ListGroup } from '../ui/ListGroup'
import GuestMessageBubble from './GuestMessageBubble';
import useGuestCommunication from '../../hooks/useGuestCommunication';
import LoadingSpinner from '../LoadingSpinner';

export default function GuestMessagePanel({ token, guestName }) {
  const { t } = useTranslation('guest');
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  const {
    loading,
    thread,
    messages,
    sending,
    connectionStatus,
    sendMessage,
    initialize,
    refresh,
    markMessageAsRead,
    messageListRef
  } = useGuestCommunication(token);

  // Initialize communication on mount - only run when token changes
  useEffect(() => {
    if (token) {
      initialize();
    }
  }, [token, initialize]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [draft]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;

    const messageContent = draft.trim();
    setDraft(''); // Clear immediately for better UX

    try {
      await sendMessage(messageContent);
    } catch (error) {
      // If sending fails, restore the draft
      setDraft(messageContent);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRefresh = () => {
    refresh();
  };


 return (
    <div className="h-full flex flex-col">
      {/* Header (blended) */}
      <Section title={t('supportChat.title')} subtitle={t('supportChat.subtitle')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={[
                'inline-block w-2 h-2 rounded-full',
                connectionStatus === 'SUBSCRIBED'
                  ? 'bg-emerald-500'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-yellow-400'
                  : 'bg-slate-400',
              ].join(' ')}
              title={t('supportChat.connectionStatus', { status: connectionStatus })}
            />
            <span className="text-xs text-slate-600">{connectionStatus}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
            aria-label={t('supportChat.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Section>

      {/* Messages (inset sheet) */}
      <div ref={messageListRef} className="flex-1 overflow-y-auto px-4 pt-1 pb-3">
        <div
          className="rounded-2xl bg-white/70 dark:bg-slate-900/50 backdrop-blur
                    supports-[backdrop-filter]:bg-white/60 ring-1 ring-slate-200/70 dark:ring-slate-700/60
                    p-3 min-h-[180px]"
        >
          {loading && messages.length === 0 ? (
            <div className="text-center py-8">
              <LoadingSpinner />
              <p className="text-slate-600 mt-2 text-sm">{t('supportChat.loadingMessages')}</p>
            </div>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                {!thread ? t('supportChat.emptyState.noThread.title') : t('supportChat.emptyState.hasThread.title')}
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                {!thread
                  ? t('supportChat.emptyState.noThread.description')
                  : t('supportChat.emptyState.hasThread.description')}
              </p>
            </div>
          ) : null}

          {messages.map((message, index) => {
            const formatTimeKey = (timestamp) => {
              const date = new Date(timestamp)
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            }
            const showTimestamp =
              index === 0 || formatTimeKey(message.created_at) !== formatTimeKey(messages[index - 1].created_at)

            return (
              <GuestMessageBubble
                key={message.id}
                message={message}
                showTimestamp={showTimestamp}
                onMarkAsRead={markMessageAsRead}
              />
            )
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

        {/* Composer (modern pill) */}
        <div className="px-4 pb-3 safe-pb">
          <div
            className="composer group rounded-2xl bg-white/90 dark:bg-slate-900/60 backdrop-blur
                      ring-1 ring-slate-200/70 dark:ring-slate-700/60 shadow-sm px-3 py-2.5
                      flex items-end gap-2 focus-within:ring-2 focus-within:ring-slate-300"
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={t('supportChat.composer.placeholder')}
              className="flex-1 bg-transparent appearance-none border-0 ring-0 outline-none
                        focus:border-transparent focus:ring-0 focus:outline-none focus-visible:outline-none
                        resize-none text-[15px] leading-5 placeholder-slate-400 max-h-32 min-h-[22px]
                        textarea-no-scrollbar"
              rows={1}
              disabled={sending}
            />

            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending || draft.length > 1000}
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-700 text-white
                        hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-slate-900
                        disabled:opacity-50 disabled:cursor-not-allowed transition"
              aria-label={t('supportChat.composer.sendButton')}
              type="button"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
    </div>
  );
}
