'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
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

  // ✅ NEW: host + names
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 🔐 Fetch current user once
  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);
    }

    fetchUser();
  }, [supabase]);

  // ✅ NEW: fetch host (creator) once
  useEffect(() => {
    async function fetchHost() {
      const { data, error } = await supabase
        .from('crawl_events')
        .select('creator_id')
        .eq('id', crawlId)
        .single();

      if (error) {
        console.error('[SponsorChat] Host fetch error:', error);
        return;
      }

      setHostUserId(data?.creator_id ?? null);
    }

    fetchHost();
  }, [crawlId, supabase]);

  // ✅ NEW: helper to fetch names for user ids
  async function ensureNames(userIds: string[]) {
    const idsToFetch = userIds.filter((id) => id && !nameByUserId[id]);
    if (idsToFetch.length === 0) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', idsToFetch);

    if (error) {
      console.error('[SponsorChat] Name fetch error:', error);
      return;
    }

    setNameByUserId((prev) => {
      const next = { ...prev };
      (data ?? []).forEach((p) => {
        const label =
          (p as any)?.full_name?.trim?.() ||
          'Someone';
        next[(p as any).id] = label;
      });
      return next;
    });
  }

  // 📥 Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('crawl_messages')
        .select('*')
        .eq('crawl_id', crawlId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[SponsorChat] Fetch error:', error);
      } else {
        setMessages(data ?? []);

        // ✅ NEW: fetch names for initial message authors
        const userIds = (data ?? [])
          .map((m) => m.user_id)
          .filter((id): id is string => typeof id === 'string');
        await ensureNames(Array.from(new Set(userIds)));
      }

      setLoading(false);
    }

    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlId, supabase]);

  // 🔄 Realtime subscription
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
          console.log('🔥 Realtime payload received:', payload);

          // ✅ NEW: fetch name for new author if needed
          if (payload?.new?.user_id) {
            await ensureNames([payload.new.user_id]);
          }

          setMessages((prev) => {
            // Prevent duplicate messages
            if (prev.some((m) => m.id === payload.new.id)) {
              return prev;
            }
            return [...prev, payload.new];
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlId, supabase, nameByUserId]);

  // 📜 Auto-scroll when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ✉️ Send message (Optimistic UI)
  async function sendMessage() {
    if (!input.trim() || !currentUserId) return;

    const trimmed = input.trim();

    // Optimistic insert
    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      crawl_id: crawlId,
      user_id: currentUserId,
      message: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput('');

    // ✅ NEW: ensure current user's name is available (for immediate label)
    await ensureNames([currentUserId]);

    const { error } = await supabase
      .from('crawl_messages')
      .insert({
        crawl_id: crawlId,
        user_id: currentUserId,
        message: trimmed,
      });

    if (error) {
      console.error('[SponsorChat] Insert error:', error);
    }
  }

  return (
  <div className="border rounded-lg p-4 space-y-4 bg-white dark:bg-neutral-900 dark:border-neutral-700">
    <h3 className="font-semibold text-lg text-black dark:text-white">
      Group Chat
    </h3>

    <div className="max-h-64 overflow-y-auto space-y-2 text-sm">
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
        const isHost = !!hostUserId && m.user_id === hostUserId;

        const displayName =
          (m.user_id && nameByUserId[m.user_id]) ||
          (isOwn ? 'You' : 'Someone');

        const baseBubble = isOwn
          ? 'ml-auto bg-black text-white dark:bg-white dark:text-black'
          : 'bg-gray-100 text-black dark:bg-neutral-800 dark:text-white';

        const hostEnhancement = isHost
          ? 'border border-amber-400 dark:border-amber-500'
          : '';

        return (
          <div
            key={m.id}
            className={`p-2 rounded max-w-[75%] ${baseBubble} ${hostEnhancement}`}
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