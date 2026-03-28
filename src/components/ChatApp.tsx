import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Upload, CheckCircle2, FileText, ShieldCheck, AlertCircle, Building, Zap, Globe, RefreshCcw, Activity, Building2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select } from '@/src/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { toast } from 'sonner';
import { MerchantData, FileData } from '@/src/types';
import { getFallbackUnderwriting } from '@/src/lib/underwritingFallback';

type QuestionId = Exclude<keyof MerchantData, 'additionalDocuments'> | 'done' | 'companyDetailsForm' | 'contactAddressForm' | 'businessOperationsForm' | 'ownerDetailsForm' | 'bankAccountForm' | 'subscriptionForm' | 'retailForm';

interface QuestionDef {
  id: QuestionId;
  text: string;
  type: 'buttons' | 'dropdown' | 'text' | 'upload' | 'form';
  options?: { label: string; value: string }[];
  fields?: { id: keyof MerchantData; label: string; type: 'text' | 'email' | 'number' | 'date' }[];
}

const QUESTIONS: Partial<Record<QuestionId, QuestionDef>> = {
  businessType: {
    id: 'businessType',
    text: "Hi there! I'm here to help you get set up with MerchantWerx. First, what type of business are you operating?",
    type: 'buttons',
    options: [
      { label: 'Sole Proprietorship', value: 'sole_proprietorship' },
      { label: 'LLC', value: 'llc' },
      { label: 'Corporation', value: 'corporation' },
      { label: 'Partnership', value: 'partnership' },
    ]
  },
  country: {
    id: 'country',
    text: "Great. Where is your business legally located?",
    type: 'dropdown',
    options: [
      { label: 'United States', value: 'US' },
      { label: 'Canada', value: 'CA' },
      { label: 'United Kingdom', value: 'UK' },
      { label: 'European Union', value: 'EU' },
      { label: 'Other', value: 'Other' },
    ]
  },
  industry: {
    id: 'industry',
    text: "What industry are you in?",
    type: 'dropdown',
    options: [
      { label: 'Retail / E-commerce', value: 'retail' },
      { label: 'Software / SaaS', value: 'software' },
      { label: 'Professional Services', value: 'services' },
      { label: 'Gaming', value: 'gaming' },
      { label: 'Crypto / Web3', value: 'crypto' },
      { label: 'Other High Risk', value: 'high_risk' },
    ]
  },
  monthlyVolume: {
    id: 'monthlyVolume',
    text: "What is your estimated monthly processing volume?",
    type: 'buttons',
    options: [
      { label: '< $10k', value: '<10k' },
      { label: '$10k - $50k', value: '10k-50k' },
      { label: '$50k - $250k', value: '50k-250k' },
      { label: '> $250k', value: '>250k' },
    ]
  },
  monthlyTransactions: {
    id: 'monthlyTransactions',
    text: "And roughly how many transactions do you process per month?",
    type: 'buttons',
    options: [
      { label: '< 100', value: '<100' },
      { label: '100 - 1,000', value: '100-1k' },
      { label: '1,000 - 10,000', value: '1k-10k' },
      { label: '> 10,000', value: '>10k' },
    ]
  },
  legalName: {
    id: 'legalName',
    text: "What is the legal name of your company?",
    type: 'text'
  },
  taxId: {
    id: 'taxId',
    text: "Please provide your Tax ID or EIN.",
    type: 'text'
  },
  ownerName: {
    id: 'ownerName',
    text: "What is your full legal name?",
    type: 'text'
  },
  website: {
    id: 'website',
    text: "What is your business website URL?",
    type: 'text'
  },
  complianceDetails: {
    id: 'complianceDetails',
    text: "Since you're in a regulated industry, please briefly describe your compliance program.",
    type: 'text'
  },
  financials: {
    id: 'financials',
    text: "To proceed with your application, please upload your latest financial statements (e.g., P&L, Balance Sheet).",
    type: 'upload'
  },
  idUpload: {
    id: 'idUpload',
    text: "Please upload a valid government-issued ID for the primary business owner.",
    type: 'upload'
  },
  enhancedVerification: {
    id: 'enhancedVerification',
    text: "Since you are located outside of Canada, we require a secondary form of ID or proof of address.",
    type: 'upload'
  },
  
  // New Form Questions
  companyDetailsForm: {
    id: 'companyDetailsForm',
    text: "Please provide your company's core details.",
    type: 'form',
    fields: [
      { id: 'legalName', label: 'Legal Business Name', type: 'text' },
      { id: 'taxId', label: 'Tax ID / EIN', type: 'text' },
      { id: 'website', label: 'Business Website', type: 'text' },
      { id: 'timeInBusiness', label: 'Time in Business (e.g., 2 years)', type: 'text' },
      { id: 'staffSize', label: 'Staff Size', type: 'text' },
      { id: 'businessCategory', label: 'Business Subcategory', type: 'text' }
    ]
  },
  contactAddressForm: {
    id: 'contactAddressForm',
    text: "Where is your business located and how can we reach you?",
    type: 'form',
    fields: [
      { id: 'generalEmail', label: 'General Email', type: 'email' },
      { id: 'phone', label: 'Phone Number', type: 'text' },
      { id: 'registeredAddress', label: 'Registered Address', type: 'text' },
      { id: 'operatingAddress', label: 'Operating Address', type: 'text' },
      { id: 'city', label: 'City', type: 'text' },
      { id: 'province', label: 'Province / State', type: 'text' }
    ]
  },
  businessOperationsForm: {
    id: 'businessOperationsForm',
    text: "Tell us a bit about your transaction profile.",
    type: 'form',
    fields: [
      { id: 'avgTxnCount', label: 'Average Monthly Transactions', type: 'number' },
      { id: 'avgTicketSize', label: 'Average Ticket Size ($)', type: 'number' },
      { id: 'targetGeography', label: 'Target Customers Geography', type: 'text' },
      { id: 'domesticCrossBorderSplit', label: 'Domestic / Cross-border Split (%)', type: 'text' },
      { id: 'processingCurrencies', label: 'Processing Currencies (e.g., USD, EUR)', type: 'text' },
      { id: 'paymentProducts', label: 'Payment Products Needed', type: 'text' }
    ]
  },
  ownerDetailsForm: {
    id: 'ownerDetailsForm',
    text: "Please provide details about the primary business owner.",
    type: 'form',
    fields: [
      { id: 'ownerName', label: 'Full Legal Name', type: 'text' },
      { id: 'ownerEmail', label: 'Owner Email', type: 'email' },
      { id: 'ownerRole', label: 'Role / Title', type: 'text' },
      { id: 'ownershipPercentage', label: 'Ownership Percentage (%)', type: 'number' },
      { id: 'ownerIdNumber', label: 'ID Number (Passport/Driver License)', type: 'text' },
      { id: 'ownerIdExpiry', label: 'ID Expiry', type: 'date' },
      { id: 'ownerCountryOfResidence', label: 'Country of Residence', type: 'text' }
    ]
  },
  bankAccountForm: {
    id: 'bankAccountForm',
    text: "Where should we send your funds? Please provide your settlement account details.",
    type: 'form',
    fields: [
      { id: 'bankName', label: 'Bank Name', type: 'text' },
      { id: 'accountHolderName', label: 'Account Holder Name', type: 'text' },
      { id: 'accountNumber', label: 'Account Number / IBAN', type: 'text' },
      { id: 'routingNumber', label: 'Routing Number / Branch Code', type: 'text' },
      { id: 'settlementCurrency', label: 'Settlement Currency', type: 'text' }
    ]
  },
  subscriptionForm: {
    id: 'subscriptionForm',
    text: "Since you run a subscription business, please provide these details.",
    type: 'form',
    fields: [
      { id: 'recurringBillingDetails', label: 'Recurring Billing Details', type: 'text' },
      { id: 'refundPolicy', label: 'Cancellation / Refund Policy', type: 'text' }
    ]
  },
  retailForm: {
    id: 'retailForm',
    text: "Since you sell physical goods, please provide these details.",
    type: 'form',
    fields: [
      { id: 'deliveryMethod', label: 'Delivery Method', type: 'text' },
      { id: 'shippingPolicy', label: 'Shipping Policy', type: 'text' },
      { id: 'refundPolicy', label: 'Return Policy', type: 'text' }
    ]
  },

  // New Document Uploads
  proofOfAddress: {
    id: 'proofOfAddress',
    text: "Please upload a proof of address (utility bill, bank statement, etc.).",
    type: 'upload'
  },
  registrationCertificate: {
    id: 'registrationCertificate',
    text: "Please upload your business registration certificate.",
    type: 'upload'
  },
  taxDocument: {
    id: 'taxDocument',
    text: "Please upload your tax registration document.",
    type: 'upload'
  },
  proofOfFunds: {
    id: 'proofOfFunds',
    text: "Please upload proof of source of funds/income.",
    type: 'upload'
  },
  bankStatement: {
    id: 'bankStatement',
    text: "Could you please upload a recent bank statement (showing at least 3 months of activity)?",
    type: 'upload'
  },
  complianceDocument: {
    id: 'complianceDocument',
    text: "Please upload any relevant compliance or licensing documents.",
    type: 'upload'
  },

  done: {
    id: 'done',
    text: "All done! Let me analyze your profile...",
    type: 'text'
  }
};

const getNextQuestion = (currentId: QuestionId, data: MerchantData): QuestionId => {
  const isHighRisk = ['high_risk', 'crypto', 'gaming'].includes(data.industry);
  const isSubscription = data.industry === 'software';
  const isPhysicalGoods = data.industry === 'retail';

  // Define the full sequence of possible follow-up questions after 'monthlyTransactions'
  const followUpSequence: QuestionId[] = [
    'companyDetailsForm',
    'contactAddressForm',
    'ownerDetailsForm',
    'businessOperationsForm',
    'bankAccountForm'
  ];

  if (isSubscription) followUpSequence.push('subscriptionForm');
  if (isPhysicalGoods) followUpSequence.push('retailForm');
  if (isHighRisk) followUpSequence.push('complianceDetails');

  // Document sequence
  followUpSequence.push('idUpload');
  followUpSequence.push('registrationCertificate');
  followUpSequence.push('proofOfAddress');
  followUpSequence.push('bankStatement'); // Always ask
  followUpSequence.push('financials'); // Always ask

  if (isHighRisk) {
    followUpSequence.push('complianceDocument');
    followUpSequence.push('proofOfFunds');
  }

  if (data.country !== 'CA') {
    followUpSequence.push('enhancedVerification');
  }

  followUpSequence.push('done');

  switch (currentId) {
    case 'businessType': return 'country';
    case 'country': return 'industry';
    case 'industry': return 'monthlyVolume';
    case 'monthlyVolume': return 'monthlyTransactions';
    case 'monthlyTransactions': return followUpSequence[0];
    default:
      const index = followUpSequence.indexOf(currentId);
      if (index !== -1 && index < followUpSequence.length - 1) {
        return followUpSequence[index + 1];
      }
      return 'done';
  }
};

type Message = {
  id: string;
  sender: 'system' | 'user';
  content: React.ReactNode;
  isActionable?: boolean;
  questionId?: QuestionId;
};

interface ChatAppProps {
  data: MerchantData;
  setData: React.Dispatch<React.SetStateAction<MerchantData>>;
  setAiRecommendation: (rec: any) => void;
  setIsFinished: (val: boolean) => void;
  isFinished: boolean;
  documents: FileData[];
  setDocuments: React.Dispatch<React.SetStateAction<FileData[]>>;
  editSection: string | null;
  setEditSection: (section: string | null) => void;
  onFinish: () => void;
}

export function ChatApp({ data, setData, setAiRecommendation, setIsFinished, isFinished, documents, setDocuments, editSection, setEditSection, onFinish }: ChatAppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionId>('businessType');
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editSection && !isFinished) {
      setCurrentQuestion(editSection as QuestionId);
      setEditSection(null);
      
      // Check if it's a branching question
      const branchingQuestions = ['businessType', 'country', 'industry', 'monthlyVolume', 'monthlyTransactions'];
      setIsEditing(!branchingQuestions.includes(editSection));
      
      const qDef = QUESTIONS[editSection as QuestionId];
      if (qDef) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: `Let's update your ${qDef.text.toLowerCase()}`,
          sender: 'bot',
          isActionable: true
        }]);
      }
    }
  }, [editSection, isFinished, setEditSection]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const initialized = useRef(false);

  useEffect(() => {
    // Initial message
    if (!initialized.current && messages.length === 0) {
      initialized.current = true;
      askQuestion('businessType');
    }
  }, []);

  const askQuestion = (qId: QuestionId) => {
    const qDef = QUESTIONS[qId];
    if (!qDef) return;
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev.map(m => ({ ...m, isActionable: false })), // Disable previous actions
        {
          id: Math.random().toString(36).substring(2, 15),
          sender: 'system',
          content: qDef.text,
          isActionable: true,
          questionId: qId
        }
      ]);
    }, 800);
  };

  const handleAnswer = (value: any, displayValue?: string) => {
    if (!currentQuestion || currentQuestion === 'done') return;

    // Save data
    let newData = { ...data };
    if (typeof value === 'object' && !value.mimeType && !Array.isArray(value)) {
       newData = { ...newData, ...value };
    } else {
       newData = { ...newData, [currentQuestion]: value };
    }
    setData(newData);

    // Add user message
    setMessages(prev => [
      ...prev.map(m => ({ ...m, isActionable: false })),
      {
        id: Math.random().toString(36).substring(2, 15),
        sender: 'user',
        content: displayValue || (typeof value === 'object' && !value.mimeType ? 'Provided details' : value.toString())
      }
    ]);

    setInputValue('');

    // Determine next question
    let nextQ: QuestionId;
    if (isEditing) {
      setIsEditing(false);
      nextQ = 'done';
    } else {
      nextQ = getNextQuestion(currentQuestion, newData);
    }
    
    setCurrentQuestion(nextQ);

    if (nextQ === 'done') {
      finishFlow(newData);
    } else {
      askQuestion(nextQ);
    }
  };

  const finishFlow = async (finalData: MerchantData) => {
    setIsTyping(true);
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 15),
        sender: 'system',
        content: "All done! I'm analyzing your profile and documents now. This might take 10-20 seconds if you uploaded files, please bear with me...",
      }
    ]);

    try {
      const apiRes = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantData: finalData }),
      });

      const payload = (await apiRes.json().catch(() => ({}))) as {
        riskScore?: number;
        riskCategory?: string;
        riskFactors?: string[];
        recommendedProcessor?: string;
        reason?: string;
        documentSummary?: string;
        verificationStatus?: string;
        verificationNotes?: string[];
        error?: string;
      };

      if (!apiRes.ok) {
        throw new Error(payload.error || `Request failed (${apiRes.status})`);
      }

      const vStatus = payload.verificationStatus;
      const verificationStatus =
        vStatus === 'Verified' || vStatus === 'Discrepancies Found' || vStatus === 'Unverified'
          ? vStatus
          : 'Unverified';
      const verificationNotes = Array.isArray(payload.verificationNotes)
        ? payload.verificationNotes.filter((n): n is string => typeof n === 'string')
        : [];

      setAiRecommendation({
        riskScore: payload.riskScore ?? 50,
        riskCategory: (payload.riskCategory as 'Low' | 'Medium' | 'High') || 'Medium',
        riskFactors: payload.riskFactors ?? [],
        recommendedProcessor: payload.recommendedProcessor ?? '',
        reason: payload.reason ?? '',
        documentSummary: payload.documentSummary ?? '',
        verificationStatus,
        verificationNotes,
      });
      setIsFinished(true);
      onFinish();
    } catch (error) {
      console.error('[v0] AI Analysis failed:', error);
      console.error('[v0] Error details:', error instanceof Error ? error.message : String(error));
      toast.error('Failed to analyze profile. Using fallback recommendation.');
      setAiRecommendation(getFallbackUnderwriting(finalData));
      setIsFinished(true);
      onFinish();
    } finally {
      setIsTyping(false);
    }
  };

  const renderInputArea = () => {
    if (isFinished || isTyping || !currentQuestion || currentQuestion === 'done') return null;

    const qDef = QUESTIONS[currentQuestion];
    if (!qDef) return null;

    if (qDef.type === 'form') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="p-4 border-t bg-white">
            <form 
              className="space-y-4 max-w-2xl mx-auto"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const values: Record<string, any> = {};
                let allFilled = true;
                qDef.fields?.forEach(f => {
                  const val = formData.get(f.id) as string;
                  values[f.id] = val;
                  if (!val) allFilled = false;
                });
                if (!allFilled) {
                  toast.error("Please fill out all fields.");
                  return;
                }
                handleAnswer(values, "Provided details");
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qDef.fields?.map(field => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">{field.label}</label>
                    <Input 
                      name={field.id} 
                      type={field.type} 
                      required 
                      defaultValue={data[field.id as keyof MerchantData] as string || ''}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit">Submit Details</Button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (qDef.type === 'buttons') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 p-4 border-t bg-white">
            {qDef.options?.map(opt => (
              <Button 
                key={opt.value} 
                variant="outline" 
                onClick={() => handleAnswer(opt.value, opt.label)}
                className="rounded-full"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      );
    }

    if (qDef.type === 'dropdown') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="flex gap-2 p-4 border-t bg-white items-center">
            <Select 
              value={inputValue} 
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1"
            >
              <option value="" disabled>Select an option...</option>
              {qDef.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Button 
              disabled={!inputValue} 
              onClick={() => {
                const label = qDef.options?.find(o => o.value === inputValue)?.label;
                handleAnswer(inputValue, label);
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (qDef.type === 'upload') {
      return (
        <div className="relative">
          {isEditing && (
            <div className="absolute -top-10 right-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditing(false);
                  setCurrentQuestion('done');
                  finishFlow(data);
                }}
                className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="flex gap-2 p-4 border-t bg-white items-center justify-center">
            <label className="flex items-center justify-center w-full max-w-sm h-12 px-4 transition bg-white border-2 border-dashed rounded-md appearance-none cursor-pointer hover:border-primary focus:outline-none">
            <span className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">
                Drop files to Attach, or browse
              </span>
            </span>
            <input 
              type="file" 
              accept="image/*,application/pdf"
              name="file_upload" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 4 * 1024 * 1024) {
                    toast.error("File is too large. Please upload a file smaller than 4MB.");
                    e.target.value = '';
                    return;
                  }
                  
                  let mimeType = file.type;
                  if (!mimeType) {
                    if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
                    else if (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
                    else if (file.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                  }
                  
                  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
                  if (!validTypes.includes(mimeType)) {
                     toast.error("Unsupported file type. Please upload a PDF, JPEG, PNG, or WebP.");
                     e.target.value = '';
                     return;
                  }

                  setIsTyping(true);
                  
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64Data = (reader.result as string).split(',')[1];
                    const fileData: FileData = {
                      id: Math.random().toString(36).substring(2, 15),
                      name: file.name,
                      mimeType: mimeType,
                      data: base64Data,
                      uploadDate: new Date().toISOString(),
                      documentType: currentQuestion,
                      status: 'Uploaded',
                      linkedRequirement: qDef.text
                    };
                    
                    setDocuments(prev => [...prev, fileData]);
                    
                    toast.success(`File ${file.name} uploaded successfully`);
                    setIsTyping(false);
                    handleAnswer(fileData, `Uploaded: ${file.name}`);
                  };
                  reader.onerror = () => {
                    toast.error("Failed to read file.");
                    setIsTyping(false);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        {isEditing && (
          <div className="absolute -top-10 right-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setIsEditing(false);
                setCurrentQuestion('done');
                finishFlow(data);
              }}
              className="text-slate-500 hover:text-slate-700 bg-white/80 backdrop-blur-sm"
            >
              Cancel Edit
            </Button>
          </div>
        )}
        <div className="flex gap-2 p-4 border-t bg-white items-center">
          <Input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your answer..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                handleAnswer(inputValue.trim());
              }
            }}
            className="flex-1"
          />
          <Button 
            disabled={!inputValue.trim()} 
            onClick={() => handleAnswer(inputValue.trim())}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-x shadow-sm">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-blue-100 text-blue-600'
                }`}>
                  {msg.sender === 'user' ? 'U' : 'M'}
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm ${
                  msg.sender === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-white border text-slate-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex justify-start"
            >
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-100 text-blue-600">
                  M
                </div>
                <div className="px-4 py-4 rounded-2xl bg-white border text-slate-800 rounded-tl-sm shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {renderInputArea()}
    </div>
  );
}
