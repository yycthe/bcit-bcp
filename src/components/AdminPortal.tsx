import React, { useMemo, useState } from 'react';
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
import {
  RULE_BASED_MASTER_PROMPT,
  RULE_BASED_PORTAL_RULES,
  RULE_BASED_WORKFLOW_STEPS,
} from '@/src/lib/ruleBasedWorkflow';
import { FormattedSummary } from '@/src/components/ui/formatted-summary';
import {
  ShieldCheck,
  LayoutDashboard,
  CheckCircle2,
  FileWarning,
  Send,
  Trash2,
  Building,
  Activity,
  AlertCircle,
  Globe,
  FileText,
  FileSearch,
  ShieldAlert,
  RefreshCcw,
  Sparkles,
  ThumbsUp,
  Inbox,
  Gauge,
  Bell,
  ScrollText,
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Banner } from '@/src/components/ui/banner';
import { Section } from '@/src/components/ui/section';
import { KpiTile } from '@/src/components/ui/kpi-tile';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Tabs } from '@/src/components/ui/tabs';
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

type AdminView = 'queue' | 'underwriting';
type QueueTab = 'notify' | 'kyc' | 'processor';
type ReviewTab = 'rule' | 'ai' | 'docs' | 'prompt';

function appStatusPill(status: ApplicationStatus): {
  intent: StatusIntent;
  label: string;
} {
  if (status === 'draft') return { intent: 'idle', label: 'Draft' };
  if (status === 'under_review') return { intent: 'in_progress', label: 'Reviewing' };
  if (status === 'approved') return { intent: 'needs_signature', label: 'Approved' };
  return { intent: 'complete', label: 'Signed' };
}

function getAvgTicketSize(vol: string, trans: string) {
  if (!vol || !trans) return 'Unknown';
  let volMid = 0;
  if (vol === '<10k') volMid = 5000;
  else if (vol === '10k-50k') volMid = 30000;
  else if (vol === '50k-250k') volMid = 150000;
  else if (vol === '>250k') volMid = 500000;
  let transMid = 0;
  if (trans === '<100') transMid = 50;
  else if (trans === '100-1k') transMid = 500;
  else if (trans === '1k-10k') transMid = 5000;
  else if (trans === '>10k') transMid = 25000;
  if (volMid && transMid) return `$${(volMid / transMid).toFixed(2)}`;
  return 'Unknown';
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
  const [queueTab, setQueueTab] = useState<QueueTab>('notify');
  const [reviewTab, setReviewTab] = useState<ReviewTab>('rule');
  const [reminderCustom, setReminderCustom] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [lastVerification, setLastVerification] = useState<VerificationCheckResult | null>(null);
  const [personaKybStatus, setPersonaKybStatus] = useState(merchantData.personaKybStatus || '');
  const [personaKycStatuses, setPersonaKycStatuses] = useState(
    merchantData.personaKycStatuses || ''
  );
  const [personaVerificationIssues, setPersonaVerificationIssues] = useState(
    merchantData.personaVerificationIssues || ''
  );
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const merchantName = merchantData.legalName || merchantData.ownerName || 'Unknown Merchant';
  const docChecklist = useMemo(
    () => getMerchantDocumentChecklist(merchantData),
    [merchantData]
  );
  const missingCount = docChecklist.filter((d) => !d.present).length;
  const presentCount = docChecklist.length - missingCount;
  const statusPill = appStatusPill(appStatus);

  const postAutoReminder = () => {
    setMerchantNoticeFromAdmin(buildDefaultDocumentReminder(merchantData));
    toast.success('Reminder posted to merchant portal');
  };

  const postCustomReminder = () => {
    const t = reminderCustom.trim();
    if (!t) {
      toast.error('Enter a message or use the auto reminder.');
      return;
    }
    setMerchantNoticeFromAdmin(t);
    toast.success('Custom notice posted to merchant portal');
  };

  const clearMerchantNotice = () => {
    setMerchantNoticeFromAdmin('');
    toast.message('Merchant notice cleared');
  };

  const runVerification = () => {
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
      toast.success('KYC / KYB review complete', {
        description: result.summary,
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const runRuleBasedUnderwriting = () => {
    const result = getFallbackUnderwriting(merchantData);
    setUnderwritingResult(result);
    toast.success('Rule-based review complete', {
      description: `Review score: ${result.riskScore}/100 — ${result.riskCategory}`,
    });
  };

  const runAiReview = async () => {
    setAiLoading(true);
    setAiError(null);
    const toastId = toast.loading('AI reviewing application...');
    try {
      let rule = underwritingResult;
      if (!rule) {
        rule = getFallbackUnderwriting(merchantData);
        setUnderwritingResult(rule);
      }
      const result = await requestAiReview(merchantData, rule, documents);
      setAiReview(result);
      toast.success('AI review complete', {
        id: toastId,
        description: `${result.riskCategory} risk — ${result.recommendedProcessor} (${Math.round(
          result.confidence * 100
        )}% confidence)`,
      });
      setReviewTab('ai');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setAiError(msg);
      toast.error('AI review failed', { id: toastId, description: msg });
    } finally {
      setAiLoading(false);
    }
  };

  const savePersonaResults = () => {
    if (personaKybStatus && !['passed', 'failed', 'pending'].includes(personaKybStatus)) {
      toast.error('KYB status must be passed, failed, or pending.');
      return;
    }
    if (!personaKybStatus && !personaKycStatuses && !personaVerificationIssues) {
      toast.error('Enter at least one KYC / KYB result field before saving.');
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
    toast.success('KYC / KYB verification results saved to merchant profile');
  };

  const scoreColor = (score: number) => {
    if (score <= 33) return 'text-success';
    if (score <= 66) return 'text-warning';
    return 'text-danger';
  };
  const scoreBar = (score: number) => {
    if (score <= 33) return 'bg-success';
    if (score <= 66) return 'bg-warning';
    return 'bg-danger';
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
              Workspace
            </p>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Rule-based review console
          </p>
          <p className="mt-1 text-[11px] text-foreground-muted leading-relaxed">
            Triage applications, run KYC / KYB, route processors and approve packages.
          </p>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          <SidebarItem
            label="Application queue"
            description="All merchant intakes"
            icon={LayoutDashboard}
            active={currentView === 'queue'}
            onClick={() => setCurrentView('queue')}
            trailing={appStatus !== 'draft' ? <span className="text-[10px] font-semibold text-foreground-muted">1</span> : null}
          />
          <SidebarItem
            label="Review report"
            description="Score, AI, decision"
            icon={ShieldCheck}
            active={currentView === 'underwriting'}
            disabled={appStatus === 'draft'}
            onClick={() => appStatus !== 'draft' && setCurrentView('underwriting')}
          />
        </nav>

        <div className="border-t border-border px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
            Current application
          </p>
          <p className="text-sm font-semibold text-foreground truncate">{merchantName}</p>
          <StatusPill intent={statusPill.intent} label={statusPill.label} />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface-muted/40">
        {currentView === 'queue' && (
          <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
                    Workspace
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                    Application queue
                  </h1>
                  <p className="text-sm text-foreground-muted">
                    Manage common intake, KYC / KYB verification, processor routing, and package readiness.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={runRuleBasedUnderwriting}
                    disabled={appStatus === 'draft'}
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Run rule review
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    onClick={() => setCurrentView('underwriting')}
                    disabled={appStatus === 'draft'}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Open review report
                  </Button>
                </div>
              </div>

              {appStatus === 'draft' ? (
                <EmptyState
                  icon={Inbox}
                  title="No pending applications"
                  description="Switch to the Merchant portal to submit an intake — it will appear here for review."
                />
              ) : (
                <>
                  {/* KPI tiles */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <KpiTile
                      label="Risk score"
                      value={
                        underwritingResult ? `${underwritingResult.riskScore}/100` : '—'
                      }
                      hint={underwritingResult ? underwritingResult.riskCategory : 'Not reviewed'}
                      icon={Gauge}
                      tone={
                        underwritingResult
                          ? underwritingResult.riskScore <= 33
                            ? 'success'
                            : underwritingResult.riskScore <= 66
                            ? 'warning'
                            : 'danger'
                          : 'neutral'
                      }
                    />
                    <KpiTile
                      label="Risk category"
                      value={underwritingResult?.riskCategory ?? '—'}
                      hint="Auto-derived"
                      icon={ShieldAlert}
                      tone={
                        underwritingResult?.riskCategory === 'Low'
                          ? 'success'
                          : underwritingResult?.riskCategory === 'Medium'
                          ? 'warning'
                          : underwritingResult?.riskCategory === 'High'
                          ? 'danger'
                          : 'neutral'
                      }
                    />
                    <KpiTile
                      label="Documents"
                      value={`${presentCount}/${docChecklist.length}`}
                      hint={
                        missingCount === 0
                          ? 'All required slots filled'
                          : `${missingCount} missing`
                      }
                      icon={FileText}
                      tone={missingCount === 0 ? 'success' : 'warning'}
                    />
                    <KpiTile
                      label="KYC / KYB"
                      value={
                        merchantData.personaKybStatus
                          ? merchantData.personaKybStatus.charAt(0).toUpperCase() +
                            merchantData.personaKybStatus.slice(1)
                          : 'Not received'
                      }
                      hint={
                        merchantData.personaKycStatuses
                          ? merchantData.personaKycStatuses.split(/[\n;,]/)[0]
                          : '—'
                      }
                      icon={ShieldCheck}
                      tone={
                        merchantData.personaKybStatus === 'passed'
                          ? 'success'
                          : merchantData.personaKybStatus === 'failed'
                          ? 'danger'
                          : merchantData.personaKybStatus === 'pending'
                          ? 'warning'
                          : 'neutral'
                      }
                    />
                    <KpiTile
                      label="Routed processor"
                      value={merchantData.matchedProcessor || 'Unassigned'}
                      hint={
                        underwritingResult?.recommendedProcessor
                          ? `Suggested: ${underwritingResult.recommendedProcessor}`
                          : '—'
                      }
                      icon={Building}
                      tone={merchantData.matchedProcessor ? 'brand' : 'neutral'}
                    />
                    <KpiTile
                      label="Status"
                      value={statusPill.label}
                      hint={
                        appStatus === 'under_review'
                          ? 'Awaiting your decision'
                          : appStatus === 'approved'
                          ? 'Sent to merchant for signing'
                          : appStatus === 'signed'
                          ? 'Agreement executed'
                          : 'Not submitted'
                      }
                      icon={Activity}
                      tone={
                        appStatus === 'signed'
                          ? 'success'
                          : appStatus === 'approved'
                          ? 'warning'
                          : appStatus === 'under_review'
                          ? 'info'
                          : 'neutral'
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                    {/* Left: snapshot + checklist + master prompt */}
                    <div className="space-y-6">
                      <Section title="Application snapshot" icon={Building}>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <SnapshotRow label="Merchant" value={merchantName} />
                          <SnapshotRow
                            label="Country"
                            value={merchantData.country || '—'}
                          />
                          <SnapshotRow
                            label="Industry"
                            value={merchantData.industry?.replace('_', ' ') || '—'}
                            capitalize
                          />
                          <SnapshotRow
                            label="Business type"
                            value={merchantData.businessType?.replace('_', ' ') || '—'}
                            capitalize
                          />
                          <SnapshotRow
                            label="Volume"
                            value={merchantData.monthlyVolume || '—'}
                          />
                          <SnapshotRow
                            label="Avg ticket"
                            value={getAvgTicketSize(
                              merchantData.monthlyVolume,
                              merchantData.monthlyTransactions
                            )}
                          />
                        </dl>
                      </Section>

                      <Section
                        title="Document checklist"
                        icon={FileWarning}
                        actions={
                          <Badge
                            variant={missingCount === 0 ? 'success' : 'warning'}
                          >
                            {presentCount}/{docChecklist.length}
                          </Badge>
                        }
                      >
                        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {docChecklist.map((row) => (
                            <li
                              key={row.key}
                              className={cn(
                                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                                row.present
                                  ? 'border-success/20 bg-success-soft/60'
                                  : 'border-warning/30 bg-warning-soft/60'
                              )}
                            >
                              <span className="text-foreground">{row.label}</span>
                              {row.present ? (
                                <Badge variant="success">On file</Badge>
                              ) : (
                                <Badge variant="warning">Missing</Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </Section>

                      <Section
                        title="Rule-based workflow prompt"
                        description="Source of truth for this demo flow — no AI / external KYC dependency."
                        icon={ScrollText}
                      >
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                              Portal flow
                            </p>
                            <ol className="mt-2 space-y-1.5">
                              {RULE_BASED_WORKFLOW_STEPS.map((step, idx) => (
                                <li
                                  key={step}
                                  className="flex gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs"
                                >
                                  <span className="font-semibold text-foreground-subtle">
                                    {idx + 1}.
                                  </span>
                                  <span className="text-foreground">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                              Guardrails
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {RULE_BASED_PORTAL_RULES.map((rule) => (
                                <li
                                  key={rule}
                                  className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs text-foreground"
                                >
                                  {rule}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <details className="lg:col-span-2 rounded-lg border border-border bg-surface-subtle px-3 py-2">
                            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                              View master prompt / question map
                            </summary>
                            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-xs leading-relaxed text-foreground">
                              {RULE_BASED_MASTER_PROMPT}
                            </pre>
                          </details>
                        </div>
                      </Section>

                      {merchantData.processorSpecificAnswers?.trim() && (
                        <Section
                          title="Processor-specific second-layer answers"
                          icon={FileText}
                          tone="brand"
                          description={`Routed processor: ${merchantData.matchedProcessor || 'Not yet routed'}`}
                        >
                          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm text-foreground">
                            {merchantData.processorSpecificAnswers}
                          </pre>
                        </Section>
                      )}
                    </div>

                    {/* Right: tabbed actions */}
                    <Section
                      title="Workspace actions"
                      icon={Activity}
                      contentClassName="p-0"
                    >
                      <Tabs<QueueTab>
                        value={queueTab}
                        onValueChange={setQueueTab}
                        className="px-5 sm:px-6"
                        items={[
                          { value: 'notify', label: 'Notify merchant' },
                          { value: 'kyc', label: 'KYC / KYB' },
                          { value: 'processor', label: 'Routing' },
                        ]}
                      />
                      <div className="p-5 sm:p-6">
                        {queueTab === 'notify' && (
                          <div className="space-y-3">
                            <p className="text-xs text-foreground-muted">
                              Shown as a banner on the Merchant portal while verification & routing review is in progress.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={postAutoReminder}
                              >
                                <Bell className="h-3.5 w-3.5" />
                                Post auto (missing list)
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={clearMerchantNotice}
                                className="text-danger hover:text-danger"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Clear notice
                              </Button>
                            </div>
                            <textarea
                              className="w-full min-h-[88px] rounded-md border border-border bg-surface p-3 text-sm shadow-xs outline-none transition-colors hover:border-border-strong focus:border-brand"
                              placeholder="Custom message to merchant…"
                              value={reminderCustom}
                              onChange={(e) => setReminderCustom(e.target.value)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="brand"
                              onClick={postCustomReminder}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Post custom message
                            </Button>
                            {merchantNoticeFromAdmin.trim() && (
                              <Banner
                                intent="info"
                                title="Active notice"
                                description={
                                  merchantNoticeFromAdmin.length > 220
                                    ? merchantNoticeFromAdmin.slice(0, 220) + '…'
                                    : merchantNoticeFromAdmin
                                }
                              />
                            )}
                          </div>
                        )}

                        {queueTab === 'kyc' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle mb-1">
                                  KYB status
                                </label>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus:border-brand outline-none"
                                  value={personaKybStatus}
                                  onChange={(e) => setPersonaKybStatus(e.target.value)}
                                >
                                  <option value="">— not yet received —</option>
                                  <option value="passed">Passed</option>
                                  <option value="failed">Failed</option>
                                  <option value="pending">Pending</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle mb-1">
                                  KYC status per person
                                </label>
                                <textarea
                                  className="w-full min-h-[60px] rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus:border-brand outline-none"
                                  placeholder={'Jane Doe (owner): passed\nJohn Smith (signer): pending'}
                                  value={personaKycStatuses}
                                  onChange={(e) => setPersonaKycStatuses(e.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle mb-1">
                                Verification issues
                              </label>
                              <textarea
                                className="w-full min-h-[48px] rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus:border-brand outline-none"
                                placeholder="identity mismatch, address mismatch — leave blank if none"
                                value={personaVerificationIssues}
                                onChange={(e) => setPersonaVerificationIssues(e.target.value)}
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="accent"
                                onClick={savePersonaResults}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Save KYC / KYB
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={verificationLoading}
                                onClick={runVerification}
                              >
                                Run rules check
                              </Button>
                            </div>
                            {lastVerification && (
                              <Banner
                                intent={lastVerification.status === 'clear' ? 'success' : 'warning'}
                                title={
                                  lastVerification.status === 'clear'
                                    ? 'Clear'
                                    : `Needs follow-up · ${lastVerification.issues.length} item${
                                        lastVerification.issues.length === 1 ? '' : 's'
                                      }`
                                }
                                description={lastVerification.summary}
                              >
                                {lastVerification.issues.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {lastVerification.issues.map((issue) => (
                                      <li
                                        key={issue.id}
                                        className="rounded border border-border bg-surface px-2 py-1.5 text-xs"
                                      >
                                        <span className="text-foreground">{issue.reason}</span>
                                        <span className="ml-1 text-foreground-subtle">
                                          — {issue.target.whereLabel}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </Banner>
                            )}
                          </div>
                        )}

                        {queueTab === 'processor' && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle mb-1">
                                Payment processor
                              </label>
                              <select
                                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs hover:border-border-strong focus:border-brand outline-none"
                                value={merchantData.matchedProcessor || ''}
                                onChange={(e) => {
                                  const processor = e.target.value;
                                  setMerchantData((prev) => ({
                                    ...prev,
                                    matchedProcessor: processor,
                                  }));
                                  if (processor) toast.success(`Processor set to ${processor}`);
                                  else toast.message('Processor assignment cleared');
                                }}
                              >
                                <option value="">— not assigned —</option>
                                <option value="Nuvei">Nuvei</option>
                                <option value="Payroc">Payroc / Peoples</option>
                                <option value="Chase">Chase</option>
                              </select>
                            </div>
                            {underwritingResult?.recommendedProcessor && (
                              <Banner
                                intent="info"
                                title={`Suggested: ${underwritingResult.recommendedProcessor}`}
                                description="Rule-based routing recommendation derived from intake answers."
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </Section>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {currentView === 'underwriting' && (
          <ReviewWorkspace
            appStatus={appStatus}
            setAppStatus={setAppStatus}
            merchantData={merchantData}
            documents={documents}
            docChecklist={docChecklist}
            underwritingResult={underwritingResult}
            aiReview={aiReview}
            aiLoading={aiLoading}
            aiError={aiError}
            reviewTab={reviewTab}
            setReviewTab={setReviewTab}
            runRuleBasedUnderwriting={runRuleBasedUnderwriting}
            runAiReview={runAiReview}
            setMerchantNoticeFromAdmin={setMerchantNoticeFromAdmin}
            scoreColor={scoreColor}
            scoreBar={scoreBar}
          />
        )}
      </div>
    </div>
  );
}

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
          {description && (
            <p className="mt-0.5 text-[11px] text-foreground-muted">{description}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function SnapshotRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-surface-subtle px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
        {label}
      </dt>
      <dd className={cn('text-sm font-medium text-foreground break-words', capitalize && 'capitalize')}>
        {value}
      </dd>
    </div>
  );
}

interface ReviewWorkspaceProps {
  appStatus: ApplicationStatus;
  setAppStatus: (status: ApplicationStatus) => void;
  merchantData: MerchantData;
  documents: FileData[];
  docChecklist: ReturnType<typeof getMerchantDocumentChecklist>;
  underwritingResult: UnderwritingDisplayResult | null;
  aiReview: AiReviewResult | null;
  aiLoading: boolean;
  aiError: string | null;
  reviewTab: ReviewTab;
  setReviewTab: (t: ReviewTab) => void;
  runRuleBasedUnderwriting: () => void;
  runAiReview: () => void;
  setMerchantNoticeFromAdmin: (msg: string) => void;
  scoreColor: (score: number) => string;
  scoreBar: (score: number) => string;
}

function ReviewWorkspace({
  appStatus,
  setAppStatus,
  merchantData,
  documents,
  docChecklist,
  underwritingResult,
  aiReview,
  aiLoading,
  aiError,
  reviewTab,
  setReviewTab,
  runRuleBasedUnderwriting,
  runAiReview,
  setMerchantNoticeFromAdmin,
  scoreColor,
  scoreBar,
}: ReviewWorkspaceProps) {
  const missing = docChecklist.filter((d) => !d.present);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/85 px-6 py-5 backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
              Verification & routing report
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {merchantData.legalName || merchantData.ownerName || 'Application'}
            </h1>
            <p className="text-sm text-foreground-muted">
              Rule-based review of readiness, KYC / KYB status, and processor routing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runRuleBasedUnderwriting}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {underwritingResult ? 'Re-run rule review' : 'Run rule review'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={aiLoading}
              onClick={runAiReview}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiLoading ? 'AI reviewing...' : aiReview ? 'Re-run AI review' : 'Run AI review'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {!underwritingResult ? (
            <EmptyState
              icon={Activity}
              title="No review data yet"
              description="Run a rule-based review to compute the score, recommended processor, and missing-item list."
              actions={
                <Button type="button" variant="brand" onClick={runRuleBasedUnderwriting}>
                  <Activity className="h-3.5 w-3.5" />
                  Run rule review
                </Button>
              }
            />
          ) : (
            <>
              {/* Score header */}
              <Section icon={Gauge} title="Review score">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                  <div className="flex flex-col items-start gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className={cn('text-5xl font-semibold tracking-tight', scoreColor(underwritingResult.riskScore))}>
                        {underwritingResult.riskScore}
                      </span>
                      <span className="text-sm text-foreground-subtle">/100</span>
                    </div>
                    <Badge
                      variant={
                        underwritingResult.riskCategory === 'Low'
                          ? 'success'
                          : underwritingResult.riskCategory === 'Medium'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {underwritingResult.riskCategory} risk
                    </Badge>
                    <div className="flex items-center gap-2 text-sm">
                      {underwritingResult.recommendedProcessor === 'Nuvei' && (
                        <Building className="h-4 w-4 text-accent" />
                      )}
                      {underwritingResult.recommendedProcessor === 'Payroc / Peoples' && (
                        <ShieldCheck className="h-4 w-4 text-brand" />
                      )}
                      {underwritingResult.recommendedProcessor === 'Chase' && (
                        <Globe className="h-4 w-4 text-info" />
                      )}
                      <span className="font-semibold text-foreground">
                        Route → {underwritingResult.recommendedProcessor}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className={cn('h-full transition-all duration-700', scoreBar(underwritingResult.riskScore))}
                        style={{ width: `${underwritingResult.riskScore}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-foreground-subtle">
                      <span>Low (0-33)</span>
                      <span>Medium (34-66)</span>
                      <span>High (67-100)</span>
                    </div>
                    <FormattedSummary
                      text={underwritingResult.reason}
                      emptyText="No recommendation reason."
                    />
                  </div>
                </div>
              </Section>

              {aiError && !aiReview && (
                <Banner
                  intent="danger"
                  title="AI review unavailable"
                  description={`${aiError}\n\nCheck that GOOGLE_API_KEY is set in Vercel environment variables. Rule-based review still works.`}
                />
              )}

              {/* Tabs */}
              <Section
                icon={ScrollText}
                title="Detailed analysis"
                description="Switch between rule engine output, AI review, document evidence, and the master prompt."
                contentClassName="p-0"
              >
                <Tabs<ReviewTab>
                  value={reviewTab}
                  onValueChange={setReviewTab}
                  className="px-5 sm:px-6"
                  items={[
                    { value: 'rule', label: 'Rule-based' },
                    {
                      value: 'ai',
                      label: 'AI review',
                      badge: aiReview ? (
                        <Badge variant="accent" className="ml-1 text-[9px]">
                          {Math.round(aiReview.confidence * 100)}%
                        </Badge>
                      ) : undefined,
                    },
                    { value: 'docs', label: 'Document evidence' },
                    { value: 'prompt', label: 'Master prompt' },
                  ]}
                />
                <div className="p-5 sm:p-6">
                  {reviewTab === 'rule' && (
                    <RuleTab
                      underwritingResult={underwritingResult}
                      merchantData={merchantData}
                    />
                  )}
                  {reviewTab === 'ai' && (
                    <AiTab
                      aiReview={aiReview}
                      aiLoading={aiLoading}
                      aiError={aiError}
                      ruleProcessor={underwritingResult.recommendedProcessor}
                      runAiReview={runAiReview}
                      setMerchantNoticeFromAdmin={setMerchantNoticeFromAdmin}
                    />
                  )}
                  {reviewTab === 'docs' && (
                    <DocsTab
                      documents={documents}
                      missing={missing}
                      summary={underwritingResult.documentSummary}
                    />
                  )}
                  {reviewTab === 'prompt' && (
                    <div className="space-y-3">
                      <p className="text-xs text-foreground-muted">
                        Frozen master prompt used by the rule engine. Each step maps to one or more intake questions.
                      </p>
                      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-subtle p-4 text-xs leading-relaxed text-foreground">
                        {RULE_BASED_MASTER_PROMPT}
                      </pre>
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      {underwritingResult && (
        <div className="sticky bottom-0 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur-md sm:px-10">
          <div className="mx-auto flex max-w-6xl flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
              <Badge
                variant={
                  underwritingResult.riskCategory === 'Low'
                    ? 'success'
                    : underwritingResult.riskCategory === 'Medium'
                    ? 'warning'
                    : 'danger'
                }
              >
                {underwritingResult.riskCategory}
              </Badge>
              <span className="hidden sm:inline">·</span>
              <span>{underwritingResult.recommendedProcessor}</span>
              {missing.length > 0 && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className="text-warning-foreground">
                    {missing.length} document slot{missing.length === 1 ? '' : 's'} empty
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runRuleBasedUnderwriting}
              >
                Re-run rule review
              </Button>
              <Button
                type="button"
                variant={appStatus === 'approved' || appStatus === 'signed' ? 'secondary' : 'brand'}
                size="lg"
                disabled={appStatus === 'approved' || appStatus === 'signed'}
                onClick={() => {
                  toast.success(
                    `Application approved — routed to ${underwritingResult.recommendedProcessor}`
                  );
                  setAppStatus('approved');
                }}
              >
                <ShieldCheck className="h-4 w-4" />
                {appStatus === 'approved' || appStatus === 'signed'
                  ? `Approved & routed to ${underwritingResult.recommendedProcessor}`
                  : `Approve & route to ${underwritingResult.recommendedProcessor}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleTab({
  underwritingResult,
  merchantData,
}: {
  underwritingResult: UnderwritingDisplayResult;
  merchantData: MerchantData;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            Key risk factors
          </p>
          <ul className="mt-2 space-y-2">
            {underwritingResult.riskFactors.map((factor, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm"
              >
                <AlertCircle
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    underwritingResult.riskCategory === 'High'
                      ? 'text-danger'
                      : underwritingResult.riskCategory === 'Medium'
                      ? 'text-warning'
                      : 'text-info'
                  )}
                />
                <span className="text-foreground leading-relaxed">{factor}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            Readiness decision
          </p>
          <div className="mt-2 rounded-xl border border-border bg-surface-subtle px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {underwritingResult.readinessDecision || 'No readiness decision.'}
            </p>
            {underwritingResult.missingItems.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {underwritingResult.missingItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-foreground-muted">No blocking missing items.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1">
          <FileSearch className="h-3 w-3" /> Cross-reference audit
        </p>
        <div
          className={cn(
            'mt-2 rounded-xl border px-4 py-3',
            underwritingResult.verificationStatus === 'Verified'
              ? 'border-success/25 bg-success-soft'
              : underwritingResult.verificationStatus === 'Discrepancies Found'
              ? 'border-danger/25 bg-danger-soft'
              : 'border-border bg-surface-subtle'
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            {underwritingResult.verificationStatus === 'Verified' && (
              <ShieldCheck className="h-4 w-4 text-success" />
            )}
            {underwritingResult.verificationStatus === 'Discrepancies Found' && (
              <ShieldAlert className="h-4 w-4 text-danger" />
            )}
            {underwritingResult.verificationStatus !== 'Verified' &&
              underwritingResult.verificationStatus !== 'Discrepancies Found' && (
                <AlertCircle className="h-4 w-4 text-foreground-muted" />
              )}
            <span className="text-foreground">{underwritingResult.verificationStatus}</span>
          </div>
          {underwritingResult.verificationNotes.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {underwritingResult.verificationNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                  <span className="leading-relaxed">{note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-foreground-muted">No specific audit notes.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            Merchant summary
          </p>
          <div className="mt-2">
            <FormattedSummary
              text={underwritingResult.merchantSummary}
              emptyText="No merchant summary."
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            KYC / KYB routing
          </p>
          <div className="mt-2">
            <FormattedSummary
              text={merchantData.personaInvitePlan || merchantData.personaVerificationSummary}
              emptyText="No KYC / KYB routing plan attached."
            />
          </div>
          {(underwritingResult.websiteReviewSummary || merchantData.websiteReviewSummary) && (
            <>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                Website review signals
              </p>
              <div className="mt-2">
                <FormattedSummary
                  text={
                    underwritingResult.websiteReviewSummary ||
                    merchantData.websiteReviewSummary
                  }
                  emptyText=""
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AiTab({
  aiReview,
  aiLoading,
  aiError,
  ruleProcessor,
  runAiReview,
  setMerchantNoticeFromAdmin,
}: {
  aiReview: AiReviewResult | null;
  aiLoading: boolean;
  aiError: string | null;
  ruleProcessor: string;
  runAiReview: () => void;
  setMerchantNoticeFromAdmin: (msg: string) => void;
}) {
  if (!aiReview) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No AI review yet"
        description="Run an AI review with Google Gemini to generate red flags, strengths, document consistency notes, and a merchant-ready message."
        actions={
          <Button
            type="button"
            variant="accent"
            onClick={runAiReview}
            disabled={aiLoading}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiLoading ? 'Reviewing...' : 'Run AI review'}
          </Button>
        }
      >
        {aiError && (
          <p className="mt-3 text-xs text-danger">{aiError}</p>
        )}
      </EmptyState>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            Recommended processor
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {aiReview.recommendedProcessor}
          </p>
          {aiReview.recommendedProcessor !== ruleProcessor && (
            <p className="mt-1 text-xs text-warning-foreground">
              Differs from rule engine ({ruleProcessor})
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            Recommended action
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground capitalize">
            {aiReview.recommendedAction.replace(/_/g, ' ')}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {aiReview.riskCategory} risk · {aiReview.riskScore}/100 ·{' '}
            {Math.round(aiReview.confidence * 100)}% confidence
          </p>
        </div>
      </div>

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
            <p className="mt-2 text-sm italic text-foreground-subtle">
              No red flags identified.
            </p>
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
            <p className="mt-2 text-sm italic text-foreground-subtle">
              No strengths identified.
            </p>
          )}
        </div>
      </div>

      {aiReview.docConsistencyNotes.length > 0 && (
        <Banner
          intent="warning"
          title="Document consistency notes"
          icon={FileSearch}
        >
          <ul className="mt-2 space-y-1 text-sm text-warning-foreground">
            {aiReview.docConsistencyNotes.map((note, idx) => (
              <li key={idx}>• {note}</li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Admin notes
        </p>
        <p className="mt-1.5 text-sm text-foreground leading-relaxed">{aiReview.adminNotes}</p>
      </div>

      <Banner
        intent="info"
        title="Merchant-facing message"
        description={`"${aiReview.merchantMessage}"`}
        actions={
          <Button
            type="button"
            size="sm"
            variant="accent"
            onClick={() => {
              setMerchantNoticeFromAdmin(aiReview.merchantMessage);
              toast.success('Posted AI-drafted message to merchant');
            }}
          >
            <Send className="h-3.5 w-3.5" />
            Send to merchant
          </Button>
        }
      />
    </motion.div>
  );
}

function DocsTab({
  documents,
  missing,
  summary,
}: {
  documents: FileData[];
  missing: ReturnType<typeof getMerchantDocumentChecklist>;
  summary: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Document summary
        </p>
        <div className="mt-2">
          <FormattedSummary text={summary} emptyText="No document data." tone="blue" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            Files on record
          </p>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm italic text-foreground-subtle">
              No documents uploaded yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="truncate">{doc.name}</span>
                </li>
              ))}
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
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{d.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
