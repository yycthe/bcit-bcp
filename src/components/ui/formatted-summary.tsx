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
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm italic text-slate-500">
        {emptyText}
      </div>
    );
  }

  const palette =
    tone === 'blue'
      ? {
          wrapper: 'space-y-3',
          item: 'rounded-xl border border-blue-200/70 bg-white/80 px-4 py-3 shadow-sm shadow-blue-100/40',
          label:
            'mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700',
          text: 'text-sm leading-6 text-slate-800',
        }
      : {
          wrapper: 'space-y-3',
          item: 'rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm',
          label:
            'mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500',
          text: 'text-sm leading-6 text-slate-700',
        };

  return (
    <div className={palette.wrapper}>
      {items.map((item, index) => (
        <div key={`${item.label ?? 'item'}-${index}`} className={palette.item}>
          {item.label ? <p className={palette.label}>{item.label}</p> : null}
          <p className={palette.text}>{item.text}</p>
        </div>
      ))}
    </div>
  );
}
