import React from 'react';
import { MerchantData, FileData } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { MerchantView } from './MerchantPortal';
import { CheckCircle2, AlertCircle, Edit2, FileText } from 'lucide-react';

interface Props {
  data: MerchantData;
  documents: FileData[];
  setCurrentView: (view: MerchantView) => void;
  onEdit: (section: string) => void;
  onSubmit: () => void;
}

export function ReviewPage({ data, documents, setCurrentView, onEdit, onSubmit }: Props) {
  const isComplete = (data.legalName || data.ownerName) && data.monthlyVolume && data.industry;

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Business Basics</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('companyDetailsForm')}><Edit2 className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Type</span> <span className="font-medium capitalize">{data.businessType?.replace('_', ' ')}</span></div>
            {data.legalName && <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Legal Name</span> <span className="font-medium">{data.legalName}</span></div>}
            {data.taxId && <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Tax ID</span> <span className="font-medium">{data.taxId}</span></div>}
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Website</span> <span className="font-medium">{data.website}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Time in Business</span> <span className="font-medium">{data.timeInBusiness}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Staff Size</span> <span className="font-medium">{data.staffSize}</span></div>
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
            <Button variant="ghost" size="sm" onClick={() => onEdit('ownerDetailsForm')}><Edit2 className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Full Name</span> <span className="font-medium">{data.ownerName}</span></div>
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

        {renderSection('Business Operations', 'businessOperationsForm', [
          { label: 'Avg Txn Count', value: data.avgTxnCount },
          { label: 'Avg Ticket Size', value: data.avgTicketSize },
          { label: 'Target Geography', value: data.targetGeography },
          { label: 'Cross-border Split', value: data.domesticCrossBorderSplit },
          { label: 'Processing Currencies', value: data.processingCurrencies },
          { label: 'Payment Products', value: data.paymentProducts },
        ])}

        {renderSection('Owner Details', 'ownerDetailsForm', [
          { label: 'Ownership %', value: data.ownershipPercentage },
          { label: 'Role', value: data.ownerRole },
          { label: 'Email', value: data.ownerEmail },
          { label: 'ID Number', value: data.ownerIdNumber },
          { label: 'ID Expiry', value: data.ownerIdExpiry },
          { label: 'Country of Residence', value: data.ownerCountryOfResidence },
        ])}

        {renderSection('Bank Account', 'bankAccountForm', [
          { label: 'Bank Name', value: data.bankName },
          { label: 'Account Holder', value: data.accountHolderName },
          { label: 'Account Number', value: data.accountNumber },
          { label: 'Routing Number', value: data.routingNumber },
          { label: 'Settlement Currency', value: data.settlementCurrency },
        ])}

        {renderSection('Industry Specific', 'subscriptionForm', [
          { label: 'Recurring Billing', value: data.recurringBillingDetails },
          { label: 'Refund Policy', value: data.refundPolicy },
          { label: 'Shipping Policy', value: data.shippingPolicy },
          { label: 'Compliance Details', value: data.complianceDetails },
        ])}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Uploaded Documents</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('idUpload')}><FileText className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {documents.length === 0 ? (
              <p className="text-slate-500 italic">No documents uploaded.</p>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <span className="truncate max-w-[200px] text-slate-700">{doc.name}</span>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 capitalize">{doc.documentType?.replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
