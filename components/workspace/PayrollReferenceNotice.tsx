import {ExternalLink, FileCheck2} from "lucide-react";
import type {CreditDocument} from "@/lib/credit-data";
import {datevReference, officialPayrollReference} from "@/lib/datev-reference";

export function PayrollReferenceNotice({doc, locale}: {doc: CreditDocument; locale: string}) {
  if (doc.type !== "income") return null;
  const reference = datevReference(doc.name);
  const valuesOnly = doc.analysisProvider === "datev-reference-values";
  const title = locale === "vi" ? "Mẫu bảng lương DATEV" : locale === "de" ? "DATEV-Gehaltsreferenz" : "DATEV payroll reference";
  const note = reference
    ? valuesOnly
      ? locale === "vi" ? "Chỉ hiển thị giá trị tham chiếu từ mẫu DATEV, không phải kết quả OCR/AI. PDF gốc của nhà phát hành không phát công khai trong app. Hai người mẫu không phải người nộp hồ sơ demo."
        : locale === "de" ? "Nur DATEV-Referenzwerte, kein OCR-/KI-Ergebnis. Das Herausgeber-PDF wird nicht öffentlich in der App verteilt. Die Musterpersonen sind nicht die Demo-Antragsteller."
        : "DATEV reference values only, not OCR/AI output. The publisher PDF is not redistributed publicly by this app. The sample people are not the demo applicants."
      : locale === "vi" ? "Tên file khớp mẫu DATEV đã chuẩn bị. Đối chiếu PDF gốc và nguồn nhà phát hành; tên file không chứng minh tính xác thực."
        : locale === "de" ? "Der Dateiname passt zur vorbereiteten DATEV-Referenz. Original und Herausgeberquelle prüfen; ein Dateiname beweist keine Echtheit."
        : "The filename matches a prepared DATEV reference. Compare the original and publisher source; a filename is not proof of authenticity."
    : locale === "vi" ? "Tài liệu đã lưu này không thuộc hai mẫu DATEV chính thức trong thư viện. Bản gốc và lịch sử được giữ nguyên; không đổi nhãn thành DATEV. Dùng thư viện DATEV cho ví dụ bảng lương mới."
      : locale === "de" ? "Dieser gespeicherte Beleg gehört nicht zu den zwei offiziellen DATEV-Bibliotheksmustern. Original und Verlauf bleiben unverändert; keine Umbenennung als DATEV. Für neue Gehaltsbeispiele die DATEV-Bibliothek nutzen."
      : "This stored evidence is not one of the two official DATEV library samples. Original and history remain unchanged, not relabelled as DATEV. Use the DATEV library for new payroll examples.";
  return <section className="payroll-reference-notice" aria-label={title}><FileCheck2 size={19}/><div><strong>{title}</strong><p>{note}</p>{reference ? <a href={`${officialPayrollReference}#page=${reference.publisherPage}`} target="_blank" rel="noopener noreferrer">DATEV LODAS 2025 · {reference.name}<ExternalLink size={13}/></a> : null}</div></section>;
}
