/* Personal, locally served exercise catalogue. Prescriptions and journal data stay in SportCore. */
(() => {
  'use strict';
  const normalize = s => String(s || '').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storageKey = owner => `flow.sport.library.v1:${owner.scope}`;
  let catalogue = null, pending = null;
  async function load() {
    if (catalogue) return catalogue;
    if (pending) return pending;
    pending = (async () => {
      const r = await fetch('./sport-library/catalog.json', {cache:'no-cache'});
      if (!r.ok) throw Error('catalogue_unavailable');
      const data = await r.json();
      if (data.schema !== 1 || !Array.isArray(data.exercises)) throw Error('catalogue_invalid');
      catalogue = data.exercises.filter(e => /^[a-zA-Z0-9_-]{1,40}$/.test(e.id) && typeof e.name === 'string' && Array.isArray(e.instructions))
        .map(e => ({id:e.id, name:e.name, instructions:e.instructions.filter(x=>typeof x==='string'), search:normalize(e.name)}));
      return catalogue;
    })().finally(()=>{pending=null;});
    return pending;
  }
  class SportLibrary extends HTMLElement {
    connectedCallback() {
      this.owner = window.flowSportRuntime?.capture();
      this.name = this.getAttribute('exercise-name') || '';
      this.generation = (this.generation || 0) + 1;
      const generation = this.generation;
      this.hiddenListener = () => { if (document.hidden) this.querySelector('video')?.pause(); };
      document.addEventListener('visibilitychange', this.hiddenListener);
      this.innerHTML = '<p class="ss-quiet" role="status">Загружаем упражнения…</p>';
      load().then(rows => {
        if (!this.isConnected || generation !== this.generation || !this.valid()) return;
        this.rows = rows;
        let mapped;
        try { mapped = JSON.parse(localStorage.getItem(storageKey(this.owner)) || '{}')[normalize(this.name)]; } catch {}
        // Only a unique exact name, or a previous explicit choice, can bind a demonstration.
        const exact = rows.filter(e=>e.search===normalize(this.name));
        this.selected = rows.find(e=>e.id===mapped) || (exact.length===1 ? exact[0] : null);
        this.draw();
      }).catch(() => {
        if (!this.isConnected || generation !== this.generation) return;
        this.innerHTML='<p class="ss-quiet" role="status">Каталог недоступен</p><button type="button" class="ss-text" data-library-retry>Повторить</button>';
        this.querySelector('button').onclick=()=>{this.disconnectedCallback();this.connectedCallback();};
      });
    }
    valid() { return !!this.owner && window.flowSportRuntime?.current(this.owner); }
    disconnectedCallback() {
      this.generation++;
      document.removeEventListener('visibilitychange',this.hiddenListener);
      this.querySelector('video')?.pause();
    }
    draw(searching = !this.selected) {
      this.querySelector('video')?.pause();
      this.innerHTML = `<div class="ss-library-preview"></div><div class="ss-library-search" ${searching?'':'hidden'}><input type="search" placeholder="Найти упражнение" aria-label="Найти упражнение в каталоге" autocomplete="off"><div class="ss-library-results" aria-live="polite"></div></div>`;
      const preview=this.querySelector('.ss-library-preview');
      if (this.selected) {
        preview.innerHTML=`<video controls loop muted playsinline preload="metadata" poster="./sport-library/still/${this.selected.id}.webp" aria-label="Анимация: ${esc(this.selected.name)}"><source src="./sport-library/clip/${this.selected.id}.mp4" type="video/mp4"></video><div class="ss-library-caption"><strong>${esc(this.selected.name)}</strong><button type="button" class="ss-text" data-library-change>Сменить</button></div><p class="ss-quiet" data-library-error hidden role="status">Анимация недоступна. Описание ниже.</p><details class="ss-disclosure"><summary>Как выполнять</summary><ol>${this.selected.instructions.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></details>`;
        const video=preview.querySelector('video');
        const unavailable=()=>{const note=preview.querySelector('[data-library-error]');if(note)note.hidden=false;};
        video.addEventListener('error',unavailable);video.querySelector('source').addEventListener('error',unavailable);
        video.addEventListener('play',()=>{if(!this.valid()){video.pause();return;}window.flowSportAuto?.pauseOnly();});
        preview.querySelector('[data-library-change]').onclick=()=>{if(this.valid()){this.draw(true);this.querySelector('input').focus();}};
      }
      const input=this.querySelector('input');
      input.value=this.name;
      input.oninput=()=>this.results(input.value);
      if(searching)this.results(input.value);
      if(this.selected&&!searching)requestAnimationFrame(()=>{if(this.isConnected)this.scrollIntoView({block:'nearest'});});
    }
    results(query) {
      if (!this.valid()) { this.innerHTML='<p class="ss-quiet" role="status">Открой тренировку заново</p>';return; }
      const needle=normalize(query),tokens=needle.split(' ').filter(Boolean);
      let found=this.rows.filter(e=>tokens.every(t=>e.search.includes(t)));
      // A loose search may offer singular/plural variants; it never binds one automatically.
      if(!found.length){const prefixes=tokens.map(t=>/^[а-я]{6,}$/.test(t)?t.slice(0,-2):t);found=this.rows.filter(e=>prefixes.every(t=>e.search.includes(t)));}
      found.sort((a,b)=>Number(b.search===needle)-Number(a.search===needle)||a.name.localeCompare(b.name,'ru'));
      const shown=found.slice(0,30);
      const target=this.querySelector('.ss-library-results');target.replaceChildren();
      for(const e of shown){
        const b=document.createElement('button');b.type='button';b.className='ss-library-row';b.textContent=e.name;b.dataset.libraryId=e.id;
        b.onclick=()=>{
          if(!this.valid())return;
          try {
            const key=storageKey(this.owner), saved=JSON.parse(localStorage.getItem(key)||'{}');
            localStorage.setItem(key,JSON.stringify({...saved,[normalize(this.name)]:e.id}));
          } catch { target.innerHTML='<p class="ss-quiet" role="alert">Не удалось запомнить выбор. Освободи место и повтори.</p>';return; }
          this.selected=e;this.draw();this.querySelector('[data-library-change]')?.focus({preventScroll:true});
        };
        target.append(b);
      }
      const status=document.createElement('p');status.className='ss-quiet';status.textContent=!found.length?'Ничего не найдено':found.length>shown.length?`${found.length} упражнений · уточни поиск`:'';target.append(status);
    }
  }
  customElements.define('flow-sport-library',SportLibrary);
  window.flowSportLibrary={html:e=>`<flow-sport-library exercise-name="${esc(e.name)}"></flow-sport-library>`};
})();
