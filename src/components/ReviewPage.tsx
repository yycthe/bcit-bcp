import React from 'react';
import { MerchantData, FileData } from '@/src/types';
import { getMerchantDocumentChecklist } from '@/src/lib/documentChecklist';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import type { MerchantView } from './MerchantPortal';
import { CheckCircle2, AlertCircle, Edit2, Eye, FileWarning } from 'lucide-react';
import { toast } from 'sonner';

async function openUploadedFileInNewTab(doc: FileData) {
  try {
    const raw = doc.data.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    let finalBytes = bytes;

    if (doc.contentEncoding === 'gzip') {
      if (typeof DecompressionStream === 'undefined') {
        toast.error('This browser cannot preview compressed uploads. Please re-upload or use a newer browser.');
        return;
      }
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const decompressed = await new Response(stream).arrayBuffer();
      finalBytes = new Uint8Array(decompressed);
    }

    const blob = new Blob([finalBytes], { type: doc.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      URL.revokeObjectURL(url);
      toast.error('Pop-up blocked. Allow pop-ups for this site to view the file.');
      return;
    }
    win.addEventListener('beforeunload', () => URL.revokeObjectURL(url));
    setTimeout(() => URL.revokeObjectURL(url), 600_000);
  } catch {
    toast.error('Could not open this file.');
  }
}

interface Props {
  data: MerchantData;
  documents: FileData[];
  setCurrentView: (view: MerchantView) => void;
  onEdit: (section: string) => void;
  onSubmit: () => void;
}

export function ReviewPage({ data, documents, setCurrentView, onEdit, onSubmit }: Props) {
  const isComplete = (data.legalName || data.ownerName) && data.monthlyVolume && data.industry;
  const docChecklist = getMerchantDocumentChecklist(data);
  const missingDocs = docChecklist.filter((d) => !d.present);

  const renderSection = (title: string, sectionId: string, fields: { label: string, value: string | undefined | null }[]) => {
    const visibleFields = fields.filter(f => f.value);
    if (visibleFields.length === 0) return null;
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEdit(sectionId)}><Edit2 className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {visibleFields.map((f, i) => (
            <div key={i} className={`flex justify-between ${i !== visibleFields.length - 1 ? 'border-b pb-2' : ''}`}>
              <span className="text-slate-500">{f.label}</span> 
              <span className="font-medium text-right max-w-[60%] break-words">{f.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto overflow-y-auto h-full space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review Application</h1>
          <p className="text-slate-500">Please review your information before submitting for AI underwriting.</p>
        </div>
        <Button 
          onClick={onSubmit} 
          disabled={!isComplete}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Submit for Underwriting
        </Button>
      </div>

      {!isComplete && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
          <div>
            <h4 className="font-semibold">Incomplete Application</h4>
            <p className="text-sm mt-1">Please complete all required fields in the Intake Assistant before submitting.</p>
          </div>
        </div>
      )}

      {missingDocs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-lg flex items-start gap-3">
          <FileWarning className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-amber-900">Document slots not filled (demo)</h4>
            <p className="text-sm mt-1 text-amber-800/90">
              You can still submit; Admin may request uploads. Missing for your profile:
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {missingDocs.map((d) => (
                <li key={d.key}>
                  <Badge variant="outline" className="border-amber-300 bg-white/80 text-amber-900">
                    {d.label}
                  </Badge>
                </li>
              ))}
            </ul>
            <Button type="button" variant="link" className="h-auto p-0 mt-2 text-amber-800" onClick={() => onEdit('idUpload')}>
              Add documents in Intake →
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Business Basics</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('legalBusinessForm')}><Edit2 className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Type</span> <span className="font-medium capitalize">{data.businessType?.replace('_', ' ')}</span></div>
            {data.legalName && <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Legal Name</span> <span className="font-medium">{data.legalName}</span></div>}
            {data.businessRegistrationNumber && <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Registration</span> <span className="font-medium">{data.businessRegistrationNumber}</span></div>}
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Website</span> <span className="font-medium">{data.website}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Established</span> <span className="font-medium">{data.establishedDate || data.timeInBusiness}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Legal Email</span> <span className="font-medium">{data.legalBusinessEmail || data.generalEmail}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Business Category</span> <span className="font-medium">{data.businessCategory}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Geography & Industry</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('country')}><Edit2 className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Country</span> <span className="font-medium">{data.country}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Industry</span> <span className="font-medium capitalize">{data.industry.replace('_', ' ')}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Monthly Volume</span> <span className="font-medium">{data.monthlyVolume}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Transactions</span> <span className="font-medium">{data.monthlyTransactions}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Owner Identity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('ownershipControlForm')}><Edit2 className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Owners</span> <span className="font-medium">{data.beneficialOwners || data.ownerName}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Signer</span> <span className="font-medium">{data.authorizedSignerName || data.ownerName}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ID Uploaded</span> 
              {data.idUpload ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-yellow-500" />}
            </div>
          </CardContent>
        </Card>

        {renderSection('Contact & Address', 'contactAddressForm', [
          { label: 'General Email', value: data.generalEmail },
          { label: 'Phone', value: data.phone },
          { label: 'Registered Address', value: data.registeredAddress },
          { label: 'Operating Address', value: data.operatingAddress },
          { label: 'City', value: data.city },
          { label: 'Province', value: data.province },
        ])}

        {renderSection('Business Model', 'businessModelForm', [
          { label: 'Products / Services', value: data.productsServices },
          { label: 'Business Description', value: data.businessDescription },
          { label: 'Customer Type', value: data.customerType },
          { label: 'Advance Payment', value: data.advancePayment },
          { label: 'Recurring Billing', value: data.recurringBilling },
          { label: 'Fulfillment Timeline', value: data.fulfillmentTimeline },
        ])}

        {renderSection('Sales Profile', 'salesProfileForm', [
          { label: 'Avg Ticket Size', value: data.avgTicketSize },
          { label: 'Highest Ticket', value: data.highestTicketAmount },
          { label: 'Channel Split', value: data.transactionChannelSplit },
          { label: 'Recurring %', value: data.recurringTransactionsPercent },
          { label: 'Foreign Cards %', value: data.foreignCardsPercent },
          { label: 'Processing Currencies', value: data.processingCurrencies },
        ])}

        {renderSection('Processing History', 'processingHistoryForm', [
          { label: 'Currently Processes Cards', value: data.currentlyProcessesCards },
          { label: 'Current / Previous Processor', value: data.currentOrPreviousProcessor },
          { label: 'Exit Reason', value: data.processorExitReason },
          { label: 'Prior Termination', value: data.priorTermination },
          { label: 'Bankruptcy', value: data.bankruptcyHistory },
          { label: 'Risk Program History', value: data.riskProgramHistory },
        ])}

        {renderSection('Website / PCI Basics', 'websiteComplianceForm', [
          { label: 'Privacy Policy', value: data.websitePrivacyPolicy },
          { label: 'Terms', value: data.websiteTerms },
          { label: 'Refund Policy', value: data.websiteRefundPolicy },
          { label: 'Shipping Policy', value: data.websiteShippingPolicy },
          { label: 'Contact Info', value: data.websiteContactInfo },
          { label: 'Currency Display', value: data.websiteCurrencyDisplay },
          { label: 'SSL', value: data.websiteSsl },
          { label: 'Stores Cards', value: data.storesCardNumbers },
        ])}

        {renderSection('Document Readiness', 'documentReadinessForm', [
          { label: 'Registration / Articles', value: data.canProvideRegistration },
          { label: 'Void Cheque / Bank Letter', value: data.canProvideVoidCheque },
          { label: 'Bank Statements', value: data.canProvideBankStatements },
          { label: 'Proof of Ownership', value: data.canProvideProofOfOwnership },
          { label: 'Owner IDs', value: data.canProvideOwnerIds },
          { label: 'Processing Statements', value: data.canProvideProcessingStatements },
        ])}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Uploaded Documents</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Edit document uploads in Intake Assistant"
              aria-label="Edit document uploads in Intake Assistant"
              onClick={() => onEdit('idUpload')}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {documents.length === 0 ? (
              <p className="text-slate-500 italic">No documents uploaded.</p>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                  <span className="truncate min-w-0 text-slate-700">{doc.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 capitalize max-w-[100px] truncate">
                      {doc.documentType?.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => {
                        void openUploadedFileInNewTab(doc);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
