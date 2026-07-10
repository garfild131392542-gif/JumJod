import * as crypto from 'crypto';

export function verifySignature(body: string, signature: string, channelSecret: string): boolean {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

export async function sendLineReply(replyToken: string, content: string | any) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error('Missing LINE_CHANNEL_ACCESS_TOKEN in environment variables.');
    return;
  }

  const messages = Array.isArray(content)
    ? content.map(c => typeof c === 'string' ? { type: 'text', text: c } : c)
    : [typeof content === 'string' ? { type: 'text', text: content } : content];

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error replying to LINE:', errorData);
      try {
        const errorString = JSON.stringify(errorData);
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{
              type: 'text',
              text: `❌ LINE API Error:\n${errorString.substring(0, 1000)}`
            }]
          }),
        });
      } catch (err) {
        console.error('Failed to send fallback LINE reply:', err);
      }
    }
  } catch (error) {
    console.error('Failed to send LINE reply:', error);
  }
}

export async function showLineLoadingAnimation(chatId: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) return;

  try {
    await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        chatId,
        loadingSeconds: 5,
      }),
    });
  } catch (error) {
    console.error('Failed to start LINE loading animation:', error);
  }
}

export async function markLineMessagesAsRead(markAsReadToken: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) return;

  try {
    const response = await fetch('https://api.line.me/v2/bot/chat/markAsRead', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        markAsReadToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error marking LINE messages as read:', errorData);
    }
  } catch (error) {
    console.error('Failed to mark LINE messages as read:', error);
  }
}
