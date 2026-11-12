function between(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Не найден источник контракта: '+start);return text.slice(a,b);}
function component(text,name){const a=text.indexOf('class '+name+' extends');if(a<0)throw Error('Нет компонента '+name);const next=text.indexOf('\nclass ',a+1),registry=text.indexOf('\nfor(const [name,ctor]',a);return text.slice(a,next<0?registry:Math.min(next,registry<0?next:registry));}
export function contractSource(source,atlasStyle,id,selectSource=''){
 source=source.replace(/\r\n/g,'\n');atlasStyle=atlasStyle.replace(/\r\n/g,'\n');
 const css=between(source,'sheet.replaceSync(`','`);').slice('sheet.replaceSync(`'.length);
 const common=between(css,':host{','.surface{')+css.slice(css.indexOf(':host-context'));
 const code=component(source,'Element')+between(source,'export const paths=','class Element extends');
 const surface=between(css,'.surface{','.button{'),button=between(css,'.button{','.check{'),check=between(css,'.check{','.row{');
 const row=between(css,'.row{','time{')+between(css,'.message{',css.includes('.entry{')?'.entry{':'.head{');
 const own={F01:surface+component(source,'Surface'),B01:button+component(source,'Button'),C01:check+component(source,'Check'),R01:row+between(css,'time{','.message{')+component(source,'Row')+(source.includes('class TaskStack extends')?component(source,'TaskStack'):''),R02:row+component(source,'Row'),R03:row+between(css,'time{','.message{')+component(source,'Row')+component(source,'TaskStack')+(source.includes('class LineRow extends')?component(source,'LineRow'):''),R04:row+component(source,'Row')+component(source,'TaskStack')+(source.includes('class LineRow extends')?component(source,'LineRow'):''),M01:selectSource,W01:(css.includes('.entry{')?between(css,'.entry{','.head{'):'')+css.slice(css.indexOf('.head{'),css.indexOf(':host-context'))+component(source,'Entry')};
 const tags={F01:['flow-surface'],B01:['flow-button'],C01:['flow-check'],R01:['flow-row',...(source.includes('class TaskStack extends')?['flow-task-stack']:[])],R02:['flow-row'],R03:['flow-line-row','flow-task-stack'],R04:['flow-line-row','flow-task-stack'],M01:['flow-select'],W01:['flow-entry']};
 const registry=tags[id].map(tag=>{const found=(id==='M01'?selectSource:source).match(new RegExp("\\['"+tag+"',\\s*(\\w+)\\]"));if(!found)throw Error('Нет регистрации '+tag);return[tag,found[1]];});
 return{common,code,atlasStyle,own:own[id],registry};
}
