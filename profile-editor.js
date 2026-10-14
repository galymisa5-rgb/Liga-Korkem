(() => {
  const profiles=new Map();
  let dialog,player,opener,busy=false;
  window.getSavedPlayerDescription=id=>profiles.get(id);
  window.loadPlayerDescriptions=async()=>{
    try{
      const rows=[];
      for(let start=0;;start+=500){const {data,error}=await sb.from('league_player_profiles').select('player_id,content,is_ai,updated_at').order('player_id').range(start,start+499);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<500)break;}
      profiles.clear();rows.forEach(row=>{if(Array.isArray(row.content)&&row.content.length===7&&row.content.every(v=>typeof v==='string'))profiles.set(row.player_id,row);});return true;
    }catch{return false;}
  };
  const status=text=>dialog.querySelector('.profile-status').textContent=text;
  const pinForm=()=>dialog.querySelector('.profile-pin-form');
  const updateSession=()=>{pinForm().hidden=window.hasLeagueAdminSession();dialog.querySelector('.profile-save').disabled=!window.hasLeagueAdminSession();};
  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='player-video-dialog profile-editor-dialog';dialog.setAttribute('aria-labelledby','profileEditorHeading');
    dialog.innerHTML='<div class="player-video-header"><h2 id="profileEditorHeading"></h2><button class="video-close" type="button">Закрыть ✕</button></div><form class="profile-pin-form" hidden><label>Код администратора<input type="password" name="pin" inputmode="numeric" maxlength="4" minlength="4" pattern="[0-9]{4}" required autocomplete="off"></label><button type="submit" class="btn">Подтвердить код</button></form><form class="profile-edit-form"><fieldset class="profile-fields"></fieldset><label class="profile-ai-label"><input type="checkbox" name="ai">Вымышленное описание — отметить «Придумано ИИ»</label><button class="btn profile-save" type="submit">Сохранить описание</button></form><p class="profile-status" role="status" aria-live="polite"></p>';
    document.body.appendChild(dialog);
    dialog.querySelector('.video-close').addEventListener('click',()=>{if(!busy)dialog.close();});
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    dialog.addEventListener('close',()=>{dialog.querySelector('[name="pin"]').value='';const target=opener?.isConnected?opener:document.querySelector('.edit-description-btn[data-player-id="'+player.id+'"]');target?.focus({preventScroll:true});});
    pinForm().addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{await window.verifyVideoAdminPin(dialog.querySelector('[name="pin"]').value);dialog.querySelector('[name="pin"]').value='';updateSession();status('Код подтверждён. Теперь можно сохранить описание.');}catch(error){status(error.message);}finally{button.disabled=false;}});
    dialog.querySelector('.profile-edit-form').addEventListener('submit',async e=>{
      e.preventDefault();if(busy||!adminMode)return;
      const content=[...dialog.querySelectorAll('[data-story-index]')].map(input=>input.value.trim());
      if(!content[0]||![2,4,6].some(i=>content[i])||[1,3,5].some(i=>!!content[i]!==!!content[i+1])){status('Укажите игровой образ и хотя бы один раздел. У каждого раздела нужны заголовок и текст.');return;}
      busy=true;const form=e.currentTarget,inputs=form.querySelectorAll('input,textarea,button');inputs.forEach(input=>input.disabled=true);dialog.querySelector('fieldset').disabled=true;status('Сохраняем описание…');
      try{
        const result=await window.authorizedLeagueAction('save-profile',{playerId:player.id,content,isAi:dialog.querySelector('[name="ai"]').checked,expectedUpdatedAt:profiles.get(player.id)?.updated_at||null});
        if(!result.profile)throw Error('Сохранение не подтверждено. Повторите попытку.');
        profiles.set(player.id,result.profile);renderCards();status('Готово! Описание сохранено и видно всем посетителям.');
      }catch(error){status(error.message||'Не удалось сохранить. Ваш текст остался в форме.');}
      finally{busy=false;inputs.forEach(input=>input.disabled=false);dialog.querySelector('fieldset').disabled=false;updateSession();}
    });
  }
  window.attachProfileEditor=(panel,p)=>{
    const button=document.createElement('button');button.type='button';button.dataset.playerId=String(p.id);button.className='btn ghost small edit-description-btn';button.textContent=LANG==='kk'?'✎ Сипаттаманы өзгерту':'✎ Редактировать описание';
    button.addEventListener('click',()=>{
      if(!adminMode)return;ensureDialog();player=p;opener=button;
      dialog.querySelector('h2').textContent=p.name+' · Описание';
      const story=window.getPlayerStory(p),fieldset=dialog.querySelector('.profile-fields');fieldset.replaceChildren();
      const labels=['Игровой образ','Заголовок раздела 1','Текст раздела 1','Заголовок раздела 2','Текст раздела 2','Заголовок раздела 3','Текст раздела 3'];
      const limits=[120,80,1200,80,1200,80,1200];
      story.content.forEach((value,i)=>{const label=document.createElement('label');label.textContent=labels[i];const input=document.createElement(i>0&&i%2===0?'textarea':'input');if(input.tagName==='TEXTAREA')input.rows=5;else input.type='text';input.value=value;input.maxLength=limits[i];input.dataset.storyIndex=String(i);if(i===0)input.required=true;label.appendChild(input);fieldset.appendChild(label);});
      dialog.querySelector('[name="ai"]').checked=story.isAi;dialog.showModal();updateSession();status('Измените текст и нажмите «Сохранить описание».');
    });panel.appendChild(button);
  };
})();
