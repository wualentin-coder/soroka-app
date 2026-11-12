import '../../../prototypes/soroka-planner/flow-ui/setting-row.js';
import '../../../prototypes/soroka-planner/flow-ui/attachment.js';
export const packetSix=[
 {id:'R07',name:'Строка параметра',version:'0.2.0',source:'setting-row.js',layout:'packet6.css',deps:['F01','B01'],uses:['Параметры заметки и материала','Настройки раздела'],target:['more.js','saved.js','notes.js','digital-directory.js'],render:s=>`<flow-surface><flow-setting-row setting-id="category" icon="list" label="Раздел" value="Материалы" state="${s}"></flow-setting-row><flow-setting-row setting-id="visibility" icon="note" label="Доступ" meta="Кто видит запись" value="Только я" state="${s}"></flow-setting-row></flow-surface>`,states:['rest','loading','error','offline','disabled']},
 {id:'A01',name:'Вложения',version:'0.1.0',source:'attachment.js',layout:'packet6.css',deps:['F01','B01','B02'],uses:['Файлы заметки','Изображение и PDF материала'],target:['note-editor.js','saved.js','digital-collections.js'],render:s=>`<flow-attachment name="attachments" aria-label="Файлы записи" state="${s}"></flow-attachment>`,states:['rest','loading','error','offline','disabled']}
];
