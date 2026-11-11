"use client";
import {useEffect,useState} from 'react';
import {RotateCcw,Square,Volume2} from 'lucide-react';
import {speakAnswer,speechCopy,speechLanguage,stopSpeech,subscribeSpeech,type SpeechState} from '@/lib/nova-speech';

/**
 * "Listen to answer" beside Copy. Plays only after a click and only once the answer is complete, with a voice on
 * this device in the answer's own language (labels follow the interface); the text answer and its citations stay.
 */
export function NovaListenAnswer({id,text,locale,complete=true}:{id:string;text:string;locale:string;complete?:boolean}){
  const t=speechCopy(locale),[state,setState]=useState<SpeechState>({status:'idle'});
  useEffect(()=>subscribeSpeech(setState),[]);
  // An answer that leaves the screen (closed history entry, other dossier) stops reading itself.
  useEffect(()=>()=>stopSpeech(id),[id]);
  const mine=state.id===id,speaking=mine&&state.status==='speaking';
  const note=mine&&state.status==='no-voice'?t.noVoice(state.language||speechLanguage(locale)):mine&&state.status==='unsupported'?t.unsupported:mine&&state.status==='error'?t.error:'';
  return <>
    {speaking?<button type="button" className="nova-speech-stop" aria-label={t.stop} title={t.stop} onClick={()=>stopSpeech(id)}><Square size={13}/> {t.stop}</button>
      :<button type="button" className="nova-speech-play" aria-label={mine&&state.status==='done'?t.replay:t.listen} title={t.local} disabled={!complete||!text.trim()}
        onClick={()=>void speakAnswer(id,text,locale)}>{mine&&state.status==='done'?<RotateCcw size={14}/>:<Volume2 size={14}/>} {mine&&state.status==='done'?t.replay:t.listen}</button>}
    <span className="nova-speech-engine" title={t.engine}>{t.engine}</span>
    {speaking?<span role="status" className="nova-speech-status">{t.speaking}</span>:null}
    {note?<span role="status" className="nova-speech-note">{note}</span>:null}
  </>;
}
