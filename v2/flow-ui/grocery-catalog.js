import './field.js?v=644cff7ac9';
import './flow-select.js?v=644cff7ac9';
import {FlowControl} from './control-base.js?v=644cff7ac9';

// Original Flow drawings and a bounded food-only catalog. No Bring assets/data copied.
export const groceryCategories=[['produce','Овощи и фрукты'],['dairy','Молочное и яйца'],['bakery','Хлеб'],['protein','Мясо и рыба'],['pantry','Крупы и бакалея'],['drinks','Напитки'],['frozen','Заморозка'],['sweets','Сладкое']].map(([id,title])=>Object.freeze({id,title}));
const paths={
 apple:'M12 8C7 4 3 8 4 14s4 8 8 6c4 2 7-1 8-6S17 4 12 8Zm0-1c0-3 2-4 5-4-1 3-2 4-5 4Z',
 banana:'M5 4c1 8 6 13 14 13-3 5-11 5-15 0S1 8 5 4Zm0 0 2-1',
 carrot:'m8 8 8 8-12 5L8 8Zm4-3 2-3m1 7 5-2M8 12l3 2m-5 2 2 1',
 tomato:'M12 8C3 3 1 17 8 20c2 1 6 1 8 0 7-3 5-17-4-12Zm0 0V3m-4 2 4 3 4-3',
 leaf:'M5 20C-1 8 10 2 20 4c0 11-4 19-15 16Zm0 0L16 8M9 16l-1-5m4 2h5',
 potato:'M5 7C0 13 4 21 10 21s13-9 10-14S9 1 5 7Zm3 2h.1m7-1h.1M7 15h.1m8 2h.1',
 milk:'m6 7 3-4h7l2 4v14H6V7Zm0 0h12M9 3l2 4v14m2-9h3',
 cheese:'m3 10 13-6 5 6v10H3V10Zm0 0h18M8 14h.1m8 3h.1m-5 2h.1',
 egg:'M5 14C5 9 9 3 12 3s7 6 7 11a7 7 0 0 1-14 0Z',
 jar:'M6 6h12v15H6V6Zm1-3h10v3H7V3Zm-1 8h12m-12 6h12',
 bread:'M5 10c-5-4 0-8 4-6 3-2 6-1 7 1 5-1 8 4 3 6v10H5V10Zm4 3v4m5-4v4',
 meat:'M5 7c3-5 8-3 11 0 6 2 6 8 1 10-4 6-12 4-13-2-3-2-2-6 1-8Zm5 2c-4 2-1 7 2 5s2-7-2-5Z',
 fish:'M3 12c5-8 12-8 17 0-5 8-12 8-17 0Zm0 0-2-4v8l2-4Zm12-2h.1M9 6l2-3 3 3',
 grain:'M5 4h14l-1 17H6L5 4Zm4 5h6m-3 1v7m-3-4 3 2 3-2',
 bottle:'M10 3h4v5l3 4v9H7v-9l3-4V3Zm-3 11h10M10 6h4',
 cup:'M4 8h13v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Zm13 2h3v6h-3M8 3v2m5-2v2',
 snow:'M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3M3 11l4-1-1-4m15 7-4 1 1 4',
 sweet:'M4 5h16v16H4V5Zm0 5h16M9 5v16m6-16v16M4 16h16',
};
export function groceryIcon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.grain}"/></svg>`;}
const entries=[
 ['apple','Яблоки','produce','кг','apple','яблоко'],['banana','Бананы','produce','кг','banana','банан'],['lemon','Лимоны','produce','шт.','apple','лимон'],['orange','Апельсины','produce','кг','apple','апельсин'],['pear','Груши','produce','кг','apple','груша'],['avocado','Авокадо','produce','шт.','potato',''],['tomato','Помидоры','produce','кг','tomato','томат помидор'],['cucumber','Огурцы','produce','кг','potato','огурец'],['potato','Картофель','produce','кг','potato','картошка'],['carrot','Морковь','produce','кг','carrot','морковка'],['onion','Лук','produce','кг','tomato','луковица'],['garlic','Чеснок','produce','шт.','tomato',''],['greens','Зелень','produce','пуч.','leaf','укроп петрушка'],['salad','Салат','produce','шт.','leaf','листья салата'],['mushroom','Шампиньоны','produce','г','potato','грибы'],
 ['milk','Молоко','dairy','л','milk',''],['kefir','Кефир','dairy','л','bottle',''],['yogurt','Йогурт','dairy','шт.','jar','йогурты'],['cheese','Сыр','dairy','г','cheese',''],['curd','Творог','dairy','г','jar',''],['cream','Сметана','dairy','шт.','jar',''],['butter','Сливочное масло','dairy','г','cheese','масло сливочное'],['eggs','Яйца','dairy','уп.','egg','яйцо'],
 ['bread','Хлеб','bakery','шт.','bread','батон'],['baguette','Багет','bakery','шт.','bread',''],['toast','Тостовый хлеб','bakery','уп.','bread','тосты'],['lavash','Лаваш','bakery','уп.','bread',''],
 ['chicken','Куриное филе','protein','г','meat','курица грудка'],['beef','Говядина','protein','г','meat','мясо'],['mince','Фарш','protein','г','meat',''],['turkey','Индейка','protein','г','meat',''],['fish','Рыба','protein','г','fish','треска'],['salmon','Лосось','protein','г','fish','семга сёмга'],
 ['rice','Рис','pantry','уп.','grain',''],['buckwheat','Гречка','pantry','уп.','grain','гречневая крупа'],['oats','Овсянка','pantry','уп.','grain','овсяные хлопья'],['pasta','Макароны','pantry','уп.','grain','паста спагетти'],['flour','Мука','pantry','кг','grain',''],['sugar','Сахар','pantry','кг','grain',''],['salt','Соль','pantry','уп.','grain',''],['oil','Растительное масло','pantry','л','bottle','подсолнечное оливковое масло'],['beans','Фасоль','pantry','шт.','jar','консервы'],['sauce','Томатный соус','pantry','шт.','jar','кетчуп'],['tea','Чай','drinks','уп.','cup',''],['coffee','Кофе','drinks','г','cup',''],['water','Вода','drinks','л','bottle','питьевая'],['juice','Сок','drinks','л','milk',''],
 ['frozen-veg','Замороженные овощи','frozen','уп.','snow','овощная смесь'],['berries','Замороженные ягоды','frozen','уп.','snow','ягоды'],['dumplings','Пельмени','frozen','уп.','snow',''],['chocolate','Шоколад','sweets','шт.','sweet',''],['cookies','Печенье','sweets','уп.','sweet',''],['honey','Мёд','sweets','шт.','jar','мед'],['nuts','Орехи','pantry','г','potato',''],
];
export const groceryProducts=Object.freeze(entries.map(([id,title,category,unit,icon,aliases])=>Object.freeze({id,title,category,unit,icon,aliases})));
const fold=value=>String(value||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').trim();
export function findGroceries(query='',category=''){const words=fold(query).split(/\s+/).filter(Boolean);return groceryProducts.filter(item=>(!category||item.category===category)&&words.every(word=>fold(item.title+' '+item.aliases).includes(word)));}
export function listImageSource(item,origin='https://flow.woosport.ru'){
 const local=item?.imageData||(typeof item?.image==='string'?item.image:'');
 if(/^data:image\/(png|jpeg|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(local))return local;
 const image=item?.image;if(!image||image.v!==1||!['image/png','image/jpeg','image/webp'].includes(image.mime)||!Number.isSafeInteger(image.size)||image.size<8||image.size>6291456)return '';
 try{const url=new URL(image.url),base=new URL(origin);if(base.protocol!=='https:'||url.protocol!=='https:'||url.origin!==base.origin||url.username||url.password||url.search||url.hash||url.pathname.includes('%'))return '';const prefix=base.pathname.replace(/\/$/,'')+'/storage/v1/object/public/note-images/';if(!url.pathname.startsWith(prefix))return '';const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.mime];if(!new RegExp('^(?:pc/[a-f0-9]{16}|[0-9]{1,20})/[0-9]+-[a-f0-9-]{36}\\.'+ext+'$').test(url.pathname.slice(prefix.length)))return '';return url.href}catch{return ''}
}
export const groceryWorkspaceSheet=new CSSStyleSheet();groceryWorkspaceSheet.replaceSync(`
.list-kind{margin-block:0 10px}.grocery-catalog-pane{max-height:350px;overflow:auto;overscroll-behavior:contain;padding:2px 2px 10px}.grocery-catalog{margin-bottom:12px}.grocery-catalog>summary{color:var(--fu-text)}.grocery-owned{display:grid;gap:10px;margin-top:10px}.grocery-heading{display:flex;align-items:center;gap:8px;min-height:44px;margin:0;font-size:13px;font-weight:500;color:var(--fu-muted)}.grocery-heading svg{width:22px;height:22px;color:var(--fu-accent)}.quantity-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(80px,.8fr);gap:8px}.grocery-empty{margin:12px 4px;color:var(--fu-muted);font-size:13px}.grocery-read-tools{margin-top:12px}.grocery-quantity{font-variant-numeric:tabular-nums}.grocery-owned flow-check-group{min-width:0}
`);
export const groceryRowSheet=new CSSStyleSheet();groceryRowSheet.replaceSync(`
.copy{display:flex!important;align-items:center;gap:10px}.grocery-art{display:grid;place-items:center;width:38px;height:44px;flex:none;color:var(--fu-accent)}.grocery-art svg{width:30px;height:30px;stroke-width:1.4}.grocery-art img{display:block;width:38px;height:38px;object-fit:contain;border-radius:9px}.grocery-copy{flex:1;min-width:0}.copy small{font-variant-numeric:tabular-nums}:host([done]) .grocery-art{color:var(--fu-muted);opacity:.6}
`);
const sheet=new CSSStyleSheet();sheet.replaceSync(`
:host{display:block;min-width:0}.catalog{min-width:0}.filters{display:grid;gap:8px;grid-template-columns:minmax(0,1fr) 44px}.filters flow-select{min-width:0}.products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}.product{position:relative;min-width:0;min-height:98px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:10px 5px;border:1px solid var(--fu-line);border-radius:16px;background:transparent;transition:background 300ms var(--fu-ease),transform 300ms var(--fu-ease)}.product svg{width:35px;height:35px;color:var(--fu-accent);flex:none}.product strong{font-size:12px;line-height:1.35;font-weight:500;overflow-wrap:anywhere}.product small{position:absolute;right:7px;top:5px;color:var(--fu-accent);font-size:11px}.product[aria-pressed=true]{background:color-mix(in srgb,var(--fu-accent) 7%,transparent)}.product:active{transform:scale(.97)}.product:focus-visible{outline:0;border-color:var(--fu-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--fu-accent) 12%,transparent)}.empty{padding:14px 4px;color:var(--fu-muted);font-size:13px;margin:0}.category{margin-top:8px}*{scrollbar-width:none}*::-webkit-scrollbar{display:none}@media(prefers-reduced-motion:reduce){.product{transition:none}}
`);
export class FlowGroceryCatalog extends FlowControl{
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,sheet];this._selected=[];this.query='';this.category='';}
 get selected(){return structuredClone(this._selected)}set selected(value){this._selected=Array.isArray(value)?structuredClone(value):[];if(this.isConnected)this.results();}
 feedbackTarget(event){return event?.composedPath().find(node=>node instanceof HTMLElement&&node.classList?.contains('product'))||this.shadowRoot.querySelector('.catalog');}
 connectedCallback(){if(this.shadowRoot.firstChild)return;this.shadowRoot.innerHTML=`<section class="catalog"><flow-field aria-label="Найти продукт" placeholder="Найти продукт"></flow-field><flow-select class="category" aria-label="Категория продуктов" presentation="dialog" value=""><option value="">Все продукты</option>${groceryCategories.map(item=>`<option value="${item.id}">${item.title}</option>`).join('')}</flow-select><div class="products" role="group" aria-label="Продукты"></div><p class="empty" hidden>Продукт не найден</p></section>`;
  const search=this.shadowRoot.querySelector('flow-field');search.oninput=()=>{this.query=search.value;this.results()};search.shadowRoot.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();this.shadowRoot.querySelector('.product')?.click()}},true);const category=this.shadowRoot.querySelector('flow-select');category.oninput=()=>{this.category=category.value;this.results()};this.results();}
 results(){const parent=this.shadowRoot.querySelector('.products');if(!parent)return;parent.replaceChildren();const items=findGroceries(this.query,this.category);for(const item of items){const owned=this._selected.filter(row=>row.productId===item.id&&!row.done),button=document.createElement('button');button.type='button';button.className='product';button.dataset.productId=item.id;button.setAttribute('aria-label',`${item.title}, добавить${owned.length?', уже в списке':''}`);button.setAttribute('aria-pressed',String(!!owned.length));button.innerHTML=groceryIcon(item.icon)+`<strong>${item.title}</strong>`+(owned.length?'<small>✓</small>':'');button.onclick=()=>this.emit('flow-grocery-pick',{productId:item.id});parent.append(button)}this.shadowRoot.querySelector('.empty').hidden=!!items.length;}
}
if(!customElements.get('flow-grocery-catalog'))customElements.define('flow-grocery-catalog',FlowGroceryCatalog);
