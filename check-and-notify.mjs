import { initializeApp } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// ===== CONFIG via variáveis de ambiente (GitHub Secrets) =====
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const HOURS_BEFORE = 3; // janela de aviso: 3 horas antes do jogo
const WINDOW_MINUTES = 30; // tolerância da janela (roda de hora em hora, +-30min)

initializeApp({
  credential: credential.cert(FIREBASE_SERVICE_ACCOUNT)
});

const db = getFirestore();

function parseGameDateTime(dateStr, timeStr) {
  // dateStr: 'YYYY-MM-DD', timeStr: 'HH:MM'
  if (!dateStr) return null;
  const time = timeStr || '00:00';
  // Horário de Brasília (UTC-3), sem horário de verão atualmente
  const isoLocal = `${dateStr}T${time}:00-03:00`;
  const d = new Date(isoLocal);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function sendPush(title, message, gameId) {
  const resp = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      filters: [
        { field: 'tag', key: 'time', relation: '=', value: 'invictos' }
      ],
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
  console.log('--- Invictos FC: verificando jogos para push 3h antes ---');
  console.log('Horário atual (UTC):', new Date().toISOString());

  const snap = await db.collection('games').where('status', '==', 'agendado').get();
  const now = new Date();

  let sentCount = 0;

  for (const doc of snap.docs) {
    const g = doc.data();
    const gameId = doc.id;
    const gameDateTime = parseGameDateTime(g.date, g.time);
    if (!gameDateTime) continue;

    const diffMs = gameDateTime.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const targetMinutes = HOURS_BEFORE * 60;

    console.log(`Jogo vs ${g.opponent} (${gameId}): faltam ${Math.round(diffMinutes)} min`);

    // Verifica se está dentro da janela de 3h (+- tolerância) e ainda não foi notificado
    if (
      diffMinutes <= targetMinutes + WINDOW_MINUTES &&
      diffMinutes >= targetMinutes - WINDOW_MINUTES &&
      !g.pushSent3h
    ) {
      const title = '⚽ Invictos FC — Jogo em 3 horas!';
      const message = `Invictos FC vs ${g.opponent} hoje às ${g.time || ''}h. Confirme sua presença!`;

      await sendPush(title, message, gameId);

      // Marca como já notificado para não repetir
      await db.collection('games').doc(gameId).update({ pushSent3h: true });
      sentCount++;
      console.log(`✅ Push enviado para o jogo vs ${g.opponent}`);
    }
  }

  console.log(`--- Concluído. ${sentCount} push(es) enviado(s). ---`);
}

main().catch(err => {
  console.error('Erro no script:', err);
  process.exit(1);
});
