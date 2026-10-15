import type {Character} from './stories-model';
export function dialogueSpeaker(text:string,characters:Character[]){
 const match=/^\s*([^:：]{1,100})[:：]\s*/u.exec(text);if(!match)return null;
 const name=match[1].trim().normalize('NFC').toLocaleLowerCase();
 const candidates=characters.filter(c=>[c.name,...c.aliases.split(',')].some(n=>n.trim().normalize('NFC').toLocaleLowerCase()===name));
 return {prefix:match[0].length,name:match[1].trim(),character:candidates.length===1?candidates[0]:undefined,ambiguous:candidates.length>1};
}
