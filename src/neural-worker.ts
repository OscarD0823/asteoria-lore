import * as ort from 'onnxruntime-web/wasm';
import {neuralVoices} from './voice-language';
import {obtainVoiceModel} from './neural-cache';
import {encodeWav} from './audio-wav';
import {modelPhonemeIds} from './phoneme-model';

let root='',session:ort.InferenceSession|undefined,modelId='',phonemizer:any,phonemes:string[]|undefined;
const currentPhonemes=()=>phonemes;
const worker=self as unknown as {onmessage:(e:MessageEvent)=>void;postMessage:(value:unknown,transfer?:Transferable[])=>void};
async function synthesize(id:string,text:string,speed:number,progress:(message:string)=>void){
 const voice=neuralVoices.find(v=>v.id===id);if(!voice)throw Error('Voz desconocida.');
 if(!text.trim()||text.length>800)throw Error('El fragmento de voz es demasiado largo.');
 if(!phonemizer){
  progress('Preparando pronunciación local…');
  const url=new URL('piper-module.js',root).href;
  const {default:create}=await import(/* @vite-ignore */ url);
  phonemizer=await create({noInitialRun:true,noExitRuntime:true,print:(line:string)=>{try{const data=JSON.parse(line);if(Array.isArray(data.phonemes))phonemes=data.phonemes;}catch{}},printErr:(line:string)=>console.warn('Pronunciación:',line),locateFile:(name:string)=>new URL(name,root).href});
 }
 if(modelId!==voice.model){
  if(session){await session.release();session=undefined;modelId='';}
  const blob=await obtainVoiceModel(voice.id,root,progress);
  progress('Cargando '+voice.name+' en el dispositivo…');
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths={mjs:new URL('runtime/ort-wasm-simd-threaded.js',root).href,wasm:new URL('runtime/ort-wasm-simd-threaded.wasm',root).href};
  session=await ort.InferenceSession.create(await blob.arrayBuffer(),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  modelId=voice.model;
 }
 phonemes=undefined;
 phonemizer.callMain(['-l',voice.config.espeak.voice,'--input',JSON.stringify([{text:text.trim()}]),'--espeak_data','/espeak-ng-data']);
 const sequence=currentPhonemes();if(!sequence?.length)throw Error('No se pudo convertir el texto en pronunciación.');
 const ids=BigInt64Array.from(modelPhonemeIds(sequence,voice.config.phoneme_id_map,voice.config.num_symbols),BigInt),config=voice.config.inference;
 const inputs:Record<string,ort.Tensor>={input:new ort.Tensor('int64',ids,[1,ids.length]),input_lengths:new ort.Tensor('int64',BigInt64Array.of(BigInt(ids.length)),[1]),scales:new ort.Tensor('float32',Float32Array.of(config.noise_scale,config.length_scale/Math.max(.65,Math.min(1.65,speed/165)),config.noise_w),[3])};
 if(session!.inputNames.includes('sid'))inputs.sid=new ort.Tensor('int64',BigInt64Array.of(BigInt(voice.speaker)),[1]);
 progress('Generando voz neuronal · '+voice.name+'…');
 const result=await session!.run(inputs),output=result[session!.outputNames[0]],pcm=output.data as Float32Array;
 if(!(pcm instanceof Float32Array)||!pcm.length||pcm.some(n=>!Number.isFinite(n)))throw Error('El motor devolvió un audio inválido.');
 const wav=encodeWav([pcm],voice.config.audio.sample_rate);
 for(const t of Object.values(result))t.dispose();for(const t of Object.values(inputs))t.dispose();
 return wav.buffer;
}
let queue=Promise.resolve();
worker.onmessage=(event:MessageEvent)=>{const {id,action,payload}=event.data;queue=queue.catch(()=>{}).then(async()=>{
 const progress=(message:string)=>worker.postMessage({id,progress:message});
 try{root=payload.root;if(action==='download'){await obtainVoiceModel(payload.voiceId,root,progress);worker.postMessage({id,result:true});return;}
 const wav=await synthesize(payload.voiceId,payload.text,payload.speed,progress);worker.postMessage({id,result:wav},[wav]);
 }catch(e){worker.postMessage({id,error:e instanceof Error?e.message:String(e)});}
});};
