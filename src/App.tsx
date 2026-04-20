import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { MerchantPortal } from './components/MerchantPortal';
import { AdminPortal } from './components/AdminPortal';
import { AppShell, type ViewMode } from './components/AppShell';
import { MerchantData, FileData, ApplicationStatus, initialMerchantData } from './types';
import type { VerificationIssue } from './lib/localVerification';
import type { UnderwritingDisplayResult } from './lib/underwritingFallback';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('merchant');
  const [appStatus, setAppStatus] = useState<ApplicationStatus>('draft');
  const [merchantData, setMerchantData] = useState<MerchantData>(() => ({
    ...initialMerchantData,
    additionalDocuments: [],
  }));
  const [documents, setDocuments] = useState<FileData[]>([]);
  const [underwritingResult, setUnderwritingResult] = useState<UnderwritingDisplayResult | null>(null);
  /** Shown to merchant while under review (set from Admin). */
  const [merchantNoticeFromAdmin, setMerchantNoticeFromAdmin] = useState('');
  const [verificationIssues, setVerificationIssues] = useState<VerificationIssue[]>([]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: 'border border-border shadow-md rounded-xl',
          },
        }}
      />
      <AppShell viewMode={viewMode} onChangeViewMode={setViewMode} appStatus={appStatus}>
        {viewMode === 'merchant' ? (
          <MerchantPortal
            appStatus={appStatus}
            setAppStatus={setAppStatus}
            merchantData={merchantData}
            setMerchantData={setMerchantData}
            documents={documents}
            setDocuments={setDocuments}
            underwritingResult={underwritingResult}
            setUnderwritingResult={setUnderwritingResult}
            merchantNoticeFromAdmin={merchantNoticeFromAdmin}
            onDismissMerchantNotice={() => setMerchantNoticeFromAdmin('')}
            verificationIssues={verificationIssues}
            onClearVerificationIssues={() => setVerificationIssues([])}
          />
        ) : (
          <AdminPortal
            appStatus={appStatus}
            setAppStatus={setAppStatus}
            merchantData={merchantData}
            setMerchantData={setMerchantData}
            documents={documents}
            underwritingResult={underwritingResult}
            setUnderwritingResult={setUnderwritingResult}
            merchantNoticeFromAdmin={merchantNoticeFromAdmin}
            setMerchantNoticeFromAdmin={setMerchantNoticeFromAdmin}
            setVerificationIssues={setVerificationIssues}
          />
        )}
      </AppShell>
    </>
  );
}
