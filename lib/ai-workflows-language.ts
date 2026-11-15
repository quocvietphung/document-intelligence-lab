import type {UseFeature,WorkflowFacts,WorkflowStatus,WorkflowStep,StepState} from './ai-workflows';

/** Text of the end-to-end AI workflows on the task page. Every key exists in English, German and Vietnamese. */
type StepCopy=Record<Exclude<WorkflowStep,'use'>,readonly [title:string,hint:string]>;
type DetailCopy=Record<'processing'|'reviewFields'|'resolveFindings'|'askStudio'|'askNova'|'checkClaims'|'closeTasks'|'reportError',string>;

const en={
  labels:{
    title:'AI workflows',
    intro:'Every AI feature as an end-to-end process. Unfinished workflows show the next step and what to do.',
    filter:'Show workflows',showOpen:'Unfinished ({count})',showAll:'All ({count})',
    next:'Next step',operator:'Needs an operator',
    unlock:'Start here: {step}. It moves {count} workflows forward.',unlockOne:'Start here: {step}. It moves one workflow forward.',
    progress:'{done}/{total} steps',groupProgress:'{done}/{total} completed',
    process:'End-to-end process ({count} steps)',processOne:'End-to-end process (1 step)',
    demoNote:'Demo mode shows the guides only. Sign in to run these workflows on a real dossier.',
    allDone:'Every AI workflow in this dossier is complete.',
    honesty:'Status comes from this dossier’s records: documents, processing jobs, saved searches and the AI transparency history. A step marked “Your step” is not recorded, so it never counts as done.',
  },
  status:{done:'Completed',ready:'Ready for you',todo:'Step missing',blocked:'Not enabled here',demo:'Guide only'} satisfies Record<WorkflowStatus,string>,
  state:{done:'Done',todo:'To do',blocked:'Not enabled',unknown:'Not checked here',user:'Your step'} satisfies Record<StepState,string>,
  steps:{
    documentEngine:['Document engine configured','An operator connects a document engine, in the cloud or as local OCR. Without one, new PDFs cannot be read.'],
    languageModel:['Language model configured','Nova needs a configured language model, local or in the cloud. Without one, only the local app guide works.'],
    semanticIndex:['Semantic index enabled','Vector search needs the ONNX embedding model and Qdrant. Without them, search falls back to BM25 keywords.'],
    addDocuments:['Add the PDFs','Upload files or import them from a connected source. Only originals in this dossier are analysed.'],
    processing:['Processing finished','Wait until every file is processed. Failed files are listed under Needs attention; retry or remove them there. Processed does not mean reviewed.'],
    reviewFields:['Confirm the extracted fields','Open each result beside its PDF page, correct values and confirm them. Only reviewers and admins can confirm; later steps rely on reviewed values.'],
    resolveFindings:['Resolve rule findings','Java rules list missing documents and field conflicts. Add the missing evidence or correct the field, then check again.'],
    tables:['Tables detected','Tables come from the document engine. If none appear, add a PDF that contains a table.'],
    fieldPages:['Fields linked to source pages','A field can only be explained when it has a source page. Documents without an analysed original have none.'],
    askStudio:['Search the evidence','Ask a complete question in Ask documents, then compare the ranked passages and cited pages. Ranking means relevance, not truth.'],
    askNova:['Ask Nova about this dossier','Open Nova in analysis mode and ask in your own words. Each answer cites pages and is saved to the answer history.'],
    checkClaims:['Check every claim against its page','Claims that need review have a missing or invalid source. Open the page, then report or revise the answer.'],
    reviewTask:['Create a reviewer task','From an answer in the answer history, create a task with a short note when a person must follow up.'],
    closeTasks:['Close reviewer tasks','A reviewer takes each task into review and resolves it; the history keeps every step. Tasks never approve documents.'],
    reportError:['Report a wrong answer when needed','If an amount, person or source is wrong, report it in the answer history and prepare a revision. The original answer is kept.'],
  } satisfies StepCopy,
  use:{library:'{section}: run “{title}”',nova:'Open Nova',page:'Use it in {page}',trust:'Open {page} → {section}',templateIntro:'Edit the prepared request, then send it to Nova yourself.'},
  details:{
    processing:'Running: {active} · failed: {failed}',reviewFields:'{verified} of {originals} confirmed',resolveFindings:'Open: {count}',askStudio:'Recorded: {count}',
    askNova:'Saved answers: {count}',checkClaims:'Need review: {count}',closeTasks:'Open: {count}',reportError:'Reported: {count}',
  } satisfies DetailCopy,
  how:{
    classification:'Open Insurance document classification and choose Run local comparison on the labelled PDF fixtures. Compare per-class F1 of the Java rules and the TF-IDF model; operational types stay rule-based.',
    'field-explanation':'Open a result, pick a field and choose Explain this field with Nova. The answer cites the document page and never changes the value.',
    'injection-guard':'Ask a question and look for quarantined passages under the answer: text that tries to instruct the model is left out, and requests to override the rules are blocked. This is not a guarantee against every injection.',
    summary:'Check that every statement cites a page and that missing evidence is named as missing. The summary stays a draft.',
    reconcile:'Check that references, people, dates and amounts each cite a page. An amount match alone verifies nothing.',
    explain:'Nova separates source facts, rule results and interpretation. Treat the interpretation as a question for the reviewer, never as a finding of fraud.',
    'request-documents':'Edit the drafted request and send it yourself from your own mail program. The app never sends it.',
    'review-checklist':'Work through the drafted list of available evidence, missing documents and manual checks. It does not approve the case.',
    terminology:'Only labels that occur in the evidence are explained, each with its page. Terms that are absent stay unknown.',
    'bilingual-summary':'Compare the paired German and Vietnamese paragraphs: same sources, unchanged amounts. It is a draft, not a certified translation.',
    timeline:'Check each date and period against its page. No deadline is calculated and nothing is legally binding.',
    obligations:'Read each obligation, condition and exclusion with its page. It is not a legal opinion or a coverage decision.',
    'privacy-review':'Inspect the listed identifier categories yourself on each page. Nothing is redacted automatically.',
    'app-guide':'Switch Nova to App guidance to find a page, or choose Guide this page on any page. It only navigates: no document is read and no model is called.',
    'field-profiles':'Choose a check profile (general, invoice, DATEV or insurance wording) before adding files. Each result lists missing fields and type mismatches.',
    batches:'Add up to four files at once. Keep the receipt; each file gets its own result to review.',
    lineage:'Build the local ETL: Bronze → Silver → reviewed Gold, quality checks and the Power BI export, then follow it in Control Tower. Local stack only, not production-tested.',
    anomaly:'Run the anomaly experiment on reviewed amounts. With fewer than 30 distinct originals per cohort it reports insufficient data instead of a score.',
    quality:'Each analysed original lists its fields, tables and source pages. Compare them with the PDF; there is no generated benchmark or accuracy percentage.',
    experiments:'Add independent expected fields or a target page on a real PDF, save the reference version and run the experiment. Read the failed examples, not only the score.',
    'dossier-reconciliation':'Import all PDFs of one real-estate project into the same dossier. Rules compare references, order plus change-order value, invoice, open defects and deadlines; check each finding at its source page. No payment or legal approval.',
    transparency:'See what is sent to cloud services, what is stored and for how long. Opening it calls no AI service.',
    governance:'Check allowed tools, prompt versions and review requirements per feature. Changing them needs the admin role.',
    performance:'Read recorded response times, feedback and review activity for the loaded window. No invented cost or time savings.',
  } satisfies Record<UseFeature,string>,
};
type Copy=typeof en;

const de:Copy={
  labels:{
    title:'KI-Abläufe',
    intro:'Jede KI-Funktion als durchgängiger Ablauf. Offene Abläufe zeigen den nächsten Schritt und was zu tun ist.',
    filter:'Abläufe anzeigen',showOpen:'Offen ({count})',showAll:'Alle ({count})',
    next:'Nächster Schritt',operator:'Braucht eine betreibende Person',
    unlock:'Hier anfangen: {step}. Das bringt {count} Abläufe weiter.',unlockOne:'Hier anfangen: {step}. Das bringt einen Ablauf weiter.',
    progress:'{done}/{total} Schritte',groupProgress:'{done}/{total} abgeschlossen',
    process:'Ablauf von Anfang bis Ende ({count} Schritte)',processOne:'Ablauf von Anfang bis Ende (1 Schritt)',
    demoNote:'Der Demomodus zeigt nur die Anleitungen. Melde dich an, um die Abläufe an einem echten Vorgang auszuführen.',
    allDone:'Alle KI-Abläufe in diesem Vorgang sind abgeschlossen.',
    honesty:'Der Status stammt aus den Daten dieses Vorgangs: Dokumente, Verarbeitungsaufträge, gespeicherte Suchen und der Verlauf der KI-Transparenz. Ein Schritt mit „Dein Schritt“ wird nicht erfasst und zählt daher nie als erledigt.',
  },
  status:{done:'Abgeschlossen',ready:'Bereit für dich',todo:'Schritt fehlt',blocked:'Hier nicht aktiv',demo:'Nur Anleitung'},
  state:{done:'Erledigt',todo:'Offen',blocked:'Nicht aktiv',unknown:'Hier nicht prüfbar',user:'Dein Schritt'},
  steps:{
    documentEngine:['Dokumentdienst eingerichtet','Eine betreibende Person bindet einen Dokumentdienst an, in der Cloud oder als lokales OCR. Ohne Dienst können neue PDFs nicht gelesen werden.'],
    languageModel:['Sprachmodell eingerichtet','Nova braucht ein eingerichtetes Sprachmodell, lokal oder in der Cloud. Ohne Modell funktioniert nur die lokale App-Hilfe.'],
    semanticIndex:['Semantischer Index aktiv','Die Vektorsuche braucht das ONNX-Embedding-Modell und Qdrant. Ohne sie sucht die App nur mit BM25-Stichwörtern.'],
    addDocuments:['PDFs hinzufügen','Dateien hochladen oder aus einer verbundenen Quelle importieren. Analysiert werden nur Originale in diesem Vorgang.'],
    processing:['Verarbeitung abgeschlossen','Warten, bis jede Datei verarbeitet ist. Fehlgeschlagene Dateien stehen unter „Braucht Aufmerksamkeit“; dort erneut starten oder entfernen. Verarbeitet heißt noch nicht geprüft.'],
    reviewFields:['Extrahierte Felder bestätigen','Jedes Ergebnis neben seiner PDF-Seite öffnen, Werte korrigieren und bestätigen. Nur Prüfende und Admins können bestätigen; spätere Schritte nutzen geprüfte Werte.'],
    resolveFindings:['Regelbefunde klären','Java-Regeln melden fehlende Dokumente und Feldkonflikte. Fehlenden Beleg ergänzen oder das Feld korrigieren, dann erneut prüfen.'],
    tables:['Tabellen erkannt','Tabellen liefert der Dokumentdienst. Erscheint keine, ein PDF mit Tabelle hinzufügen.'],
    fieldPages:['Felder mit Quellseite','Ein Feld lässt sich nur mit Quellseite erklären. Dokumente ohne analysiertes Original haben keine.'],
    askStudio:['Belege durchsuchen','In „Dokumente fragen“ eine vollständige Frage stellen und die gerankten Passagen und Quellseiten vergleichen. Ranking bedeutet Relevanz, nicht Wahrheit.'],
    askNova:['Nova zum Vorgang fragen','Nova im Analysemodus öffnen und in eigenen Worten fragen. Jede Antwort nennt Seiten und wird im Antwortverlauf gespeichert.'],
    checkClaims:['Jede Aussage an ihrer Seite prüfen','Aussagen, die eine Prüfung brauchen, haben eine fehlende oder ungültige Quelle. Seite öffnen, dann die Antwort melden oder überarbeiten.'],
    reviewTask:['Prüfaufgabe anlegen','Zu einer Antwort im Antwortverlauf eine Aufgabe mit kurzer Notiz anlegen, wenn eine Person nachfassen muss.'],
    closeTasks:['Prüfaufgaben abschließen','Eine prüfende Person übernimmt jede Aufgabe und schließt sie ab; der Verlauf hält jeden Schritt fest. Aufgaben geben nie Dokumente frei.'],
    reportError:['Falsche Antwort bei Bedarf melden','Ist ein Betrag, eine Person oder eine Quelle falsch, im Antwortverlauf melden und eine Überarbeitung vorbereiten. Die Originalantwort bleibt erhalten.'],
  },
  use:{library:'{section}: „{title}“ ausführen',nova:'Nova öffnen',page:'In {page} nutzen',trust:'{page} → {section} öffnen',templateIntro:'Die vorbereitete Anfrage bearbeiten und selbst an Nova senden.'},
  details:{
    processing:'Laufend: {active} · fehlgeschlagen: {failed}',reviewFields:'{verified} von {originals} bestätigt',resolveFindings:'Offen: {count}',askStudio:'Erfasst: {count}',
    askNova:'Gespeicherte Antworten: {count}',checkClaims:'Zu prüfen: {count}',closeTasks:'Offen: {count}',reportError:'Gemeldet: {count}',
  },
  how:{
    classification:'Versicherungsdokumente klassifizieren öffnen und auf den gelabelten PDF-Fixtures „Lokalen Vergleich starten“ wählen. F1 je Klasse von Java-Regeln und TF-IDF-Modell vergleichen; im Betrieb bleiben die Regeln maßgeblich.',
    'field-explanation':'Ein Ergebnis öffnen, ein Feld wählen und „Feld mit Nova erklären“ nutzen. Die Antwort nennt die Dokumentseite und ändert den Wert nie.',
    'injection-guard':'Eine Frage stellen und unter der Antwort auf isolierte Passagen achten: Text, der dem Modell Anweisungen geben will, bleibt außen vor, und Versuche, Regeln auszuhebeln, werden blockiert. Kein Schutz vor jeder Injection.',
    summary:'Prüfen, dass jede Aussage eine Seite nennt und fehlende Belege als fehlend benannt sind. Die Zusammenfassung bleibt ein Entwurf.',
    reconcile:'Prüfen, dass Referenzen, Personen, Daten und Beträge jeweils eine Seite nennen. Gleiche Beträge allein belegen nichts.',
    explain:'Nova trennt Quellenfakten, Regelergebnisse und Interpretation. Die Interpretation ist eine Frage an die prüfende Person, nie ein Betrugsbefund.',
    'request-documents':'Die entworfene Anfrage bearbeiten und selbst aus dem eigenen Mailprogramm senden. Die App sendet nie.',
    'review-checklist':'Die entworfene Liste aus vorhandenen Belegen, fehlenden Dokumenten und manuellen Prüfungen abarbeiten. Sie gibt den Vorgang nicht frei.',
    terminology:'Erklärt werden nur Begriffe, die in den Belegen vorkommen, jeweils mit Seite. Fehlende Begriffe bleiben unbekannt.',
    'bilingual-summary':'Die gepaarten deutschen und vietnamesischen Absätze vergleichen: gleiche Quellen, unveränderte Beträge. Entwurf, keine beglaubigte Übersetzung.',
    timeline:'Jedes Datum und jeden Zeitraum an der Seite prüfen. Es werden keine Fristen berechnet, nichts ist rechtsverbindlich.',
    obligations:'Jede Pflicht, Bedingung und jeden Ausschluss mit Seite lesen. Kein Rechtsgutachten und keine Deckungsentscheidung.',
    'privacy-review':'Die genannten Kategorien von Kennungen selbst auf jeder Seite prüfen. Nichts wird automatisch geschwärzt.',
    'app-guide':'Nova auf App-Hilfe umstellen, um eine Seite zu finden, oder auf jeder Seite „Diese Seite erklären“ wählen. Das navigiert nur: Es liest kein Dokument und ruft kein Modell auf.',
    'field-profiles':'Vor dem Hinzufügen ein Prüfprofil wählen (allgemein, Rechnung, DATEV oder Versicherungswortlaut). Jedes Ergebnis nennt fehlende Felder und Typfehler.',
    batches:'Bis zu vier Dateien auf einmal hinzufügen. Die Quittung aufbewahren; jede Datei erhält ein eigenes Ergebnis zur Prüfung.',
    lineage:'Das lokale ETL bauen: Bronze → Silver → geprüftes Gold, Qualitätsprüfungen und Power-BI-Export, dann im Control Tower verfolgen. Nur lokaler Stack, nicht in Produktion getestet.',
    anomaly:'Das Anomalie-Experiment auf geprüften Beträgen starten. Mit weniger als 30 verschiedenen Originalen je Kohorte meldet es zu wenige Daten statt eines Werts.',
    quality:'Jedes analysierte Original zeigt Felder, Tabellen und Quellseiten. Mit dem PDF vergleichen; es gibt keinen generierten Benchmark und keine Genauigkeitsprozente.',
    experiments:'Auf einem echten PDF unabhängige Sollfelder oder eine Zielseite anlegen, die Referenzversion speichern und das Experiment starten. Die fehlgeschlagenen Beispiele lesen, nicht nur den Wert.',
    'dossier-reconciliation':'Alle PDFs eines Immobilienprojekts in denselben Vorgang importieren. Regeln vergleichen Referenzen, Auftrags- plus Nachtragswert, Rechnung, offene Mängel und Fristen; jeden Befund an der Quellseite prüfen. Keine Zahlungs- oder Rechtsfreigabe.',
    transparency:'Sehen, was an Cloud-Dienste geht, was gespeichert wird und wie lange. Das Öffnen ruft keinen KI-Dienst auf.',
    governance:'Erlaubte Werkzeuge, Prompt-Versionen und Prüfpflichten je Funktion prüfen. Änderungen brauchen die Admin-Rolle.',
    performance:'Erfasste Antwortzeiten, Feedback und Prüfaktivität im geladenen Zeitraum lesen. Keine erfundenen Kosten oder Zeitersparnisse.',
  },
};

const vi:Copy={
  labels:{
    title:'Quy trình AI',
    intro:'Mỗi tính năng AI là một quy trình đầu cuối. Quy trình chưa xong sẽ hiện bước tiếp theo và việc cần làm.',
    filter:'Hiển thị quy trình',showOpen:'Chưa xong ({count})',showAll:'Tất cả ({count})',
    next:'Bước tiếp theo',operator:'Cần người vận hành',
    unlock:'Nên làm trước: {step}. Bước này giúp {count} quy trình đi tiếp.',unlockOne:'Nên làm trước: {step}. Bước này giúp 1 quy trình đi tiếp.',
    progress:'{done}/{total} bước',groupProgress:'{done}/{total} hoàn thành',
    process:'Quy trình đầu cuối ({count} bước)',processOne:'Quy trình đầu cuối (1 bước)',
    demoNote:'Chế độ minh họa chỉ hiện hướng dẫn. Đăng nhập để chạy các quy trình trên hồ sơ thật.',
    allDone:'Mọi quy trình AI trong hồ sơ này đã hoàn thành.',
    honesty:'Trạng thái lấy từ dữ liệu của hồ sơ: tài liệu, lượt xử lý, lượt tìm kiếm đã lưu và lịch sử Minh bạch AI. Bước “Bạn tự làm” không được ghi lại nên không bao giờ tính là xong.',
  },
  status:{done:'Hoàn thành',ready:'Sẵn sàng, chờ bạn',todo:'Còn thiếu bước',blocked:'Chưa bật ở đây',demo:'Chỉ hướng dẫn'},
  state:{done:'Xong',todo:'Cần làm',blocked:'Chưa bật',unknown:'Chưa kiểm tra được',user:'Bạn tự làm'},
  steps:{
    documentEngine:['Đã cấu hình công cụ đọc tài liệu','Người vận hành kết nối một công cụ đọc tài liệu, trên cloud hoặc OCR local. Chưa có công cụ thì PDF mới không đọc được.'],
    languageModel:['Đã cấu hình mô hình ngôn ngữ','Nova cần một mô hình ngôn ngữ đã cấu hình, chạy local hoặc trên cloud. Chưa có thì chỉ dùng được hướng dẫn app local.'],
    semanticIndex:['Đã bật chỉ mục ngữ nghĩa','Tìm kiếm vector cần mô hình embedding ONNX và Qdrant. Thiếu chúng, tìm kiếm chỉ dùng từ khóa BM25.'],
    addDocuments:['Thêm PDF','Tải tệp lên hoặc nhập từ nguồn đã kết nối. Chỉ bản gốc trong hồ sơ này được phân tích.'],
    processing:['Xử lý xong','Chờ đến khi mọi tệp xử lý xong. Tệp lỗi nằm trong mục “Cần xử lý”; chạy lại hoặc gỡ tệp ở đó. Xử lý xong chưa có nghĩa là đã kiểm duyệt.'],
    reviewFields:['Xác nhận trường đã trích xuất','Mở từng kết quả cạnh trang PDF, sửa giá trị và xác nhận. Chỉ người kiểm duyệt và admin mới xác nhận được; các bước sau dùng giá trị đã duyệt.'],
    resolveFindings:['Xử lý cảnh báo theo quy tắc','Quy tắc Java liệt kê tài liệu thiếu và trường mâu thuẫn. Bổ sung chứng cứ thiếu hoặc sửa trường, rồi kiểm tra lại.'],
    tables:['Đã nhận diện bảng','Bảng do công cụ đọc tài liệu trích ra. Nếu chưa có bảng nào, hãy thêm một PDF có bảng.'],
    fieldPages:['Trường có trang nguồn','Chỉ giải thích được trường có trang nguồn. Tài liệu chưa có bản gốc đã phân tích thì không có trang nguồn.'],
    askStudio:['Tìm chứng cứ','Đặt một câu hỏi đầy đủ trong Hỏi tài liệu, rồi so các đoạn được xếp hạng và trang trích dẫn. Thứ hạng là mức liên quan, không phải sự thật.'],
    askNova:['Hỏi Nova về hồ sơ này','Mở Nova ở chế độ phân tích và hỏi bằng lời của bạn. Mỗi câu trả lời có trích dẫn trang và được lưu vào lịch sử câu trả lời.'],
    checkClaims:['Kiểm tra từng nhận định với trang nguồn','Nhận định cần kiểm tra là nhận định thiếu nguồn hoặc nguồn không hợp lệ. Mở trang, rồi báo lỗi hoặc sửa câu trả lời.'],
    reviewTask:['Tạo nhiệm vụ kiểm duyệt','Từ một câu trả lời trong lịch sử, tạo nhiệm vụ kèm ghi chú ngắn khi cần người theo dõi tiếp.'],
    closeTasks:['Đóng nhiệm vụ kiểm duyệt','Người kiểm duyệt nhận từng nhiệm vụ rồi đóng lại; lịch sử giữ mọi bước. Nhiệm vụ không bao giờ phê duyệt tài liệu.'],
    reportError:['Báo câu trả lời sai khi cần','Nếu số tiền, người hoặc nguồn bị sai, báo lỗi trong lịch sử câu trả lời và chuẩn bị bản sửa. Câu trả lời gốc vẫn được giữ.'],
  },
  use:{library:'{section}: chạy “{title}”',nova:'Mở Nova',page:'Dùng trong {page}',trust:'Mở {page} → {section}',templateIntro:'Sửa yêu cầu đã chuẩn bị, rồi tự gửi cho Nova.'},
  details:{
    processing:'Đang chạy: {active} · lỗi: {failed}',reviewFields:'{verified}/{originals} đã xác nhận',resolveFindings:'Chưa xử lý: {count}',askStudio:'Đã ghi: {count} lượt',
    askNova:'Câu trả lời đã lưu: {count}',checkClaims:'Cần kiểm tra: {count}',closeTasks:'Đang mở: {count}',reportError:'Đã báo: {count}',
  },
  how:{
    classification:'Mở Phân loại tài liệu bảo hiểm và chọn “Chạy so sánh local” trên bộ PDF có nhãn. So F1 theo từng lớp giữa quy tắc Java và mô hình TF-IDF; vận hành thật vẫn dùng quy tắc.',
    'field-explanation':'Mở một kết quả, chọn trường và bấm “Giải thích trường này với Nova”. Câu trả lời trích trang tài liệu và không bao giờ đổi giá trị.',
    'injection-guard':'Đặt câu hỏi và xem các đoạn bị cách ly dưới câu trả lời: đoạn văn tìm cách ra lệnh cho mô hình bị loại ra, yêu cầu vượt quy tắc bị chặn. Không đảm bảo chặn mọi kiểu injection.',
    summary:'Kiểm tra mỗi nhận định đều trích trang và chứng cứ thiếu được ghi rõ là thiếu. Bản tóm tắt vẫn chỉ là bản nháp.',
    reconcile:'Kiểm tra mã tham chiếu, người, ngày và số tiền đều có trang nguồn. Chỉ khớp số tiền thì chưa xác minh được gì.',
    explain:'Nova tách sự kiện từ nguồn, kết quả quy tắc và phần diễn giải. Coi phần diễn giải là câu hỏi cho người kiểm duyệt, không bao giờ là kết luận gian lận.',
    'request-documents':'Sửa bản nháp yêu cầu và tự gửi từ ứng dụng thư của bạn. App không bao giờ tự gửi.',
    'review-checklist':'Làm lần lượt theo danh sách nháp: chứng cứ đã có, tài liệu thiếu và việc cần kiểm tra thủ công. Danh sách không phê duyệt hồ sơ.',
    terminology:'Chỉ giải thích nhãn có trong chứng cứ, kèm trang nguồn. Thuật ngữ không xuất hiện thì để là chưa biết.',
    'bilingual-summary':'So các đoạn tiếng Đức và tiếng Việt đi cặp: cùng nguồn, số tiền giữ nguyên. Đây là bản nháp, không phải bản dịch chứng thực.',
    timeline:'Đối chiếu từng ngày và giai đoạn với trang nguồn. Không tính hạn chót và không có giá trị pháp lý.',
    obligations:'Đọc từng nghĩa vụ, điều kiện và loại trừ kèm trang nguồn. Đây không phải ý kiến pháp lý hay quyết định bảo hiểm.',
    'privacy-review':'Tự kiểm tra các loại định danh được liệt kê trên từng trang. Không có gì được tự động che.',
    'app-guide':'Chuyển Nova sang “Hướng dẫn app” để tìm trang, hoặc bấm “Hướng dẫn trang này” ở bất kỳ trang nào. Chức năng này chỉ điều hướng: không đọc tài liệu, không gọi mô hình.',
    'field-profiles':'Chọn hồ sơ kiểm tra (chung, hóa đơn, DATEV hoặc điều khoản bảo hiểm) trước khi thêm tệp. Mỗi kết quả liệt kê trường thiếu và sai kiểu dữ liệu.',
    batches:'Thêm tối đa bốn tệp một lần. Giữ biên nhận; mỗi tệp có kết quả riêng để kiểm duyệt.',
    lineage:'Chạy ETL local: Bronze → Silver → Gold đã duyệt, kiểm tra chất lượng và bản xuất Power BI, rồi theo dõi trong Control Tower. Chỉ chạy trên stack local, chưa kiểm thử production.',
    anomaly:'Chạy thí nghiệm bất thường trên số tiền đã duyệt. Dưới 30 bản gốc khác nhau mỗi nhóm, kết quả báo thiếu dữ liệu thay vì cho điểm.',
    quality:'Mỗi bản gốc đã phân tích liệt kê trường, bảng và trang nguồn. So với PDF; không có benchmark tự tạo hay phần trăm chính xác.',
    experiments:'Trên một PDF thật, thêm trường kỳ vọng độc lập hoặc trang mục tiêu, lưu phiên bản tham chiếu rồi chạy thí nghiệm. Đọc các ví dụ sai, không chỉ nhìn điểm số.',
    'dossier-reconciliation':'Nhập toàn bộ PDF của một dự án bất động sản vào cùng một hồ sơ. Quy tắc so mã tham chiếu, giá trị đơn hàng cộng phụ lục, hóa đơn, lỗi nghiệm thu còn mở và hạn chót; kiểm tra từng phát hiện tại trang nguồn. Không phê duyệt thanh toán hay pháp lý.',
    transparency:'Xem dữ liệu nào gửi lên dịch vụ cloud, dữ liệu nào được lưu và lưu bao lâu. Mở trang không gọi dịch vụ AI nào.',
    governance:'Xem công cụ được phép, phiên bản prompt và yêu cầu kiểm duyệt của từng tính năng. Muốn thay đổi cần vai trò admin.',
    performance:'Xem thời gian phản hồi, phản hồi người dùng và hoạt động kiểm duyệt đã ghi trong khoảng đã tải. Không có chi phí hay thời gian tiết kiệm tự bịa.',
  },
};

export const workflowLanguages={en,de,vi};
export function workflowText(locale:string):Copy{return workflowLanguages[locale==='vi'?'vi':locale==='de'?'de':'en'];}

/** A short count next to a step, only when it tells the user something (for example "2 of 4 confirmed"). */
export function stepDetail(step:WorkflowStep,facts:WorkflowFacts,text:Copy['details']){
  const fill=(template:string,values:Record<string,number>)=>template.replace(/\{(\w+)\}/g,(match,key:string)=>key in values?String(values[key]):match);
  switch(step){
    case 'processing':return facts.active||facts.failed?fill(text.processing,{active:facts.active,failed:facts.failed}):undefined;
    case 'reviewFields':return facts.originals?fill(text.reviewFields,{verified:facts.verified,originals:facts.originals}):undefined;
    case 'resolveFindings':return facts.issues?fill(text.resolveFindings,{count:facts.issues}):undefined;
    case 'askStudio':return facts.searches?fill(text.askStudio,{count:facts.searches}):undefined;
    case 'askNova':return facts.answers?fill(text.askNova,{count:facts.answers}):undefined;
    case 'checkClaims':return facts.claimsNeedingReview?fill(text.checkClaims,{count:facts.claimsNeedingReview}):undefined;
    case 'closeTasks':return facts.openTasks?fill(text.closeTasks,{count:facts.openTasks}):undefined;
    case 'reportError':return facts.feedback?fill(text.reportError,{count:facts.feedback}):undefined;
    default:return undefined;
  }
}
