# 🏸 Badminton Score Counter

A simple badminton score counter built with React and TypeScript.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for production

```bash
npm run build
```

The built app goes into the `dist/` folder. You can deploy it to any static host (Netlify, Vercel, GitHub Pages, your own server).

## Deploy as a web app

- **Netlify:** Drag and drop the `dist` folder at [app.netlify.com](https://app.netlify.com), or connect your Git repo and use build command: `npm run build`, publish directory: `dist`.
- **Vercel:** Connect the repo, build: `npm run build`, output: `dist`.
- **GitHub Pages:** Run `npm run build` and publish the contents of `dist` to a `gh-pages` branch or via GitHub Actions.

## Expo (mobile & publish to stores)

The app is also available as an **Expo** project so you can run it on your phone and publish to App Store / Google Play.

```bash
cd expo-app
npm install
npm start
```

Then press **w** for web, or scan the QR code with **Expo Go** on your device.

To build and publish with **EAS (Expo Application Services)**:

1. Create an account at [expo.dev](https://expo.dev) and run `eas login`
2. Run `eas build:configure`, then `eas build --platform android` (or `ios`)
3. Submit to stores with `eas submit --platform android --latest`

See **expo-app/README.md** for step-by-step publishing instructions.

## Koppla webb och iOS (synk mellan enheter)

Om du använder **webbgränssnittet** på en dator som poängräknare och **Safari på iPhone/iPad** som poängvisare (via QR-länk) fungerar det inte med bara localStorage – varje enhet har egen lagring.

**Lösning: Firebase Realtime Database** (gratis nivå):

1. Gå till [Firebase Console](https://console.firebase.google.com) och skapa ett projekt.
2. Öppna **Build → Realtime Database** och klicka **Create Database**. Välj region (t.ex. europe-west1) och start i **testläge** (för enkel setup; du kan strama åt reglerna senare).
3. Kopiera **databas-URL:en** (t.ex. `https://DITT-PROJEKT-default-rtdb.europe-west1.firebasedatabase.app`).
4. Gå till **Projektinställningar** (kugghjulet) → **Dina appar** → lägg till webbapp om du inte har det. Kopiera **apiKey**.
5. I projektets rot, skapa en fil `.env` (kopiera från `.env.example`):
   ```
   VITE_FIREBASE_API_KEY=din-api-nyckel
   VITE_FIREBASE_DATABASE_URL=https://DITT-PROJEKT-default-rtdb.europe-west1.firebasedatabase.app
   ```
6. Starta om dev-servern (`npm run dev`). Bygg om vid deploy: `npm run build`.

Därefter skickar webb-poängräknaren state till Firebase, och när iOS öppnar visarlänken (via QR) prenumerar den på samma match och får uppdateringar direkt. Samma env-variabler måste vara satta där du bygger/deployar (t.ex. Vercel/Netlify: lägg till dem under Environment variables).

**Databasregler:** I Realtime Database → Regler kan du efter testperioden använda t.ex. `"matches": { ".read": true, ".write": true }` så att alla med länken kan läsa/skriva (tillräckligt för enkel poängräknare).

## Tech stack

- **Web:** React 18, TypeScript, Vite
- **Mobile:** Expo (React Native), TypeScript
