import React, { useState } from 'react';
import { ApplicationStatus, MerchantData, FileData } from '@/src/types';
import { getMerchantDocumentChecklist, buildDefaultDocumentReminder } from '@/src/lib/documentChecklist';
import { runLocalVerificationCheck, type VerificationCheckResult, type VerificationIssue } from '@/src/lib/localVerification';
import { buildPersonaSummary } from '@/src/lib/onboardingWorkflow';
import { getFallbackUnderwriting, type UnderwritingDisplayResult } from '@/src/lib/underwritingFallback';
import { FormattedSummary } from '@/src/components/ui/formatted-summary';
import { ShieldCheck, LayoutDashboard, Clock, CheckCircle2, FileWarning, Send, Trash2, Building, Activity, AlertCircle, Globe, FileText, FileSearch, ShieldAlert, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'motion/react';

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
  const [currentView, setCurrentView] = useState<'queue' | 'underwriting'>('queue');
  const [reminderCustom, setReminderCustom] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [lastVerification, setLastVerification] = useState<VerificationCheckResult | null>(null);
  const [personaKybStatus, setPersonaKybStatus] = useState(merchantData.personaKybStatus || '');
  const [personaKycStatuses, setPersonaKycStatuses] = useState(merchantData.personaKycStatuses || '');
  const [personaVerificationIssues, setPersonaVerificationIssues] = useState(merchantData.personaVerificationIssues || '');

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

  const runRuleBasedUnderwriting = () => {
    const result = getFallbackUnderwriting(merchantData);
    setUnderwritingResult(result);
    toast.success('Rule-based underwriting complete', {
      description: `Risk score: ${result.riskScore}/100 — ${result.riskCategory}`,
    });
  };

  const savePersonaResults = () => {
    if (personaKybStatus && !['passed', 'failed', 'pending'].includes(personaKybStatus)) {
      toast.error('KYB status must be passed, failed, or pending.');
      return;
    }
    if (!personaKybStatus && !personaKycStatuses && !personaVerificationIssues) {
      toast.error('Enter at least one Persona result field before saving.');
      return;
    }
    setMerchantData((prev) => ({
      ...prev,
      personaKybStatus,
      personaKycStatuses,
      personaVerificationIssues,
      personaVerificationSummary: [
        personaKybStatus ? `KYB status: ${personaKybStatus}` : '',
        personaKycStatuses ? `KYC status per person: ${personaKycStatuses}` : '',
        personaVerificationIssues ? `Verification issues: ${personaVerificationIssues}` : '',
      ]
        .filter(Boolean)
        .join('. ') || prev.personaVerificationSummary,
    }));
    toast.success('Persona verification results saved to merchant profile');
  };

  const getScoreColor = (score: number) => {
    if (score <= 33) return 'bg-green-500';
    if (score <= 66) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score <= 33) return 'text-green-700';
    if (score <= 66) return 'text-yellow-700';
    return 'text-red-700';
  };

  const getAvgTicketSize = (vol: string, trans: string) => {
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
            Underwriting Report
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-slate-50">
        {currentView === 'queue' && (
          <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Application Queue</h1>
              <p className="text-slate-500">Manage and review incoming merchant applications.</p>
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
                        {underwritingResult ? (
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              underwritingResult.riskScore <= 33 ? 'bg-green-500' :
                              underwritingResult.riskScore <= 66 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="font-medium">{underwritingResult.riskScore}/100</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not scored</span>
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
                          Review Report
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {appStatus !== 'draft' && (
              <>
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Document checklist */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileWarning className="w-4 h-4 text-amber-600" />
                        Document checklist
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

                  {/* Notify merchant */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Notify merchant (demo)</CardTitle>
                      <p className="text-xs text-slate-500 font-normal mt-1">
                        Shown as a banner on the Merchant portal while <strong>Under review</strong>.
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
                        className="w-full min-h-[80px] rounded-md border border-slate-200 p-3 text-sm"
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
                          <span className="font-medium text-slate-600">Active notice:</span>{' '}
                          {merchantNoticeFromAdmin.slice(0, 120)}
                          {merchantNoticeFromAdmin.length > 120 ? '…' : ''}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Processor assignment */}
                  <Card className="border-emerald-200 bg-emerald-50/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building className="w-4 h-4 text-emerald-600" />
                        Processor assignment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Payment processor</label>
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={merchantData.matchedProcessor || ''}
                          onChange={(e) => {
                            const processor = e.target.value;
                            setMerchantData((prev) => ({ ...prev, matchedProcessor: processor || undefined }));
                            if (processor) {
                              toast.success(`Processor set to ${processor}`);
                            } else {
                              toast.message('Processor assignment cleared');
                            }
                          }}
                        >
                          <option value="">— not assigned —</option>
                          <option value="Nuvei">Nuvei</option>
                          <option value="Payroc">Payroc / Peoples</option>
                          <option value="Chase">Chase</option>
                        </select>
                      </div>
                      {underwritingResult?.recommendedProcessor && (
                        <p className="text-xs text-slate-500">
                          Rule-based suggestion: <strong>{underwritingResult.recommendedProcessor}</strong>
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* KYC / KYB — merged Persona results + rules check */}
                  <Card className="border-blue-200 bg-blue-50/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        KYC / KYB verification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Persona manual entry */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">KYB status</label>
                          <select
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
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
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">KYC status per person</label>
                          <textarea
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm min-h-[60px]"
                            placeholder={"Jane Doe (owner): passed\nJohn Smith (signer): pending"}
                            value={personaKycStatuses}
                            onChange={(e) => setPersonaKycStatuses(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Verification issues</label>
                        <textarea
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm min-h-[48px]"
                          placeholder="identity mismatch, address mismatch, etc. — leave blank if none"
                          value={personaVerificationIssues}
                          onChange={(e) => setPersonaVerificationIssues(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" className="bg-blue-700 hover:bg-blue-800 gap-1" onClick={savePersonaResults}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Save Persona results
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={verificationLoading}
                          onClick={runVerification}
                        >
                          Run rules check
                        </Button>
                      </div>
                      {(merchantData.personaKybStatus || merchantData.personaKycStatuses) && (
                        <p className="text-xs text-slate-500 border-t pt-2">
                          <span className="font-medium text-slate-600">Saved:</span>{' '}
                          KYB {merchantData.personaKybStatus || 'not set'} •{' '}
                          {merchantData.personaKycStatuses ? merchantData.personaKycStatuses.slice(0, 80) + (merchantData.personaKycStatuses.length > 80 ? '…' : '') : 'KYC not set'}
                        </p>
                      )}
                      {lastVerification && (
                        <div className="rounded-lg border border-blue-200 bg-white/90 p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className={lastVerification.status === 'clear' ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100' : 'bg-amber-100 text-amber-900 hover:bg-amber-100'}>
                              {lastVerification.status === 'clear' ? 'Clear' : 'Needs follow-up'}
                            </Badge>
                            <Badge variant="outline" className="border-slate-200 text-slate-700">
                              {lastVerification.issues.length} item{lastVerification.issues.length === 1 ? '' : 's'}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{lastVerification.summary}</p>
                          {lastVerification.issues.length > 0 && (
                            <ul className="space-y-1">
                              {lastVerification.issues.map((issue) => (
                                <li key={issue.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                                  <span className="text-slate-800">{issue.reason}</span>
                                  <span className="text-slate-400 ml-1">— {issue.target.whereLabel}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Processor-specific follow-up answers — only if present */}
                {merchantData.processorSpecificAnswers?.trim() && (
                  <Card className="mt-6 border-emerald-200 bg-emerald-50/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileWarning className="w-4 h-4 text-emerald-600" />
                        Processor-specific follow-up answers
                      </CardTitle>
                      <p className="text-xs text-slate-600 font-normal mt-1">
                        Matched processor: <strong>{merchantData.matchedProcessor || 'Not yet matched'}</strong>
                      </p>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap text-sm text-slate-800 bg-white rounded-md border border-slate-200 p-3 max-h-64 overflow-y-auto">
                        {merchantData.processorSpecificAnswers}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {currentView === 'underwriting' && (
          <div className="p-8 max-w-5xl mx-auto overflow-y-auto h-full space-y-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Underwriting Report</h1>
                <p className="text-slate-500">Rule-based risk analysis and processor recommendation.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={runRuleBasedUnderwriting}
              >
                <RefreshCcw className="w-4 h-4" />
                {underwritingResult ? 'Re-analyze' : 'Run Analysis'}
              </Button>
            </div>

            {!underwritingResult ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-slate-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">No Underwriting Data Yet</h2>
                <p className="text-slate-500 max-w-md mb-4">
                  Click "Run Analysis" above to generate a rule-based underwriting report from the merchant's intake data.
                </p>
                <Button onClick={runRuleBasedUnderwriting} className="gap-2">
                  <Activity className="w-4 h-4" /> Run Analysis
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Risk & Recommendation */}
                <div className="lg:col-span-2 space-y-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-primary shadow-md overflow-hidden">
                      <div className="bg-slate-50 border-b p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Recommended Processor</h3>
                            <div className="flex items-center gap-3">
                              {underwritingResult.recommendedProcessor === 'Nuvei' && <Building className="w-6 h-6 text-blue-500" />}
                              {underwritingResult.recommendedProcessor === 'Payroc / Peoples' && <ShieldCheck className="w-6 h-6 text-emerald-600" />}
                              {underwritingResult.recommendedProcessor === 'Chase' && <Globe className="w-6 h-6 text-sky-600" />}
                              <span className="text-2xl font-bold text-slate-900">{underwritingResult.recommendedProcessor}</span>
                            </div>
                          </div>
                          <Badge variant="success" className="px-3 py-1 text-sm">Rule-Based Match</Badge>
                        </div>
                        <FormattedSummary text={underwritingResult.reason} emptyText="No recommendation reason." />
                      </div>

                      <CardContent className="p-6">
                        <div className="mb-8">
                          <div className="flex justify-between items-end mb-2">
                            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                              <Activity className="w-5 h-5 text-slate-400" />
                              Overall Risk Score
                            </h4>
                            <div className="text-right">
                              <span className={`font-bold text-3xl ${getScoreTextColor(underwritingResult.riskScore)}`}>
                                {underwritingResult.riskScore}
                              </span>
                              <span className="text-slate-400 text-sm">/100</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                            <div className={`h-full ${getScoreColor(underwritingResult.riskScore)} transition-all duration-1000`} style={{ width: `${underwritingResult.riskScore}%` }}></div>
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 font-medium">
                            <span>Low Risk (0-33)</span>
                            <span>Medium Risk (34-66)</span>
                            <span>High Risk (67-100)</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-semibold text-slate-900 border-b pb-2">Key Risk Factors Identified</h4>
                          <ul className="space-y-3">
                            {underwritingResult.riskFactors.map((factor, idx) => (
                              <li key={idx} className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                                  underwritingResult.riskCategory === 'High' ? 'text-red-500' : underwritingResult.riskCategory === 'Medium' ? 'text-yellow-500' : 'text-blue-500'
                                }`} />
                                <span className="text-sm text-slate-700 leading-relaxed">{factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-4 mt-8">
                          <h4 className="font-semibold text-slate-900 border-b pb-2">Readiness Decision</h4>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-900">{underwritingResult.readinessDecision || 'No readiness decision.'}</p>
                            {underwritingResult.missingItems.length > 0 ? (
                              <ul className="mt-3 space-y-2">
                                {underwritingResult.missingItems.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">No blocking missing items.</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4 mt-8">
                          <h4 className="font-semibold text-slate-900 border-b pb-2 flex items-center gap-2">
                            <FileSearch className="w-5 h-5 text-slate-500" />
                            Cross-Reference Audit
                          </h4>
                          <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                            underwritingResult.verificationStatus === 'Verified' ? 'bg-green-50 border-green-200 text-green-800' :
                            underwritingResult.verificationStatus === 'Discrepancies Found' ? 'bg-red-50 border-red-200 text-red-800' :
                            'bg-slate-50 border-slate-200 text-slate-800'
                          }`}>
                            {underwritingResult.verificationStatus === 'Verified' ? <ShieldCheck className="w-6 h-6 shrink-0 mt-0.5 text-green-600" /> :
                             underwritingResult.verificationStatus === 'Discrepancies Found' ? <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-red-600" /> :
                             <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-slate-500" />}
                            <div className="w-full">
                              <h5 className="font-bold uppercase tracking-wider text-xs mb-2">{underwritingResult.verificationStatus}</h5>
                              {underwritingResult.verificationNotes.length > 0 ? (
                                <ul className="space-y-2">
                                  {underwritingResult.verificationNotes.map((note, idx) => (
                                    <li key={idx} className="text-sm flex items-start gap-2">
                                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
                                      <span className="leading-relaxed">{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm opacity-80">No specific audit notes.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-slate-50 border-t p-6">
                        <Button
                          className={`w-full h-12 text-lg ${appStatus === 'approved' || appStatus === 'signed' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          disabled={appStatus === 'approved' || appStatus === 'signed'}
                          onClick={() => {
                            toast.success(`Application approved — routed to ${underwritingResult.recommendedProcessor}`);
                            setAppStatus('approved');
                          }}
                        >
                          {appStatus === 'approved' || appStatus === 'signed'
                            ? `Approved & Routed to ${underwritingResult.recommendedProcessor}`
                            : `Approve & Route to ${underwritingResult.recommendedProcessor}`}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                </div>

                {/* Right Column: Context & Documents */}
                <div className="space-y-6">
                  {/* Merchant overview — context + summary merged */}
                  <Card>
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-base">Merchant Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-sm">
                      <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Category</span> <Badge variant={underwritingResult.riskCategory === 'Low' ? 'success' : underwritingResult.riskCategory === 'Medium' ? 'warning' : 'destructive'}>{underwritingResult.riskCategory}</Badge></div>
                      <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Industry</span> <span className="font-medium capitalize">{merchantData.industry.replace('_', ' ')}</span></div>
                      <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Volume</span> <span className="font-medium">{merchantData.monthlyVolume}</span></div>
                      <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Transactions</span> <span className="font-medium">{merchantData.monthlyTransactions}</span></div>
                      <div className="flex justify-between items-center pb-2 border-b"><span className="text-slate-500">Est. Avg Ticket</span> <span className="font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">{getAvgTicketSize(merchantData.monthlyVolume, merchantData.monthlyTransactions)}</span></div>
                      <div className="pt-1">
                        <FormattedSummary text={underwritingResult.merchantSummary} emptyText="No merchant summary." />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Workflow readiness — simplified */}
                  <Card className="border-violet-100 bg-violet-50/60">
                    <CardHeader className="pb-3 border-b border-violet-100">
                      <CardTitle className="text-base text-violet-950 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Workflow Readiness
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4 text-sm">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">KYC / KYB routing</p>
                        <FormattedSummary text={merchantData.personaInvitePlan || merchantData.personaVerificationSummary} emptyText="No KYC / KYB routing plan attached." tone="slate" />
                      </div>
                      {(underwritingResult.websiteReviewSummary || merchantData.websiteReviewSummary) && (
                        <div className="border-t border-violet-100 pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Website review signals</p>
                          <FormattedSummary text={underwritingResult.websiteReviewSummary || merchantData.websiteReviewSummary} emptyText="" tone="slate" />
                        </div>
                      )}
                      {(merchantData.processorReadyPackageSummary || merchantData.processorSpecificAnswers) && (
                        <div className="border-t border-violet-100 pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Processor package</p>
                          <FormattedSummary text={merchantData.processorReadyPackageSummary || merchantData.processorSpecificAnswers} emptyText="" tone="slate" />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Documents — merged missing uploads + document summary */}
                  <Card className="bg-blue-50 border-blue-100">
                    <CardHeader className="pb-3 border-b border-blue-100">
                      <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <FormattedSummary text={underwritingResult.documentSummary} emptyText="No document data." tone="blue" />
                      {docChecklist.some((d) => !d.present) && (
                        <div className="pt-3 border-t border-blue-200/50">
                          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">Missing required uploads</p>
                          <ul className="text-xs text-amber-900 space-y-1">
                            {docChecklist.filter((d) => !d.present).map((d) => (
                              <li key={d.key} className="flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                {d.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {documents.length > 0 && (
                        <div className="pt-3 border-t border-blue-200/50">
                          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Files on record</p>
                          <ul className="space-y-1.5">
                            {documents.map(doc => (
                              <li key={doc.id} className="text-xs text-blue-700 flex items-center gap-2 truncate">
                                <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                                {doc.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
