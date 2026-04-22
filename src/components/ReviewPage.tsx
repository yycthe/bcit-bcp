import React from 'react';
import { MerchantData, FileData } from '@/src/types';
import { getMerchantDocumentChecklist } from '@/src/lib/documentChecklist';
import { Button } from '@/src/components/ui/button';
import { Banner } from '@/src/components/ui/banner';
import { Section } from '@/src/components/ui/section';
import { PageHeader } from '@/src/components/ui/page-header';
import { Badge } from '@/src/components/ui/badge';
import type { MerchantView } from './MerchantPortal';
import {
  CheckCircle2,
  AlertCircle,
  Edit2,
  Eye,
  ArrowRight,
  Building2,
  Globe2,
  Users,
  FileText,
  Phone,
  TrendingUp,
  ShoppingBag,
  History,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';

async function openUploadedFileInNewTab(doc: FileData) {
  try {
    if (/^https?:\/\//i.test(doc.data)) {
      const win = window.open(doc.data, '_blank', 'noopener,noreferrer');
      if (!win) {
        toast.error('Pop-up blocked. Allow pop-ups for this site to view the file.');
      }
      return;
    }

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

type FieldRow = { label: string; value?: string | null };

function FieldGrid({ rows }: { rows: FieldRow[] }) {
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) {
    return (
      <p className="text-sm italic text-foreground-subtle">No information provided yet.</p>
    );
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {visible.map((r, i) => (
        <div key={`${r.label}-${i}`} className="grid grid-cols-[120px_1fr] items-baseline gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
            {r.label}
          </dt>
          <dd className="text-sm font-medium text-foreground break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewPage({ data, documents, onEdit, onSubmit }: Props) {
  const isComplete = (data.legalName || data.ownerName) && data.monthlyVolume && data.industry;
  const docChecklist = getMerchantDocumentChecklist(data);
  const missingDocs = docChecklist.filter((d) => !d.present);
  const presentDocs = docChecklist.length - missingDocs.length;

  const editAction = (section: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onEdit(section)}
      aria-label={`Edit ${section}`}
    >
      <Edit2 className="h-3.5 w-3.5" />
      Edit
    </Button>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Sticky summary header */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/85 px-6 py-4 backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
              Step 2 — Review application
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">
              {data.legalName || data.ownerName || 'Untitled merchant'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
              <Badge variant="outline" className="capitalize">
                {data.industry?.replace('_', ' ') || '—'}
              </Badge>
              {data.country && <Badge variant="outline">{data.country}</Badge>}
              {data.monthlyVolume && (
                <Badge variant="outline">{data.monthlyVolume} / mo</Badge>
              )}
              <Badge variant={presentDocs === docChecklist.length ? 'success' : 'warning'}>
                Documents {presentDocs}/{docChecklist.length}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onEdit('legalBusinessForm')}>
              <Edit2 className="h-3.5 w-3.5" />
              Continue editing
            </Button>
            <Button variant="brand" onClick={onSubmit} disabled={!isComplete}>
              Submit for review
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-5xl space-y-6">
          {!isComplete && (
            <Banner
              intent="warning"
              title="Incomplete application"
              description="Please complete all required fields in the intake assistant before submitting."
            />
          )}
          {missingDocs.length > 0 && (
            <Banner
              intent="info"
              title={`${missingDocs.length} document slot${missingDocs.length === 1 ? '' : 's'} still empty`}
              description="You can submit now — Admin may request the remaining uploads later. Required for your profile:"
              actions={
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => onEdit('idUpload')}
                  className="text-info-foreground"
                >
                  Add documents in Intake →
                </Button>
              }
            >
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {missingDocs.map((d) => (
                  <li key={d.key}>
                    <Badge variant="info">{d.label}</Badge>
                  </li>
                ))}
              </ul>
            </Banner>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section
              title="Business basics"
              icon={Building2}
              actions={editAction('legalBusinessForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'Type', value: data.businessType?.replace('_', ' ') },
                  { label: 'Legal name', value: data.legalName },
                  { label: 'Registration', value: data.businessRegistrationNumber },
                  { label: 'Website', value: data.website },
                  { label: 'Established', value: data.establishedDate || data.timeInBusiness },
                  { label: 'Legal email', value: data.legalBusinessEmail || data.generalEmail },
                  { label: 'Category', value: data.businessCategory },
                ]}
              />
            </Section>

            <Section
              title="Geography & industry"
              icon={Globe2}
              actions={editAction('country')}
            >
              <FieldGrid
                rows={[
                  { label: 'Country', value: data.country },
                  { label: 'Industry', value: data.industry?.replace('_', ' ') },
                  { label: 'Monthly volume', value: data.monthlyVolume },
                  { label: 'Transactions', value: data.monthlyTransactions },
                ]}
              />
            </Section>

            <Section
              title="Owner identity"
              icon={Users}
              actions={editAction('ownershipControlForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'Owners', value: data.beneficialOwners || data.ownerName },
                  { label: 'Signer', value: data.authorizedSignerName || data.ownerName },
                ]}
              />
              <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface-subtle px-3 py-2">
                <span className="text-xs font-medium text-foreground">ID uploaded</span>
                {data.idUpload ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    On file
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Not yet
                  </span>
                )}
              </div>
            </Section>

            <Section
              title="Contact & address"
              icon={Phone}
              actions={editAction('legalBusinessForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'General email', value: data.generalEmail },
                  { label: 'Phone', value: data.phone },
                  { label: 'Registered', value: data.registeredAddress },
                  { label: 'Operating', value: data.operatingAddress },
                  { label: 'City', value: data.city },
                  { label: 'Province', value: data.province },
                ]}
              />
            </Section>

            <Section
              title="Business model"
              icon={ShoppingBag}
              actions={editAction('businessModelForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'Products / services', value: data.productsServices },
                  { label: 'Description', value: data.businessDescription },
                  { label: 'Customer type', value: data.customerType },
                  { label: 'Advance payment', value: data.advancePayment },
                  { label: 'Recurring', value: data.recurringBilling },
                  { label: 'Fulfillment', value: data.fulfillmentTimeline },
                ]}
              />
            </Section>

            <Section
              title="Sales profile"
              icon={TrendingUp}
              actions={editAction('salesProfileForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'Avg ticket', value: data.avgTicketSize },
                  { label: 'Highest ticket', value: data.highestTicketAmount },
                  { label: 'Channel split', value: data.transactionChannelSplit },
                  { label: 'Recurring %', value: data.recurringTransactionsPercent },
                  { label: 'Foreign cards %', value: data.foreignCardsPercent },
                  { label: 'Currencies', value: data.processingCurrencies },
                ]}
              />
            </Section>

            <Section
              title="Processing history"
              icon={History}
              actions={editAction('processingHistoryForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'Currently processes', value: data.currentlyProcessesCards },
                  { label: 'Prior processor', value: data.currentOrPreviousProcessor },
                  { label: 'Exit reason', value: data.processorExitReason },
                  { label: 'Termination', value: data.priorTermination },
                  { label: 'Bankruptcy', value: data.bankruptcyHistory },
                  { label: 'Risk programs', value: data.riskProgramHistory },
                ]}
              />
            </Section>

            <Section
              title="Website / PCI basics"
              icon={ShieldCheck}
              actions={editAction('websiteComplianceForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'Privacy', value: data.websitePrivacyPolicy },
                  { label: 'Terms', value: data.websiteTerms },
                  { label: 'Refund', value: data.websiteRefundPolicy },
                  { label: 'Shipping', value: data.websiteShippingPolicy },
                  { label: 'Contact', value: data.websiteContactInfo },
                  { label: 'Currency', value: data.websiteCurrencyDisplay },
                  { label: 'SSL', value: data.websiteSsl },
                  { label: 'Stores cards', value: data.storesCardNumbers },
                ]}
              />
            </Section>

            <Section
              title="Document readiness"
              icon={ClipboardList}
              actions={editAction('documentReadinessForm')}
            >
              <FieldGrid
                rows={[
                  { label: 'Registration', value: data.canProvideRegistration },
                  { label: 'Void cheque', value: data.canProvideVoidCheque },
                  { label: 'Bank stmts', value: data.canProvideBankStatements },
                  { label: 'Ownership', value: data.canProvideProofOfOwnership },
                  { label: 'Owner IDs', value: data.canProvideOwnerIds },
                  { label: 'Processing stmts', value: data.canProvideProcessingStatements },
                ]}
              />
            </Section>

            <Section
              title="Uploaded documents"
              icon={FileText}
              className="lg:col-span-2"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit('idUpload')}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Manage
                </Button>
              }
            >
              {documents.length === 0 ? (
                <p className="text-sm italic text-foreground-subtle">No documents uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-foreground-subtle" />
                        <span className="truncate text-sm text-foreground">{doc.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="neutral" className="capitalize">
                          {doc.documentType?.replace(/([A-Z])/g, ' $1').trim() || 'document'}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openUploadedFileInNewTab(doc)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>

      {/* Sticky footer CTA */}
      <div className="sticky bottom-0 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
          <p className="text-xs text-foreground-muted">
            {isComplete
              ? 'Looks good. Submit to start verification & AI review.'
              : 'Fill in the missing required answers to enable submit.'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onEdit('legalBusinessForm')}>
              Back to intake
            </Button>
            <Button variant="brand" onClick={onSubmit} disabled={!isComplete}>
              Submit for review
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
