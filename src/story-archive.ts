import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {validateStory,type StoryProject} from './stories-model';
import {getAudioAsset,validateAsset,type AudioAsset} from './stories-storage';
const limit=200*1024*1024;
export async function storyArchive(project:StoryProject):Promise<Uint8Array>{
 validateStory(project);const ids=new Set(project.audio?.clips.map(c=>c.assetId).filter(id=>!id.startsWith('builtin:'))??[]);
 const entries:Record<string,Uint8Array|[Uint8Array,{level:0}]>={},assets:Omit<AudioAsset,'blob'>[]=[];let size=0;
 for(const id of ids){const a=await getAudioAsset(id);if(!a)throw Error('Falta una pista local: vuelve a importarla antes de guardar la copia completa.');size+=a.blob.size;if(size>limit)throw Error('La copia supera 200 MB. Exporta el audio por capítulos.');const {blob,...metadata}=a;assets.push(metadata);entries['audio/'+id]=[new Uint8Array(await blob.arrayBuffer()),{level:0}];}
 if(!ids.size)return strToU8(JSON.stringify(project,null,2));
 entries['story.json']=strToU8(JSON.stringify({project,assets}));return zipSync(entries,{level:0});
}
export function readStoryArchive(bytes:Uint8Array):{project:StoryProject;assets:AudioAsset[]}{
 if(bytes.byteLength>limit+5*1024*1024)throw Error('La copia del proyecto supera 205 MB.');
 if(bytes[0]!==80||bytes[1]!==75)return{project:validateStory(JSON.parse(strFromU8(bytes))),assets:[]};
 let total=0;const files=unzipSync(bytes,{filter:f=>{total+=f.originalSize;if(total>limit+5*1024*1024||f.originalSize>50*1024*1024)throw Error('La copia contiene archivos demasiado grandes.');if(f.name!=='story.json'&&!/^audio\/[\w-]{1,100}$/.test(f.name))throw Error('La copia contiene una ruta no válida.');return true;}});
 if(!files['story.json'])throw Error('Falta la historia en esta copia.');
 const manifest=JSON.parse(strFromU8(files['story.json'])),project=validateStory(manifest.project);
 if(!Array.isArray(manifest.assets)||manifest.assets.length>2000)throw Error('La biblioteca de audio no es válida.');
 const ids=new Set<string>();const assets=manifest.assets.map((metadata:Omit<AudioAsset,'blob'>)=>{if(!metadata||ids.has(metadata.id))throw Error('Hay pistas repetidas en la copia.');ids.add(metadata.id);const data=files['audio/'+metadata.id];if(!data)throw Error('Falta una pista en la copia.');return validateAsset({...metadata,blob:new Blob([data.slice().buffer as ArrayBuffer],{type:metadata.mime})});});
 for(const clip of project.audio?.clips??[])if(!clip.assetId.startsWith('builtin:')&&!ids.has(clip.assetId))throw Error('Falta el audio utilizado en el proyecto.');
 return{project,assets};
}
