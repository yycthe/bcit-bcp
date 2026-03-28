import React, { useState } from 'react';
import { MerchantData } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { CheckCircle2, FileSignature } from 'lucide-react';

interface Props {
  data: MerchantData;
  onSign?: () => void;
}

export function AgreementPage({ data, onSign }: Props) {
  const [signature, setSignature] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const [signDate, setSignDate] = useState('');

  const merchantName = data.legalName || data.ownerName || '[Merchant Name]';
  const merchantAddress = data.registeredAddress || data.operatingAddress || '[Merchant Address]';
  const merchantEmail = data.generalEmail || data.ownerEmail || '[Merchant Email]';

  const handleSign = () => {
    if (!signature.trim()) return;
    setIsSigned(true);
    setSignDate(new Date().toLocaleDateString());
    if (onSign) onSign();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto overflow-y-auto h-full space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Merchant Agreement</h1>
          <p className="text-slate-500">Review and sign your processing agreement with FintechWerx.</p>
        </div>
      </div>

      <Card className="bg-white shadow-lg border-t-4 border-t-blue-600">
        <CardHeader className="border-b pb-6 mb-6 text-center">
          <CardTitle className="text-2xl font-serif tracking-tight">FINTECHWERX MASTER SERVICES AGREEMENT</CardTitle>
          <p className="text-sm text-slate-500 mt-2">Effective Date: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="space-y-6 font-serif text-slate-800 leading-relaxed px-4 md:px-10">
          <p>
            This Master Services Agreement (the "Agreement") is entered into by and between <strong>FintechWerx Inc.</strong> ("Provider") and <strong>{merchantName}</strong> ("Merchant"), located at <strong>{merchantAddress}</strong>.
          </p>

          <div className="bg-slate-50 p-5 rounded-lg border font-sans">
            <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-slate-500 border-b pb-2">Schedule A: Merchant Details</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <li><strong className="text-slate-600">Legal Name:</strong> <span className="font-medium">{data.legalName || 'N/A'}</span></li>
              <li><strong className="text-slate-600">DBA / Owner:</strong> <span className="font-medium">{data.ownerName || 'N/A'}</span></li>
              <li><strong className="text-slate-600">Industry:</strong> <span className="font-medium capitalize">{data.industry?.replace('_', ' ') || 'N/A'}</span></li>
              <li><strong className="text-slate-600">Contact Email:</strong> <span className="font-medium">{merchantEmail}</span></li>
              <li><strong className="text-slate-600">Monthly Volume:</strong> <span className="font-medium">{data.monthlyVolume || 'N/A'}</span></li>
              <li><strong className="text-slate-600">Settlement Currency:</strong> <span className="font-medium">{data.settlementCurrency || 'USD/CAD'}</span></li>
            </ul>
          </div>

          <div className="space-y-4 text-sm">
            <h3 className="font-bold text-lg">1. Services Provided</h3>
            <p>Provider agrees to provide Merchant with payment processing services, gateway access, and related financial technology solutions as described in the FintechWerx Terms of Service. Provider will facilitate the transmission of transaction data to the applicable acquiring banks and card networks.</p>

            <h3 className="font-bold text-lg">2. Compliance & Underwriting</h3>
            <p>Merchant agrees to comply with all applicable laws, card network rules, and Provider's acceptable use policy. Provider reserves the right to hold funds, suspend processing, or terminate this Agreement immediately if Merchant engages in prohibited activities, experiences excessive chargebacks, or exceeds acceptable risk thresholds as determined by Provider's AI underwriting systems.</p>

            <h3 className="font-bold text-lg">3. Fees & Settlement</h3>
            <p>Fees for the Services will be assessed according to the standard FintechWerx pricing schedule unless otherwise negotiated in writing. Settlement of funds will be made to the bank account provided by the Merchant during the onboarding process, subject to standard holding periods and reserve requirements.</p>
          </div>
        </CardContent>

        <CardFooter className="bg-slate-50 border-t p-6 md:p-10 flex flex-col items-start gap-6">
          <h3 className="font-bold text-lg font-serif w-full border-b pb-2">Signatures</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full">
            {/* FintechWerx Signature */}
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-500 uppercase">Provider: FintechWerx Inc.</p>
              <div className="h-16 border-b-2 border-slate-300 flex items-end pb-2">
                <span className="text-3xl text-blue-800" style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}>FintechWerx Admin</span>
              </div>
              <div>
                <p className="text-sm font-medium">Name: Authorized Representative</p>
                <p className="text-sm text-slate-500">Title: Underwriting Director</p>
                <p className="text-sm text-slate-500">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Merchant Signature */}
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-500 uppercase">Merchant: {merchantName}</p>
              
              {isSigned ? (
                <>
                  <div className="h-16 border-b-2 border-slate-300 flex items-end pb-2 relative">
                    <span className="text-4xl text-slate-800" style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}>{signature}</span>
                    <CheckCircle2 className="absolute right-2 bottom-2 text-green-500 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Name: {signature}</p>
                    <p className="text-sm text-slate-500">Title: Owner / Authorized Signatory</p>
                    <p className="text-sm text-slate-500">Date: {signDate}</p>
                  </div>
                  <div className="mt-4 bg-green-50 text-green-800 p-3 rounded-md text-sm flex items-center gap-2 border border-green-200">
                    <FileSignature className="w-4 h-4" />
                    Agreement legally signed and executed.
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">Type your full legal name to sign:</label>
                    <Input 
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="font-medium"
                    />
                    <Button 
                      onClick={handleSign} 
                      disabled={!signature.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Sign & Accept Agreement
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    By signing, you agree to the FintechWerx Master Services Agreement and confirm that you are an authorized signatory for the business.
                  </p>
                </>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
