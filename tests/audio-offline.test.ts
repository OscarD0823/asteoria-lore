import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectVoiceModels} from '../src/audio-offline';
import {createStory,blankCharacter} from '../src/stories-model';
import {defaultAudiobook,defaultVoice} from '../src/audio-model';

test('preparación offline incluye idiomas dentro de un capítulo y voces de personajes aún sin diálogo',()=>{
 const project=createStory(),person=blankCharacter('Alba');project.characters=[person];project.audio=defaultAudiobook();
 project.audio.voices[person.id]={...defaultVoice(),profile:'neural-m',language:'fr'};
 project.chapters[0].html='<p>Cada historia empieza con una idea. La noche estaba tranquila y los niños miraban las estrellas.</p><p>Every evening the children gathered in the garden, where their grandfather told stories about the stars.</p>';
 const models=projectVoiceModels(project);assert.deepEqual(new Set(models.map(m=>m.language)),new Set(['es','en','fr']));
 assert.equal(models.find(m=>m.language==='fr')?.gender,'Masculinas');
});

test('dos personajes de un modelo multispeaker necesitan una sola descarga y respeta voces clásicas explícitas',()=>{
 const project=createStory(),person=blankCharacter();project.characters=[person];project.audio=defaultAudiobook();
 project.audio.voices.narrator={...defaultVoice(),profile:'piper:es_ES-sharvard-medium-0'};
 project.audio.voices[person.id]={...defaultVoice(),profile:'piper:es_ES-sharvard-medium-1'};
 assert.equal(projectVoiceModels(project).length,1);
 project.audio.voices[person.id]={...defaultVoice(),profile:'f1',language:'es-la'};
 assert.equal(projectVoiceModels(project).length,1);
 project.audio.voices.narrator={...defaultVoice(),language:'ja'};
 assert.throws(()=>projectVoiceModels(project),/Todavía no hay una voz neuronal/);
});
