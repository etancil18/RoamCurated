'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function SharePreview() {
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${pathname}` : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-6 space-y-3 border p-4 rounded-xl bg-muted">
      <h3 className="font-semibold text-lg">📢 Share This Crawl</h3>
      <p className="text-sm text-muted-foreground">
        Invite your friends — just send them this link:
      </p>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={shareUrl}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm"
        />
        <Button onClick={handleCopy} variant="outline" size="sm">
          {copied ? 'Copied!' : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
