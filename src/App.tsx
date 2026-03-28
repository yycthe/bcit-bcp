import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { MerchantPortal } from './components/MerchantPortal';
import { AdminPortal } from './components/AdminPortal';
import { AITestLab } from './components/AITestLab';
import { MerchantData, FileData, ApplicationStatus } from './types';
import { demoMerchantData } from './lib/demoMerchantData';
import type { MockRemediationItem } from './lib/mockIdentityVerification';
import { ArrowRightLeft, FlaskConical } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'merchant' | 'admin' | 'ai-lab'>('merchant');
  const [appStatus, setAppStatus] = useState<ApplicationStatus>('draft');
  const [merchantData, setMerchantData] = useState<MerchantData>(demoMerchantData);
  const [documents, setDocuments] = useState<FileData[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);
  /** Shown to merchant while under review (set from Admin). */
  const [merchantNoticeFromAdmin, setMerchantNoticeFromAdmin] = useState('');
  const [identityRemediation, setIdentityRemediation] = useState<MockRemediationItem[]>([]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <Toaster position="top-right" />
      
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white border-b sticky top-0 z-10 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-xl">
              M
            </div>
            <span className="font-bold text-xl tracking-tight">MerchantWerx</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider">Demo Env</span>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('merchant')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'merchant' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Merchant Portal
            </button>
            <ArrowRightLeft className="w-4 h-4 text-slate-500" />
            <button
              onClick={() => setViewMode('admin')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'admin' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Admin Portal
            </button>
            <ArrowRightLeft className="w-4 h-4 text-slate-500" />
            <button
              onClick={() => setViewMode('ai-lab')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'ai-lab' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}
            >
              <FlaskConical className="w-4 h-4" />
              AI Test Lab
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {viewMode === 'merchant' ? (
          <MerchantPortal
            appStatus={appStatus}
            setAppStatus={setAppStatus}
            merchantData={merchantData}
            setMerchantData={setMerchantData}
            documents={documents}
            setDocuments={setDocuments}
            aiRecommendation={aiRecommendation}
            setAiRecommendation={setAiRecommendation}
            merchantNoticeFromAdmin={merchantNoticeFromAdmin}
            onDismissMerchantNotice={() => setMerchantNoticeFromAdmin('')}
            identityRemediation={identityRemediation}
            onClearIdentityRemediation={() => setIdentityRemediation([])}
          />
        ) : viewMode === 'admin' ? (
          <AdminPortal
            appStatus={appStatus}
            setAppStatus={setAppStatus}
            merchantData={merchantData}
            documents={documents}
            aiRecommendation={aiRecommendation}
            merchantNoticeFromAdmin={merchantNoticeFromAdmin}
            setMerchantNoticeFromAdmin={setMerchantNoticeFromAdmin}
            setIdentityRemediation={setIdentityRemediation}
          />
        ) : (
          <AITestLab />
        )}
      </main>
    </div>
  );
}
