export function encodeWav(channels:Float32Array[],sampleRate:number){
 const length=channels[0]?.length??0;if(!length||channels.some(c=>c.length!==length))throw Error('El audio no tiene muestras válidas.');
 const bytes=new Uint8Array(44+length*channels.length*2),view=new DataView(bytes.buffer);
 const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels.length,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels.length*2,true);view.setUint16(32,channels.length*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,bytes.length-44,true);
 let peak=1;for(const c of channels)for(const sample of c)peak=Math.max(peak,Math.abs(sample));
 let at=44;for(let i=0;i<length;i++)for(const c of channels){const sample=Math.max(-1,Math.min(1,c[i]/peak));view.setInt16(at,Math.round(sample*(sample<0?32768:32767)),true);at+=2;}return bytes;
}
/** Standard RIFF INFO metadata travels with the WAV; no manuscript is included. */
export function wavWithCredits(wav:Uint8Array,credits:string){
 const text=new TextEncoder().encode(credits+'\0'),padded=text.length+(text.length%2),bytes=new Uint8Array(wav.length+20+padded);bytes.set(wav);
 const view=new DataView(bytes.buffer),label=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
 view.setUint32(4,bytes.length-8,true);const at=wav.length;label(at,'LIST');view.setUint32(at+4,12+padded,true);label(at+8,'INFO');label(at+12,'ICMT');view.setUint32(at+16,text.length,true);bytes.set(text,at+20);return bytes;
}
