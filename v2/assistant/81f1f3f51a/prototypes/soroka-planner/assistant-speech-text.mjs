/** Deterministic pronunciation hints. The display text is never rewritten. */
export function spokenRussian(value){
 const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
 return String(value||'').replace(/https?:\/\/[^\s)]+/g,'ссылка на экране').replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g,(_,h,m)=>{const hours=Number(h),minutes=Number(m);return hours+' '+plural(hours,'час','часа','часов')+(minutes?' '+minutes+' '+plural(minutes,'минута','минуты','минут'):' ровно');}).replace(/ВГДС/giu,'вэ гэ дэ эс').replace(/ФГДС/giu,'эф гэ дэ эс').replace(/\bFlow\b/giu,'Флоу').replace(/\bQR\b/gu,'кью ар').replace(/[\u0000-\u0008\u000e-\u001f]/g,' ').replace(/\s+/g,' ').trim();
}
