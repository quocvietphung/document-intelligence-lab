const labels = {
  en: {open: "Open Nova chat", minimize: "Minimize Nova chat", expand: "Expand reading area", restore: "Restore compact window", context: "AI and case context", subtitle: "Your case assistant", details: "How Nova works"},
  de: {open: "Nova-Chat öffnen", minimize: "Nova-Chat minimieren", expand: "Lesebereich vergrößern", restore: "Kompaktes Fenster wiederherstellen", context: "KI und Vorgangskontext", subtitle: "Deine Fallassistentin", details: "So funktioniert Nova"},
  vi: {open: "Mở trò chuyện với Nova", minimize: "Thu gọn trò chuyện Nova", expand: "Mở rộng vùng đọc", restore: "Trở lại cửa sổ gọn", context: "AI và ngữ cảnh hồ sơ", subtitle: "Trợ lý hồ sơ của bạn", details: "Cách Nova hoạt động"},
};
export function novaWidgetText(locale: string) {
  return labels[locale as keyof typeof labels] || labels.en;
}
