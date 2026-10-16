import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {NovaChatSurface} from "@/components/workspace/NovaChatSurface";
import {novaWidgetText} from "./nova-widget-language";
import {readFileSync} from "node:fs";

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
  it("uses the same local portrait in the header and minimized launcher", () => {
    const html=render(false);
    expect(html.match(/src="\/images\/nova-avatar-v2.webp"/g)).toHaveLength(2);
    expect(html).toContain('alt=""');
    expect(html).not.toContain('src="http');
    const asset=readFileSync('public/images/nova-avatar-v2.webp');
    expect(asset.subarray(0,4).toString()).toBe('RIFF');
    expect(asset.subarray(8,12).toString()).toBe('WEBP');
    expect(asset.byteLength).toBeLessThan(100_000);
  });
  it.each(['en','de','vi'])("discloses a fictional AI identity in %s",locale=>{
    const t=novaWidgetText(locale);
    const html=renderToStaticMarkup(createElement(NovaChatSurface,{title:'Nova',locale,open:true,onOpen:()=>{},close:()=>{}}));
    expect(t.subtitle).toMatch(/AI|KI/);
    expect(t.portraitDisclosure).toMatch(/AI|KI/);
    expect(html).toContain(t.portraitDisclosure);
  });
});
