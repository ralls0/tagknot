# TagKnot - La Tua Piattaforma Social per Condividere Esperienze

TagKnot è un'applicazione web social moderna e interattiva progettata per permettere agli utenti di creare, condividere e scoprire "Spot" (eventi o luoghi di interesse) con la propria rete. L'applicazione si concentra sulla gestione del profilo utente e sulla creazione di contenuti, offrendo un'esperienza fluida e intuitiva.

## Caratteristiche Principali

- Autenticazione Utente: Registrazione e accesso tramite email/password e Google.
- Profili Utente: Gestione del proprio profilo con username, tag profilo unico e immagine personalizzabile.
- Creazione e Gestione Spot: Gli utenti possono creare nuovi "Spot" con dettagli come tag (titolo), descrizione, immagine di copertina, data, ora e posizione (tramite Google Maps Autocomplete). È possibile modificare ed eliminare i propri Spot.
- Interazione Sociale: Funzionalità di "Mi piace", commenti e condivisione di Spot con altri utenti.
- Notifiche: Sistema di notifica in tempo reale per interazioni (mi piace, commenti, condivisioni).
- Segui/Non Seguire: Gli utenti possono seguire altri profili per vedere i loro Spot pubblici.
- Persistenza Dati: Utilizzo di Firebase Firestore per la gestione dei dati in tempo reale.

## Struttura dei Componenti

Il progetto è organizzato in una struttura modulare, con ogni componente React suddiviso in file separati per migliorare la manutenibilità e la leggibilità del codice.

```
src/
├── components/
│   ├── AlertMessage.tsx           # Componente per visualizzare messaggi di avviso/errore.
│   ├── AuthContext.tsx            # Contesto React per la gestione dello stato di autenticazione globale.
│   ├── ConfirmationModal.tsx      # Modale generico per richieste di conferma.
│   ├── CreateSpotPage.tsx         # Pagina per la creazione e la modifica degli Spot (ex eventi).
│   ├── EventCard.tsx              # Componente per la visualizzazione di un singolo Spot/evento.
│   ├── EventDetailModal.tsx       # Modale per visualizzare i dettagli completi di uno Spot e i commenti.
│   ├── FollowButton.tsx           # Pulsante per seguire/non seguire un utente.
│   ├── HomePage.tsx               # Pagina del feed principale (attualmente commentata).
│   ├── LoadingSpinner.tsx         # Componente per lo spinner di caricamento.
│   ├── LoginPage.tsx              # Pagina di accesso e registrazione utente.
│   ├── Navbar.tsx                 # Barra di navigazione superiore e inferiore.
│   ├── NotificationsPage.tsx      # Pagina per visualizzare le notifiche dell'utente.
│   ├── SearchPage.tsx             # Pagina di ricerca utenti e Spot (attualmente commentata).
│   ├── SettingsPage.tsx           # Pagina per la gestione delle impostazioni del profilo utente.
│   ├── ShareEventModal.tsx        # Modale per la condivisione di uno Spot con altri utenti.
│   └── UserAvatar.tsx             # Componente per la visualizzazione dell'avatar utente.
├── firebaseConfig.ts              # File di configurazione e inizializzazione di Firebase.
├── interfaces.ts                  # Definizioni delle interfacce TypeScript per i modelli di dati.
└── AppWrapper.tsx                 # Componente principale dell'applicazione che gestisce il routing e lo stato globale.
```

## Dettaglio dei Componenti Chiave

- `AppWrapper.tsx`: Il punto di ingresso principale dell'applicazione. Gestisce la logica di routing e lo stato di autenticazione, rendendo disponibili i servizi Firebase a tutti i componenti figli tramite AuthContext.
- `AuthContext.tsx`: Fornisce lo stato di autenticazione (utente corrente, ID utente, profilo utente) a tutti i componenti che ne hanno bisogno, evitando il "prop drilling".
- `CreateSpotPage.tsx`: Questa pagina permette agli utenti di inserire tutti i dettagli per un nuovo Spot o di modificare uno esistente. Include la funzionalità di ricerca della posizione integrata con Google Maps Autocomplete.
- `UserProfileDisplay.tsx`: Mostra il profilo di un utente, inclusi username, tag profilo, immagine e il numero di follower/seguiti. Attualmente mostra solo gli Spot creati dall'utente, escludendo gli Spot taggati come richiesto.
- `Navbar.tsx`: Contiene i link di navigazione principali. I link a HomePage e SearchPage sono stati temporaneamente commentati.

## Come Avviare il Progetto

Segui questi passaggi per configurare ed eseguire il progetto localmente.

**Prerequisiti**

Assicurati di avere installato:
- Node.js (versione consigliata: 18.x o superiore)
- npm (Node Package Manager) o Yarn

**Configurazione di Firebase**

1. **Crea un Progetto Firebase:**
  - Vai alla Console Firebase.
  - Crea un nuovo progetto.
  - Aggiungi un'applicazione web al tuo progetto Firebase.
2. **Abilita Servizi Firebase:**
  - **Authentication**: Vai alla sezione "Authentication" e abilita i provider "Email/Password" e "Google".
  - **Firestore Database**: Vai alla sezione "Firestore Database" e crea un nuovo database in modalità "Avvia in modalità di produzione" (o "test", ma per la sicurezza finale è consigliata la produzione).
3. **Ottieni le Credenziali Firebase:**
  - Nelle impostazioni del tuo progetto Firebase (icona a forma di ingranaggio -> Impostazioni progetto), nella sezione "Le tue app", seleziona la tua app web.
  - Copia l'oggetto firebaseConfig.
4. **Configura `firebaseConfig.ts`:**
  - Apri il file `src/firebaseConfig.ts`.
  - Sostituisci l'oggetto `firebaseConfig` esistente con quello che hai copiato dalla Console Firebase.
```
// src/firebaseConfig.ts
const firebaseConfig = {
  apiKey: "TUA_API_KEY",
  authDomain: "TUO_AUTH_DOMAIN",
  projectId: "TUO_PROJECT_ID",
  storageBucket: "TUO_STORAGE_BUCKET",
  messagingSenderId: "TUO_MESSAGING_SENDER_ID",
  appId: "TUO_APP_ID",
  // measurementId: "TUO_MEASUREMENT_ID" // Se usi Google Analytics
};
```
5. **Google Maps API Key:**
  - Ottieni una chiave API per Google Maps Platform (assicurati di abilitare le API "Places API" e "Geocoding API").
  - Crea un file `.env` nella directory radice del progetto (la stessa dove si trova `package.json`).
  - Aggiungi la tua chiave API come variabile d'ambiente:
```
REACT_APP_GOOGLE_MAPS_API_KEY=LaTuaChiaveAPIQui
```
  - **Importante**: Non committare il file `.env` nel controllo versione (aggiungilo al `.gitignore`).

**Installazione delle Dipendenze**

Nella directory radice del progetto, esegui:

```
npm install
# o
yarn install
```

**Avvio del Progetto**

Per avviare l'applicazione in modalità di sviluppo:

```
npm start
# o
yarn start
```

L'applicazione sarà disponibile su `http://localhost:3000` (o una porta simile).

**Deployment**

Per creare una build ottimizzata per la produzione:

```
npm run build
# o
yarn build
```

Questo creerà una cartella `build/` con tutti i file necessari per il deployment. Puoi deployare questa cartella su servizi di hosting come Firebase Hosting, Netlify, Vercel, ecc.

**Informazioni Aggiuntive**

**Regole di Sicurezza Firestore**

Per il corretto funzionamento dell'applicazione, assicurati che le tue regole di sicurezza di Firestore siano configurate per consentire agli utenti autenticati di leggere e scrivere i dati nelle collezioni appropriate.

**Esempio di Regole (adattale alle tue esigenze):**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Regole per i dati pubblici (leggibili/scrivibili da qualsiasi utente autenticato)
    match /artifacts/{appId}/public/data/{collection}/{document} {
      allow read, write: if request.auth != null;
    }

    // Regole per i dati privati dell'utente (leggibili/scrivibili solo dall'utente proprietario)
    match /artifacts/{appId}/users/{userId}/{collection}/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Regole per le sottocollezioni 'profile' (usate per i profili utente)
    match /artifacts/{appId}/users/{userId}/profile/data {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Regole per le sottocollezioni 'notifications'
    match /artifacts/{appId}/users/{userId}/notifications/{notificationId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Regole per le sottocollezioni 'comments' (all'interno degli eventi pubblici)
    match /artifacts/{appId}/public/data/events/{eventId}/comments/{commentId} {
      allow read: if true; // Tutti possono leggere i commenti pubblici
      allow write: if request.auth != null; // Solo gli autenticati possono scrivere
    }

    // Regole per le query di gruppo di collezioni (es. ricerca di profili)
    // Richiede la creazione di indici nella console Firebase!
    match /{path=**}/profile {
      allow read: if request.auth != null;
    }
  }
}
```

**Nota sugli Indici Firestore:**

Alcune query (specialmente quelle che coinvolgono `orderBy` o `where` su più campi, o `collectionGroup` queries) richiederanno la creazione di indici compositi in Firestore. Se incontri errori relativi agli indici nella console del browser, segui i link forniti da Firebase per creare gli indici necessari nella tua Console Firebase.

Grazie per aver utilizzato TagKnot!