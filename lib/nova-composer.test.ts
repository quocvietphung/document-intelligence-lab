import {describe, expect, it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NovaComposer} from "@/components/workspace/NovaComposer";
import {novaEnterAction, novaKeyboardHint} from "./nova-composer";

describe("Nova keyboard submission", () => {
  it("submits an enabled plain Enter", () => expect(novaEnterAction({key: "Enter"}, true)).toBe("submit"));
  it("leaves Shift+Enter and other keys to the textarea", () => {
    expect(novaEnterAction({key: "Enter", shiftKey: true}, true)).toBe("newline");
    expect(novaEnterAction({key: "a"}, true)).toBe("newline");
  });
  it("does not submit composition input or Safari's composition Enter", () => {
    expect(novaEnterAction({key: "Enter", isComposing: true}, true)).toBe("newline");
    expect(novaEnterAction({key: "Enter", keyCode: 229}, true)).toBe("newline");
  });
  it("ignores held Enter and disabled/empty submission", () => {
    expect(novaEnterAction({key: "Enter", repeat: true}, true)).toBe("ignore");
    expect(novaEnterAction({key: "Enter"}, false)).toBe("ignore");
  });
  it.each(["en", "de", "vi"])("has an accessible localized hint and disabled blank send in %s", locale => {
    const html = renderToStaticMarkup(createElement(NovaComposer, {id: "test-chat", locale, label: "Question", sendLabel: "Send", text: "  ", onChange: () => {}, onSubmit: () => {}}));
    expect(html).toContain('aria-describedby="test-chat-hint"');
    expect(html).toContain(novaKeyboardHint(locale));
    expect(html).toContain('disabled=""');
  });
});
