// Single source of truth for the scroll-driven journey: camera choreography,
// world-space act positions, scroll-range weighting, and overlay copy.

const RAW_ACTS = [
  {
    id: 'arrival',
    weight: 1.3,
    group: [0, 0, 0],
    camera: { pos: [0, 0.3, 9], look: [0, 0, 0], fov: 45 },
    theme: 'void',
    overlay: {
      kicker: null,
      heading: null, // hero brand + headline rendered by the dedicated Hero overlay
      support: null,
      cta: true,
    },
  },
  {
    id: 'connection',
    weight: 1.0,
    group: [0, 0, -16],
    camera: { pos: [0, 1, -7], look: [0, 0, -16], fov: 45 },
    theme: 'neutral',
    overlay: {
      kicker: 'One relationship, one thread',
      heading: 'Not another calorie tracker.',
      support:
        'Coach Connect links a client and a trainer to one shared system — messages, plans, and payments run on the same thread instead of five disconnected apps.',
      cta: false,
    },
  },
  {
    id: 'client-lane',
    weight: 1.4,
    group: [6, 0, -32],
    camera: { pos: [6, 1.2, -22], look: [6, 0.4, -32], fov: 48 },
    theme: 'client',
    overlay: {
      kicker: 'For clients',
      heading: 'Find your coach. Log everything else.',
      support:
        'Browse a real marketplace of coaches, follow your plan, log meals and workouts, and check in with an AI companion that can actually act — log a meal, swap an exercise, adjust a target.',
      cta: false,
    },
  },
  {
    id: 'trainer-lane',
    weight: 1.4,
    group: [-6, 0, -48],
    camera: { pos: [-6, 1.2, -38], look: [-6, 0.3, -48], fov: 46 },
    theme: 'trainer',
    overlay: {
      kicker: 'For trainers',
      heading: 'Run your business, not a spreadsheet.',
      support:
        'A CRM built for coaching: client cards, plan builders, notes and files, and Stripe payments that route straight to you — keep 90% of every payment, no invoicing required.',
      cta: false,
    },
  },
  {
    id: 'differentiators',
    weight: 1.0,
    group: [0, 0, -64],
    camera: { pos: [0, 1.5, -54], look: [0, 0, -64], fov: 45 },
    theme: 'neutral',
    overlay: {
      kicker: 'Why not another fitness app',
      heading: 'The parts nobody else connects.',
      support: null,
      cta: false,
    },
  },
  {
    id: 'pricing',
    weight: 1.1,
    group: [0, 0, -80],
    camera: { pos: [0, 0.7, -71], look: [0, 0.4, -80], fov: 40 },
    theme: 'pricing',
    overlay: {
      kicker: 'Coach Connect Pro',
      heading: '$59.99/mo — or $49/mo billed annually',
      support: '3-day free trial. Cancel anytime. Clients use the app free.',
      cta: false,
    },
  },
  {
    id: 'cta',
    weight: 0.9,
    group: [0, 0, -92],
    camera: { pos: [0, 0.5, -84], look: [0, 0, -92], fov: 42 },
    theme: 'void',
    overlay: {
      kicker: null,
      heading: 'One app. Both sides of the work.',
      support: 'Get started free, or bring your coaching business over in a weekend.',
      cta: true,
    },
  },
];

const totalWeight = RAW_ACTS.reduce((sum, a) => sum + a.weight, 0);

let cursor = 0;
export const ACTS = RAW_ACTS.map((act) => {
  const start = cursor / totalWeight;
  cursor += act.weight;
  const end = cursor / totalWeight;
  return { ...act, range: [start, end] };
});

export const ACT_COUNT = ACTS.length;

// Total scrollable track length, expressed in viewport-heights.
export const TRACK_VH = ACT_COUNT * 110;

export const DIFFERENTIATORS = [
  {
    id: 'marketplace-crm',
    label: 'Human marketplace + CRM',
    detail: 'A real place to find a coach — and a real back office to run one.',
    color: 'cyan',
  },
  {
    id: 'ai-tools',
    label: 'AI with executable tools',
    detail: 'Not a chatbot. It logs meals, swaps exercises, adjusts plans.',
    color: 'purple',
  },
  {
    id: 'nutrition-consensus',
    label: 'Multi-source nutrition',
    detail: 'Barcode, menu, and database sources cross-checked for one answer.',
    color: 'orange',
  },
  {
    id: 'document-depth',
    label: 'Notes, files, PDFs, sheets',
    detail: 'The paperwork of coaching lives in the app, not six inboxes.',
    color: 'green',
  },
  {
    id: 'week-in-review',
    label: 'Week-in-review narrative',
    detail: 'Progress reads like a story every week, not a wall of numbers.',
    color: 'pink',
  },
];

export const PRICING_BENEFITS = [
  { label: 'Unlimited clients', color: 'cyan' },
  { label: 'AI workouts', color: 'purple' },
  { label: 'Nutrition', color: 'orange' },
  { label: 'Progress', color: 'green' },
  { label: 'Chat', color: 'pink' },
];

export const CLIENT_SATELLITES = [
  { id: 'workouts', label: 'Workouts', color: 'purple' },
  { id: 'nutrition', label: 'Nutrition', color: 'orange' },
  { id: 'wellness', label: 'Wellness rings', color: 'cyan' },
  { id: 'ai-coach', label: 'AI Coach', color: 'purple' },
];
