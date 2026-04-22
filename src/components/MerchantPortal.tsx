import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChatApp, type ChatAppStepInfo } from './ChatApp';
import { ReviewPage } from './ReviewPage';
import { MerchantStatus } from './MerchantStatus';
import { AgreementPage } from './AgreementPage';
import { MerchantSummaryRail } from './MerchantSummaryRail';
import { MerchantData, FileData, ApplicationStatus, initialMerchantData } from '@/src/types';
import {
  DEMO_PROFILES,
  DEFAULT_DEMO_PROFILE_ID,
  getDemoProfile,
} from '@/src/lib/demoMerchantData';
import { Select } from '@/src/components/ui/select';
import {
  getMerchantDocumentChecklist,
  getMissingDocumentLabels,
  getMissingDocumentKeys,
  type MerchantDocumentKey,
} from '@/src/lib/documentChecklist';
import type { UnderwritingDisplayResult } from '@/src/lib/underwritingFallback';
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
  const DOCUMENT_KEYS: MerchantDocumentKey[] = [
    'idUpload',
    'proofOfAddress',
    'registrationCertificate',
    'taxDocument',
    'proofOfFunds',
    'bankStatement',
    'financials',
    'complianceDocument',
    'enhancedVerification',
  ];
  const [currentView, setCurrentView] = useState<MerchantView>('intake');
  const [isFinished, setIsFinished] = useState(false);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [intakeSessionKey, setIntakeSessionKey] = useState(0);
  const [guidedTourOrder, setGuidedTourOrder] = useState<MerchantDocumentKey[] | null>(null);
  /** Keys of MerchantData prefilled via document AI extraction (merchant snapshot sparkles). */
  const [aiFieldHints, setAiFieldHints] = useState<Record<string, boolean>>({});
  /** Demo profile powering the "Autofill this step" shortcut (swap between sample companies). */
  const [demoProfileId, setDemoProfileId] = useState<string>(DEFAULT_DEMO_PROFILE_ID);
  /** Demo upload mode toggle: mock files for demos, or real uploads for realistic testing. */
  const [useMockUploads, setUseMockUploads] = useState(true);
  /** Current intake step, reported by ChatApp — used to scope the autofill shortcut. */
  const [currentStepInfo, setCurrentStepInfo] = useState<ChatAppStepInfo | null>(null);
  /** Incremented when sidebar autofill should auto-advance a button question in ChatApp. */
  const [autofillAdvanceToken, setAutofillAdvanceToken] = useState(0);

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
      setUnderwritingResult(null);
      setMerchantData({
        ...data,
        matchedProcessor: '',
        processorSpecificAnswers: '',
        processorSpecificAnswersJson: '',
        processorReadyPackageSummary: '',
      });
      toast.success('Application submitted for AI review', {
        description: 'AI will review the full application. Admin will confirm the final routing.',
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

  const activeDemoProfile = useMemo(() => getDemoProfile(demoProfileId), [demoProfileId]);

  const makeDemoFile = useCallback(
    (key: MerchantDocumentKey): FileData => {
      const stamp = new Date().toISOString();
      const safeProfileId = activeDemoProfile.id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const body =
        `Demo document for ${activeDemoProfile.label}\n` +
        `Document key: ${key}\n` +
        `Generated at: ${stamp}\n`;
      return {
        name: `${safeProfileId}-${key}.txt`,
        mimeType: 'text/plain',
        data: `data:text/plain;base64,${btoa(body)}`,
        uploadDate: stamp,
        documentType: key,
        status: 'Uploaded',
      };
    },
    [activeDemoProfile.id, activeDemoProfile.label]
  );

  /**
   * Fill ONLY the fields that belong to the intake step the merchant is
   * currently looking at, using the selected demo profile. Lets you step
   * through the wizard page by page with realistic sample data while still
   * testing each screen's own validation & navigation.
   */
  const autofillCurrentStep = () => {
    if (currentView !== 'intake') {
      setCurrentView('intake');
    }
    if (!currentStepInfo || currentStepInfo.fieldKeys.length === 0) {
      toast.message('Nothing to autofill on this step', {
        description:
          'The current step has no form fields (system checkpoint or document upload). Continue to the next question.',
      });
      return;
    }
    const profile = activeDemoProfile;
    const patch: Partial<MerchantData> = {};
    const filledLabels: string[] = [];
    const uploadedLabels: string[] = [];
    for (const key of currentStepInfo.fieldKeys) {
      const typedKey = key as keyof MerchantData;
      const value = profile.data[typedKey];
      if (typeof value === 'string') {
        (patch as Record<string, string>)[key] = value;
        if (value.trim()) filledLabels.push(key);
      } else if (DOCUMENT_KEYS.includes(key as MerchantDocumentKey)) {
        if (useMockUploads) {
          (patch as Record<string, FileData>)[key] = makeDemoFile(key as MerchantDocumentKey);
          uploadedLabels.push(key);
        }
      }
    }
    if (filledLabels.length === 0 && uploadedLabels.length === 0) {
      const onUploadStep = currentStepInfo.fieldKeys.some((k) =>
        DOCUMENT_KEYS.includes(k as MerchantDocumentKey)
      );
      if (onUploadStep && !useMockUploads) {
        toast.message('Real upload mode is on', {
          description: 'This step expects a real file upload. Use the Upload control to continue.',
        });
        return;
      }
      toast.message('No demo values for this step', {
        description: `${profile.label} does not have sample values for these fields.`,
      });
      return;
    }
    setMerchantData({ ...merchantData, ...patch });
    const shouldAutoAdvance =
      (currentStepInfo.type === 'buttons' || currentStepInfo.type === 'dropdown') &&
      filledLabels.length > 0;
    if (shouldAutoAdvance) {
      setAutofillAdvanceToken((t) => t + 1);
    }
    toast.success(`Autofilled this step — ${profile.label}`, {
      description:
        `${filledLabels.length} text field${filledLabels.length === 1 ? '' : 's'} filled` +
        `${uploadedLabels.length ? `, ${uploadedLabels.length} file${uploadedLabels.length === 1 ? '' : 's'} mocked` : ''}. ` +
        `${shouldAutoAdvance ? 'Auto-continued to the next step.' : 'Review, edit, or continue.'}`,
    });
  };

  /** Fill complete demo profile and open Review in one click. */
  const autofillAndOpenReview = () => {
    const profile = activeDemoProfile;
    const filePatch = useMockUploads
      ? DOCUMENT_KEYS.reduce(
          (acc, key) => {
            acc[key] = makeDemoFile(key);
            return acc;
          },
          {} as Record<MerchantDocumentKey, FileData>
        )
      : {};
    setMerchantData({ ...profile.data, ...filePatch });
    setAiFieldHints({});
    setDocuments([]);
    setUnderwritingResult(null);
    setAppStatus('draft');
    setIsFinished(true);
    setEditSection(null);
    setGuidedTourOrder(null);
    setIntakeSessionKey((k) => k + 1);
    setCurrentView('review');
    onDismissMerchantNotice();
    onClearVerificationIssues();
    toast.message(`Demo loaded — ${profile.label}`, {
      description: useMockUploads
        ? 'All intake fields filled with mock files. Review opened.'
        : 'All non-file intake fields filled. Review opened; upload steps remain real-file only.',
    });
  };

  const clearIntakeData = () => {
    setMerchantData({ ...initialMerchantData, additionalDocuments: [] });
    setAiFieldHints({});
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
          <div className="space-y-1">
            <label
              htmlFor="demo-profile-select"
              className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted"
            >
              Sample company
            </label>
            <Select
              id="demo-profile-select"
              className="h-8 text-xs"
              value={demoProfileId}
              onChange={(e) => setDemoProfileId(e.target.value)}
            >
              {DEMO_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
            <p className="text-[10px] leading-snug text-foreground-subtle">
              {activeDemoProfile.description}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">
              Upload mode
            </p>
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                variant={useMockUploads ? 'brand' : 'outline'}
                size="xs"
                className="w-full text-[11px]"
                onClick={() => setUseMockUploads(true)}
              >
                Use mock uploads
              </Button>
              <Button
                type="button"
                variant={!useMockUploads ? 'brand' : 'outline'}
                size="xs"
                className="w-full text-[11px]"
                onClick={() => setUseMockUploads(false)}
              >
                Use real uploads
              </Button>
            </div>
            <p className="text-[10px] leading-snug text-foreground-subtle">
              {useMockUploads
                ? 'Demo autofill will generate file placeholders for upload steps.'
                : 'Demo autofill will skip files so you can test real upload flows.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={autofillCurrentStep}
            disabled={currentView !== 'intake'}
            title={
              currentView !== 'intake'
                ? 'Switch to the Intake assistant to use this shortcut.'
                : currentStepInfo
                ? `Fill this step (${currentStepInfo.fieldKeys.length} field${
                    currentStepInfo.fieldKeys.length === 1 ? '' : 's'
                  }) with sample values`
                : 'Fill this step with sample values'
            }
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            Autofill this step
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={autofillAndOpenReview}
            title="Fill all fields for selected sample company and open Review"
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            Autofill all + Open Review
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
                      {item.target.kind === 'intake' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="brand"
                          className="shrink-0"
                          onClick={() => {
                            setEditSection(item.target.questionId);
                            setIsFinished(false);
                            setCurrentView('intake');
                          }}
                        >
                          Update
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
                  onAiDocumentExtractApplied={(keys) => {
                    setAiFieldHints((prev) => {
                      const next = { ...prev };
                      for (const k of keys) next[k] = true;
                      return next;
                    });
                  }}
                  onCurrentStepChange={setCurrentStepInfo}
                  autofillAdvanceToken={autofillAdvanceToken}
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
          <MerchantSummaryRail data={merchantData} appStatus={appStatus} aiFieldHints={aiFieldHints} />
        </div>
      </div>
    </div>
  );
}
