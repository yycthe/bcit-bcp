import React, { useEffect, useMemo, useState } from 'react';
import { ApplicationStatus, MerchantData, FileData } from '@/src/types';
import {
  getMerchantDocumentChecklist,
  buildDefaultDocumentReminder,
} from '@/src/lib/documentChecklist';
import {
  runLocalVerificationCheck,
  type VerificationCheckResult,
  type VerificationIssue,
} from '@/src/lib/localVerification';
import { buildPersonaSummary } from '@/src/lib/onboardingWorkflow';
import {
  getFallbackUnderwriting,
  type UnderwritingDisplayResult,
} from '@/src/lib/underwritingFallback';
import { requestAiReview, type AiReviewResult } from '@/src/lib/aiReview';
import { ONBOARDING_POLICY_PROMPT } from '@/src/lib/ruleBasedWorkflow';
import { usePersistentState } from '@/src/lib/persistentState';
import { FormattedSummary } from '@/src/components/ui/formatted-summary';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileWarning,
  FileSearch,
  FileText,
  Send,
  Building,
  Globe,
  Sparkles,
  ThumbsUp,
  Inbox,
  Bell,
  Gauge,
  LayoutDashboard,
  ScrollText,
  ChevronRight,
  Wand2,
  ArrowLeft,
  Zap,
  Ban,
  Trash2,
  Activity,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Banner } from '@/src/components/ui/banner';
import { Section } from '@/src/components/ui/section';
import { EmptyState } from '@/src/components/ui/empty-state';
import { StatusPill, type StatusIntent } from '@/src/components/ui/status-pill';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface Props {
  appStatus: ApplicationStatus;
  setAppStatus: (status: ApplicationStatus) => void;
  merchantData: MerchantData;
  setMerchantData: React.Dispatch<React.SetStateAction<MerchantData>>;
  documents: FileData[];
  underwritingResult: UnderwritingDisplayResult | null;
  setUnderwritingResult: (res: UnderwritingDisplayResult | null) => void;
  merchantNoticeFromAdmin: string;
  setMerchantNoticeFromAdmin: (msg: string) => void;
  setVerificationIssues: (items: VerificationIssue[]) => void;
}

type AdminView = 'queue' | 'workbench';

type ActionKind =
  | 'approve'
  | 'approve_with_conditions'
  | 'hold_for_review'
  | 'request_more_info'
  | 'decline';

const ACTION_META: Record<
  ActionKind,
  { label: string; intent: StatusIntent; tone: 'success' | 'brand' | 'warning' | 'danger' | 'info'; description: string }
> = {
  approve: {
    label: 'Approve',
    intent: 'complete',
    tone: 'success',
    description: 'All readiness checks passed. AI recommends approving and routing to the processor below.',
  },
  approve_with_conditions: {
    label: 'Approve with conditions',
    intent: 'needs_signature',
    tone: 'brand',
    description: 'AI recommends approving once the flagged conditions are acknowledged by the merchant.',
  },
  hold_for_review: {
    label: 'Hold for human review',
    intent: 'needs_review',
    tone: 'warning',
    description: 'AI is not confident enough to auto-approve. Escalate for a manual underwriter look.',
  },
  request_more_info: {
    label: 'Request more info',
    intent: 'needs_review',
    tone: 'warning',
    description: 'AI wants additional documents or clarifications before a decision can be made.',
  },
  decline: {
    label: 'Decline',
    intent: 'blocked',
    tone: 'danger',
    description: 'AI recommends declining the application based on hard blockers.',
  },
};

function appStatusPill(status: ApplicationStatus): { intent: StatusIntent; label: string } {
  if (status === 'draft') return { intent: 'idle', label: 'Draft' };
  if (status === 'under_review') return { intent: 'in_progress', label: 'Reviewing' };
  if (status === 'approved') return { intent: 'needs_signature', label: 'Approved' };
  return { intent: 'complete', label: 'Signed' };
}

function scoreColor(score: number) {
  if (score <= 33) return 'text-success';
  if (score <= 66) return 'text-warning';
  return 'text-danger';
}

function scoreBar(score: number) {
  if (score <= 33) return 'bg-success';
  if (score <= 66) return 'bg-warning';
  return 'bg-danger';
}

function formatSubmittedAt(merchantData: MerchantData): string {
  const raw = (merchantData as MerchantData & { submittedAt?: string }).submittedAt;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return 'just now';
}

export function AdminPortal({
  appStatus,
  setAppStatus,
  merchantData,
  setMerchantData,
  documents,
  underwritingResult,
  setUnderwritingResult,
  merchantNoticeFromAdmin,
  setMerchantNoticeFromAdmin,
  setVerificationIssues,
}: Props) {
  const [currentView, setCurrentView] = useState<AdminView>('queue');
  const [aiReview, setAiReview] = usePersistentState<AiReviewResult | null>('bcp:aiReview', null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStartedAt, setAiStartedAt] = useState<number | null>(null);
  const [aiElapsedMs, setAiElapsedMs] = useState<number | null>(null);
  const [aiLastDurationMs, setAiLastDurationMs] = usePersistentState<number | null>('bcp:aiLastDurationMs', null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Manual override state (kept local; committed to merchantData on save)
  const [personaKybStatus, setPersonaKybStatus] = useState(merchantData.personaKybStatus || '');
  const [personaKycStatuses, setPersonaKycStatuses] = useState(merchantData.personaKycStatuses || '');
  const [personaVerificationIssues, setPersonaVerificationIssues] = useState(
    merchantData.personaVerificationIssues || ''
  );
  const [customNotice, setCustomNotice] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [lastVerification, setLastVerification] = useState<VerificationCheckResult | null>(null);

  const merchantName = merchantData.legalName || merchantData.ownerName || 'Unknown Merchant';
  const hasApplication = appStatus !== 'draft';
  const statusPill = appStatusPill(appStatus);
  const docChecklist = useMemo(() => getMerchantDocumentChecklist(merchantData), [merchantData]);
  const missing = useMemo(() => docChecklist.filter((d) => !d.present), [docChecklist]);
  const presentCount = docChecklist.length - missing.length;

  // Count how many uploaded documents Gemini will actually inspect (inlineData):
  // has an HTTPS blob URL + mime is PDF/PNG/JPEG/WebP.
  const inspectableDocCount = useMemo(() => {
    const SUPPORTED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    const all = collectAdminDocuments(merchantData, documents);
    return all.filter((d) => {
      const mime = (d.mimeType || '').toLowerCase();
      const hasUrl = typeof d.data === 'string' && /^https?:\/\//i.test(d.data);
      return hasUrl && SUPPORTED.has(mime);
    }).length;
  }, [merchantData, documents]);

  // Keep manual override inputs in sync when the merchant data itself changes
  useEffect(() => {
    setPersonaKybStatus(merchantData.personaKybStatus || '');
    setPersonaKycStatuses(merchantData.personaKycStatuses || '');
    setPersonaVerificationIssues(merchantData.personaVerificationIssues || '');
  }, [merchantData.personaKybStatus, merchantData.personaKycStatuses, merchantData.personaVerificationIssues]);

  // If the current application resets (e.g. merchant cleared), drop back to queue view.
  useEffect(() => {
    if (!hasApplication && currentView === 'workbench') {
      setCurrentView('queue');
    }
  }, [hasApplication, currentView]);

  const runVerificationSilent = () => {
    setVerificationLoading(true);
    try {
      const result = runLocalVerificationCheck(merchantData);
      setLastVerification(result);
      setVerificationIssues(result.issues);
      setMerchantData((prev) => ({
        ...prev,
        personaInvitePlan: prev.personaInvitePlan || buildPersonaSummary(prev),
        personaVerificationSummary:
          result.status === 'clear'
            ? `Local KYC / KYB result: passed. ${result.summary}`
            : `Local KYC / KYB result: pending follow-up. ${result.summary}`,
      }));
    } finally {
      setVerificationLoading(false);
    }
  };

  const runAiReview = async (opts: { silent?: boolean } = {}) => {
    if (aiLoading) return null;
    const startedAt = Date.now();
    setAiLoading(true);
    setAiError(null);
    setAiStartedAt(startedAt);
    setAiElapsedMs(0);
    const toastId = opts.silent ? undefined : toast.loading('AI reviewing application...');
    try {
      const rule = underwritingResult ?? getFallbackUnderwriting(merchantData);
      const result = await requestAiReview(merchantData, rule, documents);
      setAiReview(result);
      setUnderwritingResult(null);
      const elapsed = Date.now() - startedAt;
      setAiLastDurationMs(elapsed);
      if (toastId !== undefined) {
        toast.success('AI review ready', {
          id: toastId,
          description: `${result.riskCategory} · ${Math.round(result.confidence * 100)}% confidence · ${(elapsed / 1000).toFixed(1)}s`,
        });
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setAiError(msg);
      setUnderwritingResult(getFallbackUnderwriting(merchantData));
      if (toastId !== undefined) {
        toast.error('AI review failed', { id: toastId, description: msg });
      }
      return null;
    } finally {
      setAiLoading(false);
      setAiStartedAt(null);
    }
  };

  // Tick elapsed timer while AI is running
  useEffect(() => {
    if (!aiLoading || aiStartedAt === null) return;
    const id = setInterval(() => setAiElapsedMs(Date.now() - aiStartedAt), 250);
    return () => clearInterval(id);
  }, [aiLoading, aiStartedAt]);

  // Auto-run rule + verification + AI when opening the workbench for a non-draft app.
  useEffect(() => {
    if (currentView !== 'workbench') return;
    if (!hasApplication) return;
    if (autoTriggered) return;
    setAutoTriggered(true);
    runVerificationSilent();
    if (!aiReview && !aiLoading) {
      void runAiReview({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, hasApplication]);

  // When merchant resets to an empty draft, wipe stale AI output so we don't
  // show a verdict that no longer matches the current (blank) application.
  useEffect(() => {
    if (!hasApplication && aiReview) {
      setAiReview(null);
      setAiError(null);
      setAiLastDurationMs(null);
    }
  }, [hasApplication, aiReview, setAiReview, setAiLastDurationMs]);

  const openWorkbench = () => {
    setCurrentView('workbench');
  };

  const backToQueue = () => {
    setCurrentView('queue');
  };

  const acceptAiPlan = (overrides?: {
    merchantMessage?: string;
    processor?: AiReviewResult['recommendedProcessor'];
  }) => {
    if (!aiReview) {
      toast.error('No AI plan available yet. Run AI review first.');
      return;
    }
    const action = aiReview.recommendedAction as ActionKind;
    const processor = overrides?.processor ?? aiReview.recommendedProcessor;
    const message = overrides?.merchantMessage ?? aiReview.merchantMessage;

    setMerchantData((prev) => ({
      ...prev,
      matchedProcessor: processor,
    }));

    if (message) {
      setMerchantNoticeFromAdmin(message);
    }

    if (action === 'approve' || action === 'approve_with_conditions') {
      setAppStatus('approved');
      toast.success(
        action === 'approve'
          ? `Approved & routed to ${processor}`
          : `Approved with conditions · routed to ${processor}`
      );
      return;
    }

    if (action === 'decline') {
      const ok = typeof window !== 'undefined'
        ? window.confirm('AI recommends declining this application. Confirm decline and notify the merchant?')
        : true;
      if (!ok) return;
      toast.message('Decline recorded · merchant notified');
      return;
    }

    toast.success(
      action === 'request_more_info'
        ? 'Merchant notified · waiting on additional information'
        : 'Flagged for human review · merchant notified'
    );
  };

  const savePersonaResults = () => {
    if (personaKybStatus && !['passed', 'failed', 'pending'].includes(personaKybStatus)) {
      toast.error('KYB status must be passed, failed, or pending.');
      return;
    }
    if (!personaKybStatus && !personaKycStatuses && !personaVerificationIssues) {
      toast.error('Enter at least one KYC / KYB field before saving.');
      return;
    }
    setMerchantData((prev) => ({
      ...prev,
      personaKybStatus,
      personaKycStatuses,
      personaVerificationIssues,
      personaVerificationSummary:
        [
          personaKybStatus ? `KYB status: ${personaKybStatus}` : '',
          personaKycStatuses ? `KYC status per person: ${personaKycStatuses}` : '',
          personaVerificationIssues ? `Verification issues: ${personaVerificationIssues}` : '',
        ]
          .filter(Boolean)
          .join('. ') || prev.personaVerificationSummary,
    }));
    toast.success('KYC / KYB results saved to merchant profile');
  };

  const postAutoReminder = () => {
    setMerchantNoticeFromAdmin(buildDefaultDocumentReminder(merchantData));
    toast.success('Reminder posted to merchant portal');
  };

  const postCustomReminder = () => {
    const t = customNotice.trim();
    if (!t) {
      toast.error('Enter a message or use the auto reminder.');
      return;
    }
    setMerchantNoticeFromAdmin(t);
    setCustomNotice('');
    toast.success('Custom notice posted to merchant portal');
  };

  const clearMerchantNotice = () => {
    setMerchantNoticeFromAdmin('');
    toast.message('Merchant notice cleared');
  };

  return (
    <div className="flex h-full w-full min-h-0">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface">
              Admin
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
              AI workbench
            </p>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">AI-driven review console</p>
          <p className="mt-1 text-[11px] text-foreground-muted leading-relaxed">
            AI makes the call · you approve, override, or request changes.
          </p>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          <SidebarItem
            label="Application queue"
            description={hasApplication ? '1 awaiting review' : 'Nothing in the queue'}
            icon={Inbox}
            active={currentView === 'queue'}
            onClick={() => setCurrentView('queue')}
            trailing={
              hasApplication ? (
                <Badge variant="neutral" className="text-[10px]">
                  1
                </Badge>
              ) : null
            }
          />
          <SidebarItem
            label="AI workbench"
            description={hasApplication ? merchantName : 'Open an application first'}
            icon={Sparkles}
            active={currentView === 'workbench'}
            disabled={!hasApplication}
            onClick={() => hasApplication && setCurrentView('workbench')}
          />
        </nav>

        <div className="border-t border-border px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
            Signed in as
          </p>
          <p className="text-sm font-semibold text-foreground">Onboarding admin</p>
          <p className="text-[11px] text-foreground-muted">Demo environment · single-tenant</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface-muted/40">
        {currentView === 'queue' && (
          <QueueList
            hasApplication={hasApplication}
            merchantData={merchantData}
            merchantName={merchantName}
            statusPill={statusPill}
            aiReview={aiReview}
            aiLoading={aiLoading}
            missing={missing.length}
            present={presentCount}
            total={docChecklist.length}
            onOpen={openWorkbench}
          />
        )}

        {currentView === 'workbench' && hasApplication && (
          <Workbench
            appStatus={appStatus}
            statusPill={statusPill}
            merchantData={merchantData}
            merchantName={merchantName}
            documents={documents}
            docChecklist={docChecklist}
            missing={missing}
            underwritingResult={underwritingResult}
            aiReview={aiReview}
            aiLoading={aiLoading}
            aiError={aiError}
            aiElapsedMs={aiElapsedMs}
            aiLastDurationMs={aiLastDurationMs}
            inspectableDocCount={inspectableDocCount}
            lastVerification={lastVerification}
            verificationLoading={verificationLoading}
            merchantNoticeFromAdmin={merchantNoticeFromAdmin}
            customNotice={customNotice}
            setCustomNotice={setCustomNotice}
            personaKybStatus={personaKybStatus}
            setPersonaKybStatus={setPersonaKybStatus}
            personaKycStatuses={personaKycStatuses}
            setPersonaKycStatuses={setPersonaKycStatuses}
            personaVerificationIssues={personaVerificationIssues}
            setPersonaVerificationIssues={setPersonaVerificationIssues}
            onBack={backToQueue}
            onRunAi={() => runAiReview()}
            onRunVerification={runVerificationSilent}
            onAcceptPlan={(overrides) => acceptAiPlan(overrides)}
            onSavePersona={savePersonaResults}
            onAutoReminder={postAutoReminder}
            onCustomReminder={postCustomReminder}
            onClearNotice={clearMerchantNotice}
            onProcessorOverride={(value) => {
              setMerchantData((prev) => ({ ...prev, matchedProcessor: value }));
              if (value) toast.success(`Processor overridden to ${value}`);
              else toast.message('Processor assignment cleared');
            }}
            onForceApprove={() => {
              setAppStatus('approved');
              toast.success(
                `Manually approved${merchantData.matchedProcessor ? ` · routed to ${merchantData.matchedProcessor}` : ''}`
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue (list only)
// ---------------------------------------------------------------------------

interface QueueListProps {
  hasApplication: boolean;
  merchantData: MerchantData;
  merchantName: string;
  statusPill: { intent: StatusIntent; label: string };
  aiReview: AiReviewResult | null;
  aiLoading: boolean;
  missing: number;
  present: number;
  total: number;
  onOpen: () => void;
}

function QueueList({
  hasApplication,
  merchantData,
  merchantName,
  statusPill,
  aiReview,
  aiLoading,
  missing,
  present,
  total,
  onOpen,
}: QueueListProps) {
  const industry = merchantData.industry || 'Industry pending';
  const country = merchantData.country || '—';
  const volume = merchantData.monthlyVolume || '—';
  const submitted = formatSubmittedAt(merchantData);

  const aiBadge = aiReview
    ? ACTION_META[aiReview.recommendedAction as ActionKind]
    : null;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            Application queue
          </h1>
          <p className="text-sm text-foreground-muted">
            AI reviews every submitted application. Open one to see the verdict and execute the plan.
          </p>
        </div>

        {!hasApplication ? (
          <EmptyState
            icon={Inbox}
            title="Nothing in the queue"
            description="Applications appear here the moment a merchant submits intake. AI review kicks in automatically."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-border bg-surface-muted/60 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-subtle">
              <span>Merchant</span>
              <span>Industry · Region</span>
              <span>Status</span>
              <span>AI verdict</span>
              <span className="sr-only">Open</span>
            </div>
            <button
              type="button"
              onClick={onOpen}
              className="group grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-surface-muted/60 focus-visible:bg-surface-muted/80 focus-visible:outline-none"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{merchantName}</p>
                <p className="mt-0.5 truncate text-[11px] text-foreground-muted">
                  {present}/{total} docs · {volume} monthly · submitted {submitted}
                </p>
              </div>
              <div className="min-w-0 text-xs text-foreground-muted">
                <p className="truncate capitalize">{industry.replace(/_/g, ' ')}</p>
                <p className="truncate">{country}</p>
              </div>
              <div>
                <StatusPill intent={statusPill.intent} label={statusPill.label} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                {aiBadge ? (
                  <>
                    <Badge variant={aiBadge.tone} className="w-fit">
                      {aiBadge.label}
                    </Badge>
                    <p className="truncate text-[11px] text-foreground-muted">
                      {aiReview!.riskCategory} · {aiReview!.riskScore}/100
                    </p>
                  </>
                ) : aiLoading ? (
                  <Badge variant="info" className="w-fit">
                    <Sparkles className="h-3 w-3" /> AI thinking…
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="w-fit">
                    Pending AI
                  </Badge>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          </div>
        )}

        <p className="text-[11px] text-foreground-subtle">
          Only the current demo application is shown. In production this list would page across every submitted merchant.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workbench (single merchant, AI-led)
// ---------------------------------------------------------------------------

interface WorkbenchProps {
  appStatus: ApplicationStatus;
  statusPill: { intent: StatusIntent; label: string };
  merchantData: MerchantData;
  merchantName: string;
  documents: FileData[];
  docChecklist: ReturnType<typeof getMerchantDocumentChecklist>;
  missing: ReturnType<typeof getMerchantDocumentChecklist>;
  underwritingResult: UnderwritingDisplayResult | null;
  aiReview: AiReviewResult | null;
  aiLoading: boolean;
  aiError: string | null;
  aiElapsedMs: number | null;
  aiLastDurationMs: number | null;
  inspectableDocCount: number;
  lastVerification: VerificationCheckResult | null;
  verificationLoading: boolean;
  merchantNoticeFromAdmin: string;
  customNotice: string;
  setCustomNotice: (v: string) => void;
  personaKybStatus: string;
  setPersonaKybStatus: (v: string) => void;
  personaKycStatuses: string;
  setPersonaKycStatuses: (v: string) => void;
  personaVerificationIssues: string;
  setPersonaVerificationIssues: (v: string) => void;
  onBack: () => void;
  onRunAi: () => void;
  onRunVerification: () => void;
  onAcceptPlan: (overrides?: {
    merchantMessage?: string;
    processor?: AiReviewResult['recommendedProcessor'];
  }) => void;
  onSavePersona: () => void;
  onAutoReminder: () => void;
  onCustomReminder: () => void;
  onClearNotice: () => void;
  onProcessorOverride: (value: string) => void;
  onForceApprove: () => void;
}

function Workbench(props: WorkbenchProps) {
  const {
    appStatus,
    statusPill,
    merchantData,
    merchantName,
    documents,
    docChecklist,
    missing,
    underwritingResult,
    aiReview,
    aiLoading,
    aiError,
    aiElapsedMs,
    aiLastDurationMs,
    inspectableDocCount,
    merchantNoticeFromAdmin,
    onBack,
    onRunAi,
    onAcceptPlan,
  } = props;

  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editProcessor, setEditProcessor] = useState<AiReviewResult['recommendedProcessor']>('Nuvei');

  const openEditModal = () => {
    if (!aiReview) return;
    setEditMessage(aiReview.merchantMessage || '');
    setEditProcessor(aiReview.recommendedProcessor);
    setEditPlanOpen(true);
  };

  const aiMeta = aiReview ? ACTION_META[aiReview.recommendedAction as ActionKind] : null;
  const isApproved = appStatus === 'approved' || appStatus === 'signed';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground-muted transition-colors hover:text-foreground"
              aria-label="Back to queue"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
                AI workbench
              </p>
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {merchantName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                <StatusPill intent={statusPill.intent} label={statusPill.label} />
                {aiMeta && (
                  <Badge variant={aiMeta.tone}>
                    <Sparkles className="h-3 w-3" /> {aiMeta.label}
                  </Badge>
                )}
                {aiLoading && (
                  <Badge variant="info">
                    <Sparkles className="h-3 w-3" />
                    {inspectableDocCount > 0
                      ? `AI reading ${inspectableDocCount} doc${inspectableDocCount === 1 ? '' : 's'}`
                      : 'AI thinking…'}
                    {aiElapsedMs !== null ? ` · ${(aiElapsedMs / 1000).toFixed(1)}s` : ''}
                  </Badge>
                )}
                {!aiLoading && aiLastDurationMs !== null && aiReview && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-foreground-subtle"
                    title="Last AI review duration"
                  >
                    <Clock className="h-3 w-3" />
                    {(aiLastDurationMs / 1000).toFixed(1)}s
                  </span>
                )}
                <span className="hidden sm:inline">·</span>
                <span>{merchantData.industry ? merchantData.industry.replace(/_/g, ' ') : 'Industry pending'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRunAi} disabled={aiLoading}>
              <Sparkles className="h-3.5 w-3.5" />
              {aiLoading ? 'AI reviewing…' : aiReview ? 'Re-run AI' : 'Run AI'}
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10">
        <div className="mx-auto max-w-6xl space-y-6 pb-24">
          {aiError && underwritingResult && (
            <Banner
              intent="warning"
              title="AI unavailable — deterministic baseline shown"
              description={`${aiError} Local policy-check output is restored below so you can still decide. Re-run AI when the service recovers.`}
            />
          )}

          <AiVerdict
            aiReview={aiReview}
            aiLoading={aiLoading}
            aiError={aiError}
            onRunAi={onRunAi}
            isApproved={isApproved}
            onConfirmDecision={() => onAcceptPlan()}
            onEditBeforeSend={openEditModal}
          />

          <ActionPlan
            aiReview={aiReview}
            missing={missing}
            merchantNoticeFromAdmin={merchantNoticeFromAdmin}
            isApproved={isApproved}
            onAcceptPlan={onAcceptPlan}
            onEditBeforeSend={openEditModal}
          />

          <Evidence
            aiReview={aiReview}
            merchantData={merchantData}
            documents={documents}
            docChecklist={docChecklist}
            missing={missing}
          />

          <ManualOverride {...props} />
        </div>
      </div>

      {editPlanOpen && aiReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-plan-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <h2 id="edit-plan-title" className="text-lg font-semibold text-foreground">
              Edit before confirming
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Adjust the merchant-visible message and routing processor, then confirm the AI decision.
            </p>
            <label className="mt-4 block space-y-1">
              <span className="text-xs font-medium text-foreground-subtle">Merchant message</span>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-brand"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
              />
            </label>
            <label className="mt-4 block space-y-1">
              <span className="text-xs font-medium text-foreground-subtle">Processor</span>
              <select
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-brand"
                value={editProcessor}
                onChange={(e) =>
                  setEditProcessor(e.target.value as AiReviewResult['recommendedProcessor'])
                }
              >
                <option value="Nuvei">Nuvei</option>
                <option value="Payroc / Peoples">Payroc / Peoples</option>
                <option value="Chase">Chase</option>
              </select>
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditPlanOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="brand"
                onClick={() => {
                  onAcceptPlan({
                    merchantMessage: editMessage,
                    processor: editProcessor,
                  });
                  setEditPlanOpen(false);
                }}
              >
                Apply & confirm decision
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-stretch gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            {missing.length > 0 && (
              <span className="text-warning-foreground">{missing.length} required uploads still missing</span>
            )}
            {missing.length === 0 && <span>Document checklist complete for current rules.</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="lg" variant="outline" disabled={isApproved || !aiReview} onClick={openEditModal}>
              Edit before confirming
            </Button>
            <Button
              type="button"
              size="lg"
              variant={isApproved ? 'secondary' : 'brand'}
              disabled={isApproved || !aiReview}
              onClick={() => onAcceptPlan()}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Decision recorded
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> Confirm AI decision
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Verdict hero
// ---------------------------------------------------------------------------

function AiVerdict({
  aiReview,
  aiLoading,
  aiError,
  onRunAi,
  isApproved,
  onConfirmDecision,
  onEditBeforeSend,
}: {
  aiReview: AiReviewResult | null;
  aiLoading: boolean;
  aiError: string | null;
  onRunAi: () => void;
  isApproved: boolean;
  onConfirmDecision: () => void;
  onEditBeforeSend: () => void;
}) {
  if (aiLoading && !aiReview) {
    return (
      <Section
        icon={Sparkles}
        title="AI reviewing application"
        description="Gemini 2.5 Pro is reading intake fields, attached PDFs/images, and your policy rules."
      >
        <div className="space-y-3">
          <div className="h-3 w-full animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-subtle" />
        </div>
      </Section>
    );
  }

  if (!aiReview) {
    return (
      <Section icon={Sparkles} title="AI verdict">
        <EmptyState
          icon={Sparkles}
          title="AI hasn't reviewed this yet"
          description={
            aiError
              ? aiError
              : 'Run an AI review to generate the recommendation, risk flags, and a merchant-ready message.'
          }
          actions={
            <Button type="button" variant="accent" onClick={onRunAi} disabled={aiLoading}>
              <Sparkles className="h-3.5 w-3.5" />
              {aiLoading ? 'Reviewing…' : 'Run AI review'}
            </Button>
          }
        />
      </Section>
    );
  }

  const meta = ACTION_META[aiReview.recommendedAction as ActionKind];
  const confidencePct = Math.round(aiReview.confidence * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Section
        icon={Sparkles}
        title="AI verdict"
        description="Powered by Gemini 2.5 Pro — recommendation from documents, intake answers, and onboarding policy."
        actions={
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-subtle">
            Multimodal review
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className={cn('text-5xl font-semibold tracking-tight', scoreColor(aiReview.riskScore))}>
                {aiReview.riskScore}
              </span>
              <span className="text-sm text-foreground-subtle">/100</span>
            </div>
            <Badge
              variant={
                aiReview.riskCategory === 'Low'
                  ? 'success'
                  : aiReview.riskCategory === 'Medium'
                  ? 'warning'
                  : 'danger'
              }
            >
              {aiReview.riskCategory} risk
            </Badge>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {aiReview.recommendedProcessor === 'Nuvei' && <Building className="h-4 w-4 text-accent" />}
              {aiReview.recommendedProcessor === 'Payroc / Peoples' && (
                <ShieldCheck className="h-4 w-4 text-brand" />
              )}
              {aiReview.recommendedProcessor === 'Chase' && <Globe className="h-4 w-4 text-info" />}
              Route → {aiReview.recommendedProcessor}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={meta.tone}>
                  <Sparkles className="h-3 w-3" /> {meta.label}
                </Badge>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-subtle">
                  {confidencePct}% confidence
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {meta.description}
              </p>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
              <div
                className={cn('h-full transition-all duration-700', scoreBar(aiReview.riskScore))}
                style={{ width: `${aiReview.riskScore}%` }}
              />
            </div>

            <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm leading-relaxed text-foreground">
              {aiReview.adminNotes}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="brand"
                size="lg"
                disabled={isApproved}
                onClick={onConfirmDecision}
              >
                <CheckCircle2 className="h-4 w-4" /> Confirm · {meta.label}
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={isApproved} onClick={onEditBeforeSend}>
                Edit before confirming
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Action plan checklist
// ---------------------------------------------------------------------------

function ActionPlan({
  aiReview,
  missing,
  merchantNoticeFromAdmin,
  isApproved,
  onAcceptPlan,
  onEditBeforeSend,
}: {
  aiReview: AiReviewResult | null;
  missing: ReturnType<typeof getMerchantDocumentChecklist>;
  merchantNoticeFromAdmin: string;
  isApproved: boolean;
  onAcceptPlan: (overrides?: {
    merchantMessage?: string;
    processor?: AiReviewResult['recommendedProcessor'];
  }) => void;
  onEditBeforeSend: () => void;
}) {
  if (!aiReview) return null;
  const meta = ACTION_META[aiReview.recommendedAction as ActionKind];

  const steps: Array<{ label: string; status: 'done' | 'pending' | 'warning'; detail?: string }> = [];

  if (aiReview.merchantMessage) {
    steps.push({
      label: 'Send AI-drafted message to the merchant',
      status: merchantNoticeFromAdmin === aiReview.merchantMessage ? 'done' : 'pending',
      detail: aiReview.merchantMessage,
    });
  }

  steps.push({
    label: `Route to ${aiReview.recommendedProcessor}`,
    status: 'pending',
    detail: 'Processor assignment follows the AI recommendation unless you edit before confirming.',
  });

  if (missing.length > 0) {
    steps.push({
      label: `Collect ${missing.length} missing document${missing.length === 1 ? '' : 's'}`,
      status: 'warning',
      detail: missing.map((m) => m.label).join(', '),
    });
  }

  if (aiReview.docConsistencyNotes.length > 0) {
    steps.push({
      label: 'Reconcile document inconsistencies',
      status: 'warning',
      detail: aiReview.docConsistencyNotes.join(' · '),
    });
  }

  steps.push({
    label: meta.label,
    status: isApproved ? 'done' : 'pending',
    detail: meta.description,
  });

  return (
    <Section
      icon={LayoutDashboard}
      title="Action plan"
      description="Checklist mirrors the AI recommendation. Use Confirm in the verdict card or footer, or edit first."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={isApproved} onClick={onEditBeforeSend}>
            Edit before confirming
          </Button>
          <Button type="button" size="sm" variant="brand" disabled={isApproved} onClick={() => onAcceptPlan()}>
            <Wand2 className="h-3.5 w-3.5" />
            {isApproved ? 'Applied' : 'Confirm decision'}
          </Button>
        </div>
      }
    >
      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <li
            key={idx}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3',
              step.status === 'done'
                ? 'border-success/30 bg-success-soft'
                : step.status === 'warning'
                ? 'border-warning/30 bg-warning-soft'
                : 'border-border bg-surface-subtle'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                step.status === 'done'
                  ? 'bg-success text-success-foreground'
                  : step.status === 'warning'
                  ? 'bg-warning text-warning-foreground'
                  : 'bg-surface text-foreground-muted ring-1 ring-border'
              )}
            >
              {step.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{step.label}</p>
              {step.detail && (
                <p className="mt-0.5 text-[12px] leading-relaxed text-foreground-muted break-words">
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Evidence (collapsible)
// ---------------------------------------------------------------------------

const MERCHANT_FILE_SLOT_LABELS: Record<string, string> = {
  idUpload: 'Owner ID',
  proofOfAddress: 'Proof of address',
  registrationCertificate: 'Registration certificate',
  taxDocument: 'Tax document',
  proofOfFunds: 'Proof of funds',
  bankStatement: 'Bank statement',
  financials: 'Financials',
  complianceDocument: 'Compliance document',
  enhancedVerification: 'Enhanced verification',
};

type AdminDocEntry = FileData & { slot: string; slotLabel?: string };

function collectAdminDocuments(merchantData: MerchantData, extra: FileData[]): AdminDocEntry[] {
  const entries: AdminDocEntry[] = [];
  const seenNames = new Set<string>();

  const push = (slot: string, source: FileData | undefined) => {
    if (!source || typeof source !== 'object') return;
    if (!source.name) return;
    const key = `${slot}:${source.name}`;
    if (seenNames.has(key)) return;
    seenNames.add(key);
    entries.push({
      ...source,
      slot,
      slotLabel: MERCHANT_FILE_SLOT_LABELS[slot],
    });
  };

  for (const slot of Object.keys(MERCHANT_FILE_SLOT_LABELS)) {
    push(slot, (merchantData as unknown as Record<string, unknown>)[slot] as FileData | undefined);
  }
  (Array.isArray(merchantData.additionalDocuments) ? merchantData.additionalDocuments : []).forEach((d, i) => {
    push(`additional-${i}`, d);
  });
  extra.forEach((d, i) => push(`chat-${i}`, d));

  return entries;
}

function Evidence({
  aiReview,
  merchantData,
  documents,
  missing,
}: {
  aiReview: AiReviewResult | null;
  merchantData: MerchantData;
  documents: FileData[];
  docChecklist: ReturnType<typeof getMerchantDocumentChecklist>;
  missing: ReturnType<typeof getMerchantDocumentChecklist>;
}) {
  const allDocumentsForReview = collectAdminDocuments(merchantData, documents);
  return (
    <details className="group rounded-2xl border border-border bg-surface shadow-xs">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-foreground-muted">
            <ScrollText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Evidence & reasoning</p>
            <p className="text-[11px] text-foreground-muted">
              AI observations, evidence citations, KYC snapshot, and files on record.
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-foreground-subtle transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-6 border-t border-border px-5 py-5 sm:px-6">
        {/* AI observations */}
        {aiReview && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-danger flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Red flags
              </p>
              {aiReview.redFlags.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {aiReview.redFlags.map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                      <span className="leading-relaxed">{flag}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm italic text-foreground-subtle">No red flags identified.</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-success flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> Strengths
              </p>
              {aiReview.strengths.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {aiReview.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm italic text-foreground-subtle">No strengths identified.</p>
              )}
            </div>
          </div>
        )}

        {aiReview && aiReview.docConsistencyNotes.length > 0 && (
          <Banner intent="warning" title="Document consistency notes" icon={FileSearch}>
            <ul className="mt-2 space-y-1 text-sm text-warning-foreground">
              {aiReview.docConsistencyNotes.map((note, idx) => (
                <li key={idx}>• {note}</li>
              ))}
            </ul>
          </Banner>
        )}

        {aiReview && (aiReview.evidenceCitations?.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1">
              <FileSearch className="h-3 w-3" /> Evidence citations
            </p>
            <ul className="mt-2 space-y-2">
              {(aiReview.evidenceCitations ?? []).map((c, idx) => (
                <li key={idx} className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground">
                  <span className="font-medium">{c.claim}</span>
                  <span className="text-foreground-muted"> — {c.source}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            KYC / KYB on file
          </p>
          <div className="mt-2">
            <FormattedSummary
              text={merchantData.personaInvitePlan || merchantData.personaVerificationSummary}
              emptyText="No KYC / KYB routing summary yet."
            />
          </div>
        </div>

        {/* Document inventory */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
              Files on record ({allDocumentsForReview.length})
            </p>
            {allDocumentsForReview.length === 0 ? (
              <p className="mt-2 text-sm italic text-foreground-subtle">No documents uploaded yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {allDocumentsForReview.map((doc) => {
                  const previewUrl =
                    typeof doc.data === 'string' && /^(https?:|data:)/i.test(doc.data) ? doc.data : null;
                  return (
                    <li
                      key={`${doc.slot}-${doc.name}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate" title={doc.name}>
                          {doc.name}
                        </span>
                        {doc.slotLabel ? (
                          <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                            {doc.slotLabel}
                          </span>
                        ) : null}
                      </div>
                      {previewUrl ? (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-foreground-muted transition hover:border-brand hover:bg-brand/10 hover:text-brand"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      ) : (
                        <span className="text-[10px] italic text-foreground-subtle">metadata only</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
              Missing required uploads
            </p>
            {missing.length === 0 ? (
              <p className="mt-2 text-sm italic text-foreground-subtle">
                All required uploads are on file.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {missing.map((d) => (
                  <li
                    key={d.key}
                    className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-foreground"
                  >
                    <FileWarning className="h-3.5 w-3.5 shrink-0" />
                    <span>{d.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Manual override (collapsible)
// ---------------------------------------------------------------------------

function ManualOverride({
  appStatus,
  merchantData,
  merchantNoticeFromAdmin,
  customNotice,
  setCustomNotice,
  personaKybStatus,
  setPersonaKybStatus,
  personaKycStatuses,
  setPersonaKycStatuses,
  personaVerificationIssues,
  setPersonaVerificationIssues,
  onSavePersona,
  onAutoReminder,
  onCustomReminder,
  onClearNotice,
  onProcessorOverride,
  onForceApprove,
  onRunVerification,
  verificationLoading,
}: WorkbenchProps) {
  const isApproved = appStatus === 'approved' || appStatus === 'signed';
  return (
    <details className="group rounded-2xl border border-border bg-surface shadow-xs">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-foreground-muted">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Advanced override (rare)</p>
            <p className="text-[11px] text-foreground-muted">
              Persona fields, custom notices, processor override, or manual approve — only when the AI path is insufficient.
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-foreground-subtle transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-6 border-t border-border px-5 py-5 sm:px-6">
        {/* Notify merchant */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1">
            <Bell className="h-3 w-3" /> Notify merchant
          </p>
          {merchantNoticeFromAdmin ? (
            <Banner
              intent="info"
              title="Current merchant notice"
              description={merchantNoticeFromAdmin}
              actions={
                <Button type="button" variant="outline" size="sm" onClick={onClearNotice}>
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              }
            />
          ) : (
            <p className="text-sm italic text-foreground-subtle">
              No notice posted to the merchant right now.
            </p>
          )}
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus-visible:border-brand outline-none"
            rows={3}
            placeholder="Write a custom message for the merchant portal…"
            value={customNotice}
            onChange={(e) => setCustomNotice(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onAutoReminder}>
              <Bell className="h-3.5 w-3.5" /> Post auto reminder
            </Button>
            <Button type="button" size="sm" variant="brand" onClick={onCustomReminder}>
              <Send className="h-3.5 w-3.5" /> Send custom notice
            </Button>
          </div>
        </div>

        {/* Persona KYC / KYB */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Persona KYC / KYB results
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={verificationLoading}
              onClick={onRunVerification}
            >
              <Activity className="h-3.5 w-3.5" /> Re-run local check
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block space-y-1 text-xs">
              <span className="text-foreground-subtle">KYB status</span>
              <select
                value={personaKybStatus}
                onChange={(e) => setPersonaKybStatus(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus-visible:border-brand outline-none"
              >
                <option value="">—</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs md:col-span-2">
              <span className="text-foreground-subtle">KYC status per person (one per line)</span>
              <textarea
                value={personaKycStatuses}
                onChange={(e) => setPersonaKycStatuses(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus-visible:border-brand outline-none"
                placeholder="Jane Doe: passed&#10;John Smith: pending"
              />
            </label>
            <label className="block space-y-1 text-xs md:col-span-3">
              <span className="text-foreground-subtle">Verification mismatches</span>
              <textarea
                value={personaVerificationIssues}
                onChange={(e) => setPersonaVerificationIssues(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus-visible:border-brand outline-none"
                placeholder="Address on ID does not match proof of address"
              />
            </label>
          </div>
          <div>
            <Button type="button" size="sm" variant="brand" onClick={onSavePersona}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Save KYC / KYB results
            </Button>
          </div>
        </div>

        {/* Processor override */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1">
            <Building className="h-3 w-3" /> Processor override
          </p>
          <select
            className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus-visible:border-brand outline-none"
            value={merchantData.matchedProcessor || ''}
            onChange={(e) => onProcessorOverride(e.target.value)}
          >
            <option value="">— not assigned —</option>
            <option value="Nuvei">Nuvei</option>
            <option value="Payroc">Payroc / Peoples</option>
            <option value="Chase">Chase</option>
          </select>
        </div>

        {/* Force approve */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1">
            <Zap className="h-3 w-3" /> Final decision
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isApproved ? 'secondary' : 'brand'}
              disabled={isApproved}
              onClick={onForceApprove}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {isApproved ? 'Already approved' : 'Force approve & route'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => toast.message('Declined (demo only)')}
            >
              <Ban className="h-3.5 w-3.5" /> Decline
            </Button>
          </div>
        </div>

        <details className="rounded-xl border border-border bg-surface-subtle">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-foreground-muted" /> Policy audit prompt (mirrors Gemini)
            </span>
            <ChevronRight className="h-4 w-4 text-foreground-subtle transition-transform group-open:rotate-90" />
          </summary>
          <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap border-t border-border px-4 py-3 text-xs leading-relaxed text-foreground">
            {ONBOARDING_POLICY_PROMPT}
          </pre>
        </details>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Sidebar item
// ---------------------------------------------------------------------------

function SidebarItem({
  label,
  description,
  icon: Icon,
  active,
  disabled,
  onClick,
  trailing,
}: {
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group w-full rounded-lg px-3 py-2.5 text-left transition-all',
        active
          ? 'bg-brand-soft/70 ring-1 ring-brand/20'
          : disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-surface-subtle'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
            active ? 'bg-brand text-brand-foreground' : 'bg-surface-subtle text-foreground-muted'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {trailing}
          </div>
          {description && <p className="mt-0.5 text-[11px] text-foreground-muted">{description}</p>}
        </div>
      </div>
    </button>
  );
}
