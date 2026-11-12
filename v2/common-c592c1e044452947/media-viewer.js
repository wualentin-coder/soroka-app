import {dialogHeader} from '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/dialog-header.js';

let active=null;
export function closeImage(){active?.close();active=null;}
export async function showImage(image,{title='Изображение',isCurrent=()=>true}={}){
 if(typeof image!=='string'||image.length>32000000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||!isCurrent())return false;
 const picture=new Image();picture.alt=title;picture.src=image;
 try{await picture.decode();}catch{picture.removeAttribute('src');return false;}
 if(!isCurrent()){picture.removeAttribute('src');return false;}
 closeImage();const opener=document.activeElement,dialog=document.createElement('dialog');active=dialog;dialog.className='media-workspace';dialog.setAttribute('aria-label',title);dialog.innerHTML=dialogHeader(title,'media-title');dialog.append(picture);document.body.append(dialog);
 const hidden=()=>{if(document.hidden)dialog.close();};
 dialog.addEventListener('close',()=>{document.removeEventListener('visibilitychange',hidden);picture.removeAttribute('src');if(active===dialog)active=null;dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});},{once:true});
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
 document.addEventListener('visibilitychange',hidden);dialog.showModal();return true;
}
