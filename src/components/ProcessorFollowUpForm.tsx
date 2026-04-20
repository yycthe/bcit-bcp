import React, { useMemo, useState } from 'react';
import {
  getProcessorFollowUpSpec,
  isFieldVisible,
  validateFollowUp,
  type FollowUpField,
} from '@/src/lib/intake/processorFollowUpForms';
import type { ProcessorFit } from '@/src/lib/onboardingWorkflow';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { toast } from 'sonner';

interface Props {
  processor: ProcessorFit;
  initialAnswers?: Record<string, string>;
  onSubmit: (answers: Record<string, string>) => void;
  submitLabel?: string;
}

export function ProcessorFollowUpForm({ processor, initialAnswers = {}, onSubmit, submitLabel }: Props) {
  const spec = useMemo(() => getProcessorFollowUpSpec(processor), [processor]);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);

  const update = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = () => {
    const { ok, missing } = validateFollowUp(spec, answers);
    if (!ok) {
      toast.error(`Please answer: ${missing.slice(0, 3).join('; ')}${missing.length > 3 ? '...' : ''}`);
      return;
    }
    onSubmit(answers);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-accent/20 bg-accent-soft p-4">
        <h3 className="text-sm font-semibold text-info-foreground">
          {processor} follow-up questions
        </h3>
        <p className="mt-1 text-xs text-info-foreground/80 leading-relaxed">
          These questions apply specifically to <strong>{processor}</strong> based on your matched
          processor. Only visible fields will be submitted.
        </p>
      </div>

      {spec.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-sm">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {section.fields.map((field) => {
              if (!isFieldVisible(field, answers)) return null;
              return (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={answers[field.id] || ''}
                  onChange={(v) => update(field.id, v)}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} size="lg" variant="brand">
          {submitLabel || `Submit ${processor} follow-up`}
        </Button>
      </div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FollowUpField;
  value: string;
  onChange: (v: string) => void;
}) {
  const labelEl = (
    <Label htmlFor={field.id} className="mb-1 block text-xs font-semibold text-foreground">
      {field.label}
      {field.required && <span className="ml-1 text-danger">*</span>}
    </Label>
  );

  if (field.type === 'select') {
    return (
      <div>
        {labelEl}
        <select
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm shadow-xs transition-colors hover:border-border-strong focus-visible:border-brand outline-none"
        >
          <option value="">— Select —</option>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.helperText && (
          <p className="mt-1 text-xs text-foreground-muted">{field.helperText}</p>
        )}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {labelEl}
        <textarea
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-xs transition-colors hover:border-border-strong focus-visible:border-brand outline-none"
        />
        {field.helperText && (
          <p className="mt-1 text-xs text-foreground-muted">{field.helperText}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      <Input
        id={field.id}
        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
      {field.helperText && (
        <p className="mt-1 text-xs text-foreground-muted">{field.helperText}</p>
      )}
    </div>
  );
}
