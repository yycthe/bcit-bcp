import React from 'react';
import { ApplicationStatus } from '@/src/types';
import type { MerchantDocumentKey } from '@/src/lib/documentChecklist';
import { Button } from '@/src/components/ui/button';
import { Banner } from '@/src/components/ui/banner';
import { Section } from '@/src/components/ui/section';
import { PageHeader } from '@/src/components/ui/page-header';
import { Timeline, type TimelineStep } from '@/src/components/ui/timeline';
import {
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  Building,
  Upload,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

export type MissingDocumentItem = { key: MerchantDocumentKey; label: string };

interface Props {
  status: ApplicationStatus;
  onProceedToAgreement: () => void;
  adminNotice?: string;
  onDismissNotice?: () => void;
  missingDocuments?: MissingDocumentItem[];
  onStartGuidedUpload?: (startKey: MerchantDocumentKey) => void;
  onInlineUpload?: (key: MerchantDocumentKey) => void;
  matchedProcessor?: string;
  processorFollowUpComplete?: boolean;
  onOpenProcessorFollowUp?: () => void;
}

function MissingDocsList({
  items,
  onUpload,
}: {
  items: MissingDocumentItem[];
  onUpload?: (key: MerchantDocumentKey) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {items.map(({ key, label }) => (
        <li
          key={key}
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-xs"
        >
          <span className="text-sm text-foreground">{label}</span>
          {onUpload && (
            <Button
              type="button"
              size="sm"
              variant="brand"
              onClick={() => onUpload(key)}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function MerchantStatus({
  status,
  onProceedToAgreement,
  adminNotice,
  onDismissNotice,
  missingDocuments = [],
  onInlineUpload,
  matchedProcessor,
  processorFollowUpComplete,
  onOpenProcessorFollowUp,
}: Props) {
  const timelineSteps: TimelineStep[] = [
    {
      id: 'submitted',
      title: 'Application submitted',
      description: 'Your application and documents have been securely received.',
      icon: FileText,
      status: status !== 'draft' ? 'complete' : 'pending',
      meta: status !== 'draft' ? 'Done' : undefined,
    },
    {
      id: 'under_review',
      title: 'Verification & routing review',
      description:
        'Our team is checking KYC / KYB readiness, supporting documents, and processor routing.',
      icon: Clock,
      status:
        status === 'approved' || status === 'signed'
          ? 'complete'
          : status === 'under_review'
          ? 'active'
          : 'pending',
      meta: status === 'under_review' ? 'In progress' : undefined,
      children:
        status === 'under_review' ? (
          <div className="rounded-lg border border-info/20 bg-info-soft px-3 py-2 text-xs font-medium text-info-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-info" />
              Processing — please wait while we complete the review.
            </span>
          </div>
        ) : null,
    },
    {
      id: 'agreement',
      title: 'Decision & agreement',
      description: 'Review and sign your merchant processing agreement.',
      icon: CheckCircle2,
      status:
        status === 'signed'
          ? 'complete'
          : status === 'approved'
          ? 'active'
          : 'pending',
      meta:
        status === 'signed'
          ? 'Signed'
          : status === 'approved'
          ? 'Awaiting your signature'
          : undefined,
      children:
        status === 'approved' ? (
          <Button
            type="button"
            variant="brand"
            onClick={onProceedToAgreement}
            className="mt-1"
          >
            Review agreement
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Application status"
          title="Track your application"
          description="Watch progress as our review team verifies KYC / KYB, documents, and processor fit."
        />

        {status === 'under_review' && !adminNotice?.trim() && (
          <Banner
            intent="info"
            icon={Sparkles}
            title="AI pre-review in progress"
            description="Our AI assistant is reading your answers and uploaded documents. A human reviewer will confirm the final decision and reach out if anything is missing — no action needed from you right now."
          />
        )}

        {status === 'under_review' && adminNotice?.trim() && (
          <Banner
            intent="info"
            icon={MessageSquare}
            title="Message from review team"
            description={adminNotice}
            onDismiss={onDismissNotice}
          >
            {missingDocuments.length > 0 && onInlineUpload && (
              <>
                <p className="mt-2 text-xs font-semibold text-info-foreground">
                  Upload a document directly:
                </p>
                <MissingDocsList items={missingDocuments} onUpload={onInlineUpload} />
              </>
            )}
          </Banner>
        )}

        {status === 'under_review' &&
          !adminNotice?.trim() &&
          missingDocuments.length > 0 &&
          onInlineUpload && (
            <Banner
              intent="info"
              title="Strengthen your application"
              description="These documents are optional right now, but may speed up review."
            >
              <MissingDocsList items={missingDocuments} onUpload={onInlineUpload} />
            </Banner>
          )}

        {status === 'under_review' && matchedProcessor && onOpenProcessorFollowUp && (
          <Banner
            intent={processorFollowUpComplete ? 'success' : 'info'}
            icon={Building}
            title={`Processor routed: ${matchedProcessor}`}
            description={
              processorFollowUpComplete
                ? 'Processor-specific follow-up complete.'
                : `Please complete the ${matchedProcessor}-specific follow-up so your package is processor-ready.`
            }
            actions={
              !processorFollowUpComplete && (
                <Button type="button" variant="accent" onClick={onOpenProcessorFollowUp}>
                  Complete follow-up
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )
            }
          />
        )}

        <Section title="Application timeline" icon={Clock}>
          <Timeline steps={timelineSteps} />
        </Section>
      </div>
    </div>
  );
}
