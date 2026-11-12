import '../../../prototypes/soroka-planner/flow-ui/record-card.js';
import '../../../prototypes/soroka-planner/flow-ui/content-state.js';

// Reuse the local library image; no remote media or record request.
const thumbnail=new URL('../../../prototypes/soroka-planner/assets/weekend-street.png',import.meta.url).href;
export const packetFour=[
 {id:'R05',name:'Карточка сохранённой записи',version:'0.2.0',source:'record-card.js',layout:'packet4.css',assets:[thumbnail],deps:['F01','B01'],uses:['Заметка, материал и список','Открытие записи и отдельная закладка'],target:['saved.js','digital-collections.js','notes.js'],render:s=>`<div class="packet-four-records"><flow-record-card record-id="sample-note" kind="note" title="Идея для проекта" meta="Сегодня" state="${s}"></flow-record-card><flow-record-card record-id="sample-material" kind="material" title="Идеи для выходных" meta="Статья · 6 мин" thumbnail="${thumbnail}" state="${s}"></flow-record-card><flow-record-card record-id="sample-list" kind="list" title="Покупки на неделю" meta="3 из 8" bookmarked state="${s}"></flow-record-card></div>`,states:['rest','loading','error','offline','disabled']},
 {id:'P01',name:'Состояние содержимого',version:'0.2.0',source:'content-state.js',layout:'packet4.css',deps:['F01','B01','B02'],uses:['Пустая коллекция и загрузка','Ошибка и отсутствие связи'],target:['saved.js','digital-collections.js','english.js','sport.js'],render:s=>`<flow-content-state state="${s}"></flow-content-state>`,states:['empty','loading','error','offline']}
];
