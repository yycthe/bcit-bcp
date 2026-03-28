import React, { useState } from 'react';
import { AIUnderwriting } from './AIUnderwriting';
import { ApplicationStatus, MerchantData, FileData } from '@/src/types';
import { ShieldCheck, LayoutDashboard, Search, Filter, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';

interface Props {
  appStatus: ApplicationStatus;
  setAppStatus: (status: ApplicationStatus) => void;
  merchantData: MerchantData;
  documents: FileData[];
  aiRecommendation: any;
}

export function AdminPortal({
  appStatus,
  setAppStatus,
  merchantData,
  documents,
  aiRecommendation
}: Props) {
  const [currentView, setCurrentView] = useState<'queue' | 'underwriting'>('queue');

  const merchantName = merchantData.legalName || merchantData.ownerName || 'Unknown Merchant';

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Underwriter Dashboard</h2>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setCurrentView('queue')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentView === 'queue' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${currentView === 'queue' ? 'text-emerald-500' : 'text-slate-500'}`} />
            Application Queue
          </button>
          
          <button
            onClick={() => setCurrentView('underwriting')}
            disabled={appStatus === 'draft'}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentView === 'underwriting' ? 'bg-slate-800 text-white' : 
              appStatus === 'draft' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck className={`w-5 h-5 ${currentView === 'underwriting' ? 'text-emerald-500' : 'text-slate-500'}`} />
            AI Underwriting
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-slate-50">
        {currentView === 'queue' && (
          <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Application Queue</h1>
                <p className="text-slate-500">Manage and review incoming merchant applications.</p>
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search merchants..." className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
                  <Filter className="w-4 h-4" /> Filter
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Merchant</th>
                    <th className="px-6 py-4 font-medium">Industry</th>
                    <th className="px-6 py-4 font-medium">Risk Score</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appStatus === 'draft' ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-slate-300 mb-2" />
                          <p>No pending applications in the queue.</p>
                          <p className="text-xs mt-1">Switch to Merchant Portal to submit an application.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{merchantName}</div>
                        <div className="text-slate-500 text-xs">{merchantData.country} • {merchantData.businessType?.replace('_', ' ')}</div>
                      </td>
                      <td className="px-6 py-4 capitalize">{merchantData.industry?.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        {aiRecommendation ? (
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              aiRecommendation.riskScore <= 33 ? 'bg-green-500' :
                              aiRecommendation.riskScore <= 66 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="font-medium">{aiRecommendation.riskScore}/100</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending AI</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {appStatus === 'under_review' && <Badge variant="warning" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex w-fit items-center gap-1"><Clock className="w-3 h-3" /> Under Review</Badge>}
                        {appStatus === 'approved' && <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100 flex w-fit items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>}
                        {appStatus === 'signed' && <Badge variant="success" className="bg-blue-100 text-blue-800 hover:bg-blue-100 flex w-fit items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Signed</Badge>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setCurrentView('underwriting')}
                          className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                        >
                          Review AI Report
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === 'underwriting' && (
          <AIUnderwriting 
            data={merchantData} 
            aiRecommendation={aiRecommendation} 
            documents={documents}
            isApproved={appStatus === 'approved' || appStatus === 'signed'}
            onApprove={() => setAppStatus('approved')}
          />
        )}
      </div>
    </div>
  );
}
