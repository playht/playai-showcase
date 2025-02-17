import dotenv from 'dotenv';
import express from 'express';
import * as fs from 'node:fs';

dotenv.config();

if (process.env.USER_ID === undefined || process.env.API_KEY === undefined) {
  if (process.env.USER_ID === undefined) console.error('USER_ID not found in environment.');
  if (process.env.API_KEY === undefined) console.error('API_KEY not found in environment.');
  console.error('One or more required environment variables are missing. Please create an .env file similar to the .env.example file.');
  process.exit(1);
} else {
  console.log('USER_ID =', process.env.USER_ID.substring(0, 4) + '...');
  console.log('API_KEY =', process.env.API_KEY.substring(0, 4) + '...');
}

const model = process.env.MODEL ?? 'Play3.0-mini';
if (!['Play3.0-mini', 'PlayDialog', 'PlayDialogMultilingual', 'PlayDialogArabic'].includes(model)) {
  console.error(
    `Invalid model "${model}". Please use one of the following models: Play3.0-mini, PlayDialog, PlayDialogMultilingual, PlayDialogArabic`,
  );
  process.exit(1);
}
console.log('MODEL =', process.env.MODEL);

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.log(`Please use Node.js version 20 or higher to run this demo. Version used: ${process.version}`);
  process.exit(1);
}
type WebSocketAuthResponseSchema = { webSocketUrls: Record<string, string>; expiresAt: string };

async function getAuthenticatedWebSocketUrl() {
  try {
    const url = 'https://api.play.ai/api/v1/tts/websocket-auth';
    const headers = {
      Authorization: 'Bearer ' + process.env.API_KEY,
      'X-User-Id': process.env.USER_ID!,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, { method: 'POST', headers: headers });

    if (!response.ok) {
      throw new Error(
        `\nFailed to get authenticated websocket URL. \nPlease make sure the API_KEY and USER_ID in the .env file are correct. \nReceived response: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as WebSocketAuthResponseSchema;
  } catch (e) {
    console.error(`Error while obtaining authenticated websocket URL: ${e}`, e);
    throw e;
  }
}

const app = express();

app.all('*', async (_, res) => {
  try {
    const result = await getAuthenticatedWebSocketUrl();
    const webSocketUrl = result.webSocketUrls[model];
    if (!webSocketUrl) {
      res.status(400).send(`Websocket URL for model ${model} not found in response: ${JSON.stringify(result)}`);
      return;
    }
    const pageContent = fs
      .readFileSync(`${import.meta.dirname}/websocket.html`, 'utf8')
      .replaceAll('<%= SELECTED_MODEL %>', model)
      .replaceAll('<%= WEBSOCKET_URL %>', webSocketUrl);
    res.status(200).send(pageContent);
  } catch (e) {
    console.error(`Error serving HTML page: ${e}`, e);
    res.status(500).send('Error while obtaining authenticated websocket URL. Please check the server logs.');
  }
});

const serverPort = 8080;
app.listen(serverPort, () => {
  console.log(`*** Server running on http://localhost:${serverPort}`);
});
