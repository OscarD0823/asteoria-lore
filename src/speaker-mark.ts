import {Mark,mergeAttributes} from '@tiptap/core';
export const SpeakerMark=Mark.create({
 name:'speaker',inclusive:false,
 addAttributes(){return{speakerId:{default:'narrator',parseHTML:element=>element.getAttribute('data-speaker-id'),renderHTML:attributes=>({'data-speaker-id':attributes.speakerId})}};},
 parseHTML(){return[{tag:'span[data-speaker-id]'}];},
 renderHTML({HTMLAttributes}){return['span',mergeAttributes(HTMLAttributes,{class:'lore-speaker'}),0];},
});
