/** Piper models carry their own vocabulary. Older models use composed IPA
 * symbols where newer eSpeak versions emit a base plus combining mark. */
export function modelPhonemeIds(symbols:string[],map:Record<string,number[]|undefined>,limit:number){
 const mapped=(symbol:string)=>Object.hasOwn(map,symbol)?map[symbol]:undefined;
 const bos=mapped('^'),pad=mapped('_'),eos=mapped('$');
 if(!bos||!pad||!eos)throw Error('El modelo no contiene los símbolos de pronunciación necesarios.');
 const ids=[...bos,...pad];
 for(const cluster of symbols.join('').match(/[^\p{M}]\p{M}*|\p{M}+/gu)??[]){
  const raw=Array.from(cluster),composed=Array.from(cluster.normalize('NFC'));
  const sequence=raw.every(s=>mapped(s))?raw:composed.every(s=>mapped(s))?composed:raw;
  for(const symbol of sequence){const token=mapped(symbol);
   if(!token){if(/^\p{M}+$/u.test(symbol))continue;throw Error(`Esta voz no puede pronunciar el símbolo «${symbol}». Elige otra voz para este idioma.`);}
   ids.push(...token,...pad);
  }
 }
 ids.push(...eos);
 if(ids.some(n=>!Number.isInteger(n)||n<0||n>=limit))throw Error('El vocabulario de este modelo de voz no es válido.');
 return ids;
}
