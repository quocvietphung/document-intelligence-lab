/** Do not submit Enter while an IME is choosing a character (including Safari's 229). */
export function novaEnterAction(key: {key: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number; repeat?: boolean}, enabled: boolean): "submit" | "ignore" | "newline" {
  if (key.key !== "Enter" || key.shiftKey || key.isComposing || key.keyCode === 229) return "newline";
  return enabled && !key.repeat ? "submit" : "ignore";
}

export function novaKeyboardHint(locale: string) {
  return locale === "vi" ? "Enter để gửi · Shift+Enter để xuống dòng" : locale === "de" ? "Enter zum Senden · Shift+Enter für eine neue Zeile" : "Enter to send · Shift+Enter for a new line";
}
