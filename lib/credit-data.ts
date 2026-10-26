import type {EvidenceRegion} from './evidence-inspection';
export type CreditDocument = {
  id: string;
  name: string;
  type: string;
  status: "verified" | "review" | "missing";
  confidence?: number | null;
  fields?: { label: string; value: string; confidence: number | null; page?: number; evidence?: string;originalValue?:string }[];
  pages?: { number: number; text: string; method: string;regions?:EvidenceRegion[] }[];
  ocrCorrections?:{id:string;page:number;sourceId:string;originalText:string;correctedText:string;reason:string;actor:string;time:string}[];
  originalAvailable?: boolean;
  analysisProvider?: string | null;
  modelId?: string | null;
  contentType?: string | null;
  tables?: {page:number;rows:number;columns:number;cells:{row:number;column:number;text:string}[]}[];
};

export const demoCase = {
  id: "CR-2026-1048",
  tenantId: "praxisbank-demo",
  applicant: "Dr. Lea Hoffmann",
  coApplicant: "Jonas Hoffmann",
  purpose: "Praxisübernahme",
  amount: "€ 480.000",
  progress: 0,
  status: "Human review",
  submittedAt: "08.10.2026 · 14:32",
  documents: [
    {
      id: "doc-1",
      name: "datev-lodas-2025-robert-muster.pdf",
      type: "Einkommensnachweis",
      status: "review",
      confidence: null,
      analysisProvider: "datev-reference-values",
      originalAvailable: false,
      fields: [
        { label: "netIncome", value: "2.967,11 EUR", confidence: null },
        { label: "payoutAmount", value: "2.882,11 EUR", confidence: null },
      ],
    },
    {
      id: "doc-2",
      name: "Kontoauszug_Q3.pdf",
      type: "Kontoauszug",
      status: "review",
      confidence: 84,
      fields: [
        { label: "Kontostand", value: "€ 42.180", confidence: 94 },
        { label: "Monatliche Rate", value: "€ 1.250", confidence: 71 },
      ],
    },
    {
      id: "doc-3",
      name: "Identitätsnachweis",
      type: "Personaldokument",
      status: "verified",
      confidence: 99,
    },
    {
      id: "doc-4",
      name: "Praxisbewertung",
      type: "Bewertungsgutachten",
      status: "missing",
    },
  ] satisfies CreditDocument[],
  issues: [
    {
      severity: "high",
      title: "Pflichtdokument fehlt",
      detail: "Die Praxisbewertung wurde noch nicht hochgeladen.",
    },
    {
      severity: "medium",
      title: "Abweichende Monatsrate",
      detail: "Kontoauszug: € 1.250 · Selbstauskunft: € 980. Manuelle Prüfung nötig.",
    },
  ],
  audit: [
    ["14:41", "AI extraction completed", "service/document-ai"],
    ["14:39", "Document uploaded", "customer/lea.hoffmann"],
    ["14:35", "Co-applicant consented", "customer/jonas.hoffmann"],
    ["14:32", "Application created", "customer/lea.hoffmann"],
  ],
};

export const knowledge = [
  {
    title: "Required documents",
    text: "The demo case requires an identity document, income evidence, recent account statements and a practice valuation. Missing items must be reviewed by a human.",
  },
  {
    title: "AI policy",
    text: "The AI extracts and explains information but never approves or rejects credit. Low-confidence values and contradictions are routed to human review.",
  },
  {
    title: "Current demo case",
    text: "Case CR-2026-1048 is 78 percent complete. The practice valuation is missing. The monthly-rate conflict is 1250 euros in the account statement versus 980 euros in self-disclosure.",
  },
  {
    title: "Security model",
    text: "Keycloak supplies OAuth 2.0 and OpenID Connect tokens. The Java API derives tenant and roles from verified JWT claims. Azure OpenAI uses workload identity federation instead of a stored long-lived API key.",
  },
];

export function retrieveKnowledge(query: string) {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return knowledge
    .map((item) => ({
      ...item,
      score: terms.reduce(
        (score, term) => score + (item.text.toLowerCase().includes(term) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
