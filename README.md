# Ginnastica Calisthenics App

Applicazione React + Vite per generare un allenamento di calisthenics con:
- scelta livello (`base`, `intermedio`, `avanzato`)
- durata totale allenamento
- riscaldamento guidato
- dettagli tecnici esercizi
- rendering 3D esercizi con Three.js

La build Vite usa path relativo (`base: './'`) per poter essere deployata in contesti differenti.

## Requisiti

- Node.js 20+
- npm 10+
- Docker e Docker Compose (per deploy containerizzato)

## Avvio locale (dev)

```bash
./localrun.sh
```

Oppure:

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

## Build produzione

```bash
npm run build
```

Output in `dist/`.

## Docker

Sono inclusi:
- `Dockerfile` (multi-stage: build con Node, runtime con `nginxinc/nginx-unprivileged`)
- `docker-compose.yml`
- `deploy.sh`
- `run.sh`
- `localrun.sh`
- `publish.sh`

Il runtime container non usa root.

### Build e run con Compose

```bash
docker compose up --build -d
```

App disponibile su `http://localhost:8080`.

### Build + push immagine

```bash
./deploy.sh
```

Variabili supportate:
- `REGISTRY` (default: `docker.io/andpra70`)
- `IMAGE_NAME` (default: `ginnastica-calistenics-app`)
- `TAG` (default: `latest`)
- `PUSH_IMAGE` (default: `true`)

Esempio:

```bash
REGISTRY=docker.io/andpra70 IMAGE_NAME=ginnastica-calistenics-app TAG=v1.0.0 ./deploy.sh
```

### Run da immagine registry

```bash
./run.sh
```

Variabili supportate:
- `REGISTRY` (default: `docker.io/andpra70`)
- `IMAGE_NAME` (default: `ginnastica-calistenics-app`)
- `TAG` (default: `latest`)
- `CONTAINER_NAME` (default: `ginnastica-app`)
- `HOST_PORT` (default: `8080`)
- `CONTAINER_PORT` (default: `8080`)
- `PULL_IMAGE` (default: `true`)

Lo script rimuove sempre eventuale container esistente con lo stesso nome prima di avviare quello nuovo.

## Publish git veloce

```bash
./publish.sh
```

Esegue:
- `git add .`
- `git commit -m "Update watermarks site"`
- `git push`
