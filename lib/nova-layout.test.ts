import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {NovaChatContext,NovaChatSurface} from "@/components/workspace/NovaChatSurface";
import {NovaConversation,NovaSuggestions} from "@/components/workspace/NovaConversation";
import {NovaComposer} from "@/components/workspace/NovaComposer";
import {novaViewportSpace} from "./nova-layout";
import {novaWidgetText} from "./nova-widget-language";

describe("Nova reading space",()=>{
  it("accounts for a keyboard without placing the composer behind it",()=>{
    expect(novaViewportSpace(844,844)).toEqual({height:844,bottom:0});
    expect(novaViewportSpace(844,410)).toEqual({height:410,bottom:434});
    expect(novaViewportSpace(844,410,50)).toEqual({height:410,bottom:384});
    expect(novaViewportSpace(720,900)).toEqual({height:720,bottom:0});
    expect(novaViewportSpace(720,400,500)).toEqual({height:400,bottom:0});
  });
  it.each(["en","de","vi"])("offers accessible expansion and compact-window labels in %s",locale=>{
    const t=novaWidgetText(locale);
    const html=renderToStaticMarkup(createElement(NovaChatSurface,{locale,title:"Nova",open:true,onOpen:()=>{},close:()=>{}}));
    expect(html).toContain(`aria-label="${t.expand}"`);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-modal="false"');
    expect(t.restore.length).toBeGreaterThan(5);
  });
  it("keeps metadata and suggestions inside the single message scroller",()=>{
    const history=createElement(NovaConversation,{locale:"vi",open:true,messages:[],label:"Nova"},
      createElement(NovaChatContext,{key:"context",locale:"vi",caseId:"CR-TEST",demo:true}),
      createElement("article",{key:"answer"},"A long answer"),
      createElement(NovaSuggestions,{key:"suggestions",locale:"vi",page:"studio",select:()=>{}}),
    );
    const html=renderToStaticMarkup(history);
    expect(html).toContain('role="log"');expect(html).toContain('tabindex="0"');
    expect(html).toContain('class="nova-conversation-messages"><details class="nova-chat-context"');
    expect(html).toContain("A long answer");expect(html).toContain('class="nova-suggestions"');
    expect(html).not.toContain('open=""');
    expect(html).toContain("Không tự động gửi lên AI");
  });
  it("does not reserve another fixed model-identity strip above the conversation",()=>{
    const html=renderToStaticMarkup(createElement(NovaChatSurface,{locale:"en",title:"Nova",open:true,onOpen:()=>{},close:()=>{}},createElement("p",null,"History")));
    expect(html).toContain('class="nova-chat-content"><p>History</p>');
    expect(html).not.toContain('class="ai-chat-identity"');
  });
  it("does not overlay the latest-message control on answer text",()=>{
    const css=readFileSync("app/globals.css","utf8"),rule=css.match(/\.nova-latest\{([^}]+)\}/)?.[1];
    expect(rule).toContain("position:static");expect(rule).toContain("flex-shrink:0");
    expect(rule).not.toContain("position:absolute");
  });
  it("renders the controls in the same pinned composer dock as the input",()=>{
    const html=renderToStaticMarkup(createElement(NovaComposer,{id:"layout-input",locale:"en",label:"Question",sendLabel:"Send",text:"Draft",onChange:()=>{},onSubmit:()=>{},actions:createElement("button",{type:"button"},"Clear")}));
    expect(html).toContain('class="nova-composer-dock"');expect(html).toContain('class="nova-composer-footer"');
    expect(html).toContain('class="nova-chat-controls"');expect(html).toContain('aria-describedby="layout-input-hint"');
  });
  it("keeps both real and demo suggestions in the conversation, not above the dock",()=>{
    for(const file of ["components/workspace/CreditWorkspace.tsx","components/workspace/DemoCopilot.tsx"]){
      const source=readFileSync(file,"utf8"),start=source.indexOf("<NovaConversation");
      expect(start).toBeGreaterThan(-1);
      const end=source.indexOf("</NovaConversation>",start),suggestions=source.indexOf("<NovaSuggestions",start),composer=source.indexOf("<NovaComposer",start);
      expect(suggestions).toBeLessThan(end);expect(composer).toBeGreaterThan(end);
    }
  });
});
