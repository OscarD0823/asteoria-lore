import {francAll} from 'franc-min';
import voices from './neural-voices.json';
import type {Voice} from './audio-model';

export const neuralVoices=voices;
export const naturalLanguages=[['es','Español'],['en','English'],['fr','Français'],['pt','Português'],['de','Deutsch'],['it','Italiano'],['nl','Nederlands'],['pl','Polski'],['ru','Русский'],['uk','Українська']] as const;
const iso:Record<string,string>={spa:'es',eng:'en',fra:'fr',por:'pt',deu:'de',ita:'it',nld:'nl',pol:'pl',rus:'ru',ukr:'uk',ara:'ar',cmn:'zh',jpn:'ja',kor:'ko',hin:'hi',tur:'tr',swe:'sv',dan:'da',fin:'fi',ces:'cs',ron:'ro',ell:'el',heb:'he',vie:'vi',ind:'id',hun:'hu',bul:'bg'};
export const canonicalLanguage=(value:string)=>value==='es-la'?'es':value.startsWith('en/')?'en':value;
export function detectTextLanguage(text:string):string|undefined{
 const clean=text.normalize('NFC').replace(/https?:\/\/\S+/g,' ').trim();
 const letters=clean.replace(/[^\p{L}]/gu,'').length;
 const dominant=(pattern:RegExp)=>(clean.match(pattern)?.length??0)>=Math.max(1,letters*.3);
 // Explicit scripts must never be pronounced by an unrelated Latin voice.
 if(dominant(/[\u3040-\u30ff]/gu))return 'ja';
 if(dominant(/[\u3400-\u9fff]/gu))return 'zh';
 if(dominant(/[\uac00-\ud7af]/gu))return 'ko';
 if(dominant(/[\u0600-\u06ff]/gu))return 'ar';
 if(dominant(/[\u0900-\u097f]/gu))return 'hi';
 if(dominant(/[\u0590-\u05ff]/gu))return 'he';
 if(dominant(/[\u0370-\u03ff]/gu))return 'el';
 const unfamiliar=clean.replace(/[^\p{L}]/gu,'').replace(/[\p{Script=Latin}\p{Script=Cyrillic}]/gu,'').length;
 if(unfamiliar>=Math.max(1,letters*.3))return 'sin-modelo';
 if(letters<60&&dominant(/[\u0400-\u04ff]/gu))return /[іїєґ]/iu.test(clean)?'uk':'ru';
 // Short dialogue and proper names inherit the chapter language. Statistical
 // guesses from a handful of Latin words frequently produce the wrong voice.
 if(letters<60)return undefined;
 const ranked=francAll(clean,{minLength:60});
 if(!ranked.length||ranked[0][0]==='und'||(ranked[1]&&ranked[0][1]-ranked[1][1]<.025))return undefined;
 return iso[ranked[0][0]]??ranked[0][0];
}
export function chapterLanguage(text:string,choice='auto'){
 return choice==='auto'?(detectTextLanguage(text)??'es'):canonicalLanguage(choice);
}
export function resolveNeuralVoice(voice:Voice,text:string,fallback='es'){
 const language=voice.language==='auto'?(detectTextLanguage(text)??fallback):canonicalLanguage(voice.language);
 const compatible=neuralVoices.filter(v=>v.language===language);
 if(!compatible.length)throw Error(`Todavía no hay una voz neuronal para el idioma «${language}». Elige el idioma correcto o usa una voz grabada. El texto no se enviará a un servidor.`);
 const preferred=neuralVoices.find(v=>'piper:'+v.id===voice.profile);
 const gender=preferred?.gender??(voice.profile==='neural-m'?'Masculinas':'Femeninas');
 // The automatic Spanish pair is included in both native installers.
 const spanishDefault=language==='es'&&voice.profile.startsWith('neural-')?compatible.find(v=>v.model===(gender==='Masculinas'?'es_ES-sharvard-medium':'es_AR-daniela-high')&&(gender!=='Masculinas'||v.speaker===0)):undefined;
 return preferred?.language===language?preferred:(spanishDefault??compatible.find(v=>v.gender===gender)??compatible[0]);
}
export const isNeural=(voice:Voice)=>voice.profile.startsWith('neural-')||voice.profile.startsWith('piper:');
export const languageName=(id:string)=>naturalLanguages.find(l=>l[0]===id)?.[1]??id;
