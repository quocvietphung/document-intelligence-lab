import type {UIMessage} from "ai";

const greetings={
  en:"Hello! I'm Nova. Wishing you a wonderful day! How can I help you today?",
  de:"Hallo! Ich bin Nova. Ich wünsche dir einen schönen Tag! Wobei kann ich dir heute helfen?",
  vi:"Chào bạn! Mình là Nova. Chúc bạn một ngày tốt lành! Bạn cần mình hỗ trợ gì hôm nay?",
};
/** UI-only greeting: never contacts Azure or represents a generated answer. */
export function novaGreeting(locale:string) {return greetings[locale==="de"?"de":locale==="vi"?"vi":"en"];}
export function novaWelcomeMessage(locale:string):UIMessage {
  return {id:"nova-welcome",role:"assistant",parts:[{type:"text",text:novaGreeting(locale)}]};
}
export function welcomeSessionKey(auth:{ready:boolean;authenticated:boolean;mode:string;tenantId:string;displayName:string}) {
  return auth.ready&&auth.authenticated?JSON.stringify([auth.mode,auth.tenantId,auth.displayName]):undefined;
}
