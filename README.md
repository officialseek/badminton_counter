# 🏸 Badminton Poängräknare

Enkel poängräknare för badminton byggd med React och TypeScript.

## Köra lokalt

```bash
npm install
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) i webbläsaren.

## Bygga för publicering

```bash
npm run build
```

Färdig app hamnar i mappen `dist/`. Den kan publiceras på valfri webbhost (Netlify, Vercel, GitHub Pages, egen server).

## Publicera som webbapp

- **Netlify:** Dra och släpp mappen `dist` på [app.netlify.com](https://app.netlify.com), eller koppla till Git och använd build-kommando: `npm run build`, publicera-mapp: `dist`.
- **Vercel:** Koppla repot, build: `npm run build`, output: `dist`.
- **GitHub Pages:** Kör `npm run build` och publicera innehållet i `dist` till en `gh-pages`-branch eller via GitHub Actions.

## Tekniker

- React 18
- TypeScript
- Vite
