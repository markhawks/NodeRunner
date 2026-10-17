# Stato del progetto

Ultimo aggiornamento: **17 ottobre 2026**.

## Situazione attuale

NodeRunner dispone di backend Python/Nmap, interfaccia web, registro persistente, mappa, stanze, categorie personalizzate e avvisi. È stata completata una prima passata di correzioni di bug e sicurezza. Questo non equivale a un audit esaustivo o a una dichiarazione di idoneità all'esposizione pubblica.

I documenti e gli strumenti di verifica sono ora nel progetto: non occorre recuperare file da `/tmp` per proseguire.

È stato inoltre aggiornato il registro sul codice esistente: tema chiaro **Light** selezionabile e persistente nel browser, tabella più leggibile, contatori, stato riferito all'ultima scansione, filtri e ricerca per stanza/hostname. I temi scuri restano disponibili. La verifica visiva in un browser reale è ancora da svolgere.

Il registro è una pagina a schermo intero (`#registry`), con ritorno alla mappa e navigazione del browser. È disponibile **Export Excel (.xlsx)** per gli host visualizzati, con la stessa ricerca, filtro e ordinamento. Il backend genera il foglio in memoria; l'export JSON rimane il formato di backup ripristinabile. Per attivare l'endpoint Excel occorre riavviare il backend aggiornato.

Il menu **Vendor** riutilizza quello della scheda del dispositivo e la colonna **Connection** è nelle prime posizioni. Le scelte Wi-Fi/Wired/Unassigned aggiornano lo stesso campo usato dalla mappa. Vendor personalizzati, ritorno al produttore automatico ed export Excel rimangono coerenti. Lo scorrimento della tabella viene mantenuto dopo le modifiche.

Il **gateway** è incluso nel registro e nell'export Excel. Il nome visualizzato predefinito è **Gateway Router**, con hostname rilevato separato; eventuali nomi personalizzati vengono conservati. La riga mostra ruolo Gateway e MAC reale, con preferenza sui duplicati dello stesso IP. Un gateway inferito rimane non verificato e non riceve un nuovo timestamp di avvistamento. Le anomalie degli altri host continuano a essere calcolate separatamente.

Le intestazioni di tutte le colonne dati sono ordinabili, senza i tre vecchi pulsanti Sort. Primo clic su una nuova colonna: crescente; secondo clic: decrescente, con freccia e indicazione accessibile della direzione. Vendor e Room usano i valori effettivamente mostrati, IP e lastSeen sono numerici, i campi vuoti restano in fondo. Filtri ed export Excel conservano l'ordine scelto.

Il registro si divide in **tabelle distinte** quando l'ordinamento è Room o Connection: una per stanza oppure per Wi-Fi/Wired/Gateway/connessione non assegnata. Titoli e conteggi seguono i filtri correnti; le colonne sono allineate e modificabili in ogni gruppo. Ordinando per un altro campo si torna alla tabella unica. L'Excel conserva l'ordine dei gruppi sul foglio esistente.

Il registro evidenzia in **giallo tenue** l'intera riga dei dispositivi **Not in scan**, con badge giallo e bordo laterale. Lo stile prevale sul verde degli host attendibili e resta distinguibile al passaggio del mouse; sono previste tonalità per tema chiaro e scuri. Nessuna evidenziazione per Not verified. Modifiche solo frontend: basta Ctrl+F5.

## Grafica ufficiale — aggiornamento 0.1.1

Originali forniti dall'utente in `/var/www/html/HomeNetScanner/icons/`: banner, icona NR e wallpaper. Copiati byte per byte in `assets/branding/originals/`, con verifica SHA-256; la cartella di ingresso `/icons/` è esclusa da Git per evitare duplicati. Copie ottimizzate in `static/branding/` e `docs/images/`, documentate in `assets/branding/README.md`, sotto la stessa licenza AGPL-3.0-only del progetto.

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

Rinominati gli entry point in `noderunner.py`, `NodeRunner.html` e `deploy/apache-noderunner.conf`; i nomi precedenti e `index.html` restano collegamenti compatibili. La cartella installata resta `/var/www/html/HomeNetScanner` e la configurazione Apache punta ancora a quella cartella. `AGENTS.md` esistente è stato conservato, come richiesto all'inizio: i suoi comandi precedenti restano validi tramite gli alias.

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

## Completato

- Validazione dei dati su backend, cache del browser e importazione dei backup; rifiuto di chiavi pericolose e strutture non valide.
- Protezione dell'HTML costruito con IP e identificativi del registro; restrizioni sulle icone SVG personalizzate.
- Eliminato il trasferimento automatico della fiducia basato su hostname uguali.
- Errori Nmap distinti dalle scansioni riuscite senza dispositivi; conservazione della cache precedente in caso di errore.
- Target IPv4 validato anche da riga di comando; rifiuto di opzioni Nmap usate come target e di scansioni IPv6 non supportate.
- Limite delle richieste a 2 MiB, timeout delle connessioni e massimo 32 gestori HTTP contemporanei.
- Condivisione del risultato tra richieste concorrenti arrivate durante la stessa scansione.
- Salvataggi atomici con file temporanei privati e non prevedibili; token e backup creati con permessi privati.
- Registro corrotto segnalato come errore; rete salvata mantenuta durante gli aggiornamenti del registro.
- Salvataggi consecutivi del browser serializzati e fallimenti visibili all'utente.
- Porta personalizzata supportata nelle pagine servite dal backend; fallback statico che conserva HTTPS.
- Orari riferiti alla scansione effettiva, gateway non verificato indicato correttamente, rimosse velocità Ethernet inventate e chiarito il significato di MARK BLOCKED.
- Test, configurazione Apache e documentazione consolidati in `tests/`, `deploy/` e `docs/`.

Il dettaglio tecnico è in [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md).

## Verifiche disponibili

| Controllo | Esito |
| --- | --- |
| Test Python | 35 superati |
| Controlli JavaScript | 59 superati, inclusi raggruppamento Room/Connection, filtri ed export coerente |
| Sintassi dei quattro script dell'app | Verificata |
| Compatibilità con il registro locale esistente | Verificata senza riscriverlo nei test |
| File XLSX | Verificati ZIP/XML, intestazioni, celle di testo, filtri, riga bloccata, autenticazione e limiti |
| Apertura del report in Microsoft Excel/LibreOffice | Da verificare manualmente |
| Sintassi della configurazione Apache preparata | Verificata con configurazione minima isolata |
| Browser reale, server in ascolto e scansione Nmap reale | Da verificare manualmente |
| Configurazione Apache completa in produzione | Da verificare dopo l'installazione |

Ambiente usato per i test: **Python 3.14.8, Node.js 22.23.1**. Nmap **7.92** è presente; durante le verifiche automatiche non è stato usato per scansionare la rete. Le altre versioni e piattaforme non sono state verificate.

## Da completare, in ordine

1. **Protezione Apache:** installare `deploy/apache-noderunner.conf`, controllare l'intera configurazione e ricaricare il servizio. Al controllo del 17 ottobre il file `/etc/httpd/conf.d/homenetscanner.conf` risultava assente. Verificare dall'esterno che dati, token, backup e directory private siano negati.
2. **Prova manuale:** riavviare il backend aggiornato, verificare token, scansione reale, rete personalizzata, porta 8080, modifica di un host, riavvio con dati persistenti e importazione/esportazione. Verificare anche tema Light, pagina `#registry`, ritorno alla mappa/Indietro, filtri e scorrimento su schermi stretti. Aprire l'export `.xlsx` in Excel o LibreOffice e confrontarlo con la tabella filtrata. Usare una rete autorizzata e un backup dei dati.
3. **Concorrenza tra browser:** introdurre versionamento o aggiornamenti parziali. Oggi due browser indipendenti inviano copie complete del registro e l'ultimo salvataggio può sovrascrivere modifiche dell'altro.
4. **Rilevamento rete:** ricavare la maschera effettiva invece di assumere `/24`; rivedere la gestione di più interfacce e reti.
5. **Distribuzione:** definire avvio come servizio, privilegi minimi e configurazione TLS/reverse proxy, se richiesti. Non sono stati aggiunti servizi o automatismi di avvio.

## Vincoli da ricordare

- Wi-Fi/cavo, stanze e posizioni sono manuali. Il riconoscimento dei tipi è euristico.
- Il flag blocked non applica regole a router o firewall.
- Aggiornamento automatico disabilitato; cache delle scansioni solo in memoria, senza serie storica completa.
- Backend in HTTP su `0.0.0.0`, porta predefinita 8000. Token condiviso, senza account o ruoli.
- `assignments.json`, backup e `noderunner_token.txt` (legacy `hns_token.txt`) sono dati privati: non commetterli, non includerli nei documenti e non azzerarli.
- Lo stato dei processi sull'host e l'eventuale riavvio effettuato dall'utente non sono attestati da questa documentazione.
- Commit, branch e release non sono stati verificati nel sandbox. Non modificare il percorso `.git` per superare i limiti dell'ambiente.
