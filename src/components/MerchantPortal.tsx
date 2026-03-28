import React, { useState, useEffect } from 'react';
import { ChatApp } from './ChatApp';
import { ReviewPage } from './ReviewPage';
import { MerchantStatus } from './MerchantStatus';
import { AgreementPage } from './AgreementPage';
import { MerchantData, FileData, ApplicationStatus } from '@/src/types';
import { MessageSquare, FileCheck, Activity, PenTool } from 'lucide-react';

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
}

export function MerchantPortal({
  appStatus,
  setAppStatus,
  merchantData,
  setMerchantData,
  documents,
  setDocuments,
  aiRecommendation,
  setAiRecommendation
}: Props) {
  const [currentView, setCurrentView] = useState<MerchantView>('intake');
  const [isFinished, setIsFinished] = useState(false);
  const [editSection, setEditSection] = useState<string | null>(null);

  // Auto-navigate based on status changes
  useEffect(() => {
    if (appStatus === 'under_review' && currentView === 'review') setCurrentView('status');
    if (appStatus === 'approved' && currentView === 'status') setCurrentView('agreement');
  }, [appStatus, currentView]);

  const handleIntakeComplete = (data: MerchantData, docs: FileData[], aiResult: any) => {
    setMerchantData(data);
    setDocuments(docs);
    setAiRecommendation(aiResult);
    setCurrentView('review');
  };

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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Merchant Portal</h2>
        </div>
        <nav className="flex-1 p-4 space-y-1">
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {currentView === 'intake' && (
          <ChatApp 
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
          />
        )}
        {currentView === 'review' && (
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
        )}
        {currentView === 'status' && (
          <MerchantStatus 
            status={appStatus}
            onProceedToAgreement={() => setCurrentView('agreement')}
          />
        )}
        {currentView === 'agreement' && (
          <AgreementPage 
            data={merchantData} 
            onSign={() => setAppStatus('signed')}
          />
        )}
      </div>
    </div>
  );
}
