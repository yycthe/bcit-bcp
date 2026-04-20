import React, { useState } from 'react';
import { MerchantData } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Banner } from '@/src/components/ui/banner';
import { Badge } from '@/src/components/ui/badge';
import { CheckCircle2, FileSignature, ScrollText, Building2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface Props {
  data: MerchantData;
  onSign?: () => void;
}

const SECTIONS = [
  { id: 'sec-1', label: '1. Services provided' },
  { id: 'sec-2', label: '2. Compliance & review' },
  { id: 'sec-3', label: '3. Fees & settlement' },
  { id: 'sec-schedule', label: 'Schedule A: Merchant details' },
];

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
    <div className="px-6 py-8 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: agreement body */}
        <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <header className="flex items-center justify-between gap-4 border-b border-border bg-gradient-to-r from-brand-soft/60 to-accent-soft/60 px-6 py-5 sm:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-subtle">
                Master services agreement
              </p>
              <h1
                className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                BCIT BCP Master Services Agreement
              </h1>
              <p className="mt-1 text-xs text-foreground-muted">
                Effective {new Date().toLocaleDateString()}
              </p>
            </div>
            <Badge variant={isSigned ? 'success' : 'warning'}>
              {isSigned ? 'Signed' : 'Awaiting signature'}
            </Badge>
          </header>

          <div
            className="space-y-6 px-6 py-8 text-[15px] leading-7 text-foreground sm:px-10"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            <p>
              This Master Services Agreement (the "Agreement") is entered into by and between{' '}
              <strong>BCIT BCP</strong> ("Provider") and <strong>{merchantName}</strong>{' '}
              ("Merchant"), located at <strong>{merchantAddress}</strong>.
            </p>

            <section
              id="sec-1"
              className="space-y-3 scroll-mt-24"
              aria-labelledby="sec-1-h"
            >
              <h2 id="sec-1-h" className="text-lg font-semibold tracking-tight">
                1. Services provided
              </h2>
              <p>
                Provider agrees to provide Merchant with payment processing services, gateway
                access, and related financial technology solutions as described in the BCIT BCP
                Terms of Service. Provider will facilitate the transmission of transaction data to
                the applicable acquiring banks and card networks.
              </p>
            </section>

            <section
              id="sec-2"
              className="space-y-3 scroll-mt-24"
              aria-labelledby="sec-2-h"
            >
              <h2 id="sec-2-h" className="text-lg font-semibold tracking-tight">
                2. Compliance & review
              </h2>
              <p>
                Merchant agrees to comply with all applicable laws, card network rules, and
                Provider's acceptable use policy. Provider reserves the right to hold funds,
                suspend processing, or terminate this Agreement immediately if Merchant engages in
                prohibited activities, experiences excessive chargebacks, or exceeds acceptable
                risk thresholds as determined by Provider's AI-assisted review process.
              </p>
            </section>

            <section
              id="sec-3"
              className="space-y-3 scroll-mt-24"
              aria-labelledby="sec-3-h"
            >
              <h2 id="sec-3-h" className="text-lg font-semibold tracking-tight">
                3. Fees & settlement
              </h2>
              <p>
                Fees for the Services will be assessed according to the standard BCIT BCP pricing
                schedule unless otherwise negotiated in writing. Settlement of funds will be made
                to the bank account provided by the Merchant during the onboarding process,
                subject to standard holding periods and reserve requirements.
              </p>
            </section>

            <section
              id="sec-schedule"
              className="scroll-mt-24 rounded-xl border border-border bg-surface-muted px-5 py-5"
              style={{ fontFamily: 'var(--font-sans)' }}
              aria-labelledby="sec-schedule-h"
            >
              <h3
                id="sec-schedule-h"
                className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-subtle"
              >
                <Building2 className="h-3.5 w-3.5 text-brand" />
                Schedule A — Merchant details
              </h3>
              <dl className="mt-3 grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-6 text-sm">
                <DlRow label="Legal name" value={data.legalName || 'N/A'} />
                <DlRow label="DBA / Owner" value={data.ownerName || 'N/A'} />
                <DlRow
                  label="Industry"
                  value={data.industry?.replace('_', ' ') || 'N/A'}
                  capitalize
                />
                <DlRow label="Contact email" value={merchantEmail} />
                <DlRow label="Monthly volume" value={data.monthlyVolume || 'N/A'} />
                <DlRow
                  label="Settlement currency"
                  value={data.settlementCurrency || 'USD/CAD'}
                />
              </dl>
            </section>
          </div>
        </article>

        {/* Right rail: TOC + signature */}
        <aside className="lg:sticky lg:top-6 self-start space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
              <ScrollText className="h-3.5 w-3.5 text-brand" />
              Contents
            </p>
            <ul className="mt-3 space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-md px-2.5 py-1.5 text-xs text-foreground-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                <FileSignature className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-semibold text-foreground">Merchant signature</p>
            </div>
            <p className="mt-1 text-xs text-foreground-muted">
              Type your full legal name to sign on behalf of <span className="font-medium">{merchantName}</span>.
            </p>

            {isSigned ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-3">
                  <p
                    className="text-3xl text-foreground"
                    style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}
                  >
                    {signature}
                  </p>
                  <p className="mt-1 text-xs text-success-foreground">Signed on {signDate}</p>
                </div>
                <Banner
                  intent="success"
                  title="Agreement signed"
                  description="A signed copy will be available in your records."
                  icon={CheckCircle2}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="text-xs font-semibold text-foreground" htmlFor="agreement-signature">
                  Type your full legal name
                </label>
                <Input
                  id="agreement-signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className={cn(
                    'text-2xl h-14',
                  )}
                  style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}
                />
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleSign}
                  disabled={!signature.trim()}
                  className="w-full"
                >
                  Sign & accept agreement
                </Button>
                <p className="text-[11px] leading-relaxed text-foreground-muted">
                  By signing, you confirm authority to bind the merchant entity.
                </p>
              </div>
            )}

            <div className="mt-5 border-t border-border pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                Counterparty
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">BCIT BCP</p>
              <p
                className="text-2xl text-accent-strong"
                style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}
              >
                BCIT BCP Admin
              </p>
              <p className="text-[11px] text-foreground-muted">
                Authorized representative · {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DlRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
        {label}
      </dt>
      <dd
        className={cn(
          'text-sm font-medium text-foreground break-words',
          capitalize && 'capitalize'
        )}
      >
        {value}
      </dd>
    </div>
  );
}
