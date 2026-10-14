import {languages,voiceProfiles,type Voice} from './audio-model';
const root=()=>new URL('./lore-audio/',document.baseURI);
/** Exportable synthesis runs outside the UI thread on desktop and mobile. */
export class LocalVoiceEngine{
 private worker?:Worker;private next=1;private pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:unknown)=>void;timer:ReturnType<typeof setTimeout>}>();private ready?:Promise<void>;private loaded=new Set<string>();
 private initialize(){return this.ready??=new Promise<void>((resolve,reject)=>{
  const worker=this.worker=new Worker(new URL('speech/mespeak-core.js',root()));
  const timer=setTimeout(()=>{this.close();reject(Error('El motor de voz tardó demasiado en iniciarse.'));},30000);
  worker.onmessage=e=>{const data=e.data;if(data.rsp==='ready'){clearTimeout(timer);worker.postMessage({job:'useTransferables',args:true,jobId:0});resolve();return;}const p=this.pending.get(data.jobId);if(p){clearTimeout(p.timer);this.pending.delete(data.jobId);data.success===false?p.reject(Error('No se pudo cargar la voz local.')):p.resolve(data);}};
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
 close(){this.worker?.terminate();this.worker=undefined;this.ready=undefined;this.loaded.clear();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Generación cancelada.'));}this.pending.clear();}
}
export function splitSpeech(text:string,max=700){const pieces:string[]=[];let rest=text.trim();while(rest.length>max){let at=rest.lastIndexOf(' ',max);if(at<max/3)at=max;pieces.push(rest.slice(0,at));rest=rest.slice(at).trim();}if(rest)pieces.push(rest);return pieces;}
export const audioRoot=root;
