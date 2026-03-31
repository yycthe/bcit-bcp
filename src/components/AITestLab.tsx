import React, { useMemo, useState } from 'react';
import { Upload, FileText, Sparkles, LoaderCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { FormattedSummary } from '@/src/components/ui/formatted-summary';
import { FileData, MerchantData, initialMerchantData } from '@/src/types';
import { prepareFileForUpload } from '@/src/lib/uploadPreparation';

type TestResult = {
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

const VERCEL_FUNCTION_BODY_SOFT_LIMIT_BYTES = 4_000_000;

function estimateJsonBytes(value: unknown): number {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return json.length;
}

function stripBinaryFromFile(file: FileData): FileData {
  return {
    ...file,
    data: '',
  };
}

function buildMerchantData(files: FileData[], notes: string, scenarioName: string): MerchantData {
  return {
    ...initialMerchantData,
    businessType: 'corporation',
    country: 'CA',
    industry: 'services',
    monthlyVolume: '10k-50k',
    monthlyTransactions: '100-1k',
    legalName: scenarioName || 'AI Test Upload',
    ownerName: 'AI Test User',
    website: 'https://example.com',
    businessDescription: notes,
    complianceDetails: notes,
    additionalDocuments: files,
  };
}

function preparePayload(merchantData: MerchantData): {
  body: string;
  metadataOnly: boolean;
} {
  const fullPayload = { merchantData };
  if (estimateJsonBytes(fullPayload) <= VERCEL_FUNCTION_BODY_SOFT_LIMIT_BYTES) {
    return {
      body: JSON.stringify(fullPayload),
      metadataOnly: false,
    };
  }

  return {
    body: JSON.stringify({
      merchantData: {
        ...merchantData,
        additionalDocuments: merchantData.additionalDocuments?.map(stripBinaryFromFile),
      },
    }),
    metadataOnly: true,
  };
}

export function AITestLab() {
  const [scenarioName, setScenarioName] = useState('AI Test Upload');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [lastMode, setLastMode] = useState<'full' | 'metadata-only' | null>(null);

  const totalBytes = useMemo(() => estimateJsonBytes({ files }), [files]);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    try {
      const preparedFiles = await Promise.all(selected.map((file) => prepareFileForUpload(file)));
      preparedFiles.forEach((prepared) => {
        prepared.notices.forEach((notice) => {
          if (notice.level === 'warning') {
            toast.warning(notice.message);
          } else {
            toast.success(notice.message);
          }
        });
      });
      setFiles((prev) => [...prev, ...preparedFiles.map((prepared) => prepared.fileData)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to prepare one of the uploaded files.';
      toast.error(message);
    }
    event.target.value = '';
  }

  async function runSummary() {
    if (!files.length) {
      toast.error('Please upload at least one file first.');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const merchantData = buildMerchantData(files, notes, scenarioName);
      let prepared = preparePayload(merchantData);
      setLastMode(prepared.metadataOnly ? 'metadata-only' : 'full');

      if (prepared.metadataOnly) {
        toast.warning('Payload is large, so this test is running in metadata-only mode.');
      }

      let response = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: prepared.body,
      });

      if (response.status === 413 && !prepared.metadataOnly) {
        prepared = preparePayload({
          ...merchantData,
          additionalDocuments: merchantData.additionalDocuments?.map(stripBinaryFromFile),
        });
        setLastMode('metadata-only');
        toast.warning('Vercel request was too large. Retrying without binary document contents.');
        response = await fetch('/api/underwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: prepared.body,
        });
      }

      const rawText = await response.text();
      let payload = {} as TestResult;
      if (rawText) {
        try {
          payload = JSON.parse(rawText) as TestResult;
        } catch {
          payload = {};
        }
      }
      if (!response.ok) {
        const detail = payload.error || rawText.trim().slice(0, 400);
        throw new Error(detail || `Request failed (${response.status})`);
      }

      setResult(payload);
      toast.success('AI summary generated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResult({ error: message });
      toast.error(`AI summary failed: ${message}`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              AI Test Lab
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Direct AI Summary Test</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Upload multiple files and call the underwriting API directly. This page is meant for debugging
              xAI summary generation without going through the full onboarding flow.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={lastMode === 'metadata-only' ? 'warning' : 'success'}>
              {lastMode === 'metadata-only' ? 'Metadata-only mode' : 'Full payload mode'}
            </Badge>
            <Badge variant="outline">{files.length} file(s)</Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Test Input</CardTitle>
              <CardDescription>
                Give the test a label, optional notes, and upload PDFs or images to see what the AI can summarize.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Scenario Name</label>
                <Input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Extra Notes for the Prompt</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-400"
                  placeholder="Optional: tell the AI what you expect from the uploaded files."
                />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/60 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white p-3 shadow-sm">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Upload files</p>
                      <p className="text-sm text-slate-600">Supports multiple PDFs and images in one test run. Large files are optimized before upload when possible.</p>
                    </div>
                  </div>

                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                    Select Files
                    <input type="file" multiple accept=".pdf,image/*" className="hidden" onChange={handleFilesSelected} />
                  </label>
                </div>

                <div className="mt-5 space-y-2">
                  {files.length === 0 ? (
                    <div className="rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-500">
                      No files uploaded yet.
                    </div>
                  ) : (
                    files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                          <p className="text-xs text-slate-500">{file.mimeType || 'unknown mime type'}</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-500 hover:text-red-600"
                          onClick={() => setFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Estimated upload payload: {(totalBytes / 1024 / 1024).toFixed(2)} MB
                </div>
                <Button onClick={runSummary} disabled={isRunning || files.length === 0} className="gap-2">
                  {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Run AI Summary
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Latest Result</CardTitle>
                <CardDescription>
                  This shows the current underwriting response and makes it easier to isolate xAI/API issues.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!result ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                    Run a test to see the AI summary here.
                  </div>
                ) : result.error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-semibold">Request failed</p>
                    <p className="mt-2 whitespace-pre-wrap break-words">{result.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-semibold">Summary generated</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-slate-500">Risk Score</p>
                          <p className="font-semibold text-slate-900">{result.riskScore ?? 'Unknown'}</p>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-slate-500">Risk Category</p>
                          <p className="font-semibold text-slate-900">{result.riskCategory ?? 'Unknown'}</p>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-slate-500">Verification</p>
                          <p className="font-semibold text-slate-900">{result.verificationStatus ?? 'Unknown'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900">Recommendation Reason</h3>
                        <FormattedSummary
                          text={result.reason}
                          emptyText="No recommendation reason returned."
                        />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900">Document Summary</h3>
                        <FormattedSummary
                          text={result.documentSummary}
                          emptyText="No summary returned."
                        />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900">Risk Factors</h3>
                        <FormattedSummary
                          text={result.riskFactors?.join('\n')}
                          emptyText="No risk factors returned."
                        />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900">Verification Notes</h3>
                        <FormattedSummary
                          text={result.verificationNotes?.join('\n')}
                          emptyText="No verification notes returned."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-slate-900">Full JSON</h3>
                      <pre className="max-h-[380px] overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-100">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  What This Helps Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>It bypasses the merchant questionnaire and calls `/api/underwrite` directly.</p>
                <p>It supports multiple uploaded files in `additionalDocuments`, so you can isolate file-related xAI failures quickly.</p>
                <p>If the payload is too large for Vercel, it automatically retries in metadata-only mode.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
