if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/soroka-app/v2/sw.js',{scope:'/soroka-app/v2/'}).catch(()=>{}));
