import React from 'react';
import { MerchantData, FileData } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { FormattedSummary } from '@/src/components/ui/formatted-summary';
import { Zap, Globe, AlertCircle, Building, Activity, FileText, CheckCircle2, FileSearch, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface Props {
  data: MerchantData;
  aiRecommendation: any;
  documents: FileData[];
  onApprove?: () => void;
  isApproved?: boolean;
}

export function AIUnderwriting({ data, aiRecommendation, documents, onApprove, isApproved }: Props) {
  if (!aiRecommendation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Underwriting Data Yet</h2>
        <p className="text-slate-500 max-w-md">
          Complete the intake process and submit your application from the Review page to generate an AI underwriting assessment.
        </p>
      </div>
    );
  }

  const { riskScore, riskCategory, riskFactors, recommendedProcessor, reason, documentSummary, verificationStatus = 'Unverified', verificationNotes = [] } = aiRecommendation;

  // Calculate estimated average ticket size
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

    if (volMid && transMid) {
      const avg = volMid / transMid;
      return `$${avg.toFixed(2)}`;
    }
    return 'Unknown';
  };

  const avgTicketSize = getAvgTicketSize(data.monthlyVolume, data.monthlyTransactions);

  const getScoreColor = (score: number) => {
    if (score <= 33) return "bg-green-500";
    if (score <= 66) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  const getScoreTextColor = (score: number) => {
    if (score <= 33) return "text-green-700";
    if (score <= 66) return "text-yellow-700";
    return "text-red-700";
  };

  return (
    <div className="p-8 max-w-5xl mx-auto overflow-y-auto h-full space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Underwriting Summary</h1>
          <p className="text-slate-500">Comprehensive risk analysis and processor recommendation.</p>
        </div>
      </div>

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
                      {recommendedProcessor === 'Stripe' && <Zap className="w-6 h-6 text-indigo-500" />}
                      {recommendedProcessor === 'Adyen' && <Globe className="w-6 h-6 text-green-500" />}
                      {recommendedProcessor === 'HighRiskPay' && <AlertCircle className="w-6 h-6 text-red-500" />}
                      {recommendedProcessor === 'Nuvei' && <Building className="w-6 h-6 text-blue-500" />}
                      <span className="text-2xl font-bold text-slate-900">{recommendedProcessor}</span>
                    </div>
                  </div>
                  <Badge variant="success" className="px-3 py-1 text-sm">AI Recommended Match</Badge>
                </div>
                <FormattedSummary
                  text={reason}
                  emptyText="No recommendation reason returned."
                />
              </div>
              
              <CardContent className="p-6">
                <div className="mb-8">
                  <div className="flex justify-between items-end mb-2">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-slate-400" />
                      Overall Risk Score
                    </h4>
                    <div className="text-right">
                      <span className={`font-bold text-3xl ${getScoreTextColor(riskScore)}`}>
                        {riskScore}
                      </span>
                      <span className="text-slate-400 text-sm">/100</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                    <div className={`h-full ${getScoreColor(riskScore)} transition-all duration-1000`} style={{ width: `${riskScore}%` }}></div>
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
                    {riskFactors.map((factor: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                          riskCategory === 'High' ? 'text-red-500' : riskCategory === 'Medium' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <span className="text-sm text-slate-700 leading-relaxed">{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4 mt-8">
                  <h4 className="font-semibold text-slate-900 border-b pb-2 flex items-center gap-2">
                    <FileSearch className="w-5 h-5 text-slate-500" />
                    Cross-Reference Audit
                  </h4>
                  
                  <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                    verificationStatus === 'Verified' ? 'bg-green-50 border-green-200 text-green-800' :
                    verificationStatus === 'Discrepancies Found' ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    {verificationStatus === 'Verified' ? <ShieldCheck className="w-6 h-6 shrink-0 mt-0.5 text-green-600" /> :
                     verificationStatus === 'Discrepancies Found' ? <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-red-600" /> :
                     <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-slate-500" />}
                    
                    <div className="w-full">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-bold uppercase tracking-wider text-xs">{verificationStatus}</h5>
                      </div>
                      {verificationNotes && verificationNotes.length > 0 ? (
                        <ul className="space-y-2 mt-2">
                          {verificationNotes.map((note: string, idx: number) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
                              <span className="leading-relaxed">{note}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm mt-1 opacity-80">No specific audit notes available.</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-6">
                <Button 
                  className={`w-full h-12 text-lg ${isApproved ? 'bg-green-600 hover:bg-green-700' : ''}`} 
                  disabled={isApproved}
                  onClick={() => {
                    toast.success(`Application successfully routed to ${recommendedProcessor}!`);
                    if (onApprove) onApprove();
                  }}
                >
                  {isApproved ? `Approved & Routed to ${recommendedProcessor}` : `Approve & Route to ${recommendedProcessor}`}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </div>

        {/* Right Column: Context & Documents */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">Merchant Context</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Category</span> <Badge variant={riskCategory === 'Low' ? 'success' : riskCategory === 'Medium' ? 'warning' : 'destructive'}>{riskCategory}</Badge></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Industry</span> <span className="font-medium capitalize">{data.industry.replace('_', ' ')}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Volume</span> <span className="font-medium">{data.monthlyVolume}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Transactions</span> <span className="font-medium">{data.monthlyTransactions}</span></div>
              <div className="flex justify-between items-center pt-1"><span className="text-slate-500">Est. Avg Ticket</span> <span className="font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">{avgTicketSize}</span></div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-100">
            <CardHeader className="pb-3 border-b border-blue-100">
              <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Document Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {documentSummary && documentSummary !== "No document information extracted" && documentSummary !== "No document information extracted (Fallback mode)" ? (
                <FormattedSummary
                  text={documentSummary}
                  emptyText="No document data extracted."
                  tone="blue"
                />
              ) : (
                <div className="text-sm text-blue-600/70 italic text-center py-4">
                  No document data extracted.
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-blue-200/50">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Files Analyzed</p>
                {documents.length > 0 ? (
                  <ul className="space-y-2">
                    {documents.map(doc => (
                      <li key={doc.id} className="text-xs text-blue-700 flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                        {doc.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-blue-600/70">No files uploaded</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
