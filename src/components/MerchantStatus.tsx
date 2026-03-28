import React from 'react';
import { ApplicationStatus } from '@/src/types';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { CheckCircle2, Clock, FileText, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  status: ApplicationStatus;
  onProceedToAgreement: () => void;
}

export function MerchantStatus({ status, onProceedToAgreement }: Props) {
  const steps = [
    {
      id: 'submitted',
      title: 'Application Submitted',
      description: 'Your application and documents have been securely received.',
      icon: FileText,
      isActive: status !== 'draft',
      isCompleted: status !== 'draft'
    },
    {
      id: 'under_review',
      title: 'Underwriting Review',
      description: 'Our team is reviewing your profile and verifying documents.',
      icon: Clock,
      isActive: status === 'under_review' || status === 'approved' || status === 'signed',
      isCompleted: status === 'approved' || status === 'signed'
    },
    {
      id: 'approved',
      title: 'Decision & Agreement',
      description: 'Review and sign your merchant processing agreement.',
      icon: CheckCircle2,
      isActive: status === 'approved' || status === 'signed',
      isCompleted: status === 'signed'
    }
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto h-full flex flex-col justify-center">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Application Status</h1>
        <p className="text-slate-500 text-lg">Track the progress of your merchant account application.</p>
      </div>

      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${
                step.isCompleted ? 'bg-green-500 text-white' :
                step.isActive ? 'bg-blue-600 text-white animate-pulse' :
                'bg-slate-200 text-slate-400'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              
              <Card className={`w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] ${
                step.isActive && !step.isCompleted ? 'border-blue-200 shadow-md ring-1 ring-blue-100' : 
                step.isCompleted ? 'border-green-100 bg-green-50/30' : 
                'opacity-60'
              }`}>
                <CardContent className="p-5">
                  <h3 className={`font-bold text-lg mb-1 ${
                    step.isCompleted ? 'text-green-800' :
                    step.isActive ? 'text-blue-900' :
                    'text-slate-500'
                  }`}>{step.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                  
                  {step.id === 'under_review' && status === 'under_review' && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 font-medium bg-blue-50 p-2 rounded-md">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0"></div>
                      Processing... Please wait.
                    </div>
                  )}

                  {step.id === 'approved' && status === 'approved' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
                      <Button 
                        onClick={onProceedToAgreement}
                        className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 shadow-sm"
                      >
                        Review Agreement <ArrowRight className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
