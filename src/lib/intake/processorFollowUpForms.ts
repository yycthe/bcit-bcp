import type { ProcessorFit } from '@/src/lib/onboardingWorkflow';

export type FollowUpFieldType = 'text' | 'textarea' | 'number' | 'select' | 'email';

export type FollowUpField = {
  id: string;
  label: string;
  type: FollowUpFieldType;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  helperText?: string;
  showIf?: { field: string; equals: string };
};

export type FollowUpSection = {
  title: string;
  description?: string;
  fields: FollowUpField[];
};

export type ProcessorFollowUpSpec = {
  processor: ProcessorFit;
  sections: FollowUpSection[];
};

const YES_NO = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];

const YES_NO_NS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'Not sure', value: 'Not sure' },
];

const NUVEI: ProcessorFollowUpSpec = {
  processor: 'Nuvei',
  sections: [
    {
      title: 'Merchant profile / setup',
      fields: [
        { id: 'nuvei_gst_exempt', label: 'Are you GST exempt?', type: 'select', options: YES_NO, required: true },
        { id: 'nuvei_months_beyond_years', label: 'How many additional months have you been in business beyond full years?', type: 'number' },
        { id: 'nuvei_customer_service_email', label: 'Customer service email', type: 'email', required: true },
        { id: 'nuvei_statements_email', label: 'Email address for statements', type: 'email', required: true },
        { id: 'nuvei_moto_phone', label: 'Customer service phone number for MOTO / e-commerce', type: 'text' },
      ],
    },
    {
      title: 'Ownership / management detail',
      fields: [
        { id: 'nuvei_owners_managerial_control', label: 'For each owner, do they have significant managerial control?', type: 'textarea', required: true },
        { id: 'nuvei_additional_bos', label: 'Are there additional beneficial owners beyond the Common Intake list?', type: 'select', options: YES_NO, required: true },
        { id: 'nuvei_owner_dl_numbers', label: 'Driver licence number(s) — use masked or last-four format', type: 'textarea' },
        { id: 'nuvei_owner_dl_province', label: 'Province(s) that issued the driver licence', type: 'text' },
        { id: 'nuvei_owner_mobiles', label: 'Owner mobile number(s)', type: 'textarea' },
        { id: 'nuvei_owner_sin', label: 'SIN availability or last four only (do NOT paste full SIN)', type: 'textarea' },
        { id: 'nuvei_owner_dob', label: 'Owner date(s) of birth', type: 'textarea' },
      ],
    },
    {
      title: 'Sales breakdown',
      fields: [
        { id: 'nuvei_pct_swipe', label: '% swipe / chip', type: 'number', required: true },
        { id: 'nuvei_pct_ecom', label: '% e-commerce', type: 'number', required: true },
        { id: 'nuvei_pct_moto', label: '% MOTO / keyed', type: 'number', required: true },
        { id: 'nuvei_monthly_by_brand', label: 'Monthly volume by card brand', type: 'textarea' },
        { id: 'nuvei_avg_by_brand', label: 'Average ticket by card brand', type: 'textarea' },
        { id: 'nuvei_high_by_brand', label: 'High ticket by card brand', type: 'textarea' },
        { id: 'nuvei_seasonal', label: 'Is the business seasonal?', type: 'select', options: YES_NO, required: true },
        { id: 'nuvei_seasonal_months', label: 'If yes, which months?', type: 'text', showIf: { field: 'nuvei_seasonal', equals: 'Yes' } },
      ],
    },
    {
      title: 'Services questionnaire',
      fields: [
        { id: 'nuvei_marketing', label: 'Marketing methods used', type: 'textarea' },
        { id: 'nuvei_ecom_geo', label: 'E-commerce customer geography (% Canada / US / Other)', type: 'textarea' },
        { id: 'nuvei_requires_deposits', label: 'Do you require deposits for future delivery?', type: 'select', options: YES_NO },
        { id: 'nuvei_final_before_fulfill', label: 'Is final payment due before fulfillment?', type: 'select', options: YES_NO },
        { id: 'nuvei_neg_option_billing', label: 'Do you use automatic or negative option billing?', type: 'select', options: YES_NO },
        { id: 'nuvei_warranties', label: 'Do you offer warranties or guarantees?', type: 'select', options: YES_NO },
        { id: 'nuvei_refund_window', label: 'Refund window', type: 'text' },
        { id: 'nuvei_upsells', label: 'Do you offer upsells?', type: 'select', options: YES_NO },
        { id: 'nuvei_card_entry', label: 'How is card payment information entered into the system?', type: 'text' },
        { id: 'nuvei_owns_inventory', label: 'Do you own the product / inventory?', type: 'select', options: YES_NO },
        { id: 'nuvei_product_location', label: 'Where is the product stored or shipped from?', type: 'text' },
        { id: 'nuvei_fulfillment_center', label: 'Do you use a fulfillment center?', type: 'select', options: YES_NO },
        { id: 'nuvei_delivery_method', label: 'Delivery method', type: 'text' },
      ],
    },
    {
      title: 'Site / location',
      fields: [
        {
          id: 'nuvei_zone', label: 'Business zone', type: 'select', options: [
            { label: 'Business district', value: 'Business District' },
            { label: 'Industrial', value: 'Industrial' },
            { label: 'Residential', value: 'Residential' },
          ],
        },
        { id: 'nuvei_sqft', label: 'Approximate square footage', type: 'number' },
        {
          id: 'nuvei_location_type', label: 'Location type', type: 'select', options: [
            { label: 'Office', value: 'Office' },
            { label: 'Home', value: 'Home' },
            { label: 'Shopping area', value: 'Shopping Area' },
            { label: 'Mixed', value: 'Mixed' },
            { label: 'Other', value: 'Other' },
          ],
        },
      ],
    },
    {
      title: 'Setup / technical',
      fields: [
        { id: 'nuvei_terminal', label: 'Terminal purchase or rental?', type: 'select', options: [
          { label: 'Purchase', value: 'Purchase' }, { label: 'Rental', value: 'Rental' }, { label: 'None', value: 'None' },
        ] },
        { id: 'nuvei_tip', label: 'Tip functionality?', type: 'select', options: YES_NO },
        { id: 'nuvei_auto_settle', label: 'Auto-settle?', type: 'select', options: YES_NO },
        { id: 'nuvei_refund_protect', label: 'Refunds password protected?', type: 'select', options: YES_NO },
        { id: 'nuvei_interac_cashback', label: 'Interac cash back?', type: 'select', options: YES_NO },
        { id: 'nuvei_semi_integrated', label: 'Semi-integrated setup?', type: 'select', options: YES_NO },
        { id: 'nuvei_comm_type', label: 'Communication type', type: 'text' },
        { id: 'nuvei_dcc', label: 'Dynamic Currency Conversion?', type: 'select', options: YES_NO },
        { id: 'nuvei_control_panel', label: 'Access to the Control Panel?', type: 'select', options: YES_NO },
        { id: 'nuvei_control_panel_admin', label: 'Control Panel administrator name/email', type: 'text', showIf: { field: 'nuvei_control_panel', equals: 'Yes' } },
      ],
    },
  ],
};

const PAYROC: ProcessorFollowUpSpec = {
  processor: 'Payroc / Peoples',
  sections: [
    {
      title: 'Contact segmentation',
      fields: [
        { id: 'payroc_chargeback_contact', label: 'Chargebacks & disputes contact', type: 'text', required: true },
        { id: 'payroc_cs_contact', label: 'Customer service contact', type: 'text', required: true },
        { id: 'payroc_reports_contact', label: 'Reports & statements contact', type: 'text', required: true },
        { id: 'payroc_chargeback_destination', label: 'Where should chargeback and retrieval requests be sent?', type: 'textarea', required: true },
      ],
    },
    {
      title: 'Business / processing detail',
      fields: [
        { id: 'payroc_years_processing', label: 'Years the business has been processing payments', type: 'number' },
        { id: 'payroc_mcc', label: 'MCC', type: 'text' },
        { id: 'payroc_terminated', label: 'Ever had a processing agreement terminated by a bank?', type: 'select', options: YES_NO, required: true },
        { id: 'payroc_terminated_reason', label: 'If yes, reason', type: 'textarea', showIf: { field: 'payroc_terminated', equals: 'Yes' } },
        { id: 'payroc_bankruptcy', label: 'Ever filed for business or personal bankruptcy?', type: 'select', options: YES_NO, required: true },
        { id: 'payroc_bankruptcy_year', label: 'If yes, year', type: 'text', showIf: { field: 'payroc_bankruptcy', equals: 'Yes' } },
      ],
    },
    {
      title: 'Card acceptance',
      fields: [
        { id: 'payroc_currently_processing', label: 'Do you currently process payments?', type: 'select', options: YES_NO, required: true },
        { id: 'payroc_acceptance_methods', label: 'Methods of card acceptance', type: 'textarea' },
        { id: 'payroc_pct_mpo', label: '% Mail / Phone Order', type: 'number' },
        { id: 'payroc_pct_ecom', label: '% e-commerce', type: 'number' },
        { id: 'payroc_amex_mid', label: 'Do you have an Amex-issued Merchant ID?', type: 'select', options: YES_NO },
      ],
    },
    {
      title: 'Underwriting numbers',
      fields: [
        { id: 'payroc_annual_visa', label: 'Annual Visa volume', type: 'number' },
        { id: 'payroc_annual_mc', label: 'Annual Mastercard volume', type: 'number' },
        { id: 'payroc_annual_amex', label: 'Annual Amex volume', type: 'number' },
        { id: 'payroc_pct_foreign', label: '% foreign cards', type: 'number' },
        { id: 'payroc_pct_recurring', label: '% recurring', type: 'number' },
        { id: 'payroc_high_ticket', label: 'High-ticket amount', type: 'number' },
      ],
    },
    {
      title: 'Website / fulfillment / refund',
      fields: [
        { id: 'payroc_sells_online', label: 'Selling products/services on your website?', type: 'select', options: YES_NO, required: true },
        { id: 'payroc_ssl_provider', label: 'SSL provider', type: 'text' },
        { id: 'payroc_return_policy', label: 'Return policy', type: 'textarea' },
        { id: 'payroc_refund_policy', label: 'Refund policy', type: 'textarea' },
        { id: 'payroc_pct_refunded', label: '% of monthly sales refunded', type: 'number' },
        { id: 'payroc_when_charged', label: 'When do you charge the customer?', type: 'text' },
        { id: 'payroc_shipment_traceable', label: 'Is shipment traceable?', type: 'select', options: YES_NO_NS },
        { id: 'payroc_pod_requested', label: 'Is proof of delivery requested?', type: 'select', options: YES_NO_NS },
        { id: 'payroc_other_companies', label: 'Other companies involved in accepting / shipping / fulfilling?', type: 'textarea' },
        { id: 'payroc_turnaround', label: 'Normal turnaround time from order to customer receipt', type: 'text' },
        { id: 'payroc_deposits', label: 'Do you take deposits?', type: 'select', options: YES_NO },
        { id: 'payroc_deposits_amount', label: 'If yes, percentage or fixed amount', type: 'text', showIf: { field: 'payroc_deposits', equals: 'Yes' } },
        { id: 'payroc_card_entry_operator', label: 'Who enters the card information into the processing system?', type: 'text' },
        { id: 'payroc_owns_inventory', label: 'Do you own the inventory at the time of sale?', type: 'select', options: YES_NO },
      ],
    },
    {
      title: 'Required documents / website requirements',
      fields: [
        { id: 'payroc_can_financials', label: 'Audited / reviewed financial statements or corporate tax returns available?', type: 'select', options: YES_NO, required: true },
        { id: 'payroc_can_statements', label: '3 consecutive months of processing statements within the last 90 days?', type: 'select', options: YES_NO },
        { id: 'payroc_can_officer_id', label: 'Each signing officer can provide a government ID?', type: 'select', options: YES_NO, required: true },
        { id: 'payroc_site_secure_payment', label: 'Secure payment page?', type: 'select', options: YES_NO },
        { id: 'payroc_site_shipping_policy', label: 'Shipping policy on site?', type: 'select', options: YES_NO },
        { id: 'payroc_site_currency', label: 'Transaction currency displayed?', type: 'select', options: YES_NO },
        { id: 'payroc_site_item_description', label: 'Complete description of items / services sold?', type: 'select', options: YES_NO },
      ],
    },
    {
      title: 'Banking',
      fields: [
        { id: 'payroc_separate_chargeback_acct', label: 'Need a separate chargeback bank account?', type: 'select', options: YES_NO },
        { id: 'payroc_trust_account', label: 'Is the depository account a trust account?', type: 'select', options: YES_NO },
        { id: 'payroc_void_cheques', label: 'Can you attach void cheques or bank letters for each listed account?', type: 'select', options: YES_NO, required: true },
      ],
    },
  ],
};

const CHASE: ProcessorFollowUpSpec = {
  processor: 'Chase',
  sections: [
    {
      title: 'Ownership structure',
      fields: [
        {
          id: 'chase_ownership_type', label: 'Ownership type', type: 'select', required: true, options: [
            { label: 'Privately owned', value: 'private' },
            { label: 'Publicly traded', value: 'public' },
            { label: 'Government', value: 'government' },
            { label: 'Non-profit', value: 'non_profit' },
            { label: 'Sole proprietorship', value: 'sole_prop' },
            { label: 'Parent-owned', value: 'parent_owned' },
          ],
        },
        { id: 'chase_top_two_owners', label: 'Two owners with the greatest ownership percentages', type: 'textarea', required: true },
        { id: 'chase_additional_10pct', label: 'Additional direct or indirect owners with 10%+ ownership?', type: 'textarea' },
        { id: 'chase_unlisted_controllers', label: 'Anyone not listed who can make financial decisions or control company policy?', type: 'textarea' },
      ],
    },
    {
      title: 'Owner / delegate / senior manager',
      fields: [
        { id: 'chase_delegate', label: 'Authorized delegate or representative (name, email)', type: 'text' },
        { id: 'chase_senior_manager_name', label: 'Senior manager name', type: 'text', required: true },
        { id: 'chase_senior_manager_title', label: 'Senior manager title', type: 'text', required: true },
        { id: 'chase_senior_manager_listed', label: 'Is the senior manager already listed as an owner?', type: 'select', options: YES_NO },
      ],
    },
    {
      title: 'Payment timing / recurring granularity',
      fields: [
        { id: 'chase_advance_payment', label: 'Payment taken in advance of goods / services?', type: 'select', options: YES_NO, required: true },
        { id: 'chase_advance_pct', label: '% of total processing sales paid in advance', type: 'number', showIf: { field: 'chase_advance_payment', equals: 'Yes' } },
        { id: 'chase_advance_1_7', label: '% advance in 1–7 days', type: 'number', showIf: { field: 'chase_advance_payment', equals: 'Yes' } },
        { id: 'chase_advance_8_14', label: '% advance in 8–14 days', type: 'number', showIf: { field: 'chase_advance_payment', equals: 'Yes' } },
        { id: 'chase_advance_15_30', label: '% advance in 15–30 days', type: 'number', showIf: { field: 'chase_advance_payment', equals: 'Yes' } },
        { id: 'chase_advance_30_plus', label: '% advance over 30 days', type: 'number', showIf: { field: 'chase_advance_payment', equals: 'Yes' } },
        { id: 'chase_recurring', label: 'Is billing recurring?', type: 'select', options: YES_NO, required: true },
        { id: 'chase_recurring_pct', label: '% of sales that is recurring', type: 'number', showIf: { field: 'chase_recurring', equals: 'Yes' } },
        { id: 'chase_recurring_30', label: '% recurring every 30 days', type: 'number', showIf: { field: 'chase_recurring', equals: 'Yes' } },
        { id: 'chase_recurring_60', label: '% recurring every 60 days', type: 'number', showIf: { field: 'chase_recurring', equals: 'Yes' } },
        { id: 'chase_recurring_90', label: '% recurring every 90 days', type: 'number', showIf: { field: 'chase_recurring', equals: 'Yes' } },
        { id: 'chase_recurring_annual', label: '% recurring annually', type: 'number', showIf: { field: 'chase_recurring', equals: 'Yes' } },
        { id: 'chase_recurring_other', label: '% recurring other', type: 'number', showIf: { field: 'chase_recurring', equals: 'Yes' } },
      ],
    },
    {
      title: 'Sales breakdown',
      fields: [
        { id: 'chase_pct_cp', label: '% card present', type: 'number', required: true },
        { id: 'chase_pct_keyed', label: '% keyed / mail / phone order', type: 'number', required: true },
        { id: 'chase_pct_ecom', label: '% e-commerce', type: 'number', required: true },
        { id: 'chase_payment_methods', label: 'Payment methods you wish to accept', type: 'textarea' },
        { id: 'chase_amex_mid', label: 'Already have an American Express Merchant Number?', type: 'select', options: YES_NO },
      ],
    },
    {
      title: 'Signer / guarantee / consent',
      fields: [
        { id: 'chase_signer_name', label: 'Authorized representative signing on behalf of the merchant', type: 'text', required: true },
        { id: 'chase_signer_listed', label: 'Is the signer listed in the ownership section?', type: 'select', options: YES_NO, required: true },
        { id: 'chase_pg_required', label: 'Is a personal guarantee required?', type: 'select', options: YES_NO, required: true },
        { id: 'chase_guarantors', label: 'Guarantor name(s)', type: 'textarea', showIf: { field: 'chase_pg_required', equals: 'Yes' } },
        { id: 'chase_pg_consent', label: 'Does each guarantor agree to the personal guarantee terms?', type: 'select', options: YES_NO, showIf: { field: 'chase_pg_required', equals: 'Yes' } },
        { id: 'chase_credit_consent', label: 'Consent to credit and financial investigation?', type: 'select', options: YES_NO, required: true },
        { id: 'chase_pad_consent', label: 'Consent to pre-authorized debits from the settlement account?', type: 'select', options: YES_NO, required: true },
      ],
    },
    {
      title: 'Reporting / retrieval',
      fields: [
        { id: 'chase_chargeback_destination', label: 'Where should chargeback and retrieval requests be sent?', type: 'textarea', required: true },
        { id: 'chase_online_reporting_email', label: 'Send online reporting instructions to the legal email?', type: 'select', options: YES_NO },
      ],
    },
  ],
};

export const PROCESSOR_FOLLOW_UP_FORMS: Record<ProcessorFit, ProcessorFollowUpSpec> = {
  Nuvei: NUVEI,
  'Payroc / Peoples': PAYROC,
  Chase: CHASE,
};

export function getProcessorFollowUpSpec(processor: ProcessorFit): ProcessorFollowUpSpec {
  return PROCESSOR_FOLLOW_UP_FORMS[processor];
}

export function isFieldVisible(field: FollowUpField, answers: Record<string, string>): boolean {
  if (!field.showIf) return true;
  return (answers[field.showIf.field] || '') === field.showIf.equals;
}

export function validateFollowUp(
  spec: ProcessorFollowUpSpec,
  answers: Record<string, string>
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const section of spec.sections) {
    for (const field of section.fields) {
      if (!field.required) continue;
      if (!isFieldVisible(field, answers)) continue;
      const val = (answers[field.id] || '').trim();
      if (!val) missing.push(field.label);
    }
  }
  return { ok: missing.length === 0, missing };
}
