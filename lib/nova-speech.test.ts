import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {detectLanguage,pickVoice,speakAnswer,speechChunks,speechLanguages,speechSegments,speechText,stopSpeech,stopSpeechWithPrefix,subscribeSpeech,type SpeechState} from './nova-speech';
import {NovaCopyAnswer} from '@/components/workspace/NovaConversation';

const voice=(lang:string,localService:boolean,name=lang)=>({lang,localService,name,default:false});

describe('spoken form of a Nova answer',()=>{
  it('drops Markdown, links and citation IDs but keeps amounts, dates, units and names',()=>{
    const answer=['## Ergebnis','- **Netto-Verdienst:** 2.967,11 EUR [doc-robert:p1]','- *Auszahlungsbetrag*: 2.882,11 EUR [doc-robert:p1][case-summary]',
      'Fertigstellung am 20.11.2026, 4,69 % über Plan, 2461,54 €/m² → Robert Muster.','Siehe [Bericht](https://example.org/a?b=1) und https://example.org/raw.'].join('\n');
    const spoken=speechText(answer,'de');
    for(const kept of ['2.967,11 EUR','2.882,11 EUR','20.11.2026','4,69 %','2461,54 €/m²','Robert Muster','Netto-Verdienst','Auszahlungsbetrag'])expect(spoken).toContain(kept);
    for(const dropped of ['**','##','[doc-robert:p1]','case-summary','https://','example.org','→'])expect(spoken).not.toContain(dropped);
    expect(spoken).toContain('Siehe Bericht und Link.');
  });
  it('keeps bracketed numbers that are not citations and reads tables as lists',()=>{
    expect(speechText('Laufzeit [2026] bis Q4','en')).toContain('[2026]');
    expect(speechText('| Feld | Wert |\n|---|---|\n| Netto | 2.967,11 EUR |','de')).toBe('Feld, Wert. Netto, 2.967,11 EUR.');
    expect(speechText('Xem https://a.example','vi')).toBe('Xem đường liên kết.');
    expect(speechText('## Ergebnis\n- Netto: 2.967,11 EUR','de')).toBe('Ergebnis. Netto: 2.967,11 EUR.');
    expect(speechText('The order sum is 184.450,00 EUR [doc-1:p1].\nSupporting source IDs: [doc-1:p1] [doc-2:p1]\nQuelle: [doc-1:p1]','en')).toBe('The order sum is 184.450,00 EUR.');
  });
  it('splits long answers at sentence boundaries without breaking numbers',()=>{
    const chunks=speechChunks('Netto 2.967,11 EUR. Auszahlung 2.882,11 EUR! Ende?');
    expect(chunks).toEqual(['Netto 2.967,11 EUR.','Auszahlung 2.882,11 EUR!','Ende?']);
    const long=speechChunks(`${'Wort, '.repeat(60)}Schluss.`,80);
    expect(long.every(chunk=>chunk.length<=80)).toBe(true);expect(long.join(' ').replace(/\s+/g,' ')).toContain('Schluss.');
  });
});

describe('answer language',()=>{
  it('follows the answer text, not the interface, and keeps the interface language when unclear',()=>{
    expect(detectLanguage('The change-order amount for offer NA-2026-007 is 18.400,00 EUR netto, as stated in the offer.','de')).toBe('en');
    expect(detectLanguage('Das Richtfest ist am 14.11.2026 geplant und nicht verschoben.','en')).toBe('de');
    expect(detectLanguage('Hóa đơn nêu tổng tiền sau thuế là 49.980,00 EUR.','de')).toBe('vi');
    expect(detectLanguage('2.967,11 EUR.','de')).toBe('de');
  });
  it('reads a German–Vietnamese summary with one voice per language',()=>{
    const segments=speechSegments('Der Netto-Verdienst beträgt 2.967,11 EUR und ist nicht die Auszahlung [doc:p1].\nLương ròng là 2.967,11 EUR, không phải số tiền chi trả [doc:p1].','de');
    expect(segments.map(s=>s.language)).toEqual(['de','vi']);
    expect(segments[1].text).toBe('Lương ròng là 2.967,11 EUR, không phải số tiền chi trả.');
  });
});

describe('local voice selection',()=>{
  it('uses only on-device voices in the answer language, preferring the regional default',()=>{
    const voices=[voice('vi-VN',false,'Google Tiếng Việt'),voice('de-DE',false,'Google Deutsch'),voice('de-AT',true,'Lokal AT'),voice('de-DE',true,'Anna'),voice('en-GB',true,'Daniel'),voice('en-US',true,'Samantha')];
    expect(pickVoice(voices,'de')?.name).toBe('Anna');
    expect(pickVoice(voices,'en')?.name).toBe('Samantha');
    expect(pickVoice(voices,'vi')).toBeUndefined();
    expect(pickVoice([voice('vi_VN',true,'Linh')],'vi')?.name).toBe('Linh');
    // Sound-effect voices are skipped; the system default of the region wins.
    expect(pickVoice([voice('en-US',true,'Bad News'),voice('en-US',true,'Albert'),voice('en-US',true,'Aaron')],'en')?.name).toBe('Aaron');
    expect(pickVoice([voice('de-DE',true,'Anna'),{...voice('de-DE',true,'Helena'),default:true}],'de')?.name).toBe('Helena');
  });
  it('has every label, status and message in English, German and Vietnamese',()=>{
    for(const copy of Object.values(speechLanguages))expect(Object.keys(copy).sort()).toEqual(Object.keys(speechLanguages.en).sort());
    expect(speechLanguages.vi.listen).toBe('Nghe câu trả lời');
  });
});

describe('one playback at a time',()=>{
  let spoken:string[],cancelled:number,voices:ReturnType<typeof voice>[];
  beforeEach(()=>{
    spoken=[];cancelled=0;voices=[voice('vi-VN',true,'Linh'),voice('de-DE',true,'Anna')];
    class Utterance{text:string;voice?:unknown;lang='';onend?:()=>void;onerror?:(event:{error:string})=>void;constructor(text:string){this.text=text;}}
    vi.stubGlobal('SpeechSynthesisUtterance',Utterance);
    vi.stubGlobal('window',{speechSynthesis:{getVoices:()=>voices,speak:(u:Utterance)=>spoken.push(u.text),cancel:()=>{cancelled++;},addEventListener(){},removeEventListener(){}},setTimeout,addEventListener(){}});
  });
  afterEach(()=>{stopSpeech();vi.unstubAllGlobals();});
  it('speaks after a click, replaces the previous answer and stops on request',async()=>{
    const states:SpeechState[]=[];const unsubscribe=subscribeSpeech(state=>states.push(state));
    await speakAnswer('chat-1','Lương ròng 2.967,11 EUR [doc:p1].','vi');
    expect(spoken).toEqual(['Lương ròng 2.967,11 EUR.']);expect(states.at(-1)).toEqual({id:'chat-1',status:'speaking'});
    await speakAnswer('history-2','Auszahlung 2.882,11 EUR.','de');
    expect(cancelled).toBeGreaterThan(0);expect(states.at(-1)).toEqual({id:'history-2',status:'speaking'});
    stopSpeechWithPrefix('chat-');expect(states.at(-1)?.id).toBe('history-2');
    stopSpeech('history-2');expect(states.at(-1)).toEqual({id:'history-2',status:'idle'});
    unsubscribe();
  });
  it('uses the answer language for a stored answer shown in another interface language',async()=>{
    voices=[voice('de-DE',true,'Anna'),voice('en-US',true,'Samantha')];
    const used:string[]=[];const synth=(window as unknown as {speechSynthesis:{speak:(u:{text:string;voice:{name:string}})=>void}}).speechSynthesis;
    synth.speak=u=>{spoken.push(u.text);used.push(u.voice.name);};
    await speakAnswer('history-4','The invoice does not state a payment date [doc:p1].','de');
    expect(used).toEqual(['Samantha']);expect(spoken).toEqual(['The invoice does not state a payment date.']);
  });
  it('reports a missing local voice instead of using a remote one',async()=>{
    voices=[voice('vi-VN',false,'Google Tiếng Việt')];
    const states:SpeechState[]=[];const unsubscribe=subscribeSpeech(state=>states.push(state));
    await speakAnswer('chat-3','Xin chào.','vi');
    expect(spoken).toEqual([]);expect(states.at(-1)).toEqual({id:'chat-3',status:'no-voice',language:'vi'});
    unsubscribe();
  });
});

describe('listen control beside Copy',()=>{
  it('waits for a complete answer and keeps the text answer',()=>{
    const pending=renderToStaticMarkup(createElement(NovaCopyAnswer,{text:'Netto 2.967,11 EUR',locale:'vi',speech:{id:'chat-9',complete:false}}));
    expect(pending).toContain('Nghe câu trả lời');expect(pending).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Nghe câu trả lời"|aria-label="Nghe câu trả lời"[^>]*disabled=""/);
    const ready=renderToStaticMarkup(createElement(NovaCopyAnswer,{text:'Netto 2.967,11 EUR',locale:'de',speech:{id:'chat-9'}}));
    expect(ready).toContain('Antwort anhören');expect(ready).not.toMatch(/aria-label="Antwort anhören"[^>]*disabled/);
    expect(renderToStaticMarkup(createElement(NovaCopyAnswer,{text:'x',locale:'en'}))).not.toContain('Listen to answer');
  });
});
