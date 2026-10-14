import {useEffect,useState} from 'react';
import {Download,Mic,Play,Trash2} from 'lucide-react';
import {classicProfiles,voiceFor,upgradeClassicVoices,type Audiobook,type Voice} from './audio-model';
import {chapterLanguage,isNeural,languageName,naturalLanguages,neuralVoices,resolveNeuralVoice} from './voice-language';
import {removeVoiceModel,storedVoiceModels} from './neural-cache';
import type {StoryProject} from './stories-model';

type Props={project:StoryProject;audio:Audiobook;text:string;busy:boolean;patch:(changes:Partial<Audiobook>)=>void;patchVoice:(id:string,changes:Partial<Voice>)=>void;preview:(id:string)=>void;download:(id:string)=>Promise<void>;onError:(e:unknown)=>void};
export function VoicePanel({project,audio,text,busy,patch,patchVoice,preview,download,onError}:Props){
 const [stored,setStored]=useState<string[]>([]),[library,setLibrary]=useState(false);
 const refresh=()=>storedVoiceModels().then(setStored).catch(onError);
 useEffect(()=>{void refresh();},[busy]);
 const fallback=chapterLanguage(text,audio.language),legacy=Object.values(audio.voices).some(v=>!isNeural(v));
 function upgrade(){patch(upgradeClassicVoices(audio));}
 return <><div className="lore-natural-head"><div><strong>Voces neuronales · {neuralVoices.length} voces · {naturalLanguages.length} idiomas</strong><p>Daniela High es la voz de Fortuna Real. En Automático, cada fragmento usa una voz compatible con su idioma. El timbre puede cambiar entre idiomas; donde no hay voces de ambos géneros se utiliza la disponible.</p></div><label>Idioma del capítulo<select disabled={busy} value={audio.language??'auto'} onChange={e=>patch({language:e.target.value})}><option value="auto">Detectar automáticamente</option>{naturalLanguages.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><small>Idioma principal: {languageName(fallback)}. Elige uno si el texto es breve o ambiguo.</small></label></div>
 {legacy&&<p className="lore-audio-help">Este proyecto conserva voces clásicas de una versión anterior. <button disabled={busy} onClick={upgrade}>Cambiar todas a voces neuronales</button></p>}
 <div className="lore-voice-grid">{[{id:'narrator',name:'Narrador',portrait:''},...project.characters].map(character=>{
  const v=voiceFor(audio,character.id);let actual:ReturnType<typeof resolveNeuralVoice>|undefined,message='';
  try{if(isNeural(v))actual=resolveNeuralVoice(v,text,fallback);}catch(e){message=e instanceof Error?e.message:String(e);}
  return <article key={character.id} className="lore-voice-card"><div>{character.portrait?<img src={character.portrait} alt=""/>:<Mic/>}<h3>{character.name}</h3><button disabled={busy} onClick={()=>preview(character.id)} aria-label={'Escuchar voz de '+character.name}><Play size={16}/></button></div>
  <label>Voz preferida<select disabled={busy} aria-label={'Voz de '+character.name} value={v.profile} onChange={e=>patchVoice(character.id,{profile:e.target.value,pitch:50})}><optgroup label="Adaptables al idioma"><option value="neural-f">Femenina neuronal · automática</option><option value="neural-m">Masculina neuronal · automática</option></optgroup>{['Femeninas','Masculinas','Otras voces'].map(group=><optgroup key={group} label={group+' · neuronales'}>{neuralVoices.filter(p=>p.gender===group).map(p=><option key={p.id} value={'piper:'+p.id}>{p.name}</option>)}</optgroup>)}<optgroup label="Síntesis clásica · compatibilidad">{classicProfiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></select></label>
  <label>Idioma de este personaje<select disabled={busy} value={v.language} onChange={e=>patchVoice(character.id,{language:e.target.value})}><option value="auto">Automático · según el texto</option>{naturalLanguages.map(([id,name])=><option key={id} value={id}>{name}</option>)}{!['auto',...naturalLanguages.map(l=>l[0])].includes(v.language)&&<option value={v.language}>{v.language}</option>}</select></label>
  <div className="lore-audio-fields"><label>Velocidad (base 165)<input disabled={busy} aria-label={'Velocidad de '+character.name} type="number" min="80" max="320" value={v.speed} onChange={e=>patchVoice(character.id,{speed:Math.max(80,Math.min(320,Number(e.target.value)||165))})}/></label><label>Volumen %<input disabled={busy} type="number" min="0" max="100" value={Math.round(v.volume*100)} onChange={e=>patchVoice(character.id,{volume:Math.max(0,Math.min(100,Number(e.target.value)||0))/100})}/></label>{!isNeural(v)&&<label>Tono clásico<input disabled={busy} type="number" min="0" max="99" value={v.pitch} onChange={e=>patchVoice(character.id,{pitch:Math.max(0,Math.min(99,Number(e.target.value)||0))})}/></label>}</div>
  {actual&&<div className="lore-model-state"><small>En este capítulo: {actual.name} · {languageName(actual.language)} · {Math.ceil(actual.bytes/1048576)} MB</small><button disabled={busy} onClick={()=>void download(actual!.id).then(refresh)}><Download size={14}/>{stored.includes(actual.sha256)?'Voz lista sin conexión':'Descargar voz para uso local'}</button></div>}{message&&<p role="status">{message}</p>}
  </article>;
 })}</div>
 <p className="lore-audio-help">La primera escucha descarga el modelo indicado. Solo se descargan archivos públicos de voz; el manuscrito se genera y exporta aquí. Después funciona sin conexión si conservas la voz. <button onClick={()=>setLibrary(!library)}>{library?'Ocultar':'Administrar'} voces descargadas</button></p>
 {library&&<div className="lore-downloaded-models">{neuralVoices.filter((v,i,all)=>stored.includes(v.sha256)&&all.findIndex(x=>x.sha256===v.sha256)===i).map(v=><article key={v.sha256}><span>{v.model} · {Math.ceil(v.bytes/1048576)} MB</span><a href={v.cardUrl} target="_blank" rel="noreferrer">Ficha y licencia</a><button disabled={busy} aria-label={'Eliminar voz descargada '+v.name} onClick={()=>void removeVoiceModel(v.sha256).then(refresh).catch(onError)}><Trash2 size={15}/></button></article>)}{!stored.length&&<p>Aún no hay modelos descargados.</p>}</div>}
 </>;
}
