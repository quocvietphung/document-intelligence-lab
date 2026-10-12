const labels = {
  en: {open: "Open Nova chat", minimize: "Minimize Nova chat", subtitle: "Your case assistant", details: "How Nova works"},
  de: {open: "Nova-Chat öffnen", minimize: "Nova-Chat minimieren", subtitle: "Deine Fallassistentin", details: "So funktioniert Nova"},
  vi: {open: "Mở trò chuyện với Nova", minimize: "Thu gọn trò chuyện Nova", subtitle: "Trợ lý hồ sơ của bạn", details: "Cách Nova hoạt động"},
};
export function novaWidgetText(locale: string) {
  return labels[locale as keyof typeof labels] || labels.en;
}
