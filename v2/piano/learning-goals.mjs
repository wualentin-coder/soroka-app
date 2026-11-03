import {evaluateLearningGoal,SKILLS} from './learning-path.mjs?v=d0006efbea09';
import {CURATED_SONG_GOALS} from './curriculum-data.mjs?v=d0006efbea09';

/** A catalogue aid for starting a guided opening, not a full-song assessment. */
export function getLearningGoal(compositionOrId,progress,{date,input='mic',hand='right'}={}){
  const composition=compositionOrId&&typeof compositionOrId==='object'?compositionOrId:null;
  const compositionId=typeof compositionOrId==='string'?compositionOrId:composition?.id;
  const sourceAllowed=!composition?.source||['builtin','builtin-midi','builtin-arrangement'].includes(composition.source);
  const known=typeof compositionId==='string'&&Object.hasOwn(CURATED_SONG_GOALS,compositionId)&&sourceAllowed;
  const actualHand=['right','left','both'].includes(hand)?hand:'right';
  const base={compositionId:typeof compositionId==='string'?compositionId.slice(0,80):null,hand:actualHand,
    scope:actualHand==='both'?'guided-opening-both':actualHand==='left'?'guided-opening-left':'guided-opening-right',
    canStart:true,fullSongMastery:false};
  const evidence=known?evaluateLearningGoal(progress,{compositionId,hand:actualHand,date}):{known:false,requiredSkillIds:[],missingSkillIds:[],recommendedLessonIds:[],ready:false};
  if(!evidence.known)return {...base,status:'unknown',difficulty:'unknown',label:'Разберём вместе',
    requiredSkillIds:[],missingSkillIds:[],recommendedLessonIds:[],readiness:null,
    reason:'Для этой партии нет проверенной карты подготовки. Можно изучать с ожиданием; готовность всей композиции не определена.'};
  const difficulty=CURATED_SONG_GOALS[compositionId].difficulty;
  const missing=evidence.missingSkillIds.length;
  const missingSkills=evidence.missingSkillIds.map(id=>({id,title:SKILLS.find(skill=>skill.id===id)?.title||id}));
  return {...base,...evidence,status:evidence.ready?'ready':'prepare',difficulty,readiness:evidence.ready,
    label:evidence.ready?difficulty==='beginner'?'Для начала':'К первому фрагменту':`Подготовим ${missing} ${missing===1?'навык':missing<5?'навыка':'навыков'}`,
    missingSkills,assessment:actualHand==='both'&&input!=='midi'?'microphone-beta':'notes-and-onsets',
    reason:evidence.ready?'Можно начать первый фрагмент с ожиданием. Это не означает, что вся песня освоена.':
      'Небольшая подготовка поможет с первым фрагментом. Саму композицию можно открыть уже сейчас.'};
}
