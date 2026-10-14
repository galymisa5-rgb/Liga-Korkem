/* PIN is verified on the server. Only signed, file-specific upload grants reach the browser. */
(() => {
  const BUCKET='league-videos',TABLE='league_player_videos',MAX=50*1024*1024;
  let uploaded=[],dialog,opener,previewURL,busy=false,pending=null,adminToken=null;
  const field=name=>dialog.querySelector('[name="'+name+'"]');
  const status=text=>{dialog.querySelector('.upload-status').textContent=text;};
  const publicClip=row=>({id:row.id,title:row.title,src:sb.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,playerId:row.player_id});
  async function server(action,data={}){
    const response=await fetch(SUPABASE_URL+'/functions/v1/league-video-upload',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY},body:JSON.stringify({action,token:adminToken,...data})});
    let result;try{result=await response.json();}catch{throw Error('Сервер загрузки недоступен. Повторите позже.');}
    if(!response.ok){if(response.status===401&&action!=='login')adminToken=null;throw Error(result.error||'Не удалось выполнить действие. Повторите попытку.');}
    return result;
  }
  window.verifyVideoAdminPin=async pin=>{const result=await server('login',{pin});adminToken=result.token;};
  window.clearVideoAdminSession=()=>{adminToken=null;};
  window.authorizedLeagueAction=server;
  window.hasLeagueAdminSession=()=>!!adminToken;
  window.getUploadedPlayerClips=id=>uploaded.filter(c=>c.playerId===id);
  window.loadUploadedPlayerVideos=async()=>{
    try{
      const rows=[];for(let start=0;;start+=500){
        const {data,error}=await sb.from(TABLE).select('id,player_id,title,storage_path,created_at').order('created_at',{ascending:false}).range(start,start+499);
        if(error)throw error;rows.push(...(data||[]));if(!data||data.length<500)break;
      }uploaded=rows.map(publicClip);return true;
    }catch{return false;}
  };
  function cleanPreview(){
    const preview=dialog.querySelector('.upload-preview');preview.pause();preview.removeAttribute('src');preview.load();preview.hidden=true;
    if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  }
  function showPinIfNeeded(){dialog.querySelector('.video-pin-form').hidden=!!adminToken;field('save').disabled=!adminToken;}
  function uploadSignedFile(file,prepared,onProgress){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('PUT',SUPABASE_URL+'/storage/v1/object/upload/sign/'+BUCKET+'/'+prepared.path+'?token='+encodeURIComponent(prepared.signature));
      xhr.setRequestHeader('apikey',SUPABASE_ANON_KEY);xhr.setRequestHeader('Content-Type',prepared.contentType);
      xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded,e.total);};
      xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error('Не удалось отправить видео. Проверьте интернет и повторите загрузку.'));
      xhr.onerror=()=>reject(Error('Соединение прервалось. Проверьте интернет и повторите загрузку.'));
      xhr.onabort=()=>reject(Error('Отправка видео прервана. Повторите загрузку.'));
      xhr.send(file);
    });
  }
  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='player-video-dialog video-upload-dialog';dialog.setAttribute('aria-labelledby','videoUploadHeading');
    dialog.innerHTML=`<div class="player-video-header"><h2 id="videoUploadHeading">Добавить игровой момент</h2><button type="button" class="video-close">Закрыть ✕</button></div>
      <p class="upload-intro">Выберите видео из галереи. Новый момент появится в карточке и будет виден всем.</p>
      <form class="video-pin-form" hidden><label>Код администратора<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" required></label><button type="submit" class="btn">Подтвердить код</button></form>
      <form class="video-upload-form"><fieldset><label>Игрок<select name="player" required></select></label><label>Название момента<input name="title" type="text" maxlength="100" placeholder="Например: гол дальним ударом" required></label><label class="upload-file-label">Видео из галереи<input name="file" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" required></label><p class="upload-hint">MP4, MOV или WebM, до 50 МБ. Для просмотра на разных телефонах лучше MP4 с кодеком H.264.</p><video class="upload-preview" controls playsinline preload="metadata" hidden></video><button type="submit" name="save" class="btn">Загрузить видео</button></fieldset></form>
      <progress class="video-upload-progress" max="100" value="0" aria-label="Загрузка видео" hidden></progress><p class="upload-status" role="status" aria-live="polite"></p>`;
    document.body.appendChild(dialog);
    const canClose=()=>{if(busy){status('Дождитесь завершения загрузки или ошибки. Не закрывайте страницу.');return false;}return true;};
    dialog.querySelector('.video-close').addEventListener('click',()=>{if(canClose())dialog.close();});
    dialog.addEventListener('cancel',e=>{if(!canClose())e.preventDefault();});
    dialog.addEventListener('close',()=>{cleanPreview();field('pin').value='';if(opener?.isConnected)opener.focus({preventScroll:true});});
    dialog.querySelector('.video-pin-form').addEventListener('submit',async e=>{
      e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;
      try{await window.verifyVideoAdminPin(field('pin').value);field('pin').value='';showPinIfNeeded();status('Код подтверждён. Можно загрузить видео.');}
      catch(error){status(error.message);}finally{button.disabled=false;}
    });
    field('file').addEventListener('change',()=>{
      cleanPreview();pending=null;const file=field('file').files[0];if(!file)return;
      if(!file.size||file.size>MAX){status('Выберите непустое видео размером до 50 МБ.');field('file').value='';return;}
      previewURL=URL.createObjectURL(file);const preview=dialog.querySelector('.upload-preview');preview.src=previewURL;preview.hidden=false;
      if(!field('title').value)field('title').value=file.name.replace(/\.[^.]+$/,'').slice(0,100);
      status('Видео выбрано. Проверьте игрока и название, затем нажмите «Загрузить видео».');
    });
    dialog.querySelector('.video-upload-form').addEventListener('submit',saveVideo);
  }
  async function saveVideo(e){
    e.preventDefault();if(busy||!adminMode)return;
    const file=field('file').files[0],title=field('title').value.trim(),playerId=Number(field('player').value),extension=file?.name.split('.').pop().toLowerCase();
    if(!file||!['mp4','mov','webm'].includes(extension)||!file.size||file.size>MAX||!title||!allPlayers.some(p=>p.id===playerId)){status('Выберите игрока, название и видео MP4, MOV или WebM до 50 МБ.');return;}
    busy=true;const fieldset=dialog.querySelector('fieldset');fieldset.disabled=true;
    const progress=dialog.querySelector('progress');progress.hidden=false;progress.value=0;
    try{
      if(!adminToken)throw Error('Подтвердите код администратора ещё раз.');
      if(pending&&(pending.playerId!==playerId||pending.title!==title))throw Error('Для повторной попытки оставьте исходного игрока и название или выберите файл заново.');
      if(!pending)pending={file,playerId,title,uploaded:false};
      if(!pending.uploaded){
        if(!window.tus?.Upload)throw Error('Не удалось загрузить модуль отправки видео. Обновите страницу.');
        const prepared=await server('prepare',{playerId,title,extension,size:file.size,grant:pending.grant});
        Object.assign(pending,prepared);
        const project=new URL(SUPABASE_URL).hostname.split('.')[0];
        const report=(sent,total)=>{const percent=Math.min(95,Math.round(sent/total*95));progress.value=percent;status('Загрузка видео: '+percent+'%. Не закрывайте страницу.');};
        try{await new Promise((resolve,reject)=>{
          const upload=new tus.Upload(file,{
            endpoint:'https://'+project+'.storage.supabase.co/storage/v1/upload/resumable',
            headers:{'x-signature':prepared.signature,apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+SUPABASE_ANON_KEY},
            metadata:{bucketName:BUCKET,objectName:prepared.path,contentType:prepared.contentType,cacheControl:'3600'},
            chunkSize:6*1024*1024,uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,retryDelays:[0,3000,5000,10000,20000],
            onProgress:report,
            onError:()=>reject(Error('Загрузка прервалась. Проверьте интернет и нажмите «Загрузить видео» ещё раз.')),
            onSuccess:resolve
          });
          upload.findPreviousUploads().then(previous=>{const same=previous.find(p=>p.metadata?.objectName===prepared.path&&p.metadata?.bucketName===BUCKET);if(same)upload.resumeFromPreviousUpload(same);upload.start();}).catch(reject);
        });}catch{
          // Some Storage versions reject signed TUS requests. Keep a signed PUT fallback.
          try{await uploadSignedFile(file,prepared,report);}catch(error){
            // The connection may fail after the server saved the entire file.
            // Finish is idempotent and verifies the actual object size before publishing.
            try{await server('finish',{grant:pending.grant});}catch{throw error;}
          }
        }pending.uploaded=true;
      }
      progress.value=95;status('Видео загружено. Сохраняем его в карточке…');
      const result=await server('finish',{grant:pending.grant});
      if(!result.clip)throw Error('Видео отправлено. Повторите сохранение, чтобы оно появилось в карточке.');
      const saved=publicClip(result.clip);uploaded=[saved,...uploaded.filter(c=>c.id!==saved.id)];pending=null;
      progress.value=100;status('Готово! Видео добавлено в карточку и доступно всем.');field('file').value='';field('title').value='';cleanPreview();renderCards();
    }catch(error){status(error.message||'Не удалось добавить видео. Повторите попытку.');}
    finally{busy=false;fieldset.disabled=false;showPinIfNeeded();}
  }
  window.attachVideoUploader=(panel,player)=>{
    const button=document.createElement('button');button.type='button';button.className='btn ghost small add-video-btn';button.textContent=LANG==='kk'?'＋ Бейне қосу':'＋ Добавить видео';
    button.addEventListener('click',()=>{
      if(!adminMode)return;ensureDialog();opener=button;const select=field('player');select.replaceChildren();
      [...allPlayers].sort((a,b)=>a.name.localeCompare(b.name,'ru')).forEach(p=>{const option=document.createElement('option');option.value=String(p.id);option.textContent=p.name;select.append(option);});
      select.value=String(pending?.playerId||player.id);dialog.showModal();showPinIfNeeded();status(adminToken?'Выберите видео из галереи.':'Подтвердите код администратора, чтобы продолжить.');
    });panel.appendChild(button);
  };
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
})();
