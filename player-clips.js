/* Add more moments to a player's array; put the corresponding MP4 in videos/. */
(() => {
  const clipsByPlayer = {
    'Нұржігіт': [{title:'Пенальти',titleKK:'Пенальти',src:'videos/nurzhigit-penalty.mp4'}],
    'Қайрат': [{title:'Гол Қайрата',titleKK:'Қайраттың голы',src:'videos/kairat-goal.mp4'}],
    'Нұрбол': [{title:'Гол дальним ударом',titleKK:'Алыстан соғылған гол',src:'videos/nurbol-long-range-goal.mp4'}],
    'Асет': [{title:'Гол дальним ударом',titleKK:'Алыстан соғылған гол',src:'videos/aset-long-range-goal.mp4'}]
  };
  let dialog, video, heading, choices, error, close, opener, oldOverflow;
  const ensureDialog = () => {
    if(dialog) return;
    dialog=document.createElement('dialog');dialog.className='player-video-dialog';
    dialog.setAttribute('aria-labelledby','playerVideoHeading');
    dialog.innerHTML='<div class="player-video-header"><h2 id="playerVideoHeading"></h2><button type="button" class="video-close"></button></div><video controls playsinline preload="none"></video><p class="video-error" role="status" hidden></p><nav class="player-video-choices"></nav>';
    document.body.appendChild(dialog);
    video=dialog.querySelector('video');heading=dialog.querySelector('h2');
    choices=dialog.querySelector('nav');error=dialog.querySelector('.video-error');close=dialog.querySelector('.video-close');
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{
      const r=dialog.getBoundingClientRect();
      if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();
    });
    dialog.addEventListener('close',()=>{
      video.pause();video.removeAttribute('src');video.load();
      document.body.style.overflow=oldOverflow;
      if(opener?.isConnected)opener.focus({preventScroll:true});
    });
    video.addEventListener('error',()=>{if(video.hasAttribute('src'))error.hidden=false;});
  };
  const openClips = (player, clips, kk, button) => {
    ensureDialog();opener=button;
    close.textContent=kk?'Жабу ✕':'Закрыть ✕';
    heading.textContent=player.name+' · '+(kk?'Ойын сәттері':'Игровые моменты');
    choices.setAttribute('aria-label',kk?'Бейне таңдау':'Выбор игрового момента');choices.replaceChildren();
    error.textContent=kk?'Бейне ашылмады. Файлдың жүктелгенін тексеріңіз немесе басқа браузерде ашыңыз.':'Не удалось открыть видео. Проверьте, что файл загружен на сайт, или откройте в другом браузере.';
    const select = index => {
      video.pause();error.hidden=true;video.src=clips[index].src;video.preload='metadata';video.load();
      [...choices.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    };
    clips.forEach((clip,index)=>{
      const choice=document.createElement('button');choice.type='button';choice.textContent=kk?(clip.titleKK||clip.title):clip.title;
      choice.addEventListener('click',()=>select(index));choices.appendChild(choice);
    });
    oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.showModal();select(0);close.focus();
  };
  window.addPlayerClips = (card, player, lang) => {
    const shared=window.getUploadedPlayerClips?.(player.id)||[];
    const local=clipsByPlayer[player.name==='Кайрат'?'Қайрат':player.name]||[];
    const clips=[...local.filter(clip=>!shared.some(saved=>saved.title===clip.title)),...shared];
    if(!clips?.length)return;
    const kk=lang==='kk';
    const button=document.createElement('button');button.type='button';button.className='card-video-toggle';
    button.textContent=(kk?'▶ Бейне':'▶ Видео')+' · '+clips.length;
    button.setAttribute('aria-label',`${player.name}: ${kk?'ойын сәттерін көру':'смотреть игровые моменты'}`);
    button.addEventListener('click',e=>{e.stopPropagation();openClips(player,clips,kk,button);});
    card.classList.add('has-clips');card.appendChild(button);
  };
})();
