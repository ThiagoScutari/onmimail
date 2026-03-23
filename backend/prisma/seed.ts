import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function encrypt(
  plaintext: string,
  keyHex: string,
): { encrypted: Buffer; iv: string; tag: string } {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

async function main() {
  const appSecret = process.env.APP_SECRET;
  if (!appSecret) {
    console.error('APP_SECRET not set in .env');
    process.exit(1);
  }

  const settings: Record<string, string> = {
    monitored_senders: process.env.MONITORED_SENDERS || '',
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || '',
    sync_interval_hours: '4',
  };

  for (const [key, value] of Object.entries(settings)) {
    if (!value) continue;

    const enc = encrypt(value, appSecret);

    await prisma.setting.upsert({
      where: { key },
      update: {
        value_enc: new Uint8Array(enc.encrypted),
        iv: enc.iv,
        tag: enc.tag,
      },
      create: {
        key,
        value_enc: new Uint8Array(enc.encrypted),
        iv: enc.iv,
        tag: enc.tag,
      },
    });

    console.log(`Setting "${key}" saved.`);
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
