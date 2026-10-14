import {isNeural,resolveNeuralVoice,canonicalLanguage,detectTextLanguage} from './voice-language';
import {languages,classicProfiles as voiceProfiles,type Voice} from './audio-model';
const root=()=>new URL('./lore-audio/',document.baseURI);
/** Exportable synthesis runs outside the UI thread on desktop and mobile. */
class ClassicVoiceEngine{
 private worker?:Worker;private next=1;private pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:unknown)=>void;timer:ReturnType<typeof setTimeout>}>();private ready?:Promise<void>;private startupTimer?:ReturnType<typeof setTimeout>;private startupReject?:((error:unknown)=>void);private loaded=new Set<string>();
 private initialize(){return this.ready??=new Promise<void>((resolve,reject)=>{
  const worker=this.worker=new Worker(new URL('speech/mespeak-core.js',root()));
  this.startupReject=reject;const timer=this.startupTimer=setTimeout(()=>{this.close();reject(Error('El motor de voz tardó demasiado en iniciarse.'));},30000);
  worker.onmessage=e=>{const data=e.data;if(data.rsp==='ready'){clearTimeout(timer);this.startupReject=undefined;worker.postMessage({job:'useTransferables',args:true,jobId:0});resolve();return;}const p=this.pending.get(data.jobId);if(p){clearTimeout(p.timer);this.pending.delete(data.jobId);data.success===false?p.reject(Error('No se pudo cargar la voz local.')):p.resolve(data);}};
  worker.onerror=()=>{clearTimeout(timer);this.close();reject(Error('No se pudo iniciar el motor de voz. Comprueba la descarga sin conexión.'));};
 });}
 private request(job:string,args:unknown){const id=this.next++;return new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{this.close();reject(Error('La voz tardó demasiado. Divide este fragmento en párrafos más cortos.'));},60000);this.pending.set(id,{resolve,reject,timer});this.worker!.postMessage({job,args,jobId:id});});}
 async synthesize(text:string,voice:Voice):Promise<ArrayBuffer>{
  if(!languages.some(l=>l[0]===voice.language)||!voiceProfiles.some(v=>v.id===voice.profile))throw Error('Voz desconocida.');
  if(!text.trim()||text.length>800)throw Error('Usa fragmentos de hasta 800 caracteres para generar la voz.');
  await this.initialize();
  if(!this.loaded.has(voice.language)){await this.request('loadVoice',[new URL('speech/voices/'+voice.language+'.json',root()).href]);this.loaded.add(voice.language);}
  const voiceId=voice.language;
  const response=await this.request('speak',['-w','wav.wav','-a','100','-g','0','-p',String(voice.pitch),'-s',String(voice.speed),'-b','1','-v',voiceId+'+'+voice.profile,'--path=/espeak',text]);
  if(!(response.audiodata instanceof ArrayBuffer)||response.audiodata.byteLength<44)throw Error('No se pudo generar el audio.');return response.audiodata;
 }
 close(){clearTimeout(this.startupTimer);this.startupReject?.(Error('Generación cancelada.'));this.startupReject=undefined;this.worker?.terminate();this.worker=undefined;this.ready=undefined;this.loaded.clear();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Generación cancelada.'));}this.pending.clear();}
}
export class LocalVoiceEngine{
 private classic?:ClassicVoiceEngine;private neural?:Worker;private closed=false;private next=1;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:unknown)=>void;timer:ReturnType<typeof setTimeout>}>();
 constructor(private progress:(message:string)=>void=()=>{}){}
 private request(action:string,payload:Record<string,unknown>):Promise<any>{
  if(this.closed)return Promise.reject(Error('Generación cancelada.'));
  if(!this.neural){
   this.neural=new Worker(new URL('./neural-worker.ts',import.meta.url),{type:'module'});
   this.neural.onmessage=e=>{const p=this.pending.get(e.data.id);if(!p)return;if(e.data.progress){this.progress(e.data.progress);return;}clearTimeout(p.timer);this.pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.result);};
   this.neural.onerror=()=>this.close();
  }
  const id=this.next++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.close();reject(Error('La voz tardó demasiado. Comprueba la conexión o divide el texto en fragmentos más cortos.'));},600000);this.pending.set(id,{resolve,reject,timer});this.neural!.postMessage({id,action,payload:{...payload,root:new URL('neural/',root()).href}});});
 }
 async download(voiceId:string){await this.request('download',{voiceId});}
 async synthesize(text:string,voice:Voice,fallbackLanguage='es'):Promise<ArrayBuffer>{
  if(this.closed)throw Error('Generación cancelada.');
  if(isNeural(voice)){const selected=resolveNeuralVoice(voice,text,fallbackLanguage);return this.request('synthesize',{voiceId:selected.id,text,speed:voice.speed});}
  const language=voice.language==='auto'?(detectTextLanguage(text)??fallbackLanguage):canonicalLanguage(voice.language);
  const legacy=language==='en'?'en/en-us':language==='es'?'es-la':language;
  return (this.classic??=new ClassicVoiceEngine()).synthesize(text,{...voice,language:legacy});
 }
 close(){this.closed=true;this.classic?.close();this.neural?.terminate();this.neural=undefined;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Generación cancelada o motor no disponible.'));}this.pending.clear();}
}
export function splitSpeech(text:string,max=700){const pieces:string[]=[];let rest=text.trim();while(rest.length>max){const sentences=Array.from(rest.slice(0,max).matchAll(/[.!?。！？](?:["'”’»)]*)\s+/gu));let at=sentences.at(-1)?.index;at=at!==undefined&&at>max/3?at+sentences.at(-1)![0].length:rest.lastIndexOf(' ',max);if(at<max/3)at=max;if(/[\ud800-\udbff]/.test(rest[at-1]))at--;pieces.push(rest.slice(0,at).trim());rest=rest.slice(at).trim();}if(rest)pieces.push(rest);return pieces;}
export const audioRoot=root;
