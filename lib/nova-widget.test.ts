import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {NovaChatSurface} from "@/components/workspace/NovaChatSurface";
import {novaWidgetText} from "./nova-widget-language";

function render(open: boolean) {
  return renderToStaticMarkup(createElement(NovaChatSurface, {
    title: "Nova", locale: "en", open, onOpen: () => {}, close: () => {},
  }, createElement("p", null, "Existing conversation")));
}
describe("Nova floating chat", () => {
  it("is a non-modal dialog, without a page-covering backdrop", () => {
    const html = render(true);
    expect(html).toContain('aria-modal="false"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain("modal-backdrop");
  });
  it("keeps the conversation mounted while minimized", () => {
    const html = render(false);
    expect(html).toContain('hidden=""');
    expect(html).toContain("Existing conversation");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Open Nova chat");
  });
  it("has localized accessible controls", () => {
    expect(novaWidgetText("vi").open).toBe("Mở trò chuyện với Nova");
    expect(novaWidgetText("de").minimize).toBe("Nova-Chat minimieren");
    expect(novaWidgetText("unknown")).toEqual(novaWidgetText("en"));
  });
});
