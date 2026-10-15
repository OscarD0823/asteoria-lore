export const loreBackdrops=[
 {id:'paper',name:'Papel',base:'#f5f1fb',end:'#e5def2',ink:'#302b42'},
 {id:'parchment',name:'Pergamino',base:'#f5e6c9',end:'#d9bc87',ink:'#49321c'},
 {id:'cosmos',name:'Constelaciones',base:'#19213d',end:'#504179',ink:'#f6f0ff'},
 {id:'forest',name:'Bosque',base:'#d9e9df',end:'#95b8a1',ink:'#173d2b'},
 {id:'rose',name:'Aurora',base:'#f8e2ee',end:'#dcb3d1',ink:'#542b48'},
] as const;
export type LoreBackdrop={theme:typeof loreBackdrops[number]['id'];image?:string};
export function validateLocalImage(image:unknown){if(image===undefined||image==='')return;if(typeof image!=='string'||image.length>6_000_000||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(image))throw Error('Usa una imagen local PNG, JPEG o WebP.');}
export function validateBackdrop(value:unknown){if(value===undefined)return;const b=value as LoreBackdrop;if(!b||typeof b!=='object'||!loreBackdrops.some(t=>t.id===b.theme))throw Error('El fondo no es válido.');validateLocalImage(b.image);}
export function backdropTheme(value?:LoreBackdrop){return loreBackdrops.find(t=>t.id===value?.theme)??loreBackdrops[0];}
export function backdropStyle(value?:LoreBackdrop){const theme=backdropTheme(value);return{backgroundColor:theme.base,backgroundImage:value?.image?`linear-gradient(#ffffff65,#ffffff65),url("${value.image}")`:`linear-gradient(135deg,${theme.base},${theme.end})`,backgroundSize:'cover',backgroundPosition:'center'};}
// Decode and resize locally. Never retain a file URL or fetch an image server.
export async function readArtwork(file:File,portrait=false){
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024)throw Error('Usa PNG, JPEG o WebP de hasta 8 MB.');
 const bitmap=await createImageBitmap(file);
 try{if(!bitmap.width||!bitmap.height)throw Error('La imagen está vacía.');const scale=Math.min(1,(portrait?768:1600)/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar la imagen.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/webp',.85);validateLocalImage(result);return result;}finally{bitmap.close();}
}
