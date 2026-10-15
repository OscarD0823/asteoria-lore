import {useState} from 'react';
import {ImagePlus} from 'lucide-react';
import {loreBackdrops,readArtwork,type LoreBackdrop} from './lore-artwork';
export function BackdropPicker({label,value,onChange,onError}:{label:string;value?:LoreBackdrop;onChange:(value:LoreBackdrop)=>void;onError:(e:unknown)=>void}){
 const [busy,setBusy]=useState(false);
 async function upload(file:File){setBusy(true);try{onChange({theme:value?.theme??'paper',image:await readArtwork(file)});}catch(e){onError(e);}finally{setBusy(false);}}
 return <fieldset className="lore-backdrops"><legend>{label}</legend><div>{loreBackdrops.map(b=><button key={b.id} title={b.name} aria-label={label+': '+b.name} aria-pressed={(value?.theme??'paper')===b.id&&!value?.image} style={{background:`linear-gradient(135deg,${b.base},${b.end})`,color:b.ink}} onClick={()=>onChange({theme:b.id})}>{b.name}</button>)}</div><label className="lore-upload"><ImagePlus size={16}/>{busy?'Preparando imagen…':'Subir mi fondo'}<input aria-label={'Subir '+label.toLocaleLowerCase()} disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value='';}}/></label>{value?.image&&<button onClick={()=>onChange({theme:value.theme})}>Quitar fondo subido</button>}<small>PNG, JPEG o WebP, hasta 8 MB. Se guarda en tu proyecto.</small></fieldset>;
}
