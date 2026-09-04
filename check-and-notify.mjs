import pkg from 'firebase-admin';
const { credential } = pkg;
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ===== CONFIG via GitHub Secrets =====
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const EVOLUTION_API_URL = 'https://evolution-api-production-7c15.up.railway.app';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = 'voleitche';
const GRUPO_INVICTOS = '555184670633-1477593147@g.us';
const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID;

const HOURS_BEFORE = 3;
const WINDOW_MINUTES = 30;

initializeApp({ credential: credential.cert(FIREBASE_SERVICE_ACCOUNT) });
const db = getFirestore();

function parseGameDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const time = timeStr || '00:00';
  const isoLocal = `${dateStr}T${time}:00-03:00`;
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ===== ENVIAR IMAGEM NO GRUPO VIA BASE64 =====
async function enviarImagemGrupo(buffer, caption) {
  const base64 = buffer.toString('base64');
  const resp = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: {
      'apikey': EVOLUTION_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: GRUPO_INVICTOS,
      mediatype: 'image',
      media: `data:image/jpeg;base64,${base64}`,
      caption: caption
    })
  });
  const data = await resp.json();
  console.log('Evolution API response:', JSON.stringify(data));
  return data;
}

// ===== ENVIO SEGURO COM DELAY =====
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function delayAleatorio(){
  const min=10000,max=20000; // 10-20 segundos entre mensagens
  return sleep(Math.floor(Math.random()*(max-min+1))+min);
}

async function enviarMsgSegura(numero,texto){
  await delayAleatorio();
  try{
    const resp=await fetch(`${EVOLUTION_API_URL}/message/sendText/voleitche`,{
      method:'POST',
      headers:{'apikey':EVOLUTION_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({number:numero,text:texto})
    });
    const data=await resp.json();
    console.log('✅ Enviado para '+numero);
    return data;
  }catch(e){
    console.error('❌ Erro ao enviar para '+numero+':',e);
  }
}

// ===== PUSH ONESIGNAL =====
async function sendPush(title, message, gameId) {
  const resp = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      filters: [{ field: 'tag', key: 'time', relation: '=', value: 'invictos' }],
      headings: { en: title, pt: title },
      contents: { en: message, pt: message },
      url: `https://andersonveloso0503-cmyk.github.io/-invictos-fc/confirmar.html?jogo=${gameId}`
    })
  });
  const data = await resp.json();
  console.log('OneSignal response:', JSON.stringify(data));
  return data;
}

async function main() {
  console.log('--- Invictos FC: verificando jogos ---');
  console.log('Horário atual (UTC):', new Date().toISOString());

  const snap = await db.collection('games').where('status', '==', 'agendado').get();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Ordenar jogos por data
  const jogos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const g of jogos) {
    const gameDateTime = parseGameDateTime(g.date, g.time);
    if (!gameDateTime) continue;

    const diffMs = gameDateTime.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const targetMinutes = HOURS_BEFORE * 60;

    console.log(`Jogo vs ${g.opponent} (${g.id}): faltam ${Math.round(diffMinutes)} min`);

    // ===== PUSH 3H ANTES =====
    if (
      diffMinutes <= targetMinutes + WINDOW_MINUTES &&
      diffMinutes >= targetMinutes - WINDOW_MINUTES &&
      !g.pushSent3h
    ) {
      const title = '⚽ Invictos FC — Jogo em 3 horas!';
      const message = `Invictos FC vs ${g.opponent} hoje às ${g.time || ''}h. Confirme sua presença!`;
      await sendPush(title, message, g.id);
      await db.collection('games').doc(g.id).update({ pushSent3h: true });
      console.log(`✅ Push 3h enviado para jogo vs ${g.opponent}`);
    }

      // ===== CARD DO PRÓXIMO JOGO (1 dia após jogo anterior finalizar) =====
  const jogosFinalizados=await db.collection('games').where('status','in',['vitoria','empate','derrota']).get();
  const agora=now.getTime();
  const jogoAnteriorRecente=jogosFinalizados.docs
    .map(d=>({id:d.id,...d.data()}))
    .filter(j=>{
      const dt=parseGameDateTime(j.date,j.timeEnd||j.time);
      if(!dt)return false;
      const diffH=(agora-dt.getTime())/(1000*60*60);
      return diffH>=18&&diffH<=26;
    })
    .sort((a,b)=>new Date(b.date)-new Date(a.date))[0];

  if(jogoAnteriorRecente){
    const proximoJogo=jogos[0];
    if(proximoJogo&&!proximoJogo.cardEnviado){
      console.log(`📸 Jogo anterior (${jogoAnteriorRecente.opponent}) finalizado há ~1 dia. Gerando card para ${proximoJogo.opponent}...`);
      const confSnap=await db.collection('confirmed_'+proximoJogo.id).get();
      const confIds=confSnap.docs.map(d=>d.id);
      const playersSnap=await db.collection('players').get();
      const players=playersSnap.docs.map(d=>({id:d.id,...d.data()}));
      const confirmados=players.filter(p=>confIds.includes(p.id)).map(p=>p.nick||p.name.split(' ')[0]);
      const guestsSnap=await db.collection('guests').where('gameId','==',proximoJogo.id).get();
      guestsSnap.docs.forEach(d=>confirmados.push('🎟️ '+d.data().name));
      try{
        const cardBuffer=await gerarCardJogo(proximoJogo,confirmados);
        const caption=`⚽ *PRÓXIMO JOGO — INVICTOS FC*\n\n🏆 Invictos FC vs ${proximoJogo.opponent}\n📅 ${fmtDate(proximoJogo.date)} · 🕐 ${proximoJogo.time}h\n📍 ${proximoJogo.location||''}\n\n✅ Confirmados: ${confirmados.length}\n\n⬇️ Confirme sua presença:\nhttps://andersonveloso0503-cmyk.github.io/-invictos-fc/confirmar.html?jogo=${proximoJogo.id}\n\n🦁 _Invictos FC — Nunca Rendidos!_`;
        await enviarImagemGrupo(cardBuffer,caption);
        await db.collection('games').doc(proximoJogo.id).update({cardEnviado:true});
        console.log('✅ Card do próximo jogo enviado no grupo!');
      }catch(e){console.error('Erro ao gerar/enviar card:',e);}
    }
  }

  }
  
  // ===== LEMBRETE 1 DIA ANTES ÀS 19H BRT (22H UTC) =====
  const horasUTC=now.getUTCHours();
  for(const g of jogos){
    const gameDateTime=parseGameDateTime(g.date,g.time);
    if(!gameDateTime)continue;
    const diffMs=gameDateTime.getTime()-now.getTime();
    const diffH=diffMs/(1000*60*60);
    if(diffH>=20&&diffH<=28&&horasUTC>=21&&horasUTC<=23&&!g.lembreteEnviado){
      console.log(`⏰ Enviando lembrete para jogo vs ${g.opponent}...`);
      const confSnap=await db.collection('confirmed_'+g.id).get();
      const confIds=confSnap.docs.map(d=>d.id);
      const playersSnap=await db.collection('players').get();
      const players=playersSnap.docs.map(d=>({id:d.id,...d.data()}));
      const confirmados=players.filter(p=>confIds.includes(p.id));
      const guestsSnap=await db.collection('guests').where('gameId','==',g.id).get();
      const convidados=guestsSnap.docs.map(d=>({id:d.id,...d.data()}));
      const msgLembrete=`⚽ *LEMBRETE — JOGO AMANHÃ!*\n\n🏆 Invictos FC vs ${g.opponent}\n📅 ${fmtDate(g.date)} · 🕐 ${g.time||''}h\n📍 ${g.location||''}${g.address?'\n📌 '+g.address:''}\n\n⚠️ Não esqueça! Te esperamos no campo! 🦁\n\n⚠️ _Esta é uma mensagem automática. Por favor, não responda._\n🦁 _Invictos FC — Nunca Rendidos!_`;
      for(const p of [...confirmados,...convidados]){
        if(p.phone){
          await enviarMsgSegura(p.phone,msgLembrete);
        }
      }
      await db.collection('games').doc(g.id).update({lembreteEnviado:true});
    }
  }

  console.log('--- Concluído ---');
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
