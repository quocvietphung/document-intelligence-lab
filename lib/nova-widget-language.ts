const labels = {
  en: {open: "Open Nova chat", minimize: "Minimize Nova chat", expand: "Expand reading area", restore: "Restore compact window", context: "AI and case context", subtitle: "AI document assistant", portraitDisclosure: "Nova is an AI assistant with an AI-generated fictional portrait, not a human advisor.", details: "How Nova works"},
  de: {open: "Nova-Chat öffnen", minimize: "Nova-Chat minimieren", expand: "Lesebereich vergrößern", restore: "Kompaktes Fenster wiederherstellen", context: "KI und Vorgangskontext", subtitle: "KI-Dokumentenassistentin", portraitDisclosure: "Nova ist eine KI-Assistentin mit einem KI-generierten fiktiven Porträt, keine menschliche Beraterin.", details: "So funktioniert Nova"},
  vi: {open: "Mở trò chuyện với Nova", minimize: "Thu gọn trò chuyện Nova", expand: "Mở rộng vùng đọc", restore: "Trở lại cửa sổ gọn", context: "AI và ngữ cảnh hồ sơ", subtitle: "Trợ lý AI tài liệu", portraitDisclosure: "Nova là trợ lý AI với chân dung nhân vật hư cấu do AI tạo, không phải chuyên viên thật.", details: "Cách Nova hoạt động"},
};
export function novaWidgetText(locale: string) {
  return labels[locale as keyof typeof labels] || labels.en;
}
