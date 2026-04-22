import React from 'react';
import type { MerchantDocumentKey } from '@/src/lib/documentChecklist';
import { Banner } from '@/src/components/ui/banner';
import { Button } from '@/src/components/ui/button';
import { MessageSquare, Upload } from 'lucide-react';

export type MissingDocumentItem = { key: MerchantDocumentKey; label: string };

interface Props {
  message: string;
  missingDocuments?: MissingDocumentItem[];
  onInlineUpload?: (key: MerchantDocumentKey) => void;
  onDismiss?: () => void;
}

/** Single place for admin → merchant copy: light “Message from review team” card + optional uploads. */
export function MerchantReviewTeamMessage({
  message,
  missingDocuments = [],
  onInlineUpload,
  onDismiss,
}: Props) {
  const trimmed = message.trim();
  if (!trimmed) return null;

  return (
    <Banner
      intent="info"
      icon={MessageSquare}
      title="Message from review team"
      description={trimmed}
      onDismiss={onDismiss}
    >
      {missingDocuments.length > 0 && onInlineUpload && (
        <>
          <p className="mt-2 text-xs font-semibold text-info-foreground">
            Upload a document directly:
          </p>
          <ul className="mt-3 space-y-2">
            {missingDocuments.map(({ key, label }) => (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-xs"
              >
                <span className="text-sm text-foreground">{label}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  onClick={() => onInlineUpload(key)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Banner>
  );
}
