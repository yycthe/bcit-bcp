import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { MerchantPortal } from './components/MerchantPortal';
import { AdminPortal } from './components/AdminPortal';
import { AppShell, type ViewMode } from './components/AppShell';
import { MerchantData, FileData, ApplicationStatus, initialMerchantData } from './types';
import type { VerificationIssue } from './lib/localVerification';
import type { UnderwritingDisplayResult } from './lib/underwritingFallback';
import { usePersistentState } from './lib/persistentState';

const STORAGE_KEYS = {
  appStatus: 'bcp:appStatus',
  merchantData: 'bcp:merchantData',
  documents: 'bcp:documents',
  underwritingResult: 'bcp:underwritingResult',
  merchantNoticeFromAdmin: 'bcp:merchantNoticeFromAdmin',
  verificationIssues: 'bcp:verificationIssues',
} as const;

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('merchant');
  const [appStatus, setAppStatus] = usePersistentState<ApplicationStatus>(STORAGE_KEYS.appStatus, 'draft');
  const [merchantData, setMerchantData] = usePersistentState<MerchantData>(STORAGE_KEYS.merchantData, () => ({
    ...initialMerchantData,
    additionalDocuments: [],
  }));
  const [documents, setDocuments] = usePersistentState<FileData[]>(STORAGE_KEYS.documents, []);
  const [underwritingResult, setUnderwritingResult] = usePersistentState<UnderwritingDisplayResult | null>(
    STORAGE_KEYS.underwritingResult,
    null
  );
  /** Shown to merchant while under review (set from Admin). */
  const [merchantNoticeFromAdmin, setMerchantNoticeFromAdmin] = usePersistentState<string>(
    STORAGE_KEYS.merchantNoticeFromAdmin,
    ''
  );
  const [verificationIssues, setVerificationIssues] = usePersistentState<VerificationIssue[]>(
    STORAGE_KEYS.verificationIssues,
    []
  );

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
