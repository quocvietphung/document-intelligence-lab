import catalog from "../services/credit-api/src/main/resources/nova-features.json";
import {z} from "zod";
export const workspaceTabs=["overview","studio","documents","pipeline","controls","banking","evaluation","operations","audit"] as const;
export type WorkspaceTab=typeof workspaceTabs[number];
export const guideSchema=z.object({features:z.array(z.enum(workspaceTabs)).max(9),query:z.string().max(2000)});
export type NovaGuide=z.infer<typeof guideSchema>;
const normalize=(text:string)=>text.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/ß/g,"ss");
export function novaFeature(id:WorkspaceTab,locale:string){const row=catalog.find(f=>f.id===id)!;return locale==="de"?row.de:locale==="vi"?row.vi:row.en;}
export function workspaceTarget(hash:string):WorkspaceTab|undefined{const id=hash.replace(/^#/,"");return workspaceTabs.find(tab=>tab===id);}
export function featureHref(locale:string,id:WorkspaceTab){return `/${["en","de","vi"].includes(locale)?locale:"en"}#${id}`;}
export function novaGuideFor(question:string,current?:WorkspaceTab):NovaGuide|undefined {
  const q=normalize(question);
  // User-authored requests only. Document/provider text is never interpreted as an action.
  if(/ignore.*instruction|reveal.*secret|system prompt|bo qua.*huong dan|javascript:/.test(q))return;
  const ids=catalog.filter(f=>f.aliases.some(a=>q.includes(normalize(a)))).map(f=>f.id as WorkspaceTab);
  if(current&&!ids.length&&/this (page|section)|muc nay|trang nay|dieser bereich|diese seite/.test(q))return {features:[current],query:question};
  // Location questions about payroll AI are product help, not a cloud extraction request.
  if(/phan nao|muc nao|o dau|where|wo .*|welcher bereich/.test(q)&&/ai|chuc nang|tinh nang|itnsh nang|feature|funktion/.test(q)&&/bang luong|payroll|payslip|gehaltsabrechnung|datev/.test(q))return {features:["documents","pipeline","controls"],query:question};
  const help=/what.*(can|does|is|feature)|how.*(use|open|upload)|show|open|where|guide|help|features|search|co.*gi|cach|huong dan|o dau|chuc nang|mo |dieu huong|tim |was.*(kann|ist|gibt)|wie|offne|funktion|zeig|suchen/.test(q);
  if(ids.length&&help)return {features:ids,query:question};
  if(/all.*features|app.*(can|features)|tat ca.*chuc nang|app.*co.*gi|ung dung.*co.*gi|alle.*funktion/.test(q))return {features:[...workspaceTabs],query:question};
}
export function novaGuideIntro(locale:string){return locale==="vi"?"Mình hướng dẫn bạn nhé. Đây là các chức năng thực sự có trong app. Bạn có thể mở mục tương ứng hoặc dùng công cụ chỉ đọc ngay bên dưới; mình không tự thay đổi hồ sơ.":locale==="de"?"Gern helfe ich dir! Das sind die tatsächlich vorhandenen Funktionen. Öffne den Bereich oder nutze unten ein lesendes Werkzeug. Ich ändere keine Vorgänge automatisch.":"Happy to help! These are the app's actual features. Open a section or use a read-only tool below. I do not automatically change case data.";}
export const guideLabels={
  en:{open:"Open section",read:"Show current data here",search:"Search evidence here",query:"Evidence question",run:"Search",loading:"Reading…",error:"Unable to read. Check your session and try again.",demo:"Browser fixtures · no Azure call",live:"Current case · read-only",empty:"No records available",sources:"Evidence results",actions:"Explore app features",mode:"App guide · no cloud request",upload:"Open upload & DATEV library"},
  de:{open:"Bereich öffnen",read:"Aktuelle Daten hier ansehen",search:"Belege hier suchen",query:"Belegfrage",run:"Suchen",loading:"Wird gelesen…",error:"Lesen nicht möglich. Sitzung prüfen und erneut versuchen.",demo:"Browser-Beispiele · kein Azure-Aufruf",live:"Aktueller Vorgang · nur lesen",empty:"Keine Einträge vorhanden",sources:"Belegergebnisse",actions:"App-Funktionen erkunden",mode:"App-Anleitung · keine Cloud-Anfrage",upload:"Upload & DATEV-Bibliothek öffnen"},
  vi:{open:"Mở mục này",read:"Xem dữ liệu hiện tại tại đây",search:"Tìm chứng cứ ngay tại đây",query:"Câu hỏi về chứng cứ",run:"Tìm",loading:"Đang đọc…",error:"Chưa đọc được. Kiểm tra phiên đăng nhập rồi thử lại.",demo:"Dữ liệu mẫu trình duyệt · không gọi Azure",live:"Hồ sơ hiện tại · chỉ đọc",empty:"Chưa có bản ghi",sources:"Kết quả chứng cứ",actions:"Khám phá chức năng app",mode:"Hướng dẫn app · không gửi cloud",upload:"Mở tải lên & thư viện DATEV"},
};
export function novaGuideLabels(locale:string){return guideLabels[locale as keyof typeof guideLabels]||guideLabels.en;}
