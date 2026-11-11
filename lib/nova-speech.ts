/**
 * Read Nova answers aloud with a voice that runs on this device (Web Speech API, `localService` voices only).
 * Nothing is recorded, saved or sent to a remote speech service, and the chat provider is unchanged.
 */
export type SpeechLanguage='en'|'de'|'vi';
export type SpeechStatus='idle'|'speaking'|'done'|'no-voice'|'unsupported'|'error';
/** `language` names the answer language that has no on-device voice when the status is `no-voice`. */
export type SpeechState={id?:string;status:SpeechStatus;language?:SpeechLanguage};
export type SpeechSegment={language:SpeechLanguage;text:string};
type VoiceLike=Pick<SpeechSynthesisVoice,'lang'|'localService'|'name'|'default'>;

const names={en:{en:'English',de:'German',vi:'Vietnamese'},de:{en:'englische',de:'deutsche',vi:'vietnamesische'},vi:{en:'tiếng Anh',de:'tiếng Đức',vi:'tiếng Việt'}};
const en={listen:'Listen to answer',replay:'Listen again',stop:'Stop',speaking:'Reading aloud…',
  local:'Uses a voice on this device. No audio is sent or saved.',
  noVoice:(language:SpeechLanguage)=>`No ${names.en[language]} voice is installed on this device. Add one in your system speech settings (macOS: Accessibility → Spoken Content), then reload. The text answer stays here.`,
  unsupported:'This browser cannot read answers aloud. The text answer stays here.',
  error:'Reading aloud stopped unexpectedly. The text answer stays here.',link:'link',
  engine:'Browser voice on this device. Azure Speech is not used here.'};
type Copy=typeof en;
const de:Copy={listen:'Antwort anhören',replay:'Erneut anhören',stop:'Stopp',speaking:'Wird vorgelesen…',
  local:'Nutzt eine Stimme auf diesem Gerät. Es wird kein Audio gesendet oder gespeichert.',
  noVoice:language=>`Auf diesem Gerät ist keine ${names.de[language]} Stimme installiert. Füge in den Spracheinstellungen des Systems eine hinzu (macOS: Bedienungshilfen → Gesprochene Inhalte) und lade neu. Die Textantwort bleibt hier.`,
  unsupported:'Dieser Browser kann Antworten nicht vorlesen. Die Textantwort bleibt hier.',
  error:'Das Vorlesen wurde unerwartet beendet. Die Textantwort bleibt hier.',link:'Link',
  engine:'Browser-Stimme auf diesem Gerät. Azure Speech wird hier nicht verwendet.'};
const vi:Copy={listen:'Nghe câu trả lời',replay:'Nghe lại',stop:'Dừng',speaking:'Đang đọc…',
  local:'Dùng giọng đọc trên thiết bị này. Không gửi hay lưu âm thanh.',
  noVoice:language=>`Thiết bị chưa có giọng đọc ${names.vi[language]}. Thêm giọng trong cài đặt giọng nói của hệ thống (macOS: Trợ năng → Nội dung được đọc) rồi tải lại trang. Câu trả lời dạng chữ vẫn ở đây.`,
  unsupported:'Trình duyệt này không đọc được câu trả lời. Câu trả lời dạng chữ vẫn ở đây.',
  error:'Việc đọc bị dừng bất ngờ. Câu trả lời dạng chữ vẫn ở đây.',link:'đường liên kết',
  engine:'Giọng đọc của trình duyệt trên thiết bị này. Không dùng Azure Speech.'};
export const speechLanguages={en,de,vi};
export function speechCopy(locale:string){return speechLanguages[speechLanguage(locale)];}
export function speechLanguage(locale:string):SpeechLanguage{return locale==='vi'?'vi':locale==='de'?'de':'en';}

const VI_LETTERS=/[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/gi;
const DE_MARKERS=/[äöüß]|\b(?:der|die|das|und|ist|nicht|mit|von|den|dem|des|ein|eine|einen|wird|werden|wurde|im|auf|zu|bei|laut|sind|kein|keine|keinen|nach|oder|auch|als|aus|beträgt)\b/gi;
const EN_MARKERS=/\b(?:the|and|is|are|of|for|with|not|this|that|was|were|has|have|no|in|on|to|by|from|as|be|it|which)\b/gi;
/**
 * Language of an answer or line, judged from the text itself: stored answers do not record their language, and a
 * bilingual summary pairs German and Vietnamese paragraphs. Without clear markers the fallback is kept.
 */
export function detectLanguage(text:string,fallback:SpeechLanguage):SpeechLanguage{
  if((text.match(VI_LETTERS)||[]).length>=2)return 'vi';
  const german=(text.match(DE_MARKERS)||[]).length,english=(text.match(EN_MARKERS)||[]).length;
  if(german>=2&&german>english)return 'de';
  if(english>=2&&english>german)return 'en';
  return fallback;
}

const LINK='\u0000link\u0000',CITATION=/\[(?=[^\]\n]*[A-Za-z])[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*\]/;
function inline(line:string){
  return line
    .replace(/`([^`\n]*)`/g,'$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|\/|#|\?)[^)\s]*\)/g,'$1')
    .replace(/\bhttps?:\/\/[^\s)\]]*[^\s)\].,;:!?]/gi,LINK)
    // Citation IDs such as [doc-1:p2] or [case-summary] are for the eye, not the ear.
    .replace(/\[(?=[^\]\n]*[A-Za-z])[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*\]/g,' ')
    .replace(/(\*\*|__)(.+?)\1/g,'$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g,'$1$2')
    .replace(/\s*→\s*/g,' – ')
    .replace(/[ \t]+([.,;:!?])/g,'$1')
    .replace(/\s+/g,' ').trim();
}
/**
 * Spoken form of an answer in language segments: Markdown markup, URLs and citation IDs are dropped, while amounts,
 * dates, units, currencies and names stay exactly as written. Citations remain visible on screen for checking the PDF.
 */
export function speechSegments(markdown:string,locale:string):SpeechSegment[]{
  const lines=markdown.replace(/```[\s\S]*?```/g,'\n').split(/\r?\n/).map(raw=>{
    if(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(raw)||/^\s*-{3,}\s*$/.test(raw))return '';
    let line=raw.replace(/^\s{0,3}#{1,6}\s+/,'').replace(/^\s{0,3}>\s?/,'').replace(/^\s*(?:[-*+•]|\d{1,3}[.)])\s+/,'');
    if(line.includes('|'))line=line.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(cell=>cell.trim()).filter(Boolean).join(', ');
    const cited=CITATION.test(line);line=inline(line);
    // "Sources: [doc-1:p2]" leaves only a label once the citations are removed; it is not read.
    if(cited&&/^[^.!?]{1,40}:$/.test(line))return '';
    // Each line becomes its own sentence, so list items and headings get a natural pause.
    return line&&!/[.!?…:;,]$/.test(line)?`${line}.`:line;
  }).filter(Boolean);
  const overall=detectLanguage(lines.join(' '),speechLanguage(locale)),segments:SpeechSegment[]=[];
  for(const line of lines){
    const language=detectLanguage(line,overall),text=line.split(LINK).join(speechLanguages[language].link),last=segments.at(-1);
    if(last&&last.language===language)last.text=`${last.text} ${text}`;else segments.push({language,text});
  }
  return segments;
}
export function speechText(markdown:string,locale:string){return speechSegments(markdown,locale).map(segment=>segment.text).join(' ');}

/** Sentence-sized pieces keep long answers reliable in every browser; a number such as 2.967,11 is never split. */
export function speechChunks(text:string,max=220){
  const sentences=text.split(/(?<=[.!?…])\s+/).filter(Boolean),chunks:string[]=[];
  for(const sentence of sentences){
    if(sentence.length<=max){chunks.push(sentence);continue;}
    let current='';
    for(const part of sentence.split(/(?<=[,;:])\s+/)){
      if(current&&(current+' '+part).length>max){chunks.push(current);current=part;}else current=current?`${current} ${part}`:part;
    }
    if(current)chunks.push(current);
  }
  return chunks;
}

// macOS also lists sound-effect voices; they are never chosen for an answer.
const NOVELTY=new Set(['albert','bad news','bahh','bells','boing','bubbles','cellos','good news','jester','organ','superstar','trinoids','whisper','wobble','zarvox']);
/** Only voices rendered on this device (`localService`) in the answer's language, preferring the exact regional variant. */
export function pickVoice<T extends VoiceLike>(voices:readonly T[],locale:string):T|undefined{
  const language=speechLanguage(locale),normal=(lang:string)=>lang.toLowerCase().replace('_','-');
  const local=voices.filter(voice=>voice.localService&&normal(voice.lang).split('-')[0]===language&&!NOVELTY.has(voice.name.toLowerCase().replace(/\s*\(.*\)$/,'')));
  const preferred={vi:['vi-vn'],de:['de-de'],en:['en-us','en-gb']}[language];
  for(const lang of preferred){
    const regional=local.filter(voice=>normal(voice.lang)===lang);
    if(regional.length)return regional.find(voice=>voice.default)||regional[0];
  }
  return local.find(voice=>voice.default)||local[0];
}

// One playback for the whole page: starting another answer stops the current one.
let state:SpeechState={status:'idle'},session=0;
const listeners=new Set<(state:SpeechState)=>void>();
function publish(next:SpeechState){state=next;listeners.forEach(listener=>listener(state));}
export function subscribeSpeech(listener:(state:SpeechState)=>void){listeners.add(listener);listener(state);return()=>{listeners.delete(listener);};}
export function speechSupported(){return typeof window!=='undefined'&&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';}
/** Stops playback. With an ID, only that answer is stopped (for example when its message disappears). */
export function stopSpeech(id?:string){
  if(id&&state.id!==id)return;
  session++;
  if(speechSupported())window.speechSynthesis.cancel();
  if(state.status==='speaking')publish({id:state.id,status:'idle'});
}
/** Stops whatever answer of one surface is playing, for example every chat answer when Nova closes. */
export function stopSpeechWithPrefix(prefix:string){if(state.id?.startsWith(prefix))stopSpeech(state.id);}
function voices():Promise<SpeechSynthesisVoice[]>{
  const ready=window.speechSynthesis.getVoices();
  if(ready.length)return Promise.resolve(ready);
  return new Promise(resolve=>{
    const done=()=>{window.speechSynthesis.removeEventListener('voiceschanged',done);resolve(window.speechSynthesis.getVoices());};
    window.speechSynthesis.addEventListener('voiceschanged',done);
    window.setTimeout(done,1500);
  });
}
export async function speakAnswer(id:string,text:string,locale:string){
  stopSpeech();
  const run=++session;
  if(!speechSupported()){publish({id,status:'unsupported'});return;}
  const segments=speechSegments(text,locale);
  if(!segments.length){publish({id,status:'idle'});return;}
  const available=await voices();
  if(run!==session)return;
  const chosen=new Map<SpeechLanguage,SpeechSynthesisVoice>();
  for(const segment of segments){
    if(chosen.has(segment.language))continue;
    const voice=pickVoice(available,segment.language);
    if(!voice){publish({id,status:'no-voice',language:segment.language});return;}
    chosen.set(segment.language,voice);
  }
  const chunks=segments.flatMap(segment=>speechChunks(segment.text).map(chunk=>({chunk,voice:chosen.get(segment.language)!})));
  publish({id,status:'speaking'});
  chunks.forEach(({chunk,voice},index)=>{
    const utterance=new SpeechSynthesisUtterance(chunk);
    utterance.voice=voice;utterance.lang=voice.lang;
    utterance.onend=()=>{if(run===session&&index===chunks.length-1)publish({id,status:'done'});};
    utterance.onerror=event=>{if(run===session&&event.error!=='canceled'&&event.error!=='interrupted'){session++;window.speechSynthesis.cancel();publish({id,status:'error'});}};
    window.speechSynthesis.speak(utterance);
  });
}
// Leaving or reloading the page always stops playback.
if(typeof window!=='undefined'&&typeof window.addEventListener==='function')window.addEventListener('pagehide',()=>stopSpeech());
