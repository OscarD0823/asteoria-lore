import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {sha256} from '@noble/hashes/sha2.js';
import {defaultAudiobook,defaultVoice,validateAudiobook,voiceFor,clockTime,upgradeClassicVoices} from '../src/audio-model';
import {detectTextLanguage,resolveNeuralVoice,chapterLanguage,neuralVoices} from '../src/voice-language';
import {verifiedModel,saveVoiceModel,readVoiceModel,removeVoiceModel,storedVoiceModels} from '../src/neural-cache';
import {splitSpeech,LocalVoiceEngine} from '../src/audio-engine';
import {modelPhonemeIds} from '../src/phoneme-model';

test('idioma automático reconoce escritura de diez idiomas y evita inventarlo en frases breves',()=>{
 const samples=[
 ['es','Cada historia empieza con una idea. La noche estaba tranquila y los niños miraban las estrellas.'],
 ['en','Every evening the children gathered in the garden, where their grandfather told stories about the stars.'],
 ['fr','Chaque soir les enfants se retrouvaient dans le jardin, où leur grand-mère racontait des histoires merveilleuses.'],
 ['pt','Todas as noites as crianças se reuniam no jardim, onde seu avô contava histórias sobre as estrelas.'],
 ['de','Jeden Abend versammelten sich die Kinder im Garten, wo ihr Großvater Geschichten über die Sterne erzählte.'],
 ['it','Ogni sera i bambini si riunivano nel giardino, dove il loro nonno raccontava storie meravigliose sulle stelle.'],
 ['nl','Elke avond kwamen de kinderen samen in de tuin, waar hun grootvader verhalen vertelde over de sterren.'],
 ['pl','Każdego wieczoru dzieci zbierały się w ogrodzie, gdzie ich dziadek opowiadał historie o gwiazdach.'],
 ['ru','Каждый вечер дети собирались в саду, где их дедушка рассказывал интересные истории о звёздах.'],
 ['uk','Щовечора діти збиралися в саду, де їхній дідусь розповідав цікаві історії про зірки.'],
 ];for(const [expected,text] of samples)assert.equal(detectTextLanguage(text),expected,text);
 assert.equal(detectTextLanguage('Elena'),undefined);assert.equal(chapterLanguage('Elena','fr'),'fr');
 assert.equal(detectTextLanguage('Hola, Orion. ¿Has visto las estrellas?'),undefined);
 assert.equal(resolveNeuralVoice(defaultVoice(),'Elena','fr').language,'fr');
});
test('una voz preferida cambia a un modelo compatible al cambiar el idioma y permite anular detección',()=>{
 const v={...defaultVoice(),profile:'piper:es_AR-daniela-high-0'};
 assert.equal(resolveNeuralVoice(v,'Cada historia empieza con una idea. La noche estaba tranquila.').model,'es_AR-daniela-high');
 assert.equal(resolveNeuralVoice(v,'Every evening the children gathered in the garden to hear stories from their grandmother.').language,'en');
 assert.equal(resolveNeuralVoice({...v,language:'fr'},'Hola.').language,'fr');
 assert.equal(resolveNeuralVoice({...v,profile:'neural-m'},'Hola.').gender,'Masculinas');
});
test('idiomas sin modelo generan un aviso en lugar de pronunciación falsa o petición a un servidor',()=>{
 for(const text of ['こんにちは世界','你好世界','مرحبا بالعالم','안녕하세요','नमस्ते दुनिया'])assert.throws(()=>resolveNeuralVoice(defaultVoice(),text),/Todavía no hay una voz neuronal/);
});
test('modelos neuronales están fijados por URL inmutable, tamaño, hash y hablante válidos',()=>{
 assert.equal(new Set(neuralVoices.map(v=>v.language)).size,10);
 for(const v of neuralVoices){assert.match(v.url,/\/resolve\/[0-9a-f]{40}\//);assert.match(v.sha256,/^[0-9a-f]{64}$/);assert.ok(v.bytes>10000000);assert.ok(v.speaker>=0&&v.speaker<v.config.num_speakers);assert.ok(!/NC|Unknown/i.test(v.license));}
 const a=defaultAudiobook();validateAudiobook(a,new Set());a.voices.narrator.profile='piper:missing';assert.throws(()=>validateAudiobook(a,new Set()),/voz/);
});
test('cada voz usa su vocabulario, incluido IPA compuesto en modelos antiguos',()=>{
 const old=neuralVoices.find(v=>v.id==='de_DE-kerstin-low-0')!,current=neuralVoices.find(v=>v.id==='de_DE-thorsten-high-0')!;
 assert.deepEqual(modelPhonemeIds(['c','\u0327'],old.config.phoneme_id_map,old.config.num_symbols),[1,0,40,0,2]);
 assert.deepEqual(modelPhonemeIds(['c','\u0327'],current.config.phoneme_id_map,current.config.num_symbols),[1,0,16,0,140,0,2]);
 assert.throws(()=>modelPhonemeIds(['☃'],old.config.phoneme_id_map,old.config.num_symbols),/no puede pronunciar/);
 assert.throws(()=>modelPhonemeIds(['a'],{'^':[1],'_':[0],'$':[2],a:[99]},10),/vocabulario/);
});
test('la descarga se verifica antes de guardar y rechaza truncamiento, bytes distintos y exceso',async()=>{
 const data=new Uint8Array([1,2,3,4]),hash=Array.from(sha256(data),b=>b.toString(16).padStart(2,'0')).join(''),expected={bytes:4,sha256:hash};
 const blob=await verifiedModel(new Response(data),expected);await saveVoiceModel(hash,blob);assert.equal((await readVoiceModel(hash))?.size,4);assert.ok((await storedVoiceModels()).includes(hash));await removeVoiceModel(hash);assert.equal(await readVoiceModel(hash),undefined);
 await assert.rejects(()=>verifiedModel(new Response(data.slice(0,3)),expected),/incompleta/);
 await assert.rejects(()=>verifiedModel(new Response(new Uint8Array([1,2,3,5])),expected),/dañada/);
 await assert.rejects(()=>verifiedModel(new Response(data),{...expected,bytes:3}),/tamaño/);
});
test('compatibilidad clásica explícita, herencia segura, tiempo sin segundos 60 y cancelación inmediata',async()=>{
 const a=defaultAudiobook();a.voices.narrator={...defaultVoice(),profile:'f2',language:'es-la'};validateAudiobook(a,new Set());assert.equal(voiceFor(a,'toString'),a.voices.narrator);assert.equal(clockTime(59.99),'1:00.0');
 const upgraded=upgradeClassicVoices(a);assert.equal(upgraded.voiceVersion,2);assert.equal(upgraded.voices.narrator.profile,'neural-f');assert.equal(upgraded.voices.narrator.language,'auto');assert.equal(upgraded.voices.narrator.volume,a.voices.narrator.volume);assert.equal(a.voices.narrator.profile,'f2');
 const engine=new LocalVoiceEngine();engine.close();await assert.rejects(()=>engine.synthesize('Hola.',defaultVoice()),/cancelada/);
 const text=('Niñez árbol música. ').repeat(100),parts=splitSpeech(text,280);assert.ok(parts.every(p=>p.length<=280));assert.equal(parts.join(' '),text.trim());assert.ok(splitSpeech('🌟'.repeat(500),281).every(p=>!/[\ud800-\udbff]$/.test(p)));
});
