import {Mark,mergeAttributes} from '@tiptap/core';
export const SpeakerMark=Mark.create({
 name:'speaker',inclusive:false,
 addAttributes(){return{speakerId:{default:'narrator',parseHTML:element=>element.getAttribute('data-speaker-id'),renderHTML:attributes=>({'data-speaker-id':attributes.speakerId})}};},
 parseHTML(){return[{tag:'span[data-speaker-id]'}];},
 renderHTML({HTMLAttributes}){return['span',mergeAttributes(HTMLAttributes,{class:'lore-speaker'}),0];},
});
// A recognized 'Name:' remains visible in the manuscript but is not spoken.
export const SpeakerLabel=Mark.create({
 name:'speakerLabel',inclusive:false,
 parseHTML(){return[{tag:'span[data-speaker-label]'}];},
 renderHTML(){return['span',{'data-speaker-label':'true',class:'lore-speaker-label'},0];},
});
