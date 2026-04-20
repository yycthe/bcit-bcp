import React from 'react';
import {
  Building2,
  CheckCircle2,
  FileCheck,
  Activity,
  ShieldCheck,
  Sparkles,
  Mail,
} from 'lucide-react';
import { MerchantData, ApplicationStatus } from '@/src/types';
import { getMerchantDocumentChecklist } from '@/src/lib/documentChecklist';
import { Timeline, type TimelineStep } from '@/src/components/ui/timeline';
import { StatusPill } from '@/src/components/ui/status-pill';

interface Props {
  data: MerchantData;
  appStatus: ApplicationStatus;
}

type Field = { label: string; value?: string };

const normalizeValue = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const normalized = raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized || undefined;
};

const titleCase = (s?: string) =>
  normalizeValue(s)?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';

const yesNo = (raw?: string): string | undefined => {
  const normalized = normalizeValue(raw);
  if (!normalized) return undefined;
  const v = normalized.toLowerCase();
  if (!v) return undefined;
  if (v.startsWith('yes')) return 'Yes';
  if (v.startsWith('no')) return 'No';
  return normalized;
};

const maskAccount = (acc?: string): string | undefined => {
  const normalized = normalizeValue(acc);
  if (!normalized) return undefined;

  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 4) return `••${digits.slice(-4)}`;
  if (normalized.includes('•') || normalized.includes('*')) return normalized;
  if (normalized.length <= 4) return `••${normalized}`;
  return `••${normalized.slice(-4)}`;
};

export function MerchantSummaryRail({ data, appStatus }: Props) {
  const checklist = getMerchantDocumentChecklist(data);
  const total = checklist.length;
  const present = checklist.filter((c) => c.present).length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  const businessFields: Field[] = [
    { label: 'Legal name', value: normalizeValue(data.legalName || data.ownerName) },
    { label: 'DBA name', value: normalizeValue(data.dbaName && data.dbaName !== data.legalName ? data.dbaName : '') },
    { label: 'Business type', value: titleCase(data.businessType) },
    { label: 'Industry', value: titleCase(data.industry) },
    { label: 'Country', value: normalizeValue(data.country) },
    { label: 'Tax ID', value: normalizeValue(data.taxId) },
    { label: 'Established', value: normalizeValue(data.establishedDate || data.timeInBusiness) },
    { label: 'Website', value: normalizeValue(data.website) },
  ];

  const operationsFields: Field[] = [
    { label: 'Monthly volume', value: normalizeValue(data.monthlyVolume) },
    { label: 'Monthly transactions', value: normalizeValue(data.monthlyTransactions) },
    { label: 'Avg ticket size', value: normalizeValue(data.avgTicketSize) },
    { label: 'Highest ticket', value: normalizeValue(data.highestTicketAmount) },
    { label: 'Currently processes cards', value: yesNo(data.currentlyProcessesCards) },
    { label: 'Channels', value: normalizeValue(data.transactionChannelSplit) },
    { label: 'Target geography', value: normalizeValue(data.targetGeography) },
  ];

  const contactFields: Field[] = [
    { label: 'Owner', value: normalizeValue(data.ownerName) },
    { label: 'Authorized signer', value: normalizeValue(data.authorizedSignerName) },
    { label: 'Business phone', value: normalizeValue(data.businessPhone || data.phone) },
    { label: 'Email', value: normalizeValue(data.legalBusinessEmail || data.generalEmail || data.supportEmail) },
    { label: 'Bank', value: normalizeValue(data.bankName) },
    { label: 'Account', value: maskAccount(data.accountNumber) },
    { label: 'Settlement currency', value: normalizeValue(data.settlementCurrency) },
  ];

  const businessFilled = businessFields.filter((f) => f.value && f.value.trim()).length;
  const opsFilled = operationsFields.filter((f) => f.value && f.value.trim()).length;
  const contactFilled = contactFields.filter((f) => f.value && f.value.trim()).length;

  const hasHeading = Boolean(normalizeValue(data.legalName || data.ownerName || data.businessType));
  const hasAnyProfile = hasHeading || businessFilled + opsFilled + contactFilled > 0;
  const hasDocActivity = present > 0 || appStatus !== 'draft';

  const kybStatus = data.personaKybStatus?.toLowerCase();
  const kycStatuses = data.personaKycStatuses?.trim();
  const hasKycKyb = Boolean(kybStatus || kycStatuses) || appStatus !== 'draft';

  const showTimeline = appStatus !== 'draft';

  const timelineSteps: TimelineStep[] = [
    {
      id: 'intake',
      title: 'Intake',
      status: appStatus !== 'draft' ? 'complete' : 'active',
      meta: appStatus !== 'draft' ? 'Submitted' : 'In progress',
    },
    {
      id: 'review',
      title: 'Verification & routing',
      status:
        appStatus === 'approved' || appStatus === 'signed'
          ? 'complete'
          : appStatus === 'under_review'
          ? 'active'
          : 'pending',
      meta:
        appStatus === 'under_review'
          ? 'Reviewing'
          : appStatus === 'approved' || appStatus === 'signed'
          ? 'Done'
          : 'Awaiting',
    },
    {
      id: 'agreement',
      title: 'Agreement',
      status:
        appStatus === 'signed' ? 'complete' : appStatus === 'approved' ? 'active' : 'pending',
      meta: appStatus === 'signed' ? 'Signed' : appStatus === 'approved' ? 'Awaiting signature' : '—',
    },
  ];

  const isCompletelyEmpty =
    !hasAnyProfile && !hasDocActivity && !hasKycKyb && !data.matchedProcessor && !showTimeline;

  return (
    <aside className="hidden xl:flex w-[300px] min-w-0 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-surface-muted/60 px-5 py-6">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
          Application snapshot
        </p>
        {hasHeading ? (
          <>
            <p className="mt-1 break-words text-sm font-semibold text-foreground" title={data.legalName || data.ownerName}>
              {data.legalName || data.ownerName}
            </p>
            {data.businessType ? (
              <p className="text-xs text-foreground-muted">
                {data.businessType.replace('_', ' ')}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
            Your merchant profile will populate here as you answer questions.
          </p>
        )}
      </div>

      {isCompletelyEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center shadow-xs">
          <Sparkles className="mx-auto h-5 w-5 text-brand" />
          <p className="mt-2 text-xs font-semibold text-foreground">Nothing to show yet</p>
          <p className="mt-1 text-[11px] text-foreground-muted leading-relaxed">
            Start the intake on the left and we'll keep a live summary on this rail.
          </p>
        </div>
      ) : (
        <>
          {hasAnyProfile && (
            <>
              {businessFilled > 0 && (
                <FieldGroup
                  icon={Building2}
                  title="Business profile"
                  fields={businessFields}
                  filledCount={businessFilled}
                />
              )}
              {opsFilled > 0 && (
                <FieldGroup
                  icon={Activity}
                  title="Volume & processing"
                  fields={operationsFields}
                  filledCount={opsFilled}
                />
              )}
              {contactFilled > 0 && (
                <FieldGroup
                  icon={Mail}
                  title="Contacts & banking"
                  fields={contactFields}
                  filledCount={contactFilled}
                />
              )}
            </>
          )}

          {hasDocActivity && total > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileCheck className="h-3.5 w-3.5 text-brand" />
                  Documents
                </p>
                <span className="text-xs font-semibold text-foreground-muted">
                  {present}/{total}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-foreground-muted">
                {pct === 100
                  ? 'All required slots are filled.'
                  : `${total - present} item(s) outstanding.`}
              </p>
            </div>
          )}

          {hasKycKyb && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                KYC / KYB
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground-muted">KYB</span>
                  {kybStatus === 'passed' ? (
                    <StatusPill intent="complete" label="Passed" />
                  ) : kybStatus === 'failed' ? (
                    <StatusPill intent="blocked" label="Failed" />
                  ) : kybStatus === 'pending' ? (
                    <StatusPill intent="in_progress" label="Pending" />
                  ) : (
                    <StatusPill intent="idle" label="Not yet" />
                  )}
                </div>
                <p className="text-[11px] text-foreground-muted line-clamp-3">
                  {kycStatuses || 'KYC results will appear once received.'}
                </p>
              </div>
            </div>
          )}

          {data.matchedProcessor && (
            <div className="rounded-xl border border-brand/20 bg-brand-soft p-4 shadow-xs">
              <p className="flex items-center gap-2 text-xs font-semibold text-brand-strong">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Routed processor
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{data.matchedProcessor}</p>
              {data.processorSpecificAnswers?.trim() ? (
                <p className="mt-1 text-[11px] text-foreground-muted">Follow-up complete.</p>
              ) : (
                <p className="mt-1 text-[11px] text-foreground-muted">Awaiting processor follow-up.</p>
              )}
            </div>
          )}

          {showTimeline && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <p className="text-xs font-semibold text-foreground">Status timeline</p>
              <div className="mt-3">
                <Timeline steps={timelineSteps} size="sm" />
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

interface FieldGroupProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  fields: Field[];
  filledCount: number;
}

function FieldGroup({ icon: Icon, title, fields, filledCount }: FieldGroupProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface p-3 shadow-xs">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
          <Icon className="h-3.5 w-3.5 text-brand" />
          <span className="truncate">{title}</span>
        </p>
        <span className="text-[10px] font-semibold text-foreground-subtle tabular-nums">
          {filledCount}/{fields.length}
        </span>
      </div>
      <dl className="grid gap-1.5">
        {fields.map((f) => {
          const hasValue = Boolean(f.value && f.value.trim().length > 0);
          return (
            <div
              key={f.label}
              className="grid grid-cols-[minmax(0,112px)_minmax(0,1fr)] items-start gap-3 border-b border-border/60 pb-1.5 text-xs last:border-b-0 last:pb-0"
            >
              <dt className="min-w-0 text-[11px] font-medium text-foreground-muted">
                {f.label}
              </dt>
              <dd
                className={
                  hasValue
                    ? 'min-w-0 text-right text-xs font-medium text-foreground [overflow-wrap:anywhere]'
                    : 'min-w-0 text-right text-xs italic text-foreground-subtle [overflow-wrap:anywhere]'
                }
                title={hasValue ? (f.value as string) : undefined}
              >
                {hasValue ? f.value : 'N/A'}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
