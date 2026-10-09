import type { UIMessage } from "ai";
import { demoCase, retrieveKnowledge } from "@/lib/credit-data";

export function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function buildCreditInstructions(question: string) {
  const sources = retrieveKnowledge(question);
  const context = sources.map((item) => `[${item.title}] ${item.text}`).join("\n");
  return {
    sources,
    instructions: `You are Nova, an AI copilot in a banking engineering demonstration.
Reply in the user's language (German, English or Vietnamese). Be concise, calm and explicit about uncertainty.
You may explain form fields, document requirements, extracted values, validation conflicts and workflow status.
Never approve or reject credit, recommend a financial product, estimate creditworthiness or claim professional advice.
When evidence is missing or confidence is below 90%, recommend human review.
All case data is synthetic. Never imply that the demo is affiliated with apoBank or any real bank.

SYNTHETIC CASE
Case: ${demoCase.id}; applicant: ${demoCase.applicant}; purpose: ${demoCase.purpose}; progress: ${demoCase.progress}%; status: ${demoCase.status}.

RETRIEVED CONTEXT
${context}`,
  };
}

export function demoAnswer(question: string) {
  const q = question.toLowerCase();
  if (q.includes("fehl") || q.includes("missing") || q.includes("thiếu")) {
    return "Im Demo-Fall fehlt die Praxisbewertung. Zusätzlich muss die abweichende Monatsrate von € 1.250 im Kontoauszug und € 980 in der Selbstauskunft manuell geprüft werden. Ich treffe keine Kreditentscheidung.";
  }
  if (q.includes("sicher") || q.includes("security") || q.includes("bảo mật") || q.includes("tenant")) {
    return "Keycloak übernimmt OAuth 2.0/OIDC. Der Java-Service validiert das JWT und leitet Tenant sowie Rollen ausschließlich aus geprüften Claims ab. Azure OpenAI erhält kurzlebige Tokens über Workload Identity statt eines gespeicherten API-Schlüssels.";
  }
  if (q.includes("konflikt") || q.includes("conflict") || q.includes("mâu thuẫn")) {
    return "Im synthetischen Vorgang unterscheiden sich zwei Werte: € 1.250 im Kontoauszug und € 980 in der Selbstauskunft. Nova markiert den Konflikt mit Quellenbezug; eine autorisierte Fachperson prüft und bestätigt den korrekten Wert.";
  }
  if (q.includes("confidence") || q.includes("vertrauen") || q.includes("độ tin")) {
    return "Confidence ist ein Modellhinweis, keine Wahrheit. Werte unter 90 % und widersprüchliche Felder werden in die Human-Review-Warteschlange gelegt. Im Demo-Fall hat die erkannte Monatsrate nur 71 % Confidence.";
  }
  return "Ich kann den synthetischen Vorgang, Dokumentanforderungen, OCR-Felder, Konflikte und den Prüfpfad erklären. Für echte Kreditentscheidungen oder Finanzberatung ist immer eine autorisierte Fachperson zuständig.";
}
