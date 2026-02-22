// Laddar .env så att EXPO_PUBLIC_* finns i process.env
require('dotenv').config({ path: '.env' })

const appJson = require('./app.json')

module.exports = {
  ...appJson.expo,
  extra: {
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseDatabaseUrl: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  },
}
