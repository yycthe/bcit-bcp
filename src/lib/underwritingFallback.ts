import type { MerchantData } from '@/src/types';

export type UnderwritingDisplayResult = {
  riskScore: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  riskFactors: string[];
  recommendedProcessor: string;
  reason: string;
  documentSummary: string;
};

/** Rule-based fallback when the server-side Gemini call fails or is unavailable. */
export function getFallbackUnderwriting(finalData: MerchantData): UnderwritingDisplayResult {
  let riskCategory: 'Low' | 'Medium' | 'High' = 'Low';
  let riskScore = 20;
  let riskFactors: string[] = ['Standard processing profile'];

  if (finalData.industry === 'high_risk' || finalData.industry === 'crypto' || finalData.industry === 'gaming') {
    riskCategory = 'High';
    riskScore = 85;
    riskFactors = ['High-risk industry classification', 'Elevated chargeback potential'];
  } else if (finalData.country !== 'US' && finalData.country !== 'CA' && finalData.country !== 'UK') {
    riskCategory = 'Medium';
    riskScore = 55;
    riskFactors = ['Cross-border processing', 'Moderate regulatory complexity'];
  } else if (finalData.monthlyVolume === '>250k') {
    riskCategory = 'Medium';
    riskScore = 45;
    riskFactors = ['High processing volume', 'Increased financial exposure'];
  }

  let recommendedProcessor = '';
  let reason = '';

  if (riskCategory === 'High') {
    recommendedProcessor = 'HighRiskPay';
    reason = 'Your industry requires specialized underwriting and risk management.';
  } else if ((finalData.country === 'US' || finalData.country === 'CA') && finalData.monthlyVolume !== '>250k') {
    recommendedProcessor = 'Stripe';
    reason = 'Stripe offers the fastest onboarding and best developer tools for low-risk businesses in North America.';
  } else if (finalData.monthlyVolume === '>250k') {
    recommendedProcessor = 'Adyen';
    reason = 'Adyen is optimized for high-volume enterprise merchants with global reach.';
  } else {
    recommendedProcessor = 'Nuvei';
    reason = 'Nuvei provides excellent coverage and competitive rates for your region and industry.';
  }

  return {
    riskScore,
    riskCategory,
    riskFactors,
    recommendedProcessor,
    reason,
    documentSummary: 'No document information extracted (Fallback mode)',
  };
}
