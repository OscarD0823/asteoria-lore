import {LocalVoiceEngine,splitSpeech,audioRoot} from './audio-engine';
import {defaultAudiobook,speechSegments,scheduleSpeech,voiceFor,type Voice} from './audio-model';
import {getAudioAsset} from './stories-storage';
import type {StoryProject} from './stories-model';
export type BuiltinSound={id:string;name:string;category:string;url:string;license:string;author:string;source:string};
let catalogPromise:Promise<BuiltinSound[]>|undefined;
export function soundCatalog(){return catalogPromise??=fetch(new URL('catalog.json',audioRoot())).then(async r=>{if(!r.ok)throw Error('La biblioteca de sonidos no está descargada.');return await r.json() as BuiltinSound[];}).catch(e=>{catalogPromise=undefined;throw e;});}
export async function assetBlob(id:string){
 if(!id.startsWith('builtin:')){const a=await getAudioAsset(id);if(!a)throw Error('Falta un audio de tu biblioteca. Vuelve a importarlo.');return a.blob;}
 const entry=(await soundCatalog()).find(s=>s.id===id);if(!entry)throw Error('Este efecto no está en la biblioteca.');
 const response=await fetch(new URL(entry.url,audioRoot()));if(!response.ok)throw Error('El efecto no está disponible sin conexión. Descarga la aplicación completa.');return response.blob();
}
export async function decodeBlob(blob:Blob){return new OfflineAudioContext(2,1,22050).decodeAudioData(await blob.arrayBuffer());}
function aborted(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Generación cancelada.','AbortError');}
export async function voiceBuffer(text:string,voice:Voice,engine:LocalVoiceEngine,signal?:AbortSignal){
 const context=new OfflineAudioContext(1,1,22050),buffers:AudioBuffer[]=[];let length=0;
 for(const part of splitSpeech(text)){aborted(signal);const decoded=await context.decodeAudioData(await engine.synthesize(part,voice));buffers.push(decoded);length+=decoded.length;if(length>22050*600)throw Error('Divide este fragmento en párrafos para editarlo.');}
 const combined=context.createBuffer(1,Math.max(1,length),22050);let offset=0;
 for(const buffer of buffers){combined.copyToChannel(buffer.getChannelData(0),0,offset);offset+=buffer.length;}return combined;
}
export function encodeWav(channels:Float32Array[],sampleRate:number){
 const length=channels[0]?.length??0;if(!length||channels.some(c=>c.length!==length))throw Error('El audio no tiene muestras válidas.');
 const bytes=new Uint8Array(44+length*channels.length*2),view=new DataView(bytes.buffer);
 const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels.length,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels.length*2,true);view.setUint16(32,channels.length*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,bytes.length-44,true);
 let peak=1;for(const c of channels)for(const sample of c)peak=Math.max(peak,Math.abs(sample));
 let at=44;for(let i=0;i<length;i++)for(const c of channels){const sample=Math.max(-1,Math.min(1,c[i]/peak));view.setInt16(at,Math.round(sample*(sample<0?32768:32767)),true);at+=2;}return bytes;
}
export async function renderChapter(project:StoryProject,chapterId:string,engine:LocalVoiceEngine,onProgress:(message:string)=>void=()=>{},signal?:AbortSignal){
 const chapter=project.chapters.find(c=>c.id===chapterId);if(!chapter)throw Error('El capítulo no existe.');
 const audio=project.audio??defaultAudiobook(),segments=speechSegments(chapter),buffers=new Map<string,AudioBuffer>(),durations=new Map<string,number>();
 const estimate=segments.reduce((n,s)=>n+s.text.split(/\s+/).length*60/voiceFor(audio,s.speaker).speed+(audio.timings[s.id]?.before??0)+(audio.timings[s.id]?.after??audio.gap),0);
 if(estimate>900)throw Error('Exporta capítulos de hasta 15 minutos. Divide este capítulo para conservar una buena respuesta en el celular.');
 for(let i=0;i<segments.length;i++){aborted(signal);onProgress(`Voz ${i+1} de ${segments.length} · ${chapter.title}`);const s=segments[i],buffer=await voiceBuffer(s.text,voiceFor(audio,s.speaker),engine,signal);buffers.set(s.id,buffer);durations.set(s.id,buffer.duration);}
 const schedule=scheduleSpeech(segments,durations,audio),media:{buffer:AudioBuffer;clip:(typeof audio.clips)[number];start:number}[]=[];
 for(const clip of audio.clips.filter(c=>c.chapterId===chapterId)){aborted(signal);const anchor=clip.anchor?schedule.find(s=>s.id===clip.anchor):undefined;if(clip.anchor&&!anchor)throw Error('Una pista estaba ligada a un fragmento que cambió. Elige de nuevo su punto de entrada.');const buffer=await decodeBlob(await assetBlob(clip.assetId));if(clip.offset>=buffer.duration)throw Error('El recorte de una pista comienza fuera de su audio.');media.push({clip,buffer,start:(anchor?.start??0)+clip.start});}
 const duration=Math.max(0,schedule.at(-1)?.end??0,...media.map(m=>m.start+(m.clip.loop?m.clip.duration:Math.min(m.clip.duration,m.buffer.duration-m.clip.offset))));
 if(duration<=0)throw Error('Escribe texto o añade una pista para crear el audiolibro.');if(duration>900)throw Error('La línea de tiempo supera 15 minutos. Divide el capítulo o acorta las pistas.');
 aborted(signal);onProgress('Mezclando voces, música y efectos…');
 const context=new OfflineAudioContext(2,Math.ceil((duration+.1)*22050),22050);
 for(const s of schedule){const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(s.id)!;gain.gain.value=voiceFor(audio,s.speaker).volume;source.connect(gain).connect(context.destination);source.start(s.start);}
 for(const {clip,buffer,start} of media){const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=clip.loop;if(clip.loop){source.loopStart=clip.offset;source.loopEnd=buffer.duration;}const length=clip.loop?clip.duration:Math.min(clip.duration,buffer.duration-clip.offset),fadeIn=Math.min(clip.fadeIn,length/2),fadeOut=Math.min(clip.fadeOut,length/2);gain.gain.setValueAtTime(fadeIn?0:clip.volume,start);if(fadeIn)gain.gain.linearRampToValueAtTime(clip.volume,start+fadeIn);gain.gain.setValueAtTime(clip.volume,start+length-fadeOut);if(fadeOut)gain.gain.linearRampToValueAtTime(0,start+length);source.connect(gain).connect(context.destination);source.start(start,clip.offset);source.stop(start+length);}
 const rendered=await context.startRendering();aborted(signal);return{bytes:encodeWav([rendered.getChannelData(0),rendered.getChannelData(1)],rendered.sampleRate),duration,schedule};
}
