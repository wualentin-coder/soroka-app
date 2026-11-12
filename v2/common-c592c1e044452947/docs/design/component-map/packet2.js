import'../../../prototypes/soroka-planner/flow-ui/field.js';
import'../../../prototypes/soroka-planner/flow-ui/search.js';
import'../../../prototypes/soroka-planner/flow-ui/switch.js';
import'../../../prototypes/soroka-planner/flow-ui/tabs.js';
import'../../../prototypes/soroka-planner/flow-ui/confirm.js';
export const packetTwo=[
 {id:'I01',name:'Поле ввода',version:'0.4.0',source:'field.js',deps:['F01'],uses:['Название записи','Название задачи'],target:['app.js','notes.js','deploy/pc/notes_ui'],render:s=>`<flow-field aria-label="Название" placeholder="Название" name="title" state="${s}" required></flow-field>`,states:['rest','focus','loading','error','offline','disabled']},
 {id:'I02',name:'Поиск',version:'0.4.0',source:'search.js',deps:['I01'],uses:['Поиск в библиотеке','Поиск продукта'],target:['saved.js','english.js'],render:s=>`<flow-search aria-label="Найти запись" placeholder="Найти запись" state="${s}" examples="Идея для проекта|Покупки на неделю|Музыка для вечера"></flow-search>`,states:['rest','focus','loading','error','offline','disabled']},
 {id:'S01',name:'Переключатель',version:'0.4.0',source:'switch.js',deps:['F01'],uses:['Движение и свет','Звуковые отклики'],target:['more.js','deploy/pc/notes_ui'],render:s=>`<flow-switch label="Движение и свет" name="motion" ${s==='checked'?'checked':''} ${s==='disabled'?'disabled':''}></flow-switch>`,states:['rest','checked','disabled']},
 {id:'T01',name:'Вкладки',version:'0.6.0',source:'tabs.js',deps:['F01'],uses:['Разделы финансов','Вкладки библиотеки'],target:['digital-pages.js','saved.js','english.js'],render:s=>`<flow-tabs aria-label="Разделы финансов" value="overview" ${s==='disabled'?'disabled':''}><option value="overview" data-description="Сводка по счетам и расходам">Обзор</option><option value="operations" data-description="Доходы и расходы по датам">Операции</option><option value="payments" data-description="Ближайшие платежи">Платежи</option></flow-tabs>`,states:['rest','disabled']},
 {id:'D01',name:'Подтверждение действия',version:'0.7.0',source:'confirm.js',deps:['F01','B01','B02'],uses:['Удаление задачи','Удаление записи'],target:['app.js','saved.js','deploy/pc/notes_ui'],render:s=>`<flow-confirm ${s==='disabled'?'disabled':''}></flow-confirm>`,states:['rest','disabled']}
];
