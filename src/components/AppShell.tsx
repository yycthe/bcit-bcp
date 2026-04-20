import React from 'react';
import { Building2, ShieldCheck, UserCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ApplicationStatus } from '@/src/types';
import { StatusPill, type StatusIntent } from '@/src/components/ui/status-pill';

export type ViewMode = 'merchant' | 'admin';

interface AppShellProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  appStatus: ApplicationStatus;
  children: React.ReactNode;
}

const statusIntent: Record<ApplicationStatus, StatusIntent> = {
  draft: 'idle',
  under_review: 'in_progress',
  approved: 'needs_signature',
  signed: 'complete',
};

const statusLabel: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  under_review: 'Under review',
  approved: 'Approved',
  signed: 'Signed',
};

export function AppShell({ viewMode, onChangeViewMode, appStatus, children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-surface-muted text-foreground font-sans">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm"
              style={{
                background:
                  'linear-gradient(135deg, hsl(160 84% 32%), hsl(217 91% 50%))',
              }}
            >
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                BCIT BCP
              </p>
              <p className="truncate text-[11px] text-foreground-subtle">
                Merchant onboarding workspace
              </p>
            </div>
            <span className="ml-1 hidden items-center rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted sm:inline-flex">
              Demo Env
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              role="tablist"
              aria-label="Switch portal"
              className="hidden items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1 shadow-xs sm:flex"
            >
              <SegmentButton
                active={viewMode === 'merchant'}
                onClick={() => onChangeViewMode('merchant')}
                icon={UserCircle2}
                label="Merchant"
                accent="accent"
              />
              <SegmentButton
                active={viewMode === 'admin'}
                onClick={() => onChangeViewMode('admin')}
                icon={ShieldCheck}
                label="Admin"
                accent="brand"
              />
            </div>
            <StatusPill
              intent={statusIntent[appStatus]}
              label={`Application: ${statusLabel[appStatus]}`}
              className="hidden md:inline-flex"
            />
          </div>
        </div>
        {/* Mobile portal switch */}
        <div className="border-t border-border px-4 py-2 sm:hidden">
          <div
            role="tablist"
            className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-subtle p-1"
          >
            <SegmentButton
              active={viewMode === 'merchant'}
              onClick={() => onChangeViewMode('merchant')}
              icon={UserCircle2}
              label="Merchant"
              accent="accent"
              fullWidth
            />
            <SegmentButton
              active={viewMode === 'admin'}
              onClick={() => onChangeViewMode('admin')}
              icon={ShieldCheck}
              label="Admin"
              accent="brand"
              fullWidth
            />
          </div>
        </div>
      </header>
      <main className="flex flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  icon: Icon,
  label,
  accent,
  fullWidth,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: 'brand' | 'accent';
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
        fullWidth ? 'w-full' : '',
        active
          ? 'bg-surface text-foreground shadow-sm'
          : 'text-foreground-muted hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          active
            ? accent === 'brand'
              ? 'text-brand'
              : 'text-accent'
            : 'text-foreground-subtle'
        )}
      />
      {label}
    </button>
  );
}
