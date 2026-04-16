import React, { useState } from 'react';
import { AIUnderwriting } from './AIUnderwriting';
import { ApplicationStatus, MerchantData, FileData } from '@/src/types';
import { getMerchantDocumentChecklist, buildDefaultDocumentReminder } from '@/src/lib/documentChecklist';
import { runLocalVerificationCheck, type VerificationCheckResult, type VerificationIssue } from '@/src/lib/localVerification';
import { buildPersonaSummary } from '@/src/lib/onboardingWorkflow';
import { ShieldCheck, LayoutDashboard, Search, Filter, Clock, CheckCircle2, FileWarning, Send, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { toast } from 'sonner';

interface Props {
  appStatus: ApplicationStatus;
  setAppStatus: (status: ApplicationStatus) => void;
  merchantData: MerchantData;
  setMerchantData: React.Dispatch<React.SetStateAction<MerchantData>>;
  documents: FileData[];
  aiRecommendation: any;
  merchantNoticeFromAdmin: string;
  setMerchantNoticeFromAdmin: (msg: string) => void;
  setVerificationIssues: (items: VerificationIssue[]) => void;
}

export function AdminPortal({
  appStatus,
  setAppStatus,
  merchantData,
  setMerchantData,
  documents,
  aiRecommendation,
  merchantNoticeFromAdmin,
  setMerchantNoticeFromAdmin,
  setVerificationIssues,
}: Props) {
  const [currentView, setCurrentView] = useState<'queue' | 'underwriting'>('queue');
  const [reminderCustom, setReminderCustom] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [lastVerification, setLastVerification] = useState<VerificationCheckResult | null>(null);

  const merchantName = merchantData.legalName || merchantData.ownerName || 'Unknown Merchant';
  const docChecklist = getMerchantDocumentChecklist(merchantData);
  const missingCount = docChecklist.filter((d) => !d.present).length;

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
                    <tr className="border-b hover:bg-slate-50 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{merchantName}</div>
                        <div className="text-slate-500 text-xs">{merchantData.country} • {merchantData.businessType?.replace('_', ' ')}</div>
                        {missingCount > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                            <FileWarning className="w-3.5 h-3.5 shrink-0" />
                            {missingCount} required file slot(s) empty
                          </div>
                        )}
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

            {appStatus !== 'draft' && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-600" />
                      Document checklist (expected for this profile)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {docChecklist.map((row) => (
                      <div
                        key={row.key}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                          row.present ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/40'
                        }`}
                      >
                        <span className="text-slate-800">{row.label}</span>
                        {row.present ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">On file</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Missing</Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Notify merchant (demo)</CardTitle>
                    <p className="text-xs text-slate-500 font-normal mt-1">
                      Shown as a banner on the Merchant portal while <strong>Under review</strong>. Use to ask for missing uploads.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={postAutoReminder} className="gap-1">
                        <Send className="w-3.5 h-3.5" />
                        Post auto (missing list)
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={clearMerchantNotice} className="gap-1 text-red-700 border-red-200">
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear notice
                      </Button>
                    </div>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-slate-200 p-3 text-sm"
                      placeholder="Custom message to merchant…"
                      value={reminderCustom}
                      onChange={(e) => setReminderCustom(e.target.value)}
                    />
                    <Button type="button" size="sm" onClick={postCustomReminder} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                      <Send className="w-3.5 h-3.5" />
                      Post custom message
                    </Button>
                    {merchantNoticeFromAdmin.trim() && (
                      <p className="text-xs text-slate-500 border-t pt-2">
                        <span className="font-medium text-slate-600">Active notice preview:</span>{' '}
                        {merchantNoticeFromAdmin.slice(0, 120)}
                        {merchantNoticeFromAdmin.length > 120 ? '…' : ''}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {appStatus !== 'draft' && (
              <Card className="mt-6 border-violet-200 bg-violet-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-violet-600" />
                    KYC / KYB review
                  </CardTitle>
                  <p className="text-xs text-slate-600 font-normal mt-1">
                    Runs a local KYC / KYB-style rules pass across the intake answers and uploaded documents. No external API is involved.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-violet-700 hover:bg-violet-800"
                      disabled={verificationLoading}
                      onClick={runVerification}
                    >
                      Run KYC / KYB
                    </Button>
                  </div>
                  {lastVerification && (
                    <div className="rounded-lg border border-violet-200 bg-white/90 p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={lastVerification.status === 'clear' ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100' : 'bg-amber-100 text-amber-900 hover:bg-amber-100'}>
                          {lastVerification.status === 'clear' ? 'Clear' : 'Needs follow-up'}
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 text-slate-700">
                          {lastVerification.issues.length} item{lastVerification.issues.length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Summary</p>
                          <p className="mt-1 text-slate-800">{lastVerification.summary}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Checked At</p>
                          <p className="mt-1 text-slate-800">{new Date(lastVerification.checkedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      {lastVerification.issues.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {lastVerification.issues.map((issue) => (
                            <li key={issue.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-slate-800">{issue.reason}</p>
                              <p className="mt-1 text-xs text-slate-500">{issue.target.whereLabel}</p>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentView === 'underwriting' && (
          <AIUnderwriting
            data={merchantData}
            aiRecommendation={aiRecommendation}
            documents={documents}
            documentChecklist={docChecklist}
            isApproved={appStatus === 'approved' || appStatus === 'signed'}
            onApprove={() => setAppStatus('approved')}
          />
        )}
      </div>
    </div>
  );
}
