# Riprendere una sessione

## Chiusura sessione — 17 ottobre 2026

- Versione applicazione: **0.1.1**; nessuna modifica runtime dopo il rilascio grafico.
- Commit successivi: `be3e959` (README inglese/italiano) e `123273d` (percorsi NodeScanner). Il push dei README è fallito per DNS nel sandbox; non considerare pubblicati questi commit senza verificare il remoto.
- Directory ancora presente alla preparazione: `/var/www/html/HomeNetScanner`. Destinazione: `/var/www/html/NodeScanner`, URL Apache `http://localhost/NodeScanner/`. Migrazione non ancora eseguita: l'utente la eseguirà dopo aver chiuso la sessione e arrestato il backend.
- Pacchetto di chiusura preparato in `/tmp/noderunner-session-close`: script, documentazione aggiornata, bundle Git completo e istruzioni locali di ripresa. Copiarlo fuori da `/tmp` prima di riavviare il computer. Lo script precedente `/tmp/noderunner-rename-development.sh` rimane utilizzabile finché i file temporanei esistono.
- Lo script aggiorna Apache, verifica la configurazione, rinomina la directory e installa i documenti; conserva dati/token e salva il bundle Git in `.local-session/` nella nuova directory. Non modifica il `.git` preesistente. Le directory nascoste sono negate dalla configurazione Apache preparata.
- Il clone Git reale è `/tmp/noderunner-public-dyadg9gz`; nella directory installata `.git` non è un repository utilizzabile nel sandbox. Non cancellarlo o inizializzarlo per aggirare il vincolo. Se il clone temporaneo scompare, recuperare il repository dal bundle locale con `git clone /var/www/html/NodeScanner/.local-session/repository.bundle /percorso/scrivibile/NodeRunner`.
- Verifiche di questa chiusura: sintassi dello script e integrità del bundle; nessun backend avviato e nessuna scansione. Riferimento precedente: 35 test Python / 59 controlli JavaScript; nessuna modifica applicativa che richieda rieseguirli.

Alla ripresa: leggere questa sezione, verificare l'esito effettivo della migrazione e il nuovo URL, controllare Git e gli eventuali commit da pubblicare, poi riprendere sviluppo e prove manuali nel browser (temi, mappa/trascinamento, registro/Excel). Il comando per ritrovare la conversazione specifica è nel promemoria locale del pacchetto, escluso dalla documentazione pubblica.

## Directory di sviluppo NodeScanner — 17 ottobre 2026

Percorso previsto: `/var/www/html/NodeScanner`; URL Apache: `http://localhost/NodeScanner/`. Il prodotto e il repository restano NodeRunner. Aggiornati documentazione bilingue e percorsi del template Apache. Il backend continua a usare `http://localhost:8000`, senza rinominare token o dati. La migrazione effettiva deve essere eseguita fuori dal sandbox tramite lo script preparato `/tmp/noderunner-rename-development.sh`: controllare il suo esito prima di considerarla completata. Arrestare prima il backend e riavviarlo dalla nuova directory; nessun processo è stato arrestato o avviato durante la preparazione. Le note storiche successive non attestano l'esecuzione della migrazione.

## README bilingue — 17 ottobre 2026

`README.md` è la guida principale in inglese visualizzata da GitHub; `README.it.md` conserva integralmente la guida italiana precedente, con collegamenti reciproci per cambiare lingua. Aggiornati avvio da clone, funzioni, API, licenza e rimandi per contributori. Modifica solo documentale: nessun cambio di versione, tag o comportamento. Verificare entrambi i README quando cambia una funzione documentata.

L'aggiornamento grafico v0.1.1 precedente risulta installato e pubblicato: `/tmp/noderunner-branding-result.json` riporta `installed: true`, `pushed: true` e commit `76d12792f6d0a53f7b208583190e02319b17989c`. Questo esito supera le note precedenti di installazione/push da verificare. La nuova modifica ai README è separata e la sua pubblicazione richiede un proprio push su main. Il clone scrivibile resta `/tmp/noderunner-public-dyadg9gz`; la directory installata non è stata modificata per questa traduzione.

Riferimento aggiornato il **17 ottobre 2026**. Cartella di lavoro: `/var/www/html/NodeScanner`.

## Punto di partenza

L'utente vuole continuare lo sviluppo iniziando dall'eliminazione di bug e problemi di sicurezza. Una prima serie di correzioni è già nei sorgenti. **Non ripetere l'audit da zero né sovrascrivere i dati locali.** I dettagli e le priorità sono in [PROJECT_STATUS.md](PROJECT_STATUS.md); avvio e uso in [README.md](README.md).

Il registro è una vista dedicata `#registry`, senza finestra modale o sfondo sovrapposto. **Map** nella barra centrale condivisa, Esc e la navigazione del browser riportano alla mappa. Sono presenti pulsanti per scansione e impostazioni. Restano tema Light, temi scuri, contatori e filtri.

La colonna **Connection** è subito dopo lo stato della scansione, con le opzioni Wi-Fi, Wired e Unassigned. Il menu Vendor riutilizza `vendorFieldGroup(d, compact)` anche per host storici, con produttori comuni, personalizzati, automatico e Other. I campi restano `overrides[id].vendorOverride` e `overrides[id].conn`, condivisi con la mappa ed esportati in Excel.

Il gateway è incluso nel registro. Il frontend usava direttamente l'hostname Nmap come nome del gateway; ora `normalize()` imposta il nome predefinito **Gateway Router** e conserva il dato originale in `hostname`. Un nome manuale continua a prevalere. `updateRegistryCache(list)` registra anche `gw`, senza inserirlo nei controlli delle anomalie degli altri host. La riga e l'export usano il MAC reale da `lastMac`, con tipo Router / Gateway e connessione Gateway. Il gateway dedotto resta Not verified e non aggiorna lastSeen.

`REGISTRY_COLUMNS`, `buildRegistryHeader()`, `sortRegistryBy()` e `registrySortValue()` in `registry.js` definiscono l'ordinamento dalle intestazioni, senza i vecchi pulsanti Sort. `state.registrySort` e `state.registrySortDirection` mantengono la scelta per la sessione; nuovo campo crescente, secondo clic decrescente. Room usa la label della stanza, Vendor il valore effettivo, IP/date sono numerici e i vuoti rimangono ultimi.

Il registro è raggruppato in tabelle distinte quando si ordina per Room o Connection. `registryGroups(ids)` riceve gli ID già filtrati e ordinati da `registryRowIds()`, creando gruppi per ID della stanza o tipo di connessione, incluso Gateway e valori non assegnati. `buildRegistryBody()` costruisce titoli/conteggi e chiama `buildRegistryTable()` per ogni gruppo; gli altri ordinamenti mantengono una sola tabella. `registryExportRows()` usa lo stesso raggruppamento e ne appiattisce le righe, così anche stanze con nomi identici mantengono lo stesso ordine nell'Excel.

Il registro evidenzia in giallo i dispositivi Not in scan. `buildRegistryTable()` applica la classe `is-absent` soltanto quando `registryStatus().key === 'absent'`. `style.css` definisce sfondi chiaro/scuro tramite `--absentBg` e `--absentHover`, badge e bordo laterale gialli. Questo stato prevale sul colore degli attendibili; Not verified resta neutro. Nessuna modifica a backend, dati o report Excel: basta Ctrl+F5. Verificare la resa visiva nel browser.

**Export Excel (.xlsx)** esporta le righe visualizzate con i filtri e l'ordine correnti. È stato aggiunto `POST /api/export.xlsx`, autenticato, che genera un vero archivio OOXML con la sola libreria standard Python. Occorre riavviare il backend aggiornato e ricaricare la pagina; non basta il refresh del browser per attivare l'endpoint. Non sono state cambiate la struttura dei dati persistenti o le funzioni di backup JSON.

I test e la configurazione Apache erano inizialmente in `/tmp/hns-security-review/` per un problema di proprietà delle directory. Sono stati copiati nel progetto: usare le copie in `tests/` e `deploy/`. Il vecchio blocco alla creazione dei file è stato superato; non richiedere nuovamente cambi di proprietà senza un errore attuale.

## Grafica ufficiale — aggiornamento 0.1.1

Originali forniti dall'utente in `/var/www/html/NodeScanner/icons/`: banner, icona NR e wallpaper. Copiati byte per byte in `assets/branding/originals/`, con verifica SHA-256; la cartella di ingresso `/icons/` è esclusa da Git per evitare duplicati. Copie ottimizzate in `static/branding/` e `docs/images/`, documentate in `assets/branding/README.md`, sotto la stessa licenza AGPL-3.0-only del progetto.

L'app usa l'icona NR WebP da 96 px nella barra condivisa, SVG NR semplificato per la favicon e PNG da 180/192/512 px per touch/manifest. Il README usa il banner completo WebP, circa 77 KiB; preview GitHub PNG 1280×640, circa 530 KiB, con ritaglio proporzionale che conserva titolo e sottotitolo. Wallpaper scaricabile, senza cambiare lo sfondo della mappa. Nessuno screenshot reale disponibile: le illustrazioni sono dichiarate promozionali.

Versione **0.1.1**, con voce in APP_RELEASES e CHANGELOG. Verificati **35 test Python e 59 controlli JavaScript**; due regressioni aggiunte per asset annidati consentiti, file non autorizzati e symlink della directory branding verso l'esterno. Il backend conserva una whitelist esatta, con controllo del percorso reale all'interno di static. Occorre riavviarlo per i nuovi asset e poi ricaricare con Ctrl+F5; il riavvio effettua una scansione reale.

La directory installata è tornata di proprietà `nobody` e il sandbox non può scriverci. Le modifiche sono nel clone Git scrivibile `/tmp/noderunner-public-dyadg9gz`. Installazione nella directory originale e push dell'aggiornamento vanno verificati separatamente: non considerarli eseguiti solo perché i file sono pronti. Il tag v0.1.0 rimane intatto. Per la social preview GitHub è necessario caricare manualmente `docs/images/noderunner-social-preview.png` in Settings → Social preview; non basta il commit.

## Licenza e destinazione GitHub

Scelta esplicita AGPL-3.0-only; testo integrale in LICENSE. Copia pubblica senza dati runtime, token o backup. Destinazione: https://github.com/markhawks/NodeRunner. La pubblicazione iniziale è attestata dal risultato dello script in /tmp/noderunner-publication-result.json e dal commit 0dae8df presente anche nel riferimento origin/main. La directory di lavoro originale resta separata.

## Versione 0.1.0, changelog e spaziatura

Prima versione numerata di sviluppo **v0.1.0**, datata **17 ottobre 2026**: raccoglie le funzionalità esistenti senza attribuire versioni alle attività precedenti. `APP_RELEASES` in `static/app.js` è la fonte delle note strutturate per versione/data; `APP_VERSION` deriva dalla prima voce. Per la prossima versione aggiungere una voce all'inizio dell'elenco e aggiornare la copia leggibile `CHANGELOG.md`, README e stato del progetto.

Nome, icona e versione sono ora nella barra condivisa: visibili in Map e Registry, senza marchi duplicati nelle intestazioni nascoste. Il clic sul nome apre un dialog nativo Changelog con data, versione e sezioni; chiusura con pulsante, Esc o sfondo e ritorno del focus al marchio. `initializeReleaseInfo()` inizializza le note una sola volta; la navigazione e le scansioni non le ricreano.

Il tema usa un menu details/summary con spaziatura più ampia, nome attuale, descrizioni, anteprime e spunta di selezione. Scelta da tastiera/Tab, chiusura con Esc o clic esterno e ritorno del focus al controllo dopo la scelta. Margini laterali coerenti tramite `--page-gutter`; testi del changelog con larghezza limitata, interlinea e scorrimento interno. Barra centrata su due righe sotto 1280 px.

Verificati **35 test Python e 59 controlli JavaScript**, sintassi, struttura HTML e controlli di integrità del CSS. Nuove regressioni: interazioni del menu, versione coerente con le note, inizializzazione singola, apertura/chiusura del changelog dalle due viste e focus ripristinato. Da provare nel browser: menu responsive, dialog nativo e scorrimento su schermi stretti. Aggiornamento frontend: Ctrl+F5; nessun backend avviato o scansione reale effettuata.

## Barra condivisa: scansione e temi

Rimosso l'indicatore LIVE, che non corrispondeva a un monitoraggio continuo. La barra superiore condivisa contiene **Map**, **Registry**, **Run scan**, menu temi con icona tavolozza, nome e anteprime e stato dell'ultima scansione. È visibile in entrambe le viste e rimane fissa in alto durante lo scorrimento; su schermi stretti i controlli vanno a capo.

Un solo `scanbtn` richiama `runScan(true)` dalle due viste, resta disabilitato durante la scansione e mostra Scanning… / stato di avanzamento; se fallisce torna disponibile con Scan failed · retry. Cambiare vista non avvia né interrompe la scansione. Eliminati il comando scan e i pulsanti tema duplicati nell'intestazione del registro. `theme-menu` è un menu nativo details/summary con opzioni Light/Phosphor/Ion, descrizioni, anteprime e indicazione del tema attivo. `applyTheme()` sincronizza etichette e pulsanti senza ricreare il registro; `setTheme()` conserva la persistenza esistente.

Verificati **35 test Python e 59 controlli JavaScript**: nuove regressioni del ciclo di scansione dalle due viste, cambio vista durante la richiesta, blocco dei duplicati e recupero dopo errore; aggiornato il controllo del menu temi. Nessuna scansione reale. Resta la prova manuale nel browser del menu temi, layout su schermi stretti e scansione su rete autorizzata. Modifiche frontend: Ctrl+F5, senza riavvio del backend NodeRunner già aggiornato.

## Switch centrale Map / Registry

Una sola barra `view-navigation` in `NodeRunner.html` resta al centro in alto in entrambe le viste. Due pulsanti uguali **Map** (sonar) e **Registry** (tabella), con sfondo evidenziato per la vista attiva, sostituiscono i vecchi comandi separati. Rimosso Back to map dall'intestazione del registro. La barra resta visibile durante lo scorrimento su schermi stretti.

`updateViewNavigation()` sincronizza pulsanti, `aria-current`, `aria-pressed` e hash; `syncRegistryRoute()` porta il focus al pulsante della vista attiva dopo Indietro/Avanti. Verificati 59 controlli JavaScript e sintassi di `app.js`/`registry.js`; resta da verificare la resa nel browser. Modifica solo frontend: Ctrl+F5, senza riavvio del backend già aggiornato a NodeRunner.

## Identità NodeRunner e navigazione del registro

Rinominati gli entry point in `noderunner.py`, `NodeRunner.html` e `deploy/apache-noderunner.conf`; i nomi precedenti e `index.html` restano collegamenti compatibili. La cartella installata resta `/var/www/html/NodeScanner` e la configurazione Apache punta ancora a quella cartella. `AGENTS.md` esistente è stato conservato, come richiesto all'inizio: i suoi comandi precedenti restano validi tramite gli alias.

Interfaccia, titoli, messaggi, documentazione e download JSON/XLSX ora usano NodeRunner. Logo SVG a nodi collegati, favicon, icona monocromatica e manifest in `static/`; backend aggiornato per servire esplicitamente questi asset. Il registro mostra il marchio; la navigazione è nella barra centrale condivisa **Map | Registry**, con sonar e tabella SVG e vista attiva evidenziata.

Le nuove chiavi browser sono `noderunner_*`; `readBrowserSetting()` legge anche le precedenti `hns_*` senza cancellarle. Token svuotato e valori nuovi prevalgono sui vecchi. Header API principale `X-NodeRunner-Token`, con `X-HNS-Token` come fallback soltanto quando il nuovo header è assente. Nuove installazioni: `noderunner_token.txt`; `token_file()` conserva `hns_token.txt` se già presente e non crea un nuovo segreto per mascherare un collegamento legacy non valido. Nessun dato locale o token è stato riscritto durante il lavoro.

Verificati **35 test Python e 59 controlli JavaScript**, sintassi dei quattro script, alias CLI con `--help` senza scansioni, risorse SVG/manifest via HTTP simulato, autenticazione vecchia/nuova e preferenze precedenti. La navigazione verifica il selettore condiviso, stato attivo, cambio vista e focus dopo la navigazione del browser. Durante il lavoro il CSS è stato sovrascritto per errore e recuperato dalle letture della sessione, riapplicando le modifiche; alcune regole del drawer sono state ricostruite. **Verificare nel browser** temi, dettagli dei dispositivi, logo e pulsante su desktop e schermi stretti. Nessun browser reale disponibile nell'ambiente.

Per attivare tutto occorre arrestare il backend precedente, riavviare `sudo python3 noderunner.py` con gli argomenti abituali e ricaricare con Ctrl+F5. Non basta il solo refresh: il nuovo frontend usa il nuovo header e il backend deve servire i nuovi asset. Non è stato riavviato alcun servizio né effettuata una scansione reale.

## Pannelli laterali della mappa

Layout desktop a tre colonne CSS Grid: pannelli Wi-Fi/Wired e mappa hanno spazi distinti, con dimensione minima zero e contenimento dello scorrimento. Le quattro combinazioni aperto/chiuso aggiornano le colonne; su schermi stretti i pannelli restano impilati e la mappa ha un'altezza limitata con scorrimento interno.

`toggleMapPanel()` mantiene il bordo destro visibile quando si apre/chiude Wired, il bordo sinistro per Wi-Fi e lo scorrimento verticale in entrambi i casi. Non modifica le coordinate salvate degli host. I pulsanti indicano pannello e stato con `aria-controls` e `aria-expanded`. Due regressioni verificano apertura/chiusura, limiti dello scorrimento e posizioni invariate: 59 controlli JavaScript superati e sintassi di `app.js` verificata. Da confermare nel browser: assenza di sovrapposizioni, visibilità delle stanze a destra e comportamento su schermi stretti. Applicare con Ctrl+F5.

## Mappa: griglia da 16 posti e gateway

Ogni stanza parte da 4×4 celle numerate, espandendosi automaticamente sopra 16 host. `mapMinimumSize()` dimensiona una superficie scorrevole dentro `.map-viewport`; `roomHostPositions()` conserva esattamente le coordinate manuali; `roomGridSlots()` serve soltanto alla disposizione iniziale degli host senza posizione. Il rilascio salva il punto esatto, senza aggancio alle celle né ricollocamento automatico per evitare collisioni. `pinMapOccupants()` e `pinRoomOccupants()` conservano i posti dei vicini, inclusi gli host senza stanza, prima del salvataggio. `roomDropPosition()` è stato rimosso. Persistenza nei campi esistenti `overrides[id].room` e `.pos`, senza migrazione o modifica dei dati locali durante lo sviluppo.

Il gateway ha ora il selettore Room abilitato nel registro e nei dettagli; occupa una cella e si trascina come gli altri host. Le linee partono dalla sua posizione e si aggiornano durante il trascinamento. La guida della mappa è esterna al canvas per non coprire le celle. Le modifiche richiedono Ctrl+F5, senza riavvio del backend.

Verificati 35 test Python, 59 controlli JavaScript e sintassi degli script modificati. Le regressioni coprono 9 host/16 celle, coordinate fuori griglia dopo validazione/ricaricamento, nessun ricollocamento dei punti manuali vicini, espansione a 25, molte stanze, gateway nel registro e trascinamento con aggiornamento delle linee e conservazione dei vicini. Ulteriori controlli verificano i vicini senza stanza e il mantenimento delle coordinate quando la griglia aumenta. **Da provare nel browser reale**: resa visiva, scorrimento, trascinamento e persistenza dopo ricaricamento. Nessun server avviato o scansione reale effettuata.

L'utente ha chiesto anche i consumi Internet per IP: il software attuale non raccoglie contatori di traffico. Modello e capacità del modem/router restano da chiarire prima di progettare l'integrazione; nessuna misura simulata è stata aggiunta.

## Primo controllo

```bash
cd /var/www/html/NodeScanner
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_frontend.js
```

Risultato di riferimento: **35 test Python e 59 controlli JavaScript**. Non aprono porte né scansionano la rete; i dati di prova vengono scritti in directory temporanee. Il registro reale, se presente, viene solo letto per controllarne la compatibilità. I nuovi controlli verificano struttura ZIP/XML dell'Excel, formule mantenute come testo, autenticazione, righe non valide, pagina dedicata, navigazione e corrispondenza dei filtri con l'export.

Due ulteriori controlli frontend esercitano i menu Vendor e Connection realmente costruiti nella tabella, verificando la coerenza con le funzioni della mappa, la cache locale e l'export Excel. La resa grafica continua a richiedere una prova nel browser reale.

Quattro controlli aggiunti per il gateway verificano nome/hostname separati, inclusione nel registro e nell'Excel, MAC reale, stato non verificato senza falso lastSeen, precedenza sui duplicati e ricerca per hostname/MAC.

Cinque controlli di ordinamento verificano clic e inversione di Vendor, label/numeri delle stanze, IP/date, coerenza dell'export filtrato e rimozione dei vecchi pulsanti Sort. Le intestazioni sono pulsanti nativi con `aria-sort` sulle celle, utilizzabili anche da tastiera.

Quattro controlli di raggruppamento verificano tabelle/conteggi per stanza, gruppi di connessione e spostamento degli host dopo una modifica, filtri e ritorno alla tabella unica, stanze omonime e coerenza dell'ordine con l'export. La resa dei titoli fissi e dello scorrimento condiviso resta da provare nel browser.

Leggere poi `AGENTS.md` e `docs/SECURITY_REVIEW.md`. Prima di intervenire sui sorgenti verificare le istruzioni presenti e le modifiche dell'utente. Se Git non è accessibile nel sandbox, dichiararlo e non inizializzare o ricreare `.git`.

## Prossimo lavoro consigliato

**Priorità immediata: chiudere la verifica della distribuzione.**

1. Controllare se `/etc/httpd/conf.d/homenetscanner.conf` è stato installato dopo questa sessione. Al controllo documentato era assente.
2. Se l'utente chiede di attivarlo e l'ambiente permette la scrittura amministrativa, usare il file in `deploy/`; le istruzioni sono nel README. Non considerarlo attivo solo perché il file esiste nel progetto.
3. Verificare con un browser reale il backend aggiornato, la pagina a schermo intero e il salvataggio dopo il riavvio. Controllare anche Light/Phosphor/Ion, filtri, Indietro/Esc, link `#registry` e viewport strette. Aprire un file esportato in Excel o LibreOffice. Nel sandbox non sono disponibili browser o suite Office; le prove automatiche non coprono questa parte.
4. Affrontare il conflitto tra salvataggi di browser diversi: la coda attuale serializza solo le richieste provenienti dalla stessa pagina.

Per una prova manuale, avviare il backend nel terminale dell'utente:

```bash
sudo python3 noderunner.py
```

Aprire `http://localhost:8000` e inserire il token del terminale in **Settings → Connection**. Arrestare con Ctrl+C prima di riavviare. Il backend avvia una scansione in background: avviarlo soltanto quando la prova sulla rete è voluta. Non inserire token, IP/MAC reali o esportazioni del registro in resoconti condivisi.

## Mappa tecnica essenziale

- `noderunner.py`: `run_nmap()` esegue Nmap; `scan()` costruisce il risultato; `State` gestisce cache e lock; `make_handler()` espone le API; `ScannerHTTPServer` limita i gestori simultanei.
- `validate_assignments()` valida anche la lettura da disco; un registro corrotto produce errore, non un reset. `save_assignments()` usa file temporanei privati e sostituzione atomica.
- `static/app.js`: `validateAssignments()` valida cache/import, `flushStateSaves()` serializza i salvataggi e `detectAnomalies()` confronta gli host. Le modifiche di configurazione e registro passano da API distinte.
- Temi: `readTheme()`, `setTheme()` e `applyTheme()` con il menu condiviso `theme-menu` in `app.js`; chiave browser `noderunner_theme`. Il cambio usa CSS senza ricreare il registro, conservando focus e scorrimento. `registryScanIds()` e `registryStatus()` distinguono presenza nell'ultima scansione e risultati non verificabili.
- Pagina del registro: `syncRegistryRoute()` in `app.js` segue l'hash; `renderRegistry()` applica `body.registry-view`, nasconde la mappa e costruisce una sezione a piena pagina. Nessuna richiesta di schermo intero al sistema operativo.
- Excel: `registryExportRows()` ed `exportRegistryExcel()` in `registry.js`; `registry_xlsx()` e `REGISTRY_EXPORT_COLUMNS` in Python. Ogni riga ha 14 stringhe; ZIP e XML sono generati in memoria. Non introdurre formule per interpretare i nomi dei dispositivi e non includere token o configurazione privata nei report.
- Script caricati in ordine: `icons.js` → `registry.js` → `settings.js` → `app.js`, con scope globale condiviso. Nessun bundler o framework.
- Il backend aggiunge all'HTML il meta `noderunner-backend=same-origin`; `backendBase()` lo usa per supportare porte personalizzate e reverse proxy. Le pagine statiche mantengono il fallback a 8000.
- Persistenza: `assignments.json` contiene `overrides`, `known`, `baseline`, `config`. Il token usa `noderunner_token.txt` nelle nuove installazioni o conserva `hns_token.txt` se già presente, separato dal registro e conservato anche nel browser.
- `support.js` è estraneo al funzionamento dell'app: non è caricato dalla pagina.

## Cosa non fare

- Non usare file reali come destinazione dei test; non cancellare registro o backup per risolvere errori di validazione.
- Non migrare automaticamente la fiducia da un MAC a un altro tramite hostname.
- Non presentare MARK BLOCKED come blocco di rete o assenza di porte rilevate come prova di assenza di servizi.
- Non restringere i timeout Nmap senza una prova sui client Wi-Fi in risparmio energetico.
- Non disabilitare il sandbox o applicare permessi 777 per risolvere problemi dell'ambiente.

## Prompt pronto per la prossima sessione

> Stiamo lavorando a NodeRunner in /var/www/html/NodeScanner. Leggi AGENTS.md, README.md, PROJECT_STATUS.md e SESSION_HANDOFF.md. Verifica i test esistenti, conserva tutti i dati locali e riprendi dalla prima attività ancora aperta, distinguendo le correzioni nei sorgenti dalle configurazioni effettivamente attivate sull'host. Prima di nuove scansioni considera che l'avvio del backend esegue Nmap in background.

Al termine di ogni intervento aggiornare stato, verifiche, attività aperte e questo passaggio di consegne; non includere segreti.
