'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

type Props = {
  crawlId: string;
};

type Message = Database['public']['Tables']['crawl_messages']['Row'];

export default function SponsorChat({ crawlId }: Props) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  // 🔐 Current user
  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    }
    fetchUser();
  }, [supabase]);

  // 👑 Fetch host
  useEffect(() => {
    async function fetchHost() {
      const { data } = await supabase
        .from('crawl_events')
        .select('creator_id')
        .eq('id', crawlId)
        .single();

      setHostUserId(data?.creator_id ?? null);
    }

    fetchHost();
  }, [crawlId, supabase]);

  // 👤 Ensure names
  const ensureNames = useCallback(
    async (userIds: string[]) => {
      const idsToFetch = userIds.filter((id) => id && !nameByUserId[id]);
      if (!idsToFetch.length) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', idsToFetch);

      setNameByUserId((prev) => {
        const next = { ...prev };
        (data ?? []).forEach((p: any) => {
          next[p.id] = p.full_name?.trim() || 'Someone';
        });
        return next;
      });
    },
    [nameByUserId, supabase]
  );

  // 📥 Initial load
  useEffect(() => {
    async function fetchMessages() {
      const { data } = await supabase
        .from('crawl_messages')
        .select('*')
        .eq('crawl_id', crawlId)
        .order('created_at', { ascending: true });

      setMessages(data ?? []);

      const userIds = (data ?? [])
        .map((m) => m.user_id)
        .filter((id): id is string => !!id);

      await ensureNames(Array.from(new Set(userIds)));

      setLoading(false);
    }

    fetchMessages();
  }, [crawlId, supabase, ensureNames]);

  // 🔄 Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`crawl-${crawlId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crawl_messages',
          filter: `crawl_id=eq.${crawlId}`,
        },
        async (payload: RealtimePostgresInsertPayload<Message>) => {
          const newMessage = payload.new;

          if (newMessage?.user_id) {
            await ensureNames([newMessage.user_id]);
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crawlId, supabase, ensureNames]);

  // 🧠 Track whether user is near bottom
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;

    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const threshold = 100;

    shouldAutoScrollRef.current = distanceFromBottom <= threshold;
  };

  // 📜 Smart auto-scroll
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 🖱️ Scroll escape when chat pinned at bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wheelHandler = (e: WheelEvent) => {
      const delta = e.deltaY;

      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      // If chat is pinned at bottom and user scrolls UP,
      // prevent chat from moving and scroll the page instead.
      if (atBottom && delta < 0) {
        e.preventDefault();
        window.scrollBy({ top: delta });
      }
    };

    el.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      el.removeEventListener('wheel', wheelHandler);
    };
  }, []);

  // ✉️ Send
  async function sendMessage() {
    if (!input.trim() || !currentUserId) return;

    const trimmed = input.trim();

    const optimistic: Message = {
      id: crypto.randomUUID(),
      crawl_id: crawlId,
      user_id: currentUserId,
      message: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    await ensureNames([currentUserId]);

    await supabase.from('crawl_messages').insert({
      crawl_id: crawlId,
      user_id: currentUserId,
      message: trimmed,
    });
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-white dark:bg-neutral-900 dark:border-neutral-700">
      <h3 className="font-semibold text-lg text-black dark:text-white">
        Group Chat
      </h3>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[40vh] overflow-y-auto space-y-2 text-sm"
      >
        {loading && (
          <p className="text-muted-foreground dark:text-neutral-400">
            Loading chat...
          </p>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-muted-foreground dark:text-neutral-400">
            No messages yet. Be the first to say something 👋
          </p>
        )}

        {messages.map((m) => {
          const isOwn = m.user_id === currentUserId;
          const isHost = m.user_id === hostUserId;

          const displayName =
            nameByUserId[m.user_id] || (isOwn ? 'You' : 'Someone');

          const baseBubble = isOwn
            ? 'ml-auto bg-black text-white dark:bg-white dark:text-black'
            : 'bg-gray-100 text-black dark:bg-neutral-800 dark:text-white';

          const hostBorder = isHost
            ? 'border border-amber-400 dark:border-amber-500'
            : '';

          return (
            <div
              key={m.id}
              className={`p-2 rounded max-w-[75%] ${baseBubble} ${hostBorder}`}
            >
              <div className="whitespace-pre-line">{m.message}</div>

              <div
                className={`mt-1 text-[11px] flex items-center gap-2 ${
                  isOwn
                    ? 'text-white/70 dark:text-black/60'
                    : 'text-black/60 dark:text-white/50'
                }`}
              >
                <span>{displayName}</span>

                {isHost && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-semibold">
                    HOST
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm bg-white text-black border-gray-300 
                     dark:bg-neutral-800 dark:text-white dark:border-neutral-600"
          placeholder="Send a message..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage();
          }}
        />

        <button
          onClick={sendMessage}
          className="bg-black text-white px-4 py-2 rounded text-sm 
                     dark:bg-white dark:text-black"
        >
          Send
        </button>
      </div>
    </div>
  );
}