import { GoogleGenAI, Type } from '@google/genai';
import type { MerchantData } from '../src/types';

export type UnderwritingApiResult = {
  riskScore: number;
  riskCategory: 'Low' | 'Medium' | 'High';
  riskFactors: string[];
  recommendedProcessor: string;
  reason: string;
  documentSummary: string;
};

const FILE_KEYS = [
  'financials',
  'idUpload',
  'enhancedVerification',
  'proofOfAddress',
  'registrationCertificate',
  'taxDocument',
  'proofOfFunds',
  'bankStatement',
  'complianceDocument',
] as const;

export async function runUnderwriting(
  apiKey: string,
  finalData: MerchantData
): Promise<UnderwritingApiResult> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `You are an expert payment processing underwriter. Analyze the following merchant profile and any provided documents.
          
          Merchant Profile:
          ${JSON.stringify(Object.fromEntries(Object.entries(finalData).filter(([k, v]) => v && typeof v !== 'object')), null, 2)}
          
          Based on the profile and the provided documents (if any), perform a comprehensive risk assessment.
          1. Calculate a numerical "riskScore" from 0 to 100 (0 = lowest risk, 100 = highest risk). Use a baseline of 20. Add points for high-risk industries (+30), cross-border processing (+15), high volume >$250k (+15), lack of financial documents (+10), lack of ID (+10). Deduct points if documents are provided and look legitimate (-10 per valid document type).
          2. Categorize the risk into "riskCategory" (0-33: Low, 34-66: Medium, 67-100: High).
          3. Provide 2-3 specific "riskFactors" explaining the score (e.g., "High average ticket size increases chargeback exposure", "Regulated industry requires specialized underwriting", "Verified financial documents reduce risk"). Be specific to the data provided.
          4. Recommend a payment processor from this list: Stripe, Adyen, Nuvei, HighRiskPay.
          5. Provide a brief reason for your recommendation.
          6. If any documents were uploaded (e.g., Financial Statements, ID, Business Licenses, Proof of Address), extract the key information from them and summarize all extracted information clearly in the "documentSummary" field. Format the summary with clear bullet points separated by newlines (e.g., "\\n- Name: John Doe\\n- ID: 12345"). You MUST include all extracted information from ID documents (e.g., name, date of birth, ID number) and all legal documents (e.g., business license details, registration numbers). If no documents are provided or readable, return "No document information extracted".
          7. VERIFICATION AUDIT: Cross-reference the self-reported Merchant Profile data (like legalName, ownerName, address) against the information extracted from the uploaded documents. 
             - Compare names, addresses, and business details.
             - Output a "verificationStatus": "Verified" (if data matches), "Discrepancies Found" (if there are mismatches), or "Unverified" (if not enough documents to verify).
             - Output an array of "verificationNotes" explaining the audit results (e.g., "Owner name 'John Doe' matches ID", "Address on bank statement does not match reported address").
          
          Respond ONLY with a JSON object in this format:
          {
            "riskScore": number,
            "riskCategory": "Low" | "Medium" | "High",
            "riskFactors": ["string", "string"],
            "recommendedProcessor": "Stripe" | "Adyen" | "Nuvei" | "HighRiskPay",
            "reason": "string",
            "documentSummary": "string",
            "verificationStatus": "Verified" | "Discrepancies Found" | "Unverified",
            "verificationNotes": ["string", "string"]
          }`,
    },
  ];

  for (const key of FILE_KEYS) {
    const fileData = finalData[key as keyof MerchantData] as { mimeType?: string; data?: string } | null;
    if (fileData && fileData.mimeType && fileData.data) {
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data,
        },
      });
    }
  }

  const aiCall = ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskScore: { type: Type.NUMBER },
          riskCategory: { type: Type.STRING },
          riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedProcessor: { type: Type.STRING },
          reason: { type: Type.STRING },
          documentSummary: { type: Type.STRING },
        },
        required: ['riskScore', 'riskCategory', 'riskFactors', 'recommendedProcessor', 'reason', 'documentSummary'],
      },
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI Analysis timed out')), 60_000)
  );

  const response = (await Promise.race([aiCall, timeoutPromise])) as { text?: string };
  const parsed = JSON.parse(response.text || '{}');

  return {
    riskScore: parsed.riskScore ?? 50,
    riskCategory: parsed.riskCategory as 'Low' | 'Medium' | 'High',
    riskFactors: parsed.riskFactors ?? [],
    recommendedProcessor: parsed.recommendedProcessor,
    reason: parsed.reason,
    documentSummary: parsed.documentSummary,
  };
}
