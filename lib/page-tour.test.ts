import {readFileSync} from "node:fs";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {NovaChatSurface} from "@/components/workspace/NovaChatSurface";
import {pageTour,pageTourPages,pageTourPosition,pageTourHole} from "./page-tour";

describe("native page walkthroughs",()=>{
  it('only offers DATEV steps in banking, not insurance or general dossiers',()=>{
    for(const domain of ['insurance','general'])for(const page of ['documents','pipeline'] as const) {
      expect(pageTour('en',page,domain).steps.every(step=>!step.id.includes('datev'))).toBe(true);
      expect(pageTour('en',page,domain).steps.some(step=>step.id.endsWith('upload'))).toBe(true);
    }
    expect(pageTour('en','documents','banking').steps.some(step=>step.id==='datev-preview')).toBe(true);
  });
  it("covers all ten pages with localized instructions and static selectors",()=>{
    expect(pageTourPages()).toHaveLength(10);
    for(const page of pageTourPages())for(const locale of ["en","de","vi"]){
      const guide=pageTour(locale,page);
      expect(guide.steps.length).toBeGreaterThanOrEqual(2);
      expect(new Set(guide.steps.map(step=>step.id)).size).toBe(guide.steps.length);
      for(const step of guide.steps){
        expect(step.selector).toBe(`[data-page-tour="${step.id}"]`);
        expect(step.title.length).toBeGreaterThan(5);
        expect(step.body.length).toBeGreaterThan(40);
      }
      expect(guide.labels.note.length).toBeGreaterThan(40);
    }
    expect(pageTour("unknown","studio")).toEqual(pageTour("en","studio"));
  });
  it("walks AI Studio through input, execution, evidence, explanation and traces",()=>{
    expect(pageTour("en","studio").steps.map(step=>step.id)).toEqual([
      "menu-studio","studio-query","studio-suggestions","studio-search","studio-results","studio-nova","studio-traces",
    ]);
    expect(pageTour("en","studio").steps[5].body).toContain("does not send it automatically");
    expect(pageTour("en","studio").steps[4].body).toContain("not an accuracy percentage");
  });
  it("has actual source anchors for every tour target",()=>{
    const sources=["CreditWorkspace","PlatformWorkbench","DocumentCorpus","BankingWorkbench","PayrollSamples","WorkspaceAIOverview","DocumentResults","DocumentResearchPanel"].map(name=>readFileSync(`components/workspace/${name}.tsx`,"utf8")).join("\n");
    for(const page of pageTourPages())for(const step of pageTour("en",page).steps){
      expect(sources).toContain(step.id.startsWith("menu-")?'data-page-tour={`menu-${id}`}':step.id);
    }
  });
  it("uses a body portal and never executes AI, upload or automatic clicks",()=>{
    const source=readFileSync("components/workspace/PageTour.tsx","utf8");
    expect(source).toContain("createPortal");
    expect(source).toContain("document.body");
    expect(source).toContain("scrollIntoView");
    expect(source).not.toMatch(/fetch\(|\.click\(|\.requestSubmit\(|dispatchEvent\(/);
    expect(source).toContain("page-guide-button");
  });
  it("keeps Nova chat separate; the compass starts the current page guide",()=>{
    const html=renderToStaticMarkup(createElement(NovaChatSurface,{
      title:"Nova",locale:"en",open:false,onOpen:()=>{},close:()=>{},
      onPageGuide:()=>{},pageGuideLabel:"Guide this page · AI Studio",
    },createElement("p",null,"Existing draft")));
    expect(html).toContain('class="nova-guide-launcher"');
    expect(html).toContain("Guide this page · AI Studio");
    expect(html).toContain("Existing draft");
    expect(html).not.toContain("nova-tour-menu");
    expect(html).not.toContain("page-tour-coach");
  });
});
describe("coachmark positioning",()=>{
  it("places the tooltip below a control when there is space",()=>{
    expect(pageTourPosition({left:300,top:100,width:250,height:40},{width:340,height:280},{width:1200,height:800})).toEqual({left:300,top:154,width:340});
  });
  it("places it above a low control without covering it",()=>{
    const result=pageTourPosition({left:300,top:700,width:250,height:40},{width:340,height:280},{width:1200,height:800});
    expect(result.top+280).toBeLessThan(700);
  });
  it("places it on an available side of a tall control",()=>{
    const result=pageTourPosition({left:30,top:25,width:250,height:730},{width:340,height:280},{width:1200,height:800});
    expect(result.left).toBeGreaterThan(280);
  });
  it("clamps coachmarks to desktop and mobile viewports",()=>{
    for(const viewport of [{width:390,height:844},{width:320,height:568},{width:1440,height:900}]){
      for(const target of [null,{left:-30,top:-10,width:1200,height:1500},{left:viewport.width-80,top:viewport.height-30,width:100,height:70}]){
        const position=pageTourPosition(target,{width:340,height:300},viewport);
        expect(position.left).toBeGreaterThanOrEqual(12);
        expect(position.top).toBeGreaterThanOrEqual(12);
        expect(position.left+position.width).toBeLessThanOrEqual(viewport.width-12);
        expect(position.top+300).toBeLessThanOrEqual(viewport.height-12);
      }
    }
  });
  it("clips the spotlight to the viewport and pads visible controls",()=>{
    expect(pageTourHole({left:100,top:100,width:200,height:40},{width:390,height:844})).toEqual({left:94,top:94,width:212,height:52});
    expect(pageTourHole({left:-30,top:-40,width:1000,height:1200},{width:390,height:844})).toEqual({left:0,top:0,width:390,height:844});
  });
});
