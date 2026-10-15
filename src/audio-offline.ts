import {Capacitor} from '@capacitor/core';
import {defaultAudiobook,speechSegments,voiceFor} from './audio-model';
import {chapterLanguage,isNeural,resolveNeuralVoice} from './voice-language';
import type {StoryProject} from './stories-model';

export const packagedAudio=()=>Capacitor.isNativePlatform()||['prisma:','prisma-architecture:'].includes(location.protocol);

/** Resolve every actual utterance, including language changes within chapters. */
export function projectVoiceModels(project:StoryProject){
 const audio=project.audio??defaultAudiobook(),models=new Map<string,ReturnType<typeof resolveNeuralVoice>>();
 for(const chapter of project.chapters){
  const segments=speechSegments(chapter),fallback=chapterLanguage(segments.map(s=>s.text).join(' '),audio.language);
  for(const segment of segments){const voice=voiceFor(audio,segment.speaker);if(isNeural(voice)){const model=resolveNeuralVoice(voice,segment.text,fallback);models.set(model.model,model);}}
  // Also prepare assigned speakers for new dialogue in this chapter's language.
  for(const id of ['narrator',...project.characters.map(c=>c.id)]){
   const voice=voiceFor(audio,id);if(isNeural(voice)){const model=resolveNeuralVoice(voice,'',fallback);models.set(model.model,model);}
  }
 }
 return [...models.values()];
}

export async function prepareAudioRuntime(progress:(message:string)=>void,signal?:AbortSignal){
 if(packagedAudio())return; // EXE/APK contain the runtime and sound library.
 if(!('serviceWorker' in navigator))throw Error('Este navegador no permite preparar la página sin conexión. Usa la aplicación o un navegador compatible.');
 if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
 const registration=await navigator.serviceWorker.getRegistration(new URL('./',document.baseURI).href);
 const worker=registration?.active;
 if(!worker)throw Error('La página aún está instalando la actualización. Vuelve a abrirla con conexión y reintenta.');
 await new Promise<void>((resolve,reject)=>{
  const channel=new MessageChannel();let timer:ReturnType<typeof setTimeout>;
  const finish=(error?:unknown)=>{clearTimeout(timer);channel.port1.close();signal?.removeEventListener('abort',aborted);error?reject(error):resolve();};
  const aborted=()=>finish(new DOMException('Cancelado','AbortError'));
  const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('La preparación no respondió. Vuelve a abrir la página para completar la actualización.')),60000);};
  channel.port1.onmessage=e=>{const state=e.data;if(state?.type!=='prisma-audio-offline')return;heartbeat();progress(`Preparando aplicación y audio sin conexión · ${state.cached} / ${state.total}`);if(state.error)finish(Error(state.error));else if(state.ready)finish();};
  signal?.addEventListener('abort',aborted,{once:true});heartbeat();
  worker.postMessage({type:'prisma-cache-audio'},[channel.port2]);
 });
}
