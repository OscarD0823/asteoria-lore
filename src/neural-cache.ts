import {sha256} from '@noble/hashes/sha2.js';
import {neuralVoices} from './voice-language';

export const voiceCacheName='asteoria-lore-voices-v1';
const database=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(voiceCacheName,1);r.onupgradeneeded=()=>r.result.createObjectStore('models');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function access<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>){
 const db=await database();try{return await new Promise<T>((resolve,reject)=>{const tx=db.transaction('models',mode),r=operation(tx.objectStore('models'));tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error??Error('No se pudo conservar la voz en este dispositivo.'));tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
export const storedVoiceModels=async()=>await access('readonly',s=>s.getAllKeys()) as string[];
export const removeVoiceModel=(hash:string)=>access('readwrite',s=>s.delete(hash));
export const readVoiceModel=(hash:string)=>access('readonly',s=>s.get(hash)) as Promise<Blob|undefined>;
export const saveVoiceModel=(hash:string,blob:Blob)=>access('readwrite',s=>s.put(blob,hash));

/** Only public, pinned model bytes are fetched; manuscripts never enter URLs or requests. */
export async function verifiedModel(response:Response,expected:{bytes:number;sha256:string},progress:(fraction:number)=>void=()=>{}){
 if(!response.ok||!response.body)throw Error('No se pudo descargar la voz. Comprueba tu conexión y vuelve a intentarlo.');
 const reader=response.body.getReader(),hash=sha256.create(),chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>expected.bytes)throw Error('La descarga de la voz tiene un tamaño inesperado.');hash.update(part.value);chunks.push(new Uint8Array(part.value));progress(bytes/expected.bytes);}
 const digest=Array.from(hash.digest(),b=>b.toString(16).padStart(2,'0')).join('');
 if(bytes!==expected.bytes||digest!==expected.sha256)throw Error('La voz está incompleta o dañada. Se rechazó la descarga; vuelve a intentarlo.');
 return new Blob(chunks,{type:'application/octet-stream'});
 }finally{await reader.cancel().catch(()=>{});}
}
export async function obtainVoiceModel(id:string,root:string,progress:(message:string)=>void){
 const model=neuralVoices.find(v=>v.id===id);if(!model)throw Error('Voz desconocida.');
 const saved=await readVoiceModel(model.sha256);if(saved?.size===model.bytes)return saved;
 // Desktop/APK packages may include selected models. Web packages never probe large files.
 const manifest=await fetch(new URL('bundled.json',root));const bundled=manifest.ok?await manifest.json() as string[]:[];
 const local=bundled.includes(model.model);
 progress((local?'Preparando ':'Descargando ')+model.name+' · '+Math.ceil(model.bytes/1048576)+' MB…');
 const response=await fetch(local?new URL('models/'+encodeURIComponent(model.model)+'.onnx',root):model.url,{credentials:'omit',referrerPolicy:'no-referrer'});
 let lastPercent=-1;const blob=await verifiedModel(response,model,f=>{const percent=Math.floor(f*100);if(percent===lastPercent)return;lastPercent=percent;progress((local?'Preparando ':'Descargando ')+model.name+' · '+percent+' %');});
 try{await saveVoiceModel(model.sha256,blob);}catch{throw Error('No hay espacio para conservar esta voz. Libera almacenamiento o elimina otra voz descargada.');}
 return blob;
}
