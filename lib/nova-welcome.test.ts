import {describe,expect,it,vi} from "vitest";
import {novaGreeting,novaWelcomeMessage,welcomeSessionKey} from "./nova-welcome";
import {caseChatPayload} from "./credit-chat";
describe("Nova proactive welcome",()=>{
  it("greets first in each language without invoking a provider",()=>{
    const network=vi.spyOn(globalThis,"fetch");
    expect(novaGreeting("vi")).toContain("Chúc bạn một ngày tốt lành");
    expect(novaGreeting("de")).toContain("schönen Tag");
    expect(novaGreeting("en")).toContain("wonderful day");
    expect(novaGreeting("unknown")).toBe(novaGreeting("en"));
    expect(novaWelcomeMessage("vi")).toEqual({id:"nova-welcome",role:"assistant",parts:[{type:"text",text:novaGreeting("vi")}]});
    expect(network).not.toHaveBeenCalled();network.mockRestore();
  });
  it("does not send the local greeting as a model question",()=>{
    const hello=novaWelcomeMessage("en");
    expect(caseChatPayload([hello],"C","en").messages).toEqual([]);
    expect(caseChatPayload([hello,{id:"q",role:"user",parts:[{type:"text",text:"What evidence is missing?"}]}],"C","en").messages).toHaveLength(1);
  });
  it("welcomes authenticated identities, not token refreshes or signed-out visitors",()=>{
    const auth={ready:true,authenticated:true,mode:"keycloak",tenantId:"demo",displayName:"Advisor"};
    expect(welcomeSessionKey({...auth,authenticated:false})).toBeUndefined();
    expect(welcomeSessionKey({...auth,ready:false})).toBeUndefined();
    expect(welcomeSessionKey({...auth})).toBe(welcomeSessionKey(auth));
    expect(welcomeSessionKey({...auth,displayName:"Reviewer"})).not.toBe(welcomeSessionKey(auth));
  });
});
