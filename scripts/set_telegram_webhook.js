const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
let token = '';
for (const line of envContent.split(/\r?\n/)) {
  if (line.startsWith('TELEGRAM_BOT_TOKEN=')) token = line.split('=')[1].trim();
}

async function setWebhook() {
  const webhookUrl = 'https://lafincaweb.vercel.app/api/telegram/webhook';
  const url = 'https://api.telegram.org/bot' + token + '/setWebhook?url=' + encodeURIComponent(webhookUrl);
  const res = await fetch(url);
  const data = await res.json();
  console.log('SET WEBHOOK RESULT:', data);

  const infoRes = await fetch('https://api.telegram.org/bot' + token + '/getWebhookInfo');
  const infoData = await infoRes.json();
  console.log('NEW WEBHOOK INFO:', infoData);
}
setWebhook();
