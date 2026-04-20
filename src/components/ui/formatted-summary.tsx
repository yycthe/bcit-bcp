import React from 'react';

type SummaryTone = 'slate' | 'blue';

type SummaryItem = {
  label?: string;
  text: string;
};

function stripListMarker(line: string): string {
  return line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
}

function parseSummaryText(text: string): SummaryItem[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const sourceLines = normalized.includes('\n')
    ? normalized.split('\n')
    : normalized.split(/\s*;\s+/);

  return sourceLines
    .map((line) => stripListMarker(line.trim()))
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{1,36}):\s+(.+)$/);
      if (match) {
        return {
          label: match[1].trim(),
          text: match[2].trim(),
        };
      }
      return { text: line };
    });
}

export function FormattedSummary({
  text,
  emptyText,
  tone = 'slate',
}: {
  text?: string;
  emptyText: string;
  tone?: SummaryTone;
}) {
  const items = parseSummaryText(text ?? '');

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-4 text-sm italic text-foreground-subtle">
        {emptyText}
      </div>
    );
  }

  const palette =
    tone === 'blue'
      ? {
          item: 'rounded-xl border border-accent/15 bg-accent-soft/60 px-4 py-3 shadow-xs',
          label: 'mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-info-foreground',
          text: 'text-sm leading-6 text-foreground',
        }
      : {
          item: 'rounded-xl border border-border bg-surface px-4 py-3 shadow-xs',
          label:
            'mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-subtle',
          text: 'text-sm leading-6 text-foreground',
        };

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div key={`${item.label ?? 'item'}-${index}`} className={palette.item}>
          {item.label ? <p className={palette.label}>{item.label}</p> : null}
          <p className={palette.text}>{item.text}</p>
        </div>
      ))}
    </div>
  );
}
