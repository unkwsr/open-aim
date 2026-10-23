export function installLocaleControl(locale){
  const button=document.createElement('button');
  button.type='button';button.className='aim-locale-toggle';
  button.textContent=locale==='vi'?'ENGLISH':'TIẾNG VIỆT';
  button.lang=locale==='vi'?'en':'vi';
  button.title=locale==='vi'?'Switch to English':'Switch to Vietnamese';
  button.setAttribute('aria-label',button.title);
  button.addEventListener('click',()=>{
    const next=locale==='vi'?'en':'vi';
    document.cookie=`aim_ui_language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    location.reload();
  });
  (document.querySelector('.aim-local-actions')??document.body).prepend(button);
}
