import {plainText,type Chapter} from './stories-model';
import {neuralVoices,naturalLanguages} from './voice-language';

export const classicProfiles=[
 {id:'f1',name:'Lyra · femenina suave',gender:'Femeninas'},
 {id:'f2',name:'Vega · femenina clara',gender:'Femeninas'},
 {id:'f3',name:'Elara · femenina brillante',gender:'Femeninas'},
 {id:'f4',name:'Aurora · femenina grave',gender:'Femeninas'},
 {id:'f5',name:'Selene · femenina cálida',gender:'Femeninas'},
 {id:'m1',name:'Orion · masculina cálida',gender:'Masculinas'},
 {id:'m2',name:'Altair · masculina clara',gender:'Masculinas'},
 {id:'m3',name:'Sirius · masculina grave',gender:'Masculinas'},
 {id:'m4',name:'Atlas · masculina profunda',gender:'Masculinas'},
 {id:'m5',name:'Leo · masculina brillante',gender:'Masculinas'},
 {id:'m6',name:'Rigel · masculina serena',gender:'Masculinas'},
 {id:'m7',name:'Arcturus · masculina madura',gender:'Masculinas'},
] as const;
export const voiceProfiles=[{id:'neural-f',name:'Adaptable · femenina neuronal',gender:'Femeninas'},{id:'neural-m',name:'Adaptable · masculina neuronal',gender:'Masculinas'},...neuralVoices.map(v=>({id:'piper:'+v.id,name:v.name,gender:v.gender})),...classicProfiles];
export const languages=[['es-la','Español latinoamericano'],['es','Español de España'],['en/en-us','English (US)'],['en/en','English (UK)'],['fr','Français'],['pt','Português'],['de','Deutsch'],['it','Italiano']] as const;
export type Voice={profile:string;language:string;speed:number;pitch:number;volume:number};
export type SegmentTiming={before:number;after:number};
export type MediaClip={id:string;chapterId:string;assetId:string;name:string;anchor:string;start:number;offset:number;duration:number;volume:number;fadeIn:number;fadeOut:number;loop:boolean};
export type Audiobook={voices:Record<string,Voice>;timings:Record<string,SegmentTiming>;clips:MediaClip[];gap:number;language?:string;voiceVersion?:2};
export type SpeechSegment={id:string;chapterId:string;speaker:string;text:string};
export const defaultVoice=():Voice=>({profile:'neural-f',language:'auto',speed:165,pitch:50,volume:.85});
export const defaultAudiobook=():Audiobook=>({voices:{narrator:defaultVoice()},timings:{},clips:[],gap:.35,language:'auto',voiceVersion:2});
export function upgradeClassicVoices(audio:Audiobook):Audiobook{return {...audio,voiceVersion:2,language:audio.language??'auto',voices:Object.fromEntries(Object.entries(audio.voices).map(([id,v])=>[id,classicProfiles.some(p=>p.id===v.profile)?{...v,profile:v.profile.startsWith('m')?'neural-m':'neural-f',language:'auto',pitch:50}:v]))};}
export function validateAudiobook(value:unknown,chapterIds:Set<string>):Audiobook{
 if(value===undefined)return defaultAudiobook();
 const a=value as Audiobook;
 const number=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!a||typeof a.voices!=='object'||!a.voices||Array.isArray(a.voices)||typeof a.timings!=='object'||!a.timings||Array.isArray(a.timings)||!Array.isArray(a.clips)||a.clips.length>2000||!number(a.gap,0,30))throw Error('La configuración del audiolibro no es válida.');
 if(Object.keys(a.voices).length>5001||Object.keys(a.timings).length>20000)throw Error('Hay demasiadas voces o fragmentos.');
 const validLanguage=(id:string)=>id==='auto'||languages.some(l=>l[0]===id)||naturalLanguages.some(l=>l[0]===id);
 if(a.voiceVersion!==undefined&&a.voiceVersion!==2)throw Error('La versión de voces no es válida.');
 if(a.language!==undefined&&!validLanguage(a.language))throw Error('El idioma del audiolibro no es válido.');
 for(const [id,v] of Object.entries(a.voices))if(!/^[\w-]{1,100}$/.test(id)||!v||!voiceProfiles.some(p=>p.id===v.profile)||!validLanguage(v.language)||!number(v.speed,80,320)||!number(v.pitch,0,99)||!number(v.volume,0,1))throw Error('Una voz no es válida.');
 for(const [id,t] of Object.entries(a.timings))if(!/^[\w-]{1,120}$/.test(id)||!t||!number(t.before,0,120)||!number(t.after,0,120))throw Error('Una pausa no es válida.');
 const ids=new Set<string>();
 for(const c of a.clips){if(!c||typeof c.id!=='string'||ids.has(c.id)||!chapterIds.has(c.chapterId)||typeof c.assetId!=='string'||!/^((builtin:[\w/-]+\.(?:ogg|wav))|([\w-]{1,100}))$/.test(c.assetId)||typeof c.name!=='string'||c.name.length>500||typeof c.anchor!=='string'||!number(c.start,0,86400)||!number(c.offset,0,86400)||!number(c.duration,.05,3600)||!number(c.volume,0,1)||!number(c.fadeIn,0,3600)||!number(c.fadeOut,0,3600)||typeof c.loop!=='boolean')throw Error('Una pista de audio no es válida.');ids.add(c.id);}
 return a;
}
// Only explicit speaker marks change the voice. Unmarked text belongs to the narrator.
export function speechSegments(chapter:Chapter):SpeechSegment[]{
 const runs:{speaker:string;text:string}[]=[];
 const stack:{speaker:string;skip:boolean}[]=[];let speaker='narrator',text='',skip=false;
 const flush=()=>{const decoded=plainText(text).replace(/\s+/g,' ').trim();if(decoded)runs.push({speaker,text:decoded});text='';};
 for(const token of chapter.html.match(/<[^>]*>|[^<]+/g)??[]){
  if(!token.startsWith('<')){if(!skip)text+=token;continue;}
  if(/^<span\b/i.test(token)){flush();stack.push({speaker,skip});speaker=token.match(/data-speaker-id=["']([\w-]{1,100})["']/i)?.[1]??speaker;skip=skip||/data-speaker-label=["']true["']/i.test(token);}
  else if(/^<\/span/i.test(token)){flush();const previous=stack.pop();speaker=previous?.speaker??'narrator';skip=previous?.skip??false;}
  else if(/^<\/(?:p|h[1-6]|li|blockquote|pre)>|^<br\b/i.test(token))flush();
 }
 flush();const occurrences=new Map<string,number>();
 return runs.map(run=>{let h=2166136261;for(const char of run.speaker+'\0'+run.text)h=Math.imul(h^char.codePointAt(0)!,16777619);const hash=(h>>>0).toString(36),n=occurrences.get(hash)??0;occurrences.set(hash,n+1);return {...run,chapterId:chapter.id,id:`s-${chapter.id}-${hash}-${n}`};});
}
export function voiceFor(a:Audiobook,speaker:string):Voice{return (Object.hasOwn(a.voices,speaker)?a.voices[speaker]:undefined)??(Object.hasOwn(a.voices,'narrator')?a.voices.narrator:undefined)??defaultVoice();}
export function scheduleSpeech(segments:SpeechSegment[],durations:Map<string,number>,a:Audiobook){
 let cursor=0;
 return segments.map(s=>{const timing=a.timings[s.id]??{before:0,after:a.gap},duration=durations.get(s.id)??Math.max(.4,s.text.split(/\s+/).length*60/voiceFor(a,s.speaker).speed);cursor+=timing.before;const start=cursor;cursor+=duration+timing.after;return{...s,start,duration,end:cursor};});
}
export const clockTime=(seconds:number)=>{const tenths=Math.round(Math.max(0,seconds)*10);return Math.floor(tenths/600)+':'+((tenths%600)/10).toFixed(1).padStart(4,'0');};
