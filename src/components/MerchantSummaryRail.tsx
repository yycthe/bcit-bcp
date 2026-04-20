import React from 'react';
import {
  Building2,
  CheckCircle2,
  FileCheck,
  Globe2,
  Briefcase,
  Activity,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { MerchantData, ApplicationStatus } from '@/src/types';
import { getMerchantDocumentChecklist } from '@/src/lib/documentChecklist';
import { Timeline, type TimelineStep } from '@/src/components/ui/timeline';
import { StatusPill } from '@/src/components/ui/status-pill';

interface Props {
  data: MerchantData;
  appStatus: ApplicationStatus;
}

export function MerchantSummaryRail({ data, appStatus }: Props) {
  const checklist = getMerchantDocumentChecklist(data);
  const total = checklist.length;
  const present = checklist.filter((c) => c.present).length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  const profileFields: { label: string; value?: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: 'Legal name', value: data.legalName || data.ownerName, icon: Building2 },
    { label: 'Industry', value: data.industry?.replace('_', ' '), icon: Briefcase },
    { label: 'Country', value: data.country, icon: Globe2 },
    { label: 'Monthly volume', value: data.monthlyVolume, icon: Activity },
  ];

  const filledProfileFields = profileFields.filter((f) => f.value && f.value.trim().length > 0);
  const hasHeading = Boolean(data.legalName || data.ownerName || data.businessType);
  const hasAnyProfile = hasHeading || filledProfileFields.length > 0;
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
    <aside className="hidden xl:flex w-[300px] shrink-0 flex-col gap-4 border-l border-border bg-surface-muted/60 px-5 py-6 overflow-y-auto">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
          Application snapshot
        </p>
        {hasHeading ? (
          <>
            <p className="mt-1 text-sm font-semibold text-foreground truncate">
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
          {filledProfileFields.length > 0 && (
            <dl className="grid gap-2 rounded-xl border border-border bg-surface p-3 shadow-xs">
              {filledProfileFields.map((f) => (
                <div key={f.label} className="flex items-start gap-2 text-xs">
                  <f.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
                  <div className="min-w-0 flex-1">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                      {f.label}
                    </dt>
                    <dd className="truncate text-foreground">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
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
