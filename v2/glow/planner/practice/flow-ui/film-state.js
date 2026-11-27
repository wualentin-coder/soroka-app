// One record transition contract for the card and its full editor.
export function filmRatingPatch(record,value){
 const rating=Math.max(0,Math.min(10,Math.round(Number(value))||0)),viewed=typeof record.viewed==='boolean'?record.viewed:record.status==='Посмотрел',patch={rating};
 if(rating&&!viewed)Object.assign(patch,{statusBeforeViewed:record.status||'Хочу посмотреть',status:'Посмотрел',viewed:true,viewedByRating:true});
 if(!rating&&record.viewedByRating)Object.assign(patch,{status:record.statusBeforeViewed||'Хочу посмотреть',viewed:false,viewedByRating:false});
 if(rating)patch.skipped=false;
 return patch;
}
export function filmStatusPatch(record,status){
 const viewed=status==='Посмотрел',previous=record.status==='Посмотрел'?record.statusBeforeViewed:record.status;
 return{status,viewed,viewedByRating:false,statusBeforeViewed:viewed?(previous||'Хочу посмотреть'):status};
}
