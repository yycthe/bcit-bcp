import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChatApp } from './ChatApp';
import { ReviewPage } from './ReviewPage';
import { MerchantStatus } from './MerchantStatus';
import { AgreementPage } from './AgreementPage';
import { MerchantSummaryRail } from './MerchantSummaryRail';
import { MerchantData, FileData, ApplicationStatus, initialMerchantData } from '@/src/types';
import { demoMerchantData } from '@/src/lib/demoMerchantData';
import {
  getMerchantDocumentChecklist,
  getMissingDocumentLabels,
  getMissingDocumentKeys,
  type MerchantDocumentKey,
} from '@/src/lib/documentChecklist';
import { getFallbackUnderwriting, type UnderwritingDisplayResult } from '@/src/lib/underwritingFallback';
import { prepareFileForUpload } from '@/src/lib/uploadPreparation';
import type { VerificationIssue } from '@/src/lib/localVerification';
import {
  MessageSquare,
  FileCheck,
  Activity,
  PenTool,
  RotateCcw,
  Zap,
  Upload,
  Wand2,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Banner } from '@/src/components/ui/banner';
import { StatusPill, type StatusIntent } from '@/src/components/ui/status-pill';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

export type MerchantView = 'intake' | 'review' | 'status' | 'agreement';

interface Props {
  appStatus: ApplicationStatus;
  setAppStatus: (status: ApplicationStatus) => void;
  merchantData: MerchantData;
  setMerchantData: (data: MerchantData) => void;
  documents: FileData[];
  setDocuments: (docs: FileData[]) => void;
  underwritingResult: UnderwritingDisplayResult | null;
  setUnderwritingResult: (res: UnderwritingDisplayResult | null) => void;
  merchantNoticeFromAdmin: string;
  onDismissMerchantNotice: () => void;
  verificationIssues: VerificationIssue[];
  onClearVerificationIssues: () => void;
}

interface NavItemSpec {
  id: MerchantView;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItemSpec[] = [
  {
    id: 'intake',
    label: 'Intake assistant',
    description: 'Guided wizard for business details & documents',
    icon: MessageSquare,
  },
  {
    id: 'review',
    label: 'Review application',
    description: 'Confirm everything before submitting',
    icon: FileCheck,
  },
  {
    id: 'status',
    label: 'Application status',
    description: 'Track verification & routing progress',
    icon: Activity,
  },
  {
    id: 'agreement',
    label: 'Agreement',
    description: 'Sign your processing agreement',
    icon: PenTool,
  },
];

export function MerchantPortal({
  appStatus,
  setAppStatus,
  merchantData,
  setMerchantData,
  documents,
  setDocuments,
  underwritingResult,
  setUnderwritingResult,
  merchantNoticeFromAdmin,
  onDismissMerchantNotice,
  verificationIssues,
  onClearVerificationIssues,
}: Props) {
  const [currentView, setCurrentView] = useState<MerchantView>('intake');
  const [isFinished, setIsFinished] = useState(false);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [intakeSessionKey, setIntakeSessionKey] = useState(0);
  const [guidedTourOrder, setGuidedTourOrder] = useState<MerchantDocumentKey[] | null>(null);

  const inlineUploadRef = useRef<HTMLInputElement>(null);
  const inlineUploadTargetRef = useRef<MerchantDocumentKey | null>(null);

  const handleInlineUpload = useCallback((key: MerchantDocumentKey) => {
    inlineUploadTargetRef.current = key;
    inlineUploadRef.current?.click();
  }, []);

  const onInlineFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const key = inlineUploadTargetRef.current;
      if (!file || !key) return;
      const toastId = toast.loading(`Uploading ${file.name}...`);
      try {
        const prepared = await prepareFileForUpload(file);
        prepared.notices.forEach((n) => {
          if (n.level === 'warning') toast.warning(n.message);
          else toast.success(n.message);
        });
        setMerchantData({
          ...merchantData,
          [key]: { ...prepared.fileData, uploadDate: new Date().toISOString(), documentType: key },
        });
        toast.success(`${file.name} uploaded`, {
          id: toastId,
          description:
            getMissingDocumentLabels({ ...merchantData, [key]: prepared.fileData as any } as any)
              .length === 0
              ? 'All required documents are now on file.'
              : 'Saved to merchant profile.',
        });
      } catch (err) {
        toast.error('Upload failed', {
          id: toastId,
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        e.target.value = '';
        inlineUploadTargetRef.current = null;
      }
    },
    [merchantData, setMerchantData]
  );

  useEffect(() => {
    if (appStatus === 'under_review' && currentView === 'review') setCurrentView('status');
    if (appStatus === 'approved' && currentView === 'status') setCurrentView('agreement');
  }, [appStatus, currentView]);

  useEffect(() => {
    const hasProgress = currentView === 'intake' && !isFinished && merchantData.legalName?.trim();
    if (!hasProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentView, isFinished, merchantData.legalName]);

  const docChecklist = useMemo(() => getMerchantDocumentChecklist(merchantData), [merchantData]);
  const missingDocumentItems = useMemo(
    () => docChecklist.filter((i) => !i.present),
    [docChecklist]
  );
  const totalDocs = docChecklist.length;
  const presentDocs = totalDocs - missingDocumentItems.length;
  const missingDocs = missingDocumentItems.map((i) => i.label);

  const getNavStatus = (id: MerchantView): { intent: StatusIntent; label?: string; subtitle?: string } => {
    if (id === 'intake') {
      if (isFinished) return { intent: 'complete', subtitle: 'All sections answered' };
      return { intent: 'in_progress', subtitle: 'Continue where you left off' };
    }
    if (id === 'review') {
      if (appStatus !== 'draft') return { intent: 'complete', subtitle: 'Submitted' };
      if (isFinished) return { intent: 'needs_review', label: 'Ready', subtitle: 'Review and submit' };
      return { intent: 'idle', subtitle: 'Available after intake' };
    }
    if (id === 'status') {
      if (appStatus === 'approved' || appStatus === 'signed') return { intent: 'complete', subtitle: 'Decision received' };
      if (appStatus === 'under_review') return { intent: 'in_progress', subtitle: 'Verification in progress' };
      return { intent: 'idle', subtitle: 'Updates appear after submit' };
    }
    if (id === 'agreement') {
      if (appStatus === 'signed') return { intent: 'complete', subtitle: 'Agreement signed' };
      if (appStatus === 'approved') return { intent: 'needs_signature', subtitle: 'Awaiting your signature' };
      return { intent: 'idle', subtitle: 'Unlocks after approval' };
    }
    return { intent: 'idle' };
  };

  const startGuidedUpload = (startKey: MerchantDocumentKey) => {
    const order = getMissingDocumentKeys(merchantData);
    if (order.length === 0) {
      toast.message('Nothing to upload', {
        description: 'Required documents for your profile are already on file.',
      });
      return;
    }
    const key = order.includes(startKey) ? startKey : order[0]!;
    setGuidedTourOrder(order);
    setIsFinished(false);
    setEditSection(key);
    setCurrentView('intake');
  };

  const endGuidedUpload = () => {
    setGuidedTourOrder(null);
    setEditSection(null);
    setIsFinished(true);
    setCurrentView('status');
    toast.success('Application status updated', {
      description: 'Your document checklist now reflects the latest uploads.',
    });
  };

  const abortGuidedUpload = () => {
    setGuidedTourOrder(null);
    setEditSection(null);
    setIsFinished(true);
    setCurrentView('status');
  };

  const runUnderwritingOnSubmit = useCallback(
    (data: MerchantData) => {
      const result = getFallbackUnderwriting(data);
      setUnderwritingResult(result);
      setMerchantData({
        ...data,
        matchedProcessor: '',
        processorSpecificAnswers: '',
        processorSpecificAnswersJson: '',
        processorReadyPackageSummary: '',
      });
      toast.success('Application submitted for AI review', {
        description: `Suggested route: ${result.recommendedProcessor}. Admin must confirm before follow-up.`,
      });
    },
    [setUnderwritingResult, setMerchantData]
  );

  const openProcessorFollowUp = useCallback(() => {
    setGuidedTourOrder(null);
    setIsFinished(false);
    setEditSection('processorSpecificFollowUpForm');
    setCurrentView('intake');
  }, []);

  const autofillDemoData = () => {
    setMerchantData({ ...demoMerchantData });
    setDocuments([]);
    setUnderwritingResult(null);
    setAppStatus('draft');
    setIsFinished(true);
    setEditSection(null);
    setGuidedTourOrder(null);
    setIntakeSessionKey((k) => k + 1);
    setCurrentView('intake');
    onDismissMerchantNotice();
    onClearVerificationIssues();
    toast.message('Demo data loaded', {
      description: 'All intake fields filled with sample data. Open Review when ready.',
    });
  };

  const clearIntakeData = () => {
    setMerchantData({ ...initialMerchantData, additionalDocuments: [] });
    setDocuments([]);
    setUnderwritingResult(null);
    setAppStatus('draft');
    setIsFinished(false);
    setEditSection(null);
    setGuidedTourOrder(null);
    setIntakeSessionKey((k) => k + 1);
    setCurrentView('intake');
    onDismissMerchantNotice();
    onClearVerificationIssues();
    toast.message('Intake cleared', {
      description: 'All fields reset. Start a fresh application from Intake.',
    });
  };

  const jumpToReviewWithDemo = () => {
    setMerchantData({ ...demoMerchantData });
    setDocuments([]);
    setUnderwritingResult(null);
    setGuidedTourOrder(null);
    onClearVerificationIssues();
    setIsFinished(true);
    setCurrentView('review');
    toast.message('Demo shortcut', { description: 'Review opened with sample data.' });
  };

  return (
    <div className="flex h-full w-full min-h-0">
      {/* Sidebar — stepper */}
      <aside className="w-[260px] shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
            Merchant portal
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">Onboarding journey</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{
                  width: `${
                    appStatus === 'signed'
                      ? 100
                      : appStatus === 'approved'
                      ? 75
                      : appStatus === 'under_review'
                      ? 55
                      : isFinished
                      ? 30
                      : 12
                  }%`,
                }}
              />
            </div>
            <span className="text-[11px] font-medium text-foreground-muted">
              {presentDocs}/{totalDocs} docs
            </span>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1">
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const status = getNavStatus(item.id);
            const isDisabled =
              (item.id === 'review' && !isFinished && appStatus === 'draft') ||
              (item.id === 'status' && appStatus === 'draft') ||
              (item.id === 'agreement' && appStatus !== 'approved' && appStatus !== 'signed');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !isDisabled && setCurrentView(item.id)}
                disabled={isDisabled}
                className={cn(
                  'group w-full rounded-lg px-3 py-2.5 text-left transition-all',
                  isActive
                    ? 'bg-brand-soft/70 ring-1 ring-brand/20'
                    : isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-surface-subtle'
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                      status.intent === 'complete'
                        ? 'border-success bg-success text-white'
                        : isActive
                        ? 'border-brand bg-brand text-brand-foreground'
                        : 'border-border bg-surface text-foreground-subtle'
                    )}
                  >
                    {status.intent === 'complete' ? (
                      <Icon className="h-3.5 w-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          isActive ? 'text-foreground' : 'text-foreground'
                        )}
                      >
                        {item.label}
                      </p>
                      <StatusPill intent={status.intent} label={status.label} />
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-muted">
                      {status.subtitle ?? item.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
            Demo shortcuts
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={autofillDemoData}
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            Autofill demo data
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={clearIntakeData}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            Clear all fields
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={jumpToReviewWithDemo}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Skip to Review (demo)
          </Button>
        </div>
      </aside>

      {/* Hidden inline upload input */}
      <input
        ref={inlineUploadRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf"
        onChange={onInlineFileSelected}
      />

      {/* Main content */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Notice stack */}
        {(appStatus === 'under_review' ||
          verificationIssues.length > 0 ||
          merchantNoticeFromAdmin.trim()) && (
          <div className="shrink-0 border-b border-border bg-surface-muted/60 px-4 py-3 sm:px-6 space-y-2">
            {appStatus === 'under_review' && (
              <Banner
                intent="info"
                title="Verification & routing review in progress"
                description="Our team is checking KYC / KYB readiness, routing, and supporting documents. You can still open Intake to add documents if requested."
              />
            )}
            {verificationIssues.length > 0 && (
              <Banner
                intent="danger"
                title="KYC / KYB needs updates"
                description="A local KYC / KYB review found follow-up items. Use the buttons to jump to the exact intake step."
                onDismiss={onClearVerificationIssues}
              >
                <ul className="mt-3 space-y-2">
                  {verificationIssues.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 rounded-lg border border-danger/15 bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="text-foreground">{item.reason}</span>
                        <p className="mt-0.5 text-xs text-foreground-muted">
                          {item.target.whereLabel}
                        </p>
                      </div>
                      {item.target.kind === 'document' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="brand"
                          className="shrink-0"
                          onClick={() => handleInlineUpload(item.target.documentKey)}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Banner>
            )}
            {merchantNoticeFromAdmin.trim() && (
              <Banner
                intent="warning"
                title="Message from review team"
                description={merchantNoticeFromAdmin}
                onDismiss={onDismissMerchantNotice}
              >
                {missingDocs.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-medium text-warning-foreground">
                      Still expected for your profile — click Upload to add directly:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {missingDocumentItems.map(({ key, label }) => (
                        <Button
                          key={key}
                          type="button"
                          size="sm"
                          variant="accent"
                          className="h-auto whitespace-normal py-1.5 text-left text-xs"
                          onClick={() => handleInlineUpload(key)}
                        >
                          <Upload className="h-3 w-3 shrink-0" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </Banner>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1 min-w-0">
          <div className="flex min-h-0 flex-1 min-w-0 flex-col">
            {currentView === 'intake' && (
              <div className="flex h-0 min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
                <ChatApp
                  key={intakeSessionKey}
                  data={merchantData}
                  setData={setMerchantData}
                  documents={documents}
                  setDocuments={setDocuments}
                  isFinished={isFinished}
                  setIsFinished={setIsFinished}
                  editSection={editSection}
                  setEditSection={setEditSection}
                  onFinish={() => setCurrentView('review')}
                  guidedTourOrder={guidedTourOrder}
                  onGuidedFlowComplete={endGuidedUpload}
                  onGuidedFlowAbort={abortGuidedUpload}
                />
              </div>
            )}
            {currentView === 'review' && (
              <div className="h-0 min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
                <ReviewPage
                  data={merchantData}
                  documents={documents}
                  setCurrentView={(view) => setCurrentView(view as MerchantView)}
                  onEdit={(section) => {
                    setEditSection(section);
                    setIsFinished(false);
                    setCurrentView('intake');
                  }}
                  onSubmit={() => {
                    setAppStatus('under_review');
                    setCurrentView('status');
                    runUnderwritingOnSubmit(merchantData);
                  }}
                />
              </div>
            )}
            {currentView === 'status' && (
              <div className="h-0 min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
                <MerchantStatus
                  status={appStatus}
                  onProceedToAgreement={() => setCurrentView('agreement')}
                  adminNotice={merchantNoticeFromAdmin}
                  onDismissNotice={onDismissMerchantNotice}
                  missingDocuments={missingDocumentItems.map(({ key, label }) => ({ key, label }))}
                  onStartGuidedUpload={appStatus === 'under_review' ? startGuidedUpload : undefined}
                  onInlineUpload={appStatus === 'under_review' ? handleInlineUpload : undefined}
                  matchedProcessor={merchantData.matchedProcessor || ''}
                  processorFollowUpComplete={Boolean(merchantData.processorSpecificAnswers?.trim())}
                  onOpenProcessorFollowUp={
                    appStatus === 'under_review' ? openProcessorFollowUp : undefined
                  }
                />
              </div>
            )}
            {currentView === 'agreement' && (
              <div className="h-0 min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
                <AgreementPage data={merchantData} onSign={() => setAppStatus('signed')} />
              </div>
            )}
          </div>
          <MerchantSummaryRail data={merchantData} appStatus={appStatus} />
        </div>
      </div>
    </div>
  );
}
