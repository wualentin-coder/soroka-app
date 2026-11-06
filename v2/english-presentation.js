/* Presentation only. Native API, dictionary, grading and persistence retain their owners. */
(() => {
 'use strict';
 const disclosureOpen=new Map();let listening=false;
 const disclosureSelector='.ef-method,.result-details,.training-itinerary';
 function restoreDisclosures(fragment){
  if(!listening){listening=true;document.addEventListener('toggle',event=>{const details=event.target;if(!details.matches?.(disclosureSelector)||!details.isConnected)return;const key=details.dataset.efDisclosure;if(key)disclosureOpen.set(key,details.open);},true);}
  for(const details of fragment.querySelectorAll(disclosureSelector)){
   const key=details.dataset.efDisclosure||details.querySelector('summary')?.textContent.trim();if(!key)continue;
   details.dataset.efDisclosure=key;if(disclosureOpen.has(key))details.open=disclosureOpen.get(key);
  }
 }
 function compact(fragment,icon){
  fragment.querySelector('.page-heading .date')?.remove();
  fragment.querySelectorAll('.en-swipe-tip').forEach(node=>node.remove());
  fragment.querySelector('.lv-word-rhythm .section-note')?.remove();
  fragment.querySelector('.lv-word-rhythm [data-tab=phrases] small')?.remove();
  const assessment=fragment.querySelector('.en-place');
  assessment?.querySelector(':scope>div>b')?.remove();
  const assessmentTime=assessment?.querySelector(':scope>div>small');if(assessmentTime)assessmentTime.textContent='40 слов · ≈3 мин';
  const ruleNote=fragment.querySelector('.en-rules-head small');if(ruleNote?.textContent.startsWith('По вашим ошибкам'))ruleNote.remove();
  const extra=fragment.querySelector('.lv-secondary');if(extra?.querySelector('.en-rules'))extra.querySelector(':scope>.lv-region-head')?.remove();
  const facts=fragment.querySelector('.en-facts-toggle');if(facts?.textContent.startsWith('Что Эмма знает'))facts.textContent='Память'+(facts.textContent.match(/·\s*\d+/)?.[0]?' '+facts.textContent.match(/·\s*\d+/)[0]:'');
  if(icon)for(const action of fragment.querySelectorAll('.en-rule-go')){action.innerHTML=icon('arrow','icon-sm');action.setAttribute('aria-hidden','true');}
  for(const note of fragment.querySelectorAll('.lv-lesson-route .en-step small')){
   const text=note.textContent.trim();
   if(text==='правило, упражнения, диктант, проверка'||text==='голосом, с новыми словами и грамматикой')note.remove();
   else if(text.includes('свайп «знаю / не знаю»'))note.textContent=text.replace(/\s*·\s*свайп.*$/,'').replace(/^и\s+/,'');
   else if(text.startsWith('вспомнить;'))note.textContent=text.replace(/^вспомнить;\s*/,'');
  }
  const guidance=fragment.querySelector('.en-hero>.section-note');
  if(guidance?.textContent.startsWith('Упражнения — на предложениях'))guidance.remove();
  const method=fragment.querySelector('.en-metrics')?fragment.querySelector('.lv-progress-section>.section-note,.en-situation>.section-note'):null;
  if(method){const details=document.createElement('details');details.className='ef-method';details.innerHTML='<summary>Как считается прогресс</summary>';method.before(details);details.append(method);}
  restoreDisclosures(fragment);
 }
 function addProgress(fragment,{tab,icon,native=true}={}){
  const page=fragment.querySelector('.en-page'),nav=page?.querySelector(':scope>.lv-module-nav,:scope>.en-tabs');if(!page||!nav)return;
  nav.querySelector('[data-tab=progress]')?.remove();
  if(tab==='progress'){const today=nav.querySelector('[data-tab=today]');today?.classList.add('active');today?.setAttribute('aria-selected','true');return;}
  if(tab!=='today')return;
  const previous=page.querySelector('.lv-lesson-scene>.ef-today-actions'),previousStamp=previous?.querySelector('.lv-eyebrow');if(previousStamp)previous.before(previousStamp);
  page.querySelectorAll('[data-action=en-tab][data-tab=progress],.ef-today-actions').forEach(node=>node.remove());
  const region=document.createElement('div');region.className='ef-today-actions';
  const button=document.createElement('button');button.type='button';button.className='icon-button ef-icon-control';button.setAttribute('aria-label','Мой прогресс');button.title='Мой прогресс';button.innerHTML=icon('chart','icon-sm');
  if(native){button.dataset.action='en-tab';button.dataset.tab='progress';}else button.dataset.efRoute='progress';
  region.append(button);
  const lesson=page.querySelector('.lv-lesson-scene'),stamp=lesson?.querySelector(':scope>.lv-eyebrow');
  if(lesson){if(stamp)region.prepend(stamp);lesson.prepend(region);}else nav.after(region);
  page.querySelectorAll('.en-today-links:empty,.lv-quick-links:empty').forEach(node=>node.remove());
 }
 function installNative({getState,icon}={}){
  // A missing real bridge is a failed preflight, never a request to install demo providers.
  if(typeof window.sorokaEnglish!=='function'||typeof window.renderEnglishPage!=='function'||typeof getState!=='function'||typeof icon!=='function')return {installed:false,reason:'native_bridge_required'};
  if(window.renderEnglishPage.flowEnglishMinimal)return {installed:true,repeated:true};
  const previous=window.renderEnglishPage;
  const wrapped=function(...args){const markup=previous.apply(this,args),template=document.createElement('template');template.innerHTML=markup;compact(template.content,icon);addProgress(template.content,{tab:getState().tab||'today',icon});const holder=document.createElement('div');holder.append(template.content);return holder.innerHTML;};
  wrapped.flowEnglishMinimal=true;window.renderEnglishPage=wrapped;
  return {installed:true};
 }
 window.FlowEnglishPresentation=Object.freeze({compact,addProgress,restoreDisclosures,installNative});
})();
