export const levelRank = {
  base: 1,
  intermedio: 2,
  avanzato: 3
}

export const warmupSteps = [
  { name: 'Mobilita collo e spalle', duration: '2 min', cue: 'Movimenti lenti, ampiezza progressiva.' },
  { name: 'Circonduzioni anche e ginocchia', duration: '2 min', cue: 'Mantieni addome attivo e schiena neutra.' },
  { name: 'Jumping jack leggeri', duration: '2 min', cue: 'Respira ritmicamente, non irrigidire le spalle.' },
  { name: 'Plank dinamico corto', duration: '2 min', cue: 'Attiva core e glutei prima del lavoro principale.' }
]

const EXERCISE_VIDEO_URL = 'https://www.youtube.com/watch?v=uTYNPadVdic'

const VIDEO_LOOP_BY_ANIMATION = {
  pushup: { start: 8, end: 26 },
  squat: { start: 26, end: 46 },
  plank: { start: 46, end: 64 },
  lunge: { start: 64, end: 84 },
  pike: { start: 84, end: 104 },
  hollow: { start: 104, end: 122 },
  row: { start: 122, end: 142 },
  jumpSquat: { start: 142, end: 162 },
  gluteBridge: { start: 162, end: 182 },
  mountainClimber: { start: 182, end: 202 },
  deadBug: { start: 202, end: 222 }
}

const rawExercises = [
  {
    id: 'push-up-base',
    name: 'Push-up Base',
    type: 'Spinta Orizzontale',
    animationType: 'pushup',
    level: 'base',
    durationMin: 6,
    sets: 3,
    reps: '8-12',
    execution: [
      'Mani leggermente piu larghe delle spalle.',
      'Scendi in controllo con gomiti a circa 45 gradi.',
      'Risalita spingendo il pavimento, corpo in linea.'
    ],
    mistakes: [
      'Bacino che cede verso il basso.',
      'Gomiti troppo aperti con stress alle spalle.',
      'Collo in iperestensione guardando avanti.'
    ],
    breathing: 'Inspira in discesa, espira forte in salita.'
  },
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    type: 'Gambe',
    animationType: 'squat',
    level: 'base',
    durationMin: 6,
    sets: 4,
    reps: '12-15',
    execution: [
      'Piedi poco oltre larghezza anche, punte leggermente aperte.',
      'Scendi portando anche indietro e ginocchia in linea con i piedi.',
      'Risalita spingendo su tutto il piede, addome attivo.'
    ],
    mistakes: [
      'Talloni che si staccano.',
      'Ginocchia che collassano verso l interno.',
      'Schiena curva nella fase bassa.'
    ],
    breathing: 'Inspira in discesa, espira salendo.'
  },
  {
    id: 'plank-front',
    name: 'Plank Frontale',
    type: 'Core Isometrico',
    animationType: 'plank',
    level: 'base',
    durationMin: 5,
    sets: 3,
    reps: '30-45 sec',
    execution: [
      'Avambracci a terra, gomiti sotto le spalle.',
      'Corpo in linea da testa a talloni.',
      'Contrai glutei e addome senza trattenere il fiato.'
    ],
    mistakes: [
      'Bacino troppo alto o troppo basso.',
      'Spalle chiuse verso le orecchie.',
      'Apnea durante il mantenimento.'
    ],
    breathing: 'Respirazione corta e costante: inspira dal naso, espira dalla bocca.'
  },
  {
    id: 'reverse-lunge',
    name: 'Reverse Lunge',
    type: 'Gambe Unilaterale',
    animationType: 'lunge',
    level: 'intermedio',
    durationMin: 7,
    sets: 3,
    reps: '10+10',
    execution: [
      'Passo indietro lungo per mantenere il busto stabile.',
      'Ginocchio posteriore verso il suolo senza impattare.',
      'Spingi col piede avanti per tornare in piedi.'
    ],
    mistakes: [
      'Peso sulla punta del piede davanti.',
      'Oscillazione eccessiva del busto.',
      'Passo troppo corto con sovraccarico al ginocchio.'
    ],
    breathing: 'Inspira scendendo, espira tornando su.'
  },
  {
    id: 'pike-pushup',
    name: 'Pike Push-up',
    type: 'Spinta Verticale',
    animationType: 'pike',
    level: 'intermedio',
    durationMin: 7,
    sets: 4,
    reps: '6-10',
    execution: [
      'Parti in V rovesciata con anche alte.',
      'Scendi portando la testa avanti tra le mani.',
      'Estendi le braccia tornando alla V iniziale.'
    ],
    mistakes: [
      'Perdita della forma a V con schiena piatta.',
      'Gomiti aperti lateralmente in eccesso.',
      'ROM corto senza controllo in discesa.'
    ],
    breathing: 'Inspira in discesa, espira in spinta verso l alto.'
  },
  {
    id: 'hollow-hold',
    name: 'Hollow Hold',
    type: 'Core Avanzato',
    animationType: 'hollow',
    level: 'intermedio',
    durationMin: 6,
    sets: 4,
    reps: '20-40 sec',
    execution: [
      'Lombare sempre aderente al pavimento.',
      'Braccia tese dietro la testa se possibile.',
      'Gambe estese a pochi cm da terra.'
    ],
    mistakes: [
      'Arco lombare in compenso.',
      'Collo contratto eccessivamente.',
      'Movimento a scatti al posto di tenuta solida.'
    ],
    breathing: 'Espira gradualmente per stabilizzare il core, inspira corto mantenendo tensione.'
  },
  {
    id: 'pull-table-row',
    name: 'Australian Row (sbarra bassa)',
    type: 'Trazione Orizzontale',
    animationType: 'row',
    level: 'intermedio',
    durationMin: 7,
    sets: 4,
    reps: '8-12',
    execution: [
      'Corpo rigido in linea, petto verso la sbarra.',
      'Tira con gomiti vicino al busto.',
      'Scendi lentamente fino ad estensione completa.'
    ],
    mistakes: [
      'Trazione fatta solo di braccia senza scapole attive.',
      'Bacino che crolla verso il basso.',
      'Range ridotto senza tocco del petto.'
    ],
    breathing: 'Inspira in discesa, espira durante la trazione.'
  },
  {
    id: 'jump-squat-controlled',
    name: 'Jump Squat Controllato',
    type: 'Condizionamento',
    animationType: 'jumpSquat',
    level: 'avanzato',
    durationMin: 8,
    sets: 4,
    reps: '10-14',
    execution: [
      'Scendi in mezzo squat con schiena neutra.',
      'Salta in verticale con estensione completa di anche, ginocchia e caviglie.',
      'Atterra morbido e riassorbi subito con controllo.'
    ],
    mistakes: [
      'Atterraggio rumoroso e rigido senza ammortizzazione.',
      'Ginocchia che collassano verso l interno.',
      'Perdita della postura del busto nelle ultime ripetizioni.'
    ],
    breathing: 'Inspira in discesa, espira durante lo stacco del salto.'
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    type: 'Catena Posteriore',
    animationType: 'gluteBridge',
    level: 'base',
    durationMin: 6,
    sets: 4,
    reps: '12-16',
    execution: [
      'Piedi a terra sotto le ginocchia, schiena neutra.',
      'Spingi dai talloni sollevando il bacino fino ad allineare anche e busto.',
      'Scendi lentamente senza perdere il controllo del core.'
    ],
    mistakes: [
      'Iperestensione lombare in alto.',
      'Spinta sulle punte invece che sui talloni.',
      'Movimento rapido senza fase eccentrica controllata.'
    ],
    breathing: 'Espira nella salita del bacino, inspira in discesa.'
  },
  {
    id: 'mountain-climber',
    name: 'Mountain Climber',
    type: 'Core Dinamico',
    animationType: 'mountainClimber',
    level: 'intermedio',
    durationMin: 6,
    sets: 4,
    reps: '30-45 sec',
    execution: [
      'Parti da plank alto con spalle sopra i polsi.',
      'Alterna le ginocchia verso il petto mantenendo il bacino stabile.',
      'Mantieni ritmo costante e allineamento testa-busto.'
    ],
    mistakes: [
      'Anche troppo alte o troppo basse.',
      'Passi corti senza vero richiamo del ginocchio.',
      'Spinta delle spalle verso le orecchie.'
    ],
    breathing: 'Respira in modo ritmico: espira ogni due appoggi.'
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    type: 'Core Controllo',
    animationType: 'deadBug',
    level: 'base',
    durationMin: 5,
    sets: 3,
    reps: '8+8',
    execution: [
      'Lombare aderente al suolo per tutta la serie.',
      'Estendi gamba e braccio opposto in modo alternato.',
      'Ritorna al centro senza perdere la tensione addominale.'
    ],
    mistakes: [
      'Lombare che si inarca durante l estensione.',
      'Movimento troppo veloce con compensi.',
      'Collo contratto o spalle sollevate.'
    ],
    breathing: 'Espira quando estendi, inspira tornando in posizione centrale.'
  }
]

export const exercises = rawExercises.map((exercise) => {
  const loop = VIDEO_LOOP_BY_ANIMATION[exercise.animationType] ?? { start: 0, end: 20 }
  return {
    ...exercise,
    video: {
      url: EXERCISE_VIDEO_URL,
      start: loop.start,
      end: loop.end
    }
  }
})

export function buildWorkout(durationMin, selectedLevel) {
  const available = exercises.filter((ex) => levelRank[ex.level] <= levelRank[selectedLevel])
  const sorted = [...available].sort((a, b) => a.durationMin - b.durationMin)

  const selected = []
  let total = 0

  for (const ex of sorted) {
    if (total + ex.durationMin <= durationMin || selected.length < 3) {
      selected.push(ex)
      total += ex.durationMin
    }
    if (total >= durationMin) break
  }

  return selected
}
