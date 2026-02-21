# Badminton Poängräknare – Expo

Samma app som webbversionen, byggd för **Expo** så att du kan köra den på mobil (Expo Go) och publicera till App Store / Google Play via EAS.

## Köra lokalt

```bash
cd expo-app
npm start
```

- Tryck **w** för webbläsare
- Skanna QR-koden med **Expo Go** (iOS/Android) för att öppna på telefon

## Publicera med EAS (Expo Application Services)

1. **Skapa Expo-konto** på [expo.dev](https://expo.dev) och logga in.

2. **Installera EAS CLI** och logga in:
   ```bash
   npm install -g eas-cli
   eas login
   ```

3. **Konfigurera projektet** (första gången):
   ```bash
   eas build:configure
   ```
   Välj standardprofil om du vill.

4. **Bygga för Android**:
   ```bash
   eas build --platform android --profile preview
   ```
   (Använd `--profile production` för Play Store.)

5. **Bygga för iOS** (kräver Apple Developer-konto):
   ```bash
   eas build --platform ios --profile preview
   ```

6. **Skicka till butiker** (när bygget är klart):
   ```bash
   eas submit --platform android --latest
   eas submit --platform ios --latest
   ```

Mer info: [Expo – Publish your app](https://docs.expo.dev/distribution/app-stores/)

## Översikt

- **Poängräknare**: Samma funktioner som webben (namn, poäng, set, servar, byt sida, spara match).
- **Poängvisare**: Tryck "Skanna QR – öppna som poängvisare", skanna QR från en annan enhet som visar "Visa QR för poängvisare". Den enheten visar då tavlan (poäng, set, servar).
- **Synk**: Matchdata sparas i AsyncStorage. Poängvisaren uppdateras varje sekund från samma lagrade match (samma enhet eller delad lagring krävs för synk mellan enheter – för synk över nätverk behövs backend).
