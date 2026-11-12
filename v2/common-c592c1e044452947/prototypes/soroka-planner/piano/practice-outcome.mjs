/** Presentation only. Awards are owned by the canonical course/song graders. */
export function practiceOutcome({report=null,skipped=false,inputIssue=false,assisted=false,beta=false,source='mic',step=false,allowNext=true,passPercent=80}={}){
  const valid=report?.finished===true&&Number.isInteger(report.total)&&report.total>0;
  const silent=valid&&source==='mic'&&!(report.correct>0)&&!(report.wrong>0);
  const canAssess=valid&&!skipped&&!inputIssue&&!silent&&source!=='demo'&&!beta;
  const percent=canAssess?Math.floor(Math.max(0,Math.min(report.total,report.firstAttemptCorrect||0))*100/report.total):null;
  const threshold=Number.isFinite(passPercent)?Math.max(0,Math.min(100,passPercent)):80;
  const passed=canAssess&&!assisted&&!report.assisted&&!report.earlyAbort&&(step?report.correct===report.total:percent>=threshold);
  const status=skipped?'skipped':inputIssue||silent?'input-problem':passed?'passed':'failed';
  const title={skipped:'Пропущено', 'input-problem':'Ноты не распознаны',passed:'Выполнено',failed:'Не выполнено'}[status];
  const description=skipped?'Не выполнено. Можно вернуться к этому упражнению.':status==='input-problem'?'Попытка без оценки. Проверь звук или попробуй ещё раз.':source==='demo'?'Показ завершён. Попробуй на инструменте.':beta?'Тренировка без зачёта.':assisted||report?.assisted?'Получилось с подсказкой. Попробуй самостоятельно.':passed?(step?'Шаг пройден.':'Можно идти дальше.'):'Повтори этот рисунок в удобном темпе.';
  const primary=(status==='passed'||skipped||beta&&valid)&&allowNext?{action:'next',label:'Дальше'}:{action:'repeat',label:'Повторить'};
  const secondary=primary.action==='next'?{action:'repeat',label:'Повторить'}:{action:'course',label:'К курсу'};
  return {status,title,description,percent,showScore:percent!==null&&!step,primary,secondary,assessed:canAssess,passed};
}
