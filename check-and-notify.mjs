import pkg from 'firebase-admin';
const { credential } = pkg;
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createCanvas, loadImage } from 'canvas';

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

// ===== GERAR CARD DO JOGO =====
async function gerarCardJogo(g, confirmados) {
  const W = 1080, H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0302');
  bg.addColorStop(0.5, '#0A0604');
  bg.addColorStop(1, '#020810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Linhas douradas
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.3, '#C9A84C');
  grad.addColorStop(0.7, '#C9A84C');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);

  // Header
  ctx.font = 'bold 38px serif';
  ctx.fillStyle = '#C9A84C';
  ctx.textAlign = 'center';
  ctx.fillText('INVICTOS FC', W / 2, 70);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = 'rgba(201,168,76,.6)';
  ctx.fillText('FUTEBOL AMADOR · 2015', W / 2, 105);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Logo Invictos
  try {
    const logoInv = await loadImage('https://i.imgur.com/placeholder_invictos.png').catch(() => null);
    if (logoInv) {
      ctx.save(); roundRect(120, 140, 260, 260, 20); ctx.clip();
      ctx.drawImage(logoInv, 120, 140, 260, 260); ctx.restore();
      ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 4;
      roundRect(120, 140, 260, 260, 20); ctx.stroke();
    }
  } catch (e) {}

  // Logo adversário
  if (g.logoAdversario) {
    try {
      const logoAdv = await loadImage(g.logoAdversario);
      ctx.save(); roundRect(W - 380, 140, 260, 260, 20); ctx.clip();
      ctx.drawImage(logoAdv, W - 380, 140, 260, 260); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3;
      roundRect(W - 380, 140, 260, 260, 20); ctx.stroke();
    } catch (e) {
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      roundRect(W - 380, 140, 260, 260, 20); ctx.fill();
      ctx.font = 'bold 80px serif'; ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.textAlign = 'center';
      ctx.fillText(g.opponent.charAt(0).toUpperCase(), W - 250, 300);
    }
  }

  // VS
  ctx.font = 'bold 90px serif';
  ctx.fillStyle = '#C9A84C';
  ctx.textAlign = 'center';
  ctx.fillText('×', W / 2, 300);

  // Nomes
  ctx.font = 'bold 40px serif';
  ctx.fillStyle = '#F0C040';
  ctx.fillText('INVICTOS FC', 250, 440);
  ctx.fillText(g.opponent.toUpperCase(), W - 250, 440);

  // Separador
  ctx.fillStyle = 'rgba(201,168,76,.3)';
  ctx.fillRect(60, 465, W - 120, 2);

  // Infos
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#F5E6C8';
  ctx.fillText(`📅 ${fmtDate(g.date)}   🕐 ${g.time || ''}h`, W / 2, 520);
  ctx.font = '28px sans-serif';
  ctx.fillStyle = 'rgba(245,230,200,.7)';
  ctx.fillText(`📍 ${g.location || ''}`, W / 2, 560);

  // Separador
  ctx.fillStyle = 'rgba(201,168,76,.3)';
  ctx.fillRect(60, 590, W - 120, 2);

  // Confirmados
  ctx.font = 'bold 30px serif';
  ctx.fillStyle = '#4ADE80';
  ctx.fillText(`✅ CONFIRMADOS (${confirmados.length})`, W / 2, 635);

  ctx.font = '26px sans-serif';
  ctx.fillStyle = '#F5E6C8';
  confirmados.forEach((n, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? 220 : W - 220;
    const y = 675 + row * 42;
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}. ${n}`, x, y);
  });

  // Footer
  ctx.font = 'italic 24px sans-serif';
  ctx.fillStyle = 'rgba(201,168,76,.5)';
  ctx.textAlign = 'center';
  ctx.fillText('🦁 Nunca Rendidos · Sempre Guerreiros', W / 2, H - 40);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
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

    console.log('--- Concluído ---');
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
