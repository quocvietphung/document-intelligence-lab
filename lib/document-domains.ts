export const documentDomains = ['banking', 'insurance', 'general'] as const;
export type DocumentDomain = typeof documentDomains[number];
export const domainOf = (value?: string): DocumentDomain => documentDomains.includes(value as DocumentDomain) ? value as DocumentDomain : 'banking';

const en = {
  title: 'One research lab. Multiple document domains.',
  subtitle: 'Extract with Azure Document Intelligence, retrieve evidence and explain with Azure OpenAI. Keep every result tied to its original.',
  all: 'All domains', domain: 'Document domain', count: 'dossiers', empty: 'No dossiers in this domain yet. Create one, then upload a fictional PDF.',
  banking: 'Banking & payroll', insurance: 'Insurance', general: 'General documents',
  bankingHint: 'Preserved DATEV payroll, account statements and income evidence.',
  insuranceHint: 'Policies, premiums, deductibles, coverage dates and claim documents.',
  generalHint: 'Invoices, contracts and reports. Research without credit-file requirements.',
  requirement: 'Review template', bankingRequired: 'Income evidence + account statement. Not a credit decision.',
  insuranceRequired: 'Insurance policy. Claim documents are optional. No coverage or settlement decisions.',
  generalRequired: 'No fixed document checklist. Review the originals you upload.',
  types: 'Classified document types', fields: 'Extracted fields', originals: 'Uploaded originals',
  research: 'Domain research', evidence: 'Inspect original & fields', ask: 'Ask Nova about this document',
  boundary: 'Research only: no payments, credit approvals, insurance advice or claim settlement. Classification and field checks use transparent rules, not a trained insurance model.',
  question: 'Explain the selected document using only its source pages. Identify the document type, important amounts or dates, missing evidence and uncertainties. Do not make credit or insurance decisions.',
} as const;
type Copy = {[K in keyof typeof en]: string};
const de: Copy = {
  title: 'Ein Forschungslabor. Mehrere Dokumentbereiche.',
  subtitle: 'Mit Azure Document Intelligence extrahieren, Belege recherchieren und mit Azure OpenAI erklären. Jedes Ergebnis bleibt mit dem Original verbunden.',
  all: 'Alle Bereiche', domain: 'Dokumentbereich', count: 'Vorgänge', empty: 'Noch keine Vorgänge in diesem Bereich. Lege einen an und lade ein fiktives PDF hoch.',
  banking: 'Banking & Gehalt', insurance: 'Versicherungen', general: 'Allgemeine Dokumente',
  bankingHint: 'Erhaltene DATEV-Abrechnungen, Kontoauszüge und Einkommensnachweise.',
  insuranceHint: 'Policen, Beiträge, Selbstbeteiligung, Versicherungszeiträume und Schadenunterlagen.',
  generalHint: 'Rechnungen, Verträge und Berichte. Recherche ohne Kreditakten-Pflichtunterlagen.',
  requirement: 'Prüfvorlage', bankingRequired: 'Einkommensnachweis + Kontoauszug. Keine Kreditentscheidung.',
  insuranceRequired: 'Versicherungsschein. Schadenunterlagen sind optional. Keine Deckungs- oder Regulierungsentscheidung.',
  generalRequired: 'Keine feste Dokumentliste. Prüfe die hochgeladenen Originale.',
  types: 'Erkannte Dokumenttypen', fields: 'Extrahierte Felder', originals: 'Hochgeladene Originale',
  research: 'Bereichsrecherche', evidence: 'Original & Felder prüfen', ask: 'Nova zu diesem Dokument fragen',
  boundary: 'Nur Forschung: keine Zahlungen, Kreditfreigaben, Versicherungsberatung oder Schadenregulierung. Klassifikation und Feldprüfung nutzen transparente Regeln, kein trainiertes Versicherungsmodell.',
  question: 'Erkläre das ausgewählte Dokument ausschließlich anhand seiner Quellseiten. Nenne Dokumenttyp, wichtige Beträge oder Daten, fehlende Belege und Unsicherheiten. Triff keine Kredit- oder Versicherungsentscheidungen.',
};
const vi: Copy = {
  title: 'Một lab nghiên cứu. Nhiều lĩnh vực tài liệu.',
  subtitle: 'Azure Document Intelligence trích xuất, RAG tìm chứng cứ và Azure OpenAI giải thích. Mọi kết quả đều gắn với tài liệu gốc.',
  all: 'Tất cả lĩnh vực', domain: 'Lĩnh vực tài liệu', count: 'hồ sơ', empty: 'Chưa có hồ sơ thuộc lĩnh vực này. Tạo hồ sơ rồi tải PDF giả lập để bắt đầu.',
  banking: 'Ngân hàng & bảng lương', insurance: 'Bảo hiểm', general: 'Tài liệu chung',
  bankingHint: 'Giữ nguyên bảng lương DATEV, sao kê và chứng minh thu nhập.',
  insuranceHint: 'Hợp đồng bảo hiểm, phí, mức tự chịu, thời hạn và hồ sơ tổn thất.',
  generalHint: 'Hóa đơn, hợp đồng và báo cáo. Không áp yêu cầu hồ sơ tín dụng.',
  requirement: 'Mẫu kiểm tra', bankingRequired: 'Chứng minh thu nhập + sao kê. Không ra quyết định tín dụng.',
  insuranceRequired: 'Hợp đồng bảo hiểm. Hồ sơ tổn thất là tùy chọn. Không quyết định bồi thường hay phạm vi bảo hiểm.',
  generalRequired: 'Không có danh sách bắt buộc cố định. Kiểm duyệt tài liệu gốc bạn tải lên.',
  types: 'Loại tài liệu đã phân loại', fields: 'Trường đã trích xuất', originals: 'Tài liệu gốc đã tải',
  research: 'Nghiên cứu theo lĩnh vực', evidence: 'Xem bản gốc & trường dữ liệu', ask: 'Hỏi Nova về tài liệu này',
  boundary: 'Chỉ nghiên cứu: không thanh toán, duyệt tín dụng, tư vấn bảo hiểm hay giải quyết bồi thường. Phân loại và kiểm tra trường dùng quy tắc minh bạch, không phải model bảo hiểm đã huấn luyện.',
  question: 'Giải thích tài liệu đã chọn chỉ từ các trang nguồn. Nêu loại tài liệu, số tiền hoặc ngày quan trọng, chứng cứ còn thiếu và điểm chưa chắc. Không ra quyết định tín dụng hay bảo hiểm.',
};
export const domainLanguageTables = {en, de, vi};
export function domainText(locale: string): Copy {return domainLanguageTables[locale === 'de' ? 'de' : locale === 'vi' ? 'vi' : 'en'];}
export function filterDomain<T extends {domain?: string}>(items: readonly T[], domain: DocumentDomain | 'all') {return items.filter(item => domain === 'all' || domainOf(item.domain) === domain);}

const extraLabels: Record<string, Record<string, string>> = {
  en: {workspace:'Document research workspace',lab:'Azure AI · research lab',notice:'Fictional or public non-personal references only. Research, not financial, insurance or legal advice.',applicant:'Dossier title / subject',purpose:'Research objective',coApplicant:'Additional reference (optional)',newCase:'New dossier',editCase:'Edit dossier',selectCase:'Select a dossier',search:'Search dossiers',noIssues:'No recorded issues. This is not a professional decision or approval.',nova:'Nova · Document research',ask:'Ask about the selected documents…',chatHint:'Scoped evidence · page sources · human review',welcome:'Research starts with evidence.',subtitle:'Banking, insurance and general documents in one evidence-first research workspace.', 'insurance-wording':'Insurance reference wording','insurance-policy':'Insurance policy','insurance-claim':'Claim notification',invoice:'Invoice',contract:'Contract',policyNumber:'Policy number',insurer:'Insurer',policyholder:'Policyholder',premium:'Premium',deductible:'Deductible',coverageAmount:'Coverage amount',coverageStart:'Coverage start',coverageEnd:'Coverage end',claimNumber:'Claim number',claimDate:'Date of loss',invoiceNumber:'Invoice number',invoiceTotal:'Invoice total',contractNumber:'Contract number'},
  de: {workspace:'Dokumentenforschung',lab:'Azure AI · Forschungslabor',notice:'Nur fiktive oder öffentliche nicht personenbezogene Referenzen. Keine Finanz-, Versicherungs- oder Rechtsberatung.',applicant:'Vorgangstitel / Gegenstand',purpose:'Forschungsziel',coApplicant:'Weitere Referenz (optional)',newCase:'Neuer Vorgang',editCase:'Vorgang bearbeiten',selectCase:'Vorgang auswählen',search:'Vorgänge suchen',noIssues:'Keine erfassten Hinweise. Keine fachliche Entscheidung oder Freigabe.',nova:'Nova · Dokumentenforschung',ask:'Zu den ausgewählten Dokumenten fragen…',chatHint:'Begrenzter Belegzugriff · Quellseiten · menschliche Prüfung',welcome:'Forschung beginnt mit Belegen.',subtitle:'Banking, Versicherungen und allgemeine Dokumente in einem belegbasierten Forschungsbereich.', 'insurance-wording':'Versicherungsbedingungen · Referenz','insurance-policy':'Versicherungsschein','insurance-claim':'Schadenmeldung',invoice:'Rechnung',contract:'Vertrag',policyNumber:'Versicherungsnummer',insurer:'Versicherer',policyholder:'Versicherungsnehmer',premium:'Beitrag',deductible:'Selbstbeteiligung',coverageAmount:'Deckungssumme',coverageStart:'Versicherungsbeginn',coverageEnd:'Versicherungsende',claimNumber:'Schadennummer',claimDate:'Schadendatum',invoiceNumber:'Rechnungsnummer',invoiceTotal:'Rechnungsbetrag',contractNumber:'Vertragsnummer'},
  vi: {workspace:'Không gian nghiên cứu tài liệu',lab:'Azure AI · Lab nghiên cứu',notice:'Chỉ dùng mẫu giả lập hoặc tham khảo công khai không có hồ sơ cá nhân. Không tư vấn tài chính, bảo hiểm hay pháp lý.',applicant:'Tên hồ sơ / đối tượng',purpose:'Mục tiêu nghiên cứu',coApplicant:'Tham chiếu bổ sung (tùy chọn)',newCase:'Tạo hồ sơ',editCase:'Sửa hồ sơ',selectCase:'Chọn hồ sơ',search:'Tìm hồ sơ',noIssues:'Chưa ghi nhận vấn đề. Không phải kết luận chuyên môn hay phê duyệt.',nova:'Nova · Nghiên cứu tài liệu',ask:'Hỏi về tài liệu đang chọn…',chatHint:'Đúng phạm vi · dẫn trang nguồn · người kiểm duyệt',welcome:'Nghiên cứu bắt đầu từ chứng cứ.',subtitle:'Ngân hàng, bảo hiểm và tài liệu chung trong một không gian nghiên cứu có chứng cứ.', 'insurance-wording':'Điều khoản bảo hiểm tham khảo','insurance-policy':'Hợp đồng bảo hiểm','insurance-claim':'Thông báo tổn thất',invoice:'Hóa đơn',contract:'Hợp đồng',policyNumber:'Số hợp đồng bảo hiểm',insurer:'Doanh nghiệp bảo hiểm',policyholder:'Bên mua bảo hiểm',premium:'Phí bảo hiểm',deductible:'Mức tự chịu',coverageAmount:'Số tiền bảo hiểm',coverageStart:'Bắt đầu bảo hiểm',coverageEnd:'Kết thúc bảo hiểm',claimNumber:'Mã tổn thất',claimDate:'Ngày tổn thất',invoiceNumber:'Số hóa đơn',invoiceTotal:'Tổng tiền hóa đơn',contractNumber:'Số hợp đồng'},
};
export function documentResearchLabel(locale: string, key: string): string | undefined {return extraLabels[locale === 'de' ? 'de' : locale === 'vi' ? 'vi' : 'en'][key];}
