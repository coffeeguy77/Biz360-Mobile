import { BuilderState, DraftLease, DraftSection, Jurisdiction, LeasePosition, LeaseType, PremisesType } from '@/context/leaseTypes';

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

const PROTECTION_LABELS: Record<string, string> = {
  'rent-reduction-occupancy': 'Building Occupancy Rent Reduction',
  'rent-abatement-works': 'Rent Abatement During Landlord Works',
  'peppercorn-common-areas': 'Peppercorn Rent for Common Areas',
  'outdoor-seating-licence': 'Outdoor Seating Licence',
  'foyer-licence': 'Building Foyer Licence',
  'storage-licence': 'Storage Area Licence',
  'no-rent-approvals': 'No Rent Until DA/Licence Approval',
  'no-rent-services': 'No Rent When Services Unavailable',
  'landlord-base-building': 'Landlord Base Building Obligations',
  'outgoings-cap': 'Outgoings Cap',
  'exclude-vacant-outgoings': 'Exclude Vacant Tenancy Outgoings',
  'cafe-exclusivity': 'Café Exclusivity',
  'assignment-purchaser': 'Assignment to Business Purchaser',
  'limited-makegood': 'Limited Make-Good Obligation',
  'termination-approvals': 'No Termination While Approvals Pending',
  'landlord-maintenance': 'Landlord Structural Maintenance',
  'disruption-compensation': 'Disruption Compensation',
  'option-to-renew': 'Option to Renew',
  'market-rent-dispute': 'Market Rent Dispute Resolution',
  'signage-rights': 'Signage Rights',
  'delivery-access': '24-Hour Delivery Access',
  'grease-trap': 'Grease Trap & Exhaust Landlord Obligations',
};

const PROTECTION_CLAUSES: Record<string, string> = {
  'rent-reduction-occupancy': 'If the overall occupancy of the Building falls below [threshold]% for a continuous period exceeding 30 days, the Base Rent shall be reduced by [percentage]% for the duration of the reduced occupancy. The Landlord must notify the Tenant in writing within 7 days of occupancy falling below the threshold.',
  'rent-abatement-works': 'If the Landlord carries out any works that materially interfere with the Tenant\'s use and enjoyment of the Premises, Rent shall be abated by a fair and reasonable proportion for the period of interference, as agreed by the parties or determined by an independent valuer.',
  'peppercorn-common-areas': 'Use of any common areas adjacent to the Premises for dining or display is licensed at a peppercorn rent of $1 per annum, irrevocable for the Term and any option periods.',
  'outdoor-seating-licence': 'The Tenant is granted an exclusive licence to use the Outdoor Seating Area delineated on the Plan for outdoor dining for the full Term and any renewal at a peppercorn rent of $1 per annum. The licence cannot be terminated independently of the Lease.',
  'foyer-licence': 'The Tenant is granted a non-exclusive licence to use the Building Foyer area shown on the Plan for coffee service and display during the Tenant\'s trading hours, at a peppercorn rent, not to be revoked without 90 days\' written notice and compensation.',
  'storage-licence': 'The Tenant is granted an exclusive licence to use the Storage Area shown on the Plan for the storage of goods used in connection with the Permitted Use, at a peppercorn rent of $1 per annum.',
  'no-rent-approvals': 'Rent and Outgoings shall not commence until all Development Approvals, food business registrations and other statutory consents required to operate the Permitted Use have been granted and become unconditional. The Tenant must use reasonable endeavours to obtain approvals promptly.',
  'no-rent-services': 'If electricity, gas, water, or sewerage services are unavailable for any period exceeding 4 hours (other than due to the Tenant\'s act or default), Rent and Outgoings shall be abated in full for the period of unavailability. If unavailability exceeds 5 business days, the Tenant may terminate the Lease without penalty.',
  'landlord-base-building': 'The Landlord is responsible at its cost for the repair, maintenance and replacement of the base building structure, roof, external walls, and all base building services including hydraulic, electrical and mechanical systems serving the Premises.',
  'outgoings-cap': 'The Tenant\'s total annual Outgoings liability is capped at $[amount] per annum (indexed by CPI). Outgoings shall not include capital expenditure, management fees exceeding 5% of gross income, or costs referable to vacant tenancies.',
  'exclude-vacant-outgoings': 'All Outgoings calculations shall be based on the Building\'s actual occupation. Costs attributable to vacant tenancies or unoccupied floors shall be excluded from the Tenant\'s Outgoings contribution.',
  'cafe-exclusivity': 'The Landlord will not lease, licence or permit any part of the Building to be used for the operation of a café, espresso bar, coffee shop, or any business deriving more than 30% of revenue from the retail sale of food or beverages. Breach entitles the Tenant to a rent abatement of [percentage]% per month.',
  'assignment-purchaser': 'The Tenant may assign this Lease to a bona fide purchaser of the Tenant\'s business on 14 days\' written notice, provided the assignee demonstrates sufficient financial capacity. The Landlord must not unreasonably withhold consent. The Tenant is released from all obligations upon completion of assignment.',
  'limited-makegood': 'The Tenant\'s make-good obligation is limited to: (a) removing trade fixtures and equipment; (b) making good damage caused by such removal; and (c) leaving the Premises clean. The Tenant is not required to remove fixed joinery, structural items or improvements. The Landlord must advise disputed items within 14 days of vacancy.',
  'termination-approvals': 'The Landlord may not terminate this Lease while any application for Development Approval, food business licence or liquor licence is pending before the relevant authority. The Lease continues until the outcome of such applications is determined.',
  'landlord-maintenance': 'The Landlord shall maintain and repair the structure of the Building, roof, foundations, external walls, and all structural components. The Landlord shall complete all structural repairs within 30 days of written notice from the Tenant.',
  'disruption-compensation': 'If any act, omission or works by the Landlord, other tenants or third parties causes material disruption to the Tenant\'s trading for any period, the Landlord shall compensate the Tenant for lost trading revenue as demonstrated by the Tenant\'s financial records, in addition to any rent abatement otherwise applicable.',
  'option-to-renew': 'Subject to the Tenant not being in unremedied default, the Tenant has two options to renew for further 5-year terms on 3 months\' prior written notice. Rent for each option period shall be at market review, not to exceed CPI + 2% per annum compounded. The Tenant is released from the obligation to pay any increased rent until market rent is formally determined.',
  'market-rent-dispute': 'If the parties cannot agree on market rent within 30 days of the review date, either party may refer determination to an independent valuer appointed by the President of the Australian Property Institute. The valuer acts as expert. Costs are shared equally. Ratchet provisions do not apply — market rent cannot be set below the current rent.',
  'signage-rights': 'The Tenant has the right to install external and internal signage of its choosing, subject to council and statutory approvals. The Tenant shall also be included in the Building\'s directory, entrance signage, and all wayfinding. The Landlord must not unreasonably withhold or delay consent.',
  'delivery-access': 'The Tenant and its authorised suppliers have 24-hour, 7-day access to delivery areas and loading docks serving the Premises without restriction or additional charge. The Landlord must provide at least 48 hours\' notice before restricting delivery access for any reason.',
  'grease-trap': 'The Landlord shall, prior to the Commencement Date, install a grease arrestor of sufficient capacity and a mechanical exhaust system compliant with all statutory requirements. The Landlord is responsible for all maintenance, servicing (including quarterly pump-outs), repair and replacement of these systems throughout the Term.',
};

const PREMISES_LABELS: Record<PremisesType, string> = {
  'cafe': 'Café',
  'kiosk': 'Kiosk',
  'restaurant': 'Restaurant',
  'office-foyer-cafe': 'Office Foyer Café',
  'shopping-centre-cafe': 'Shopping Centre Café',
  'street-front-cafe': 'Street Front Café',
  'outdoor-seating-cafe': 'Outdoor Seating Café',
};

const POSITION_LABELS: Record<LeasePosition, string> = {
  'tenant-friendly': 'Tenant Friendly',
  'balanced': 'Balanced',
  'landlord-friendly': 'Landlord Friendly',
};

const CRITICAL_PROTECTIONS = ['no-rent-approvals', 'no-rent-services', 'option-to-renew', 'limited-makegood', 'assignment-purchaser'];

export function generateDraft(state: BuilderState, id: string): DraftLease {
  const sections: DraftSection[] = [];

  // 1. Schedule
  sections.push({
    id: genId(),
    type: 'schedule',
    title: 'Lease Schedule',
    content: `LEASE SCHEDULE\n\nJurisdiction: ${state.jurisdiction}\nLease Type: ${state.leaseType.charAt(0).toUpperCase() + state.leaseType.slice(1)}\nPremises Type: ${PREMISES_LABELS[state.premisesType]}\nDrafting Position: ${POSITION_LABELS[state.position]}\n\nRent Structure: ${state.rentStructure}\nOutgoings Structure: ${state.outgoingsStructure}\nOccupancy Threshold: ${state.occupancyThreshold}%\n\nLicence Areas:\n${state.licenceAreas.length > 0 ? state.licenceAreas.map(a => `  • ${PROTECTION_LABELS[a] ?? a}`).join('\n') : '  None selected'}\n\nThis schedule forms part of the Lease and should be read in conjunction with the Special Conditions below.`,
  });

  // 2. Special Conditions
  const specialConditions = state.selectedProtections.map(key => {
    const title = PROTECTION_LABELS[key] ?? key;
    const text = PROTECTION_CLAUSES[key] ?? `[Clause text for ${title} — to be drafted by solicitor]`;
    return `SPECIAL CONDITION: ${title}\n\n${text}`;
  }).join('\n\n──────────────────────────────────────────\n\n');

  sections.push({
    id: genId(),
    type: 'special-conditions',
    title: 'Special Conditions',
    content: state.selectedProtections.length > 0
      ? specialConditions
      : 'No special conditions selected. Use the Lease Builder to add tenant protections.',
  });

  // 3. Licence Area Clauses
  const licenceContent = state.licenceAreas.length > 0
    ? state.licenceAreas.map(key => {
        const title = PROTECTION_LABELS[key] ?? key;
        const text = PROTECTION_CLAUSES[key] ?? `[Licence clause for ${title}]`;
        return `LICENCE: ${title}\n\n${text}`;
      }).join('\n\n──────────────────────────────────────────\n\n')
    : 'No licence areas selected.';

  sections.push({
    id: genId(),
    type: 'licence-clauses',
    title: 'Licence Area Clauses',
    content: licenceContent,
  });

  // 4. Tenant Protections Summary
  const allSelected = [...state.selectedProtections, ...state.licenceAreas];
  sections.push({
    id: genId(),
    type: 'tenant-protections',
    title: 'Tenant Protections Summary',
    content: allSelected.length > 0
      ? `SELECTED PROTECTIONS (${allSelected.length} of 22)\n\n${allSelected.map(k => `✓ ${PROTECTION_LABELS[k] ?? k}`).join('\n')}`
      : 'No protections selected.',
  });

  // 5. Plain English Summary
  sections.push({
    id: genId(),
    type: 'summary',
    title: 'Plain English Summary',
    content: `PLAIN ENGLISH LEASE SUMMARY\n\nThis lease document has been prepared for a ${PREMISES_LABELS[state.premisesType]} in ${state.jurisdiction}, taking a ${POSITION_LABELS[state.position]} drafting position.\n\n` +
      `RENT: ${state.rentStructure}\n\nOUTGOINGS: ${state.outgoingsStructure}\n\n` +
      `KEY PROTECTIONS INCLUDED:\n${state.selectedProtections.slice(0, 8).map(k => `• ${PROTECTION_LABELS[k] ?? k}`).join('\n')}\n\n` +
      `This summary is a guide only. You should have a qualified solicitor review the full lease document before signing. Commercial leases are legally binding documents with significant financial consequences.`,
  });

  // 6. Negotiation Checklist
  const allProtections = Object.keys(PROTECTION_LABELS);
  const checklist = allProtections.map(key => {
    const selected = allSelected.includes(key);
    return `${selected ? '[✓]' : '[ ]'} ${PROTECTION_LABELS[key]}`;
  }).join('\n');

  sections.push({
    id: genId(),
    type: 'checklist',
    title: 'Negotiation Checklist',
    content: `LEASE NEGOTIATION CHECKLIST\n\nUse this checklist when negotiating with your landlord or solicitor.\n\n${checklist}`,
  });

  // 7. Red Flags
  const missing = CRITICAL_PROTECTIONS.filter(key => !allSelected.includes(key));
  const redFlagContent = missing.length === 0
    ? 'No critical red flags identified. All recommended protections are included in this draft.'
    : `RED FLAG WARNINGS\n\nThe following critical protections are MISSING from this draft. These are highly recommended for any café lease:\n\n${missing.map(key => `⚠️ MISSING: ${PROTECTION_LABELS[key] ?? key}\n   This is a high-risk omission that could significantly impact your business.`).join('\n\n')}`;

  sections.push({
    id: genId(),
    type: 'red-flags',
    title: 'Red Flag Report',
    content: redFlagContent,
  });

  const name = `${PREMISES_LABELS[state.premisesType]} Lease — ${state.jurisdiction} (${new Date().toLocaleDateString('en-AU')})`;

  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    jurisdiction: state.jurisdiction,
    leaseType: state.leaseType,
    premisesType: state.premisesType,
    position: state.position,
    rentStructure: state.rentStructure,
    outgoingsStructure: state.outgoingsStructure,
    licenceAreas: state.licenceAreas,
    selectedProtections: state.selectedProtections,
    sections,
  };
}
