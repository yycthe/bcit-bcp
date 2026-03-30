import React, { useState, useEffect, useMemo } from 'react';
import { ChatApp } from './ChatApp';
import { ReviewPage } from './ReviewPage';
import { MerchantStatus } from './MerchantStatus';
import { AgreementPage } from './AgreementPage';
import { MerchantData, FileData, ApplicationStatus } from '@/src/types';
import { demoMerchantData } from '@/src/lib/demoMerchantData';
import {
  getMerchantDocumentChecklist,
  getMissingDocumentLabels,
  getMissingDocumentKeys,
  type MerchantDocumentKey,
} from '@/src/lib/documentChecklist';
import { getFallbackUnderwriting } from '@/src/lib/underwritingFallback';
import type { VerificationIssue } from '@/src/lib/localVerification';
import { MessageSquare, FileCheck, Activity, PenTool, RotateCcw, Zap, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { toast } from 'sonner';

export type MerchantView = 'intake' | 'review' | 'status' | 'agreement';

interface Props {
  appStatus: ApplicationStatus;
  setAppStatus: (status: ApplicationStatus) => void;
  merchantData: MerchantData;
  setMerchantData: (data: MerchantData) => void;
  documents: FileData[];
  setDocuments: (docs: FileData[]) => void;
  aiRecommendation: any;
  setAiRecommendation: (rec: any) => void;
  merchantNoticeFromAdmin: string;
  onDismissMerchantNotice: () => void;
  verificationIssues: VerificationIssue[];
  onClearVerificationIssues: () => void;
}

export function MerchantPortal({
  appStatus,
  setAppStatus,
  merchantData,
  setMerchantData,
  documents,
  setDocuments,
  aiRecommendation,
  setAiRecommendation,
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

  // Auto-navigate based on status changes
  useEffect(() => {
    if (appStatus === 'under_review' && currentView === 'review') setCurrentView('status');
    if (appStatus === 'approved' && currentView === 'status') setCurrentView('agreement');
  }, [appStatus, currentView]);

  const navItems = [
    { id: 'intake', label: 'Intake Assistant', icon: MessageSquare },
    { id: 'review', label: 'Review Application', icon: FileCheck },
    { id: 'status', label: 'Application Status', icon: Activity },
    { id: 'agreement', label: 'Agreement', icon: PenTool },
  ] as const;

  const getStatusBadge = (id: string) => {
    if (id === 'intake') return isFinished ? 'Complete' : 'In progress';
    if (id === 'review') return appStatus !== 'draft' ? 'Complete' : isFinished ? 'Needs review' : 'Not started';
    if (id === 'status') return appStatus === 'approved' || appStatus === 'signed' ? 'Complete' : appStatus === 'under_review' ? 'In progress' : 'Not started';
    if (id === 'agreement') return appStatus === 'signed' ? 'Complete' : appStatus === 'approved' ? 'Needs signature' : 'Not started';
    return 'Not started';
  };

  const missingDocs = getMissingDocumentLabels(merchantData);
  const missingDocumentItems = useMemo(
    () => getMerchantDocumentChecklist(merchantData).filter((i) => !i.present),
    [merchantData]
  );

  const startGuidedUpload = (startKey: MerchantDocumentKey) => {
    const order = getMissingDocumentKeys(merchantData);
    if (order.length === 0) {
      toast.message('Nothing to upload', { description: 'Required documents for your profile are already on file.' });
      return;
    }
    const key = order.includes(startKey) ? startKey : order[0]!;
    setGuidedTourOrder(order);
    setIsFinished(false);
    setEditSection(key);
    setCurrentView('intake');
  };

  const openRemediationTarget = (item: VerificationIssue) => {
    const { target } = item;
    setGuidedTourOrder(null);
    setIsFinished(false);
    if (target.kind === 'document') {
      const order = getMissingDocumentKeys(merchantData);
      if (order.includes(target.documentKey)) {
        setGuidedTourOrder(order);
      }
      setEditSection(target.documentKey);
      setCurrentView('intake');
      toast.message('Open the correct step', { description: target.whereLabel });
      return;
    }
    setEditSection(target.questionId);
    setCurrentView('intake');
    toast.message('Update your application', { description: target.whereLabel });
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

  const resetDemoIntake = () => {
    setMerchantData(demoMerchantData);
    setDocuments([]);
    setAiRecommendation(null);
    setAppStatus('draft');
    setIsFinished(false);
    setEditSection(null);
    setGuidedTourOrder(null);
    setIntakeSessionKey((k) => k + 1);
    setCurrentView('intake');
    onDismissMerchantNotice();
    onClearVerificationIssues();
    toast.message('Demo reset', { description: 'Wizard restarted with sample data. Use Skip on uploads as needed.' });
  };

  const jumpToReviewWithDemo = () => {
    setMerchantData({ ...demoMerchantData });
    setDocuments([]);
    setAiRecommendation(getFallbackUnderwriting(demoMerchantData));
    setGuidedTourOrder(null);
    onClearVerificationIssues();
    setIsFinished(true);
    setCurrentView('review');
    toast.message('Demo shortcut', { description: 'Review opened with sample data and placeholder underwriting.' });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Merchant Portal</h2>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const status = getStatusBadge(item.id);
            
            // Disable navigation to future steps
            const isDisabled = 
              (item.id === 'review' && !isFinished) ||
              (item.id === 'status' && appStatus === 'draft') ||
              (item.id === 'agreement' && appStatus !== 'approved' && appStatus !== 'signed');

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && setCurrentView(item.id as MerchantView)}
                disabled={isDisabled}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 
                  isDisabled ? 'opacity-50 cursor-not-allowed text-slate-400' : 
                  'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${
                  status === 'Complete' ? 'bg-green-100 text-green-700' :
                  status === 'In progress' ? 'bg-blue-100 text-blue-700' :
                  status === 'Needs review' || status === 'Needs signature' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {status}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 space-y-2 mt-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Demo shortcuts</p>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-auto py-2" onClick={resetDemoIntake}>
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            Reset wizard &amp; demo data
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-auto py-2" onClick={jumpToReviewWithDemo}>
            <Zap className="w-3.5 h-3.5 shrink-0" />
            Skip to Review (demo)
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {appStatus === 'under_review' && (
          <div className="shrink-0 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 flex flex-wrap items-center gap-3">
            <span className="font-medium">Application under review</span>
            <span className="text-blue-700/90">Our team is verifying your submission. You can still open Intake to add documents if requested.</span>
          </div>
        )}
        {verificationIssues.length > 0 && (
          <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-3 flex gap-3 items-start">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-900">KYC / KYB needs updates</p>
              <p className="text-sm text-rose-950/90 mt-1">
                A local KYC / KYB review found follow-up items. Use the buttons to jump to the exact Intake step.
              </p>
              <ul className="mt-3 space-y-2">
                {verificationIssues.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-white/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <span className="text-slate-800">{item.reason}</span>
                      <p className="text-xs text-slate-500 mt-1">{item.target.whereLabel}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-rose-700 hover:bg-rose-800"
                      onClick={() => openRemediationTarget(item)}
                    >
                      Fix this
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0 text-rose-900" onClick={onClearVerificationIssues} aria-label="Dismiss KYC and KYB alerts">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {merchantNoticeFromAdmin.trim() && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Message from underwriting</p>
              <p className="text-sm text-amber-950 mt-1 whitespace-pre-wrap">{merchantNoticeFromAdmin}</p>
              {missingDocs.length > 0 && (
                <>
                  <p className="text-xs text-amber-900/80 mt-2">Still expected for your profile:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingDocumentItems.map(({ key, label }) => (
                      <Button
                        key={key}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-auto min-h-8 whitespace-normal py-1.5 text-left text-xs text-amber-950"
                        onClick={() => startGuidedUpload(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0 text-amber-900" onClick={onDismissMerchantNotice} aria-label="Dismiss notice">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
        {currentView === 'intake' && (
          <div className="flex h-0 min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
            <ChatApp
              key={intakeSessionKey}
              data={merchantData}
              setData={setMerchantData}
              documents={documents}
              setDocuments={setDocuments}
              setAiRecommendation={setAiRecommendation}
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
            />
          </div>
        )}
        {currentView === 'agreement' && (
          <div className="h-0 min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
            <AgreementPage 
              data={merchantData} 
              onSign={() => setAppStatus('signed')}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
