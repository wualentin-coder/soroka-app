import '../../../prototypes/soroka-planner/flow-ui/sport-workspace.js';
export function sportSpecimenModel(state='today'){
 const date='2026-11-12',exercise={id:'row',name:'Тяга гантели в наклоне',scheme:'3 × 10',mode:'reps',sets:3,executionSeconds:40,restSeconds:60,technique:'Сохраняй устойчивую опору. Веди локоть назад, без рывка корпуса.',primary:['lats'],secondary:['biceps'],videoId:null};
 return {profileId:'sport-map-only',ownerEpoch:'map-epoch-1',viewRevision:0,dataRevision:0,sync:{state:['loading','offline','error'].includes(state)?state:'ready',pending:0,...(state==='error'?{error:'Не удалось загрузить тренировку.'}:{})},route:{tab:['today','training','profile','history'].includes(state)?state:'today',date,kind:'main'},workouts:[{key:'strength|2026-11-12|1',date,kind:'main',title:'Спина и плечи',programTitle:'Силовая программа',readOnly:false,finished:false,exercises:[exercise,{...exercise,id:'plank',name:'Планка',scheme:'2 × 30 сек',mode:'timed',sets:2,executionSeconds:30,restSeconds:45,primary:['abs'],secondary:[],technique:'Сохраняй удобное положение корпуса и ровное дыхание.'}],counts:[1,0]}],selectedWorkoutKey:'strength|2026-11-12|1',workoutKeys:['strength|2026-11-12|1'],minimized:false,error:null,media:{items:[],selectedId:null,source:null},session:state==='session'?{workoutKey:'strength|2026-11-12|1',stepKey:'work:row:2',phase:'work',block:'main',index:0,set:2,total:3,exercise,next:{...exercise,id:'plank',name:'Планка',scheme:'2 × 30 сек'},clock:{deadline:0,pausedMs:28000},totalMs:40000,elapsedSeconds:75,active:true,remainingSeconds:28,paused:true,skipped:[],error:null}:null,profile:{fields:structuredClone(metadata.fields),gaps:{profile:true},targetMuscles:['lats'],equipment:{dumbbells:{has:true,kg:10,kind:'pair',future:'keep'}},equipmentItems:structuredClone(metadata.equipmentItems),trainingPlace:{where:'home',unknown:'keep'},trainingPlaces:structuredClone(metadata.trainingPlaces),weekdays:structuredClone(metadata.weekdays),muscleGroups:structuredClone(metadata.muscleGroups),favorites:[],measurementFields:[{id:'weight',label:'Вес',unit:'кг',history:[{value:'76',recordedAt:date}]}]},history:{sessions:[{key:'previous',date:'2026-11-10',title:'Силовая тренировка',program:'Силовая программа',kind:'main',status:'active',consciouslyFinished:false,seconds:null,exercises:[{name:exercise.name,completedSets:2,plannedSets:3,actualReps:null,actualSets:[{setNumber:1,kilograms:10,basis:'на одну гантель',actualReps:10}],setsWithoutDetailedLog:1}]}],exercises:[{name:exercise.name,sessions:1,completedSets:2,plannedSets:3,lastDate:'2026-11-10',weights:[{date:'2026-11-10',kilograms:10,basis:'per_dumbbell',reps:10}]}]},journal:null,capabilities:{privateMedia:false,nativePhaseOnlyV2:false,muscleMap:false}};
}
// This specimen owns only in-memory DTO edits. Training commands require the real domain owner.
export class SportWorkspaceExample extends HTMLElement{
 connectedCallback(){if(this.workspace)return;this._journals=new Map();this._model=sportSpecimenModel(this.getAttribute('state')||'today');const workspace=this.workspace=document.createElement('flow-sport-workspace');workspace.model=this._model;workspace.addEventListener('flow-sport-request',event=>{event.preventDefault();event.stopPropagation();this.intent(event.detail)});this.append(workspace);}
 get model(){return structuredClone(this._model)}
 intent({requestId,ownerEpoch,baseRevision,intent}){
  const next=structuredClone(this._model),workspace=this.workspace;let accepted='local',data;
  try{
   if(ownerEpoch!==next.ownerEpoch)throw Error('Владелец изменился.');if(baseRevision!==next.dataRevision)throw Error('Данные изменились. Повтори действие.');
   if(intent.kind==='view'){if(intent.tab)next.route.tab=intent.tab;if(intent.date)next.route.date=intent.date;if(intent.workoutKind)next.route.kind=intent.workoutKind;accepted='read';}
   else if(intent.kind==='refresh'){next.sync={state:'ready',pending:0};accepted='read';}
   else if(intent.kind==='profile'){
    if(intent.action==='saveFields'){for(const field of next.profile.fields)if(Object.hasOwn(intent.changes,field.key))field.value=intent.changes[field.key];}
    else if(intent.action==='saveEquipment'){for(const[id,patch]of Object.entries(intent.changes.equipment||{}))next.profile.equipment[id]={...next.profile.equipment[id],...patch};if(intent.changes.trainingPlace)next.profile.trainingPlace={...next.profile.trainingPlace,...intent.changes.trainingPlace};}
    else if(intent.action==='saveMuscles')next.profile.targetMuscles=structuredClone(intent.changes.targetMuscles);
    else if(intent.action==='saveMeasurement'){const field=next.profile.measurementFields.find(f=>f.id===intent.changes.fieldId);if(!field)throw Error('Параметр не найден.');field.history.unshift({value:intent.changes.value,recordedAt:next.route.date});}
    else throw Error('Это действие подключает владелец тренировок.');
   }else if(intent.kind==='journal'){
    if(intent.action==='open'){next.journal={draftId:intent.draftId,sets:[],workoutKey:intent.workoutKey,exerciseId:intent.exerciseId,unit:intent.exerciseId==='plank'?'seconds':'reps',previousUnit:'unknown',today:[],previous:[{reps:10,kilograms:10}],previousDate:'2026-11-10',basis:'per_dumbbell'};const saved=this._journals.get(intent.workoutKey+'|'+intent.exerciseId)||[];next.journal.today=structuredClone(saved);next.journal.sets=structuredClone(saved);accepted='read';}
    else if(intent.action==='save'){this._journals.set(intent.workoutKey+'|'+intent.exerciseId,structuredClone(intent.sets));next.journal=null;}
    else if(intent.action==='copyPrevious'){if(next.journal.previousUnit!==next.journal.unit)throw Error('Единицы предыдущей записи неизвестны.');data={sets:structuredClone(next.journal.previous)};accepted='read';}
   }else throw Error('Управление тренировкой подключает владелец программы.');
   if(accepted==='local')next.dataRevision++;next.viewRevision++;this._model=next;workspace.model=next;workspace.settle(requestId,{ok:true,accepted,dataRevision:next.dataRevision,pending:0,...(data?{data}:{})});
  }catch(error){workspace.settle(requestId,{ok:false,error:error.message,code:'unavailable'})}
 }
}
if(!customElements.get('flow-sport-workspace-example'))customElements.define('flow-sport-workspace-example',SportWorkspaceExample);
export const packetTwentySeven=[{id:'SP14',name:'Спорт · программа и занятие',version:'0.2.0',source:'sport-workspace.js',sample:'packet27.js',layout:'packet27.css',extraSources:['dialog-header.js'],deps:['B01','B02','I01','M01'],states:['today','training','profile','history','session','loading','offline','error'],uses:['Четыре раздела, анкета, журнал подходов и история','Один снимок таймера владельца; нет локального зачёта'],target:['sport-train.js','sport-more.js','sport-session.js'],render:state=>`<flow-sport-workspace-example state="${state}"></flow-sport-workspace-example>`}];
// Metadata projected from the actual SportCore PROFILE_FIELDS/EQUIPMENT/MUSCLE_GROUPS, 2026-11-12. No domain algorithms copied.
const metadata={
 "trainingPlaces":[{"id":"home","label":"Дома","hint":"Только домашний инвентарь"},{"id":"gym","label":"В зале","hint":"Каждое занятие в зале"},{"id":"mixed","label":"По-разному","hint":"Часть дней в зале, часть дома"}],
 "weekdays":["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],
 "fields": [
  {
   "key": "name",
   "label": "Как тебя зовут",
   "value": null,
   "type": "text",
   "optional": true,
   "health": false
  },
  {
   "key": "birthDate",
   "label": "Дата рождения",
   "value": null,
   "type": "date",
   "optional": true,
   "health": false
  },
  {
   "key": "sex",
   "label": "Пол",
   "value": null,
   "type": "choice",
   "optional": true,
   "health": false,
   "choices": [
    "Мужской",
    "Женский"
   ]
  },
  {
   "key": "schedule",
   "label": "Тренировок в неделю",
   "value": null,
   "type": "range",
   "optional": true,
   "health": false,
   "min": 1,
   "max": 7,
   "step": 1
  },
  {
   "key": "sessionMinutes",
   "label": "Минут на одну тренировку",
   "value": null,
   "type": "range",
   "optional": true,
   "health": false,
   "min": 15,
   "max": 120,
   "step": 5
  },
  {
   "key": "recovery",
   "label": "Сон, часов в сутки",
   "value": null,
   "type": "range",
   "optional": true,
   "health": false,
   "min": 4,
   "max": 12,
   "step": 0.5
  },
  {
   "key": "goals",
   "label": "Чего больше в программе",
   "value": null,
   "type": "range",
   "optional": true,
   "health": false,
   "min": 0,
   "max": 10,
   "step": 1
  },
  {
   "key": "symptoms",
   "label": "Насколько что-то беспокоит при движении: 0 — ничего, 5 — сильно",
   "value": null,
   "type": "range",
   "optional": true,
   "health": true,
   "min": 0,
   "max": 5,
   "step": 1
  },
  {
   "key": "diagnoses",
   "label": "Подтверждённые врачом заболевания, в том числе суставов, спины и мышц",
   "value": null,
   "type": "textarea",
   "optional": true,
   "health": true
  },
  {
   "key": "injuries",
   "label": "Травмы и операции: когда, как проходило восстановление",
   "value": null,
   "type": "textarea",
   "optional": true,
   "health": true
  },
  {
   "key": "medicalRestrictions",
   "label": "Рекомендации и ограничения врача",
   "value": null,
   "type": "textarea",
   "optional": true,
   "health": true
  },
  {
   "key": "medications",
   "label": "Лекарства или другие особенности, влияющие на нагрузку (по желанию)",
   "value": null,
   "type": "textarea",
   "optional": true,
   "health": true
  }
 ],
 "equipmentItems": [
  {
   "id": "gym",
   "label": "Тренажёрный зал",
   "hint": "Свободные веса, блочные и силовые тренажёры, кардио"
  },
  {
   "id": "bodyweight",
   "label": "Собственный вес",
   "hint": "Всегда доступен"
  },
  {
   "id": "dumbbells",
   "label": "Гантели",
   "hint": "Вес одной гантели; для разборных — максимум",
   "weighed": true,
   "kinds": [
    {
     "id": "adjustable",
     "label": "Разборные"
    },
    {
     "id": "pair",
     "label": "Пара фиксированных"
    },
    {
     "id": "single",
     "label": "Одна"
    }
   ]
  },
  {
   "id": "barbell",
   "label": "Штанга",
   "hint": "С блинами, максимум",
   "weighed": true
  },
  {
   "id": "kettlebell",
   "label": "Гиря",
   "weighed": true
  },
  {
   "id": "plates",
   "label": "Диски",
   "hint": "Максимум на один диск",
   "weighed": true
  },
  {
   "id": "band",
   "label": "Резинка"
  },
  {
   "id": "pullup_bar",
   "label": "Турник"
  },
  {
   "id": "pushup_bars",
   "label": "Упоры для отжиманий",
   "hint": "Глубже отжимания, легче запястьям"
  },
  {
   "id": "bench",
   "label": "Скамья"
  },
  {
   "id": "expander",
   "label": "Эспандер",
   "hint": "Кистевой или грудной"
  },
  {
   "id": "powerball",
   "label": "Повербол",
   "hint": "Кистевой тренажёр-гироскоп"
  }
 ],
 "muscleGroups": [
  {
   "id": "neck",
   "label": "Шея"
  },
  {
   "id": "traps",
   "label": "Трапеция"
  },
  {
   "id": "delts_front",
   "label": "Передняя дельта"
  },
  {
   "id": "delts_side",
   "label": "Средняя дельта"
  },
  {
   "id": "delts_rear",
   "label": "Задняя дельта"
  },
  {
   "id": "chest",
   "label": "Грудь"
  },
  {
   "id": "chest_upper",
   "label": "Верх груди"
  },
  {
   "id": "chest_mid",
   "label": "Середина груди"
  },
  {
   "id": "chest_lower",
   "label": "Низ груди"
  },
  {
   "id": "lats",
   "label": "Широчайшие"
  },
  {
   "id": "mid_back",
   "label": "Середина спины"
  },
  {
   "id": "lower_back",
   "label": "Поясница"
  },
  {
   "id": "biceps",
   "label": "Бицепс"
  },
  {
   "id": "triceps",
   "label": "Трицепс"
  },
  {
   "id": "forearms",
   "label": "Предплечья"
  },
  {
   "id": "abs",
   "label": "Пресс"
  },
  {
   "id": "abs_upper",
   "label": "Верх пресса"
  },
  {
   "id": "abs_lower",
   "label": "Низ пресса"
  },
  {
   "id": "obliques",
   "label": "Косые живота"
  },
  {
   "id": "glutes",
   "label": "Ягодицы"
  },
  {
   "id": "quads",
   "label": "Квадрицепс"
  },
  {
   "id": "hamstrings",
   "label": "Бицепс бедра"
  },
  {
   "id": "adductors",
   "label": "Приводящие"
  },
  {
   "id": "hip_flexors",
   "label": "Сгибатели бедра"
  },
  {
   "id": "calves",
   "label": "Икры"
  }
 ]
};
