# Personal Trainer App

Applicazione React + Vite per training guidato con viewer 3D, gestione profilo, storico allenamenti e risultati.

## Stack

- React 18
- Vite 5
- Three.js + `@react-three/fiber` + `@react-three/drei`
- D3.js (grafico storico peso)

## Funzionalita principali

- Flusso a sezioni con navigazione `Indietro (<)` / `Avanti (>)` sempre disponibile.
- Header persistente con burger menu identico in ogni sezione.
- Sezioni:
  - `Profilo`
  - `Configurazione Training e Livello`
  - `Training`
  - `Storico Allenamenti`
  - `Risultati`
- Titolo header: `Personal Trainer`.
- Splash screen da `public/splash.png`.
- Logo header da `public/logone.png`.
- Icone sezioni e burger da `public/icons/*.png`.

## Profilo

- Campi: alias, nome, cognome, email, sesso, altezza.
- Peso storicizzato per data.
- Il sesso cambia il tema UI.
- Pulsante `Accedi con Google` nella riga titolo della sezione Profilo, allineato a destra.

## Training

- Scelta training e livello.
- Viewer 3D per scheda con:
  - selezione modello FBX da `src/config/models.json`
  - selezione clip con prima opzione obbligatoria `Scegli...`
  - al cambio modello: prima clip selezionata e avviata automaticamente
  - AutoFit camera con aggiornamento clip zone
  - gestione clipping per evitare tagli mesh
- Cambio scheda: non forza autofit.

## Storico e risultati

- `Storico Allenamenti`: calendario con eventi training eseguiti.
- Evento creato su `Play` (start) e completato su `Stop` (fine) o fine programma.
- Dettaglio evento: durata, tipo training, livello, orari.
- `Risultati`: grafico D3 dello storico peso (asse X data, asse Y peso, legenda/tick visibili).

## Storage locale

Tutti i dati app sono salvati sotto una chiave root unica:

- `localStorage["ginnastica"]`

Dentro la root vengono memorizzati i vari sotto-valori (tema, profilo, storico, programmi, camera, clip, ecc.).

Nota: sono presenti fallback di sola lettura per alcune chiavi legacy, per compatibilita con dati vecchi.

## Asset 3D e naming convention

Organizzazione attesa per actor:

```text
public/assets3d/actors/<actor-name>/
  <actor-name>.fbx
  textures/
    base_color.(jpg|png)
    normal.(jpg|png)
    roughness.(jpg|png)
    # opzionale: height.(jpg|png)
```

Il codice usa naming texture esplicito e comune tra actor per caricamento automatico.

Modelli disponibili centralizzati in:

- `src/config/models.json`

Include anche:

- `/assets3d/actors/sofia/sofia.fbx`

## Query params supportati

- `?edit=1` abilita modalita editor.
- `?google=1` abilita login Google.
- `?splash=0` disabilita splash.
- `?splash=1` forza splash.

## Google login

Configurazione:

1. Imposta `.env`:

```bash
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

2. Abilita via URL con `?google=1`.

3. In Google Cloud Console, OAuth Client (Web application), aggiungi in `Authorized JavaScript origins` tutte le origin usate in sviluppo/produzione.

Esempio dev:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

Se compare errore `The given origin is not allowed for the given client ID` o `403`, l'origin non e autorizzata.

## Requisiti

- Node.js 20+
- npm 10+
- Docker e Docker Compose (opzionali, per deploy containerizzato)

## Avvio locale (dev)

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

Oppure:

```bash
./localrun.sh
```

`vite.config.js` usa `server.strictPort: true`: se la porta `5173` e occupata il server non cambia porta automaticamente.

## Build produzione

```bash
npm run build
```

Output in `dist/`.

## Vite e header

- `base: './'` per deploy con path relativo.
- Header COOP impostato a `Cross-Origin-Opener-Policy: unsafe-none` (dev/preview e runtime nginx) per compatibilita con Google Identity button.

## Docker

File inclusi:

- `Dockerfile` (multi-stage: build Node + runtime `nginxinc/nginx-unprivileged`)
- `nginx.conf`
- `docker-compose.yml`
- `deploy.sh`
- `run.sh`
- `localrun.sh`
- `publish.sh`

### Build e run con Compose

```bash
docker compose up --build -d
```

App su `http://localhost:8080`.

### Build + push immagine

```bash
./deploy.sh
```

Variabili:

- `REGISTRY` default `docker.io/andpra70`
- `IMAGE_NAME` default `ginnastica-calistenics-app`
- `TAG` default `latest`
- `PUSH_IMAGE` default `true`

### Run da registry

```bash
./run.sh
```

Variabili:

- `REGISTRY` default `docker.io/andpra70`
- `IMAGE_NAME` default `ginnastica-calistenics-app`
- `TAG` default `latest`
- `CONTAINER_NAME` default `ginnastica-app`
- `HOST_PORT` default `8080`
- `CONTAINER_PORT` default `8080`
- `PULL_IMAGE` default `true`
