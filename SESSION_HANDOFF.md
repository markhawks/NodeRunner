# Riprendere una sessione

## Chiusura sessione — 19 ottobre 2026

- **Versione corrente: 0.1.3.** Release e quattro allegati verificati su https://github.com/markhawks/NodeRunner/releases/tag/v0.1.3. Tag fermo a 821e311; main prima della chiusura a e87f763. La release 0.1.2 e i suoi artefatti restano intatti.
- Corretto il servizio RPM standard per rilevare MAC sulla LAN: utente noderunner, sola CAP_NET_RAW, AF_PACKET consentito e riconoscimento della capability nel backend per Nmap --privileged. Nessuna capability globale su Python/Nmap e nessuna esecuzione del server come root.
- **Verifiche effettive:** 44 test Python e 64 controlli JavaScript nella build Fedora 44; rpmlint 0 errori/2 avvisi per UID/GID; rpm --test riuscito; payload, versione, sorgenti senza dati privati e checksum verificati. MAC rilevato realmente in rete veth isolata con backend estratto dall'RPM, UID 65534, CapEff/CapBnd limitati a CAP_NET_RAW e NoNewPrivileges, sia -sn sia -sS. Non equivale ancora a una prova sulla seconda macchina dell'utente.
- In chiusura verificati i 55 file versionati identici tra checkout installato e clone, main/tag remoti e checksum degli artefatti locali 0.1.2 e 0.1.3. Da allora soltanto documentazione: nessuna necessità di ripetere test applicativi o scansioni.
- **Dati preservati:** registro, token, backup e screenshot originali restano locali. Solo copie oscurate sono pubblicate nei README. Nessuna migrazione automatica IP→MAC o fiducia trasferita tramite hostname. Per replicare fedelmente configurazioni tra istanze usare assignments.json con destinazione ferma e backup; Import JSON unisce i dati e conserva le stanze già esistenti con lo stesso ID.
- Checkout: /var/www/html/NodeRunner; il suo .git non è utilizzabile e non va modificato. Clone operativo: /tmp/noderunner-mac-rpm. Non dipendere da /tmp: salvati bundle Git pubblico e promemoria privati in .local-session/ con nomi repository-session-close-<commit>.bundle e RESUME-session-close-<commit>.md, permessi privati ed esclusione da Git. Il bundle non include registro/token/backup runtime. In alternativa ripartire da un nuovo clone GitHub in una directory scrivibile.

### Prima attività alla ripresa

Verificare sulla **seconda istanza dell'utente** l'upgrade a noderunner-0.1.3-0.1.test.fc44.noarch.rpm, poi daemon-reload e restart esplicito. Il restart avvia una scansione reale: non eseguirlo durante i test automatici. Controllare che i MAC siano presenti e che le personalizzazioni importate tornino a corrispondere agli stessi MAC. Le vecchie voci ip-... possono restare separate: nessuna fusione automatica.

Se mancano ancora MAC, controllare unità e drop-in, CAP_NET_RAW effettiva, AF_PACKET, target e interfaccia sullo stesso segmento L2, NAT/router, isolamento client e denials SELinux. I comandi di aggiornamento e diagnostica sono in deploy/INSTALL.md. Non disabilitare SELinux o aggiungere capability globali come scorciatoia.

Altri lavori aperti: collaudo reale installazione/upgrade/rimozione RPM e conservazione dati; SELinux enforcing; browser desktop/mobile, griglie miste e posizioni manuali, espansione liste e Excel; concorrenza tra browser e rilevamento maschera/interfacce. Il monitoraggio dei consumi Internet richiede ancora un'integrazione con il router.

Questa chiusura non installa l'RPM, non arresta o riavvia processi dell'utente e non esegue scansioni sulla LAN. Lo stato dei processi in esecuzione e l'installazione sulla seconda macchina non sono stati verificati.

## Pubblicazione correzione MAC 0.1.3 — 19 ottobre 2026

Pubblicata la release di sviluppo https://github.com/markhawks/NodeRunner/releases/tag/v0.1.3, tag sul commit 821e311. Allegati RPM Fedora 44 noarch, SRPM, sorgenti e SHA256SUMS; checksum locali verificati. La release 0.1.2 rimane intatta. Build con 44 test Python e 64 controlli JavaScript, rpmlint 0 errori/2 avvisi per UID/GID dedicati, transazione rpm --test riuscita. Estratti e controllati backend e unità esatti dell'RPM.

Prova MAC riuscita anche sul backend estratto dall'artefatto definitivo: UID 65534, CapEff e CapBnd limitati esattamente a CAP_NET_RAW, NoNewPrivileges attivo; MAC del peer rilevato con -sn e -sS in rete veth isolata. Non sono stati modificati permessi/capability globali di Python o Nmap né eseguite scansioni della LAN reale. Resta da verificare il servizio sulla seconda macchina dell'utente, inclusi eventuali drop-in e SELinux.

Aggiornare l'RPM sulla seconda macchina con dnf upgrade, poi systemctl daemon-reload e restart esplicito di noderunner.service (avvia una scansione). Registro/token conservati; gli host identificati da MAC tornano ad associarsi alle personalizzazioni importate con lo stesso MAC. Le vecchie voci ip-... restano separate, senza trasferimento automatico di fiducia. MAC non disponibili oltre router/NAT o in caso di isolamento L2.

## Correzione MAC per RPM standard — 19 ottobre 2026

Preparata versione 0.1.3 per correggere la mancata scoperta MAC nel servizio RPM 0.1.2. Il servizio mantiene User/Group=noderunner e i controlli esistenti; riceve solo CAP_NET_RAW in CapabilityBoundingSet/AmbientCapabilities e consente AF_PACKET oltre alle famiglie precedenti. Nessun CAP_NET_ADMIN, CAP_NET_BIND_SERVICE, setcap sui binari di sistema o esecuzione del server come root.

Il backend rileva CAP_NET_RAW effettiva in /proc/self/status, passa --privileged a Nmap con UID non root e usa scansione SYN; senza privilegi raw resta il fallback TCP connect. Aggiornato il messaggio diagnostico. Registro e token restano invariati; nessun trasferimento automatico di fiducia tra identità IP e MAC. MAC e produttore dipendono dalla visibilità sullo stesso segmento L2 e dal database Nmap; router/NAT e isolamento dei client restano limiti effettivi.

Verificati 44 test Python e 64 controlli JavaScript. Prova reale isolata: due namespace con coppia veth, solo indirizzi/MAC fittizi, processo UID 65534 con la sola CAP_NET_RAW e NoNewPrivileges; Nmap 7.92 ha restituito il MAC del peer sia con discovery -sn sia con scansione porte -sS. Nessuna scansione della LAN reale o avvio del servizio applicativo. La prova non attesta ancora il funzionamento sulla seconda macchina dell'utente o la sua policy SELinux.

Spec RPM e guide aggiornati a 0.1.3; per applicare l'aggiornamento sulla macchina destinazione servono daemon-reload e restart esplicito (il restart avvia una scansione reale). Nuovo clone operativo /tmp/noderunner-mac-rpm: quello precedente in /tmp non esiste più; .git della copia installata lasciato intatto. Build, pubblicazione e verifiche dell’artefatto sono registrate nella sezione iniziale.

## Screenshot per README — 17 ottobre 2026

L'utente ha autorizzato l'oscuramento con strumenti locali prima della pubblicazione. Preparate quattro copie in docs/images/screenshots/: Map, Registry, gestione stanze e dettagli host. Nomi, alias, IP e MAC coperti con maschere opache; Settings ritagliato alla sezione Rooms, dettagli host al solo pannello. Nessun token pubblicato, metadati PNG rimossi. Gli originali nella directory installata restano invariati ed esclusi da Git con quattro regole esatte.

README inglese/italiano con mappa principale, tre anteprime espandibili e spiegazione del primo avvio: rilevamento automatico, assegnazione stanze/connessioni manuale. Dichiarate le modifiche di privacy e il ritaglio, conservata l'etichetta di versione precedente presente nell'acquisizione. Le immagini non sono presentate come dati dimostrativi o come schermata iniziale vuota.

Controllate visivamente le quattro copie, scansione OCR senza corrispondenze IP/MAC/hostname e assenza di metadati; link dei README verificati. Solo documentazione e asset: nessuna modifica all'app, al registro, ai token o agli artefatti della release 0.1.2. Non è stata avviata alcuna scansione reale. Il clone di pubblicazione rimane /tmp/noderunner-public-dyadg9gz; il riferimento .git della copia installata resta intatto.

## Pubblicazione 0.1.2 confermata — 17 ottobre 2026

Release di sviluppo pubblicata e verificata: https://github.com/markhawks/NodeRunner/releases/tag/v0.1.2. Tag v0.1.2 sul commit f11af3b. GitHub conferma quattro asset caricati: RPM Fedora 44 noarch di test, SRPM, sorgenti tar.gz e SHA256SUMS; checksum locali verificati. Copie locali in dist/0.1.2 (escluse da Git). Build sul tag completata con 41 test Python e 64 controlli JavaScript; rpmlint finale: 0 errori e 2 avvisi per UID/GID del servizio. La verifica rpm --test è riuscita, ma installazione reale e scansioni non sono state eseguite. Il checkout corrente mantiene dati e token originali.

## Versione 0.1.2 e RPM di prova Fedora 44 — 17 ottobre 2026

Versione 0.1.2 in APP_RELEASES, changelog e README. Include griglie configurabili e layout proporzionale, contatori stanza, Expand map, Settings condiviso, riquadro Last scan e percorsi separati. Nuova opzione --bind IPv4; default dell'avvio diretto invariato a 0.0.0.0.

Spec e servizio in deploy/. RPM sperimentale noarch `noderunner-0.1.2-0.1.test.fc44.noarch.rpm`, relativo SRPM e sorgenti prodotti su Fedora 44, da allegare con SHA256SUMS alla release di sviluppo GitHub v0.1.2. Codice in /usr/share/noderunner, launcher /usr/bin/noderunner, dati privati /var/lib/noderunner, EnvironmentFile /etc/noderunner/noderunner.conf. Account sysusers dedicato, servizio senza capability, bind 127.0.0.1:8000, output non bufferizzato per rendere disponibile il token nel journal. Nessun avvio o restart automatico di scansioni negli script RPM; niente regole firewall o migrazione automatica. MAC/vendor possono mancare senza privilegi.

Verificati 41 test Python e 64 controlli JavaScript nella build RPM, CLI --help, estrazione payload e persistenza temporanea, dipendenze e simulazione rpm --test riuscita. Verificata unità systemd sostituendo soltanto ExecStart con il launcher esistente nel checkout, dato che /usr/bin/noderunner non è installato sull'host. Nessuna installazione effettiva del pacchetto o scansione reale; browser, ciclo installazione/aggiornamento/rimozione, SELinux enforcing e scansioni del servizio restano da collaudare. RPM unsigned sperimentale; i due avvisi rpmlint sull'UID/GID noderunner sono dovuti all'account dedicato dichiarato in sysusers.d.

Per provare: scaricare RPM e SHA256SUMS dalla release, verificare il checksum e installare con dnf. L'avvio esplicito del servizio avvia una scansione: vedere deploy/INSTALL.md. Il checkout attuale, token e registro non sono stati migrati o riscritti. L'aggiornamento del backend corrente richiede un riavvio volontario e poi Ctrl+F5.

## Contatore host nei titoli delle stanze — 17 ottobre 2026

Il titolo di ogni stanza mostra nome, griglia/posti e numero di host presenti sulla mappa assegnati alla stanza (incluso il gateway, esclusi host senza stanza): per esempio Kitchen · 4×4 (16) · 3 hosts. Le stanze vuote mostrano 0 hosts; il valore segue il rendering dopo scansioni e modifiche dell'assegnazione. Nessun dato persistente aggiuntivo.

Verificati 64 controlli JavaScript e sintassi app.js. Resa visiva nel browser da confermare. Applicare con Ctrl+F5; nessun riavvio del backend o scansione reale effettuata.

## Espansione mappa dalla toolbar — 17 ottobre 2026

Aggiunto Expand map nella barra superiore, disponibile soltanto in Map (nascosto e disabilitato nel registro, con controllo anche nel gestore). Chiude le liste Wi-Fi a sinistra e Wired a destra; Restore lists ripristina la combinazione precedente, anche quando una sola lista era visibile. Le frecce laterali restano disponibili per ogni lista; usarle annulla il precedente ripristino combinato. Dopo un reload con entrambe le liste chiuse, Restore lists le riapre entrambe.

Usa le preferenze browser esistenti, conserva il centro orizzontale e lo scorrimento verticale e non modifica coordinate, registro o backend. Altezza 44 px e icona di espansione nella toolbar. Verificati 64 controlli JavaScript, compresi combinazioni destra/sinistra, ripristino e indisponibilità in Registry; sintassi app.js verificata. Prova visiva desktop/mobile ancora da fare. Applicare con Ctrl+F5, senza riavvio del backend né scansioni reali.

## Griglie configurabili per stanza — 17 ottobre 2026

Settings → Rooms offre una scelta 2×2, 3×3 o 4×4 per ogni stanza, salvata in config.rooms[id].gridSize. Il valore è una griglia minima: più host espandono automaticamente la griglia. Backend e frontend validano soltanto i valori numerici ammessi; i dati precedenti senza gridSize restano 4×4. Il campo passa da registro persistente, cache e backup JSON senza migrazioni automatiche.

Layout delle stanze proporzionale alla larghezza delle griglie e altezza massima di ogni riga; superficie minima della mappa ridotta per griglie piccole, conservando spazio per schede a dimensione intera e scorrimento. Le coordinate manuali globali restano identiche: dopo una modifica al layout potrebbe essere necessario riposizionare manualmente una scheda rispetto ai nuovi bordi della stanza. Selettori adattabili a pannelli stretti.

Verificati 40 test Python e 63 controlli JavaScript, inclusi validazione, compatibilità, riduzione del canvas, layout misto, espansione automatica, coordinate manuali e selettore Settings con salvataggio/render. Sintassi degli script verificata. Prova visiva desktop/mobile e riapertura nel browser ancora da fare. Per attivare il salvataggio del nuovo campo occorre riavviare il backend aggiornato, poi Ctrl+F5; il riavvio avvia una scansione reale, non eseguita durante il lavoro. Nessun dato locale è stato riscritto.

## Riquadro ultima scansione — 17 ottobre 2026

Lo stato Last scan è racchiuso in un riquadro con bordo, sfondo del tema, angoli arrotondati e icona orologio nella toolbar condivisa. Altezza 44 px, allineata a Map, Registry, Settings e Run scan. Conservati id lastscan, aggiornamenti del testo e stato accessibile, inclusi scansione in corso ed errore. Il riquadro segue il ritorno a capo dei controlli sui viewport stretti.

Verificati 59 controlli JavaScript e struttura HTML (un solo stato nella navigazione condivisa). Resa visiva nel browser da confermare; applicare con Ctrl+F5, senza riavvio del backend. Nessuna scansione reale o modifica ai dati.

## Settings nella barra condivisa — 17 ottobre 2026

Un solo pulsante Settings con ingranaggio SVG è nella toolbar persistente di Map e Registry, accanto a Run scan. Eliminati il comando separato nell'header della mappa e quello generato nel registro. Il pulsante mantiene lo stesso id e gestore di apertura; usa la classe view-tab comune, con altezza esplicita di 44 px come Map e Registry. Nessuna modifica ai dati o al backend.

Verificati 59 controlli JavaScript, sintassi di app.js/registry.js e struttura HTML (unico pulsante nella navigazione condivisa, icona SVG). Nessun browser reale disponibile: resa visiva desktop/mobile da confermare. Applicare con Ctrl+F5, senza riavviare il backend. Modifiche sincronizzate nel clone di pubblicazione per GitHub.

## Percorsi per installazione di sistema — 17 ottobre 2026

Implementati `--data-dir` e `--assets-dir`, con valori predefiniti dalle variabili `NODERUNNER_DATA_DIR` e `NODERUNNER_ASSETS_DIR`; la CLI prevale. L'avvio diretto conserva i percorsi relativi allo script. Il launcher `deploy/noderunner`, destinato a `/usr/bin/noderunner`, usa `/usr/share/noderunner` per codice/HTML/static e `/var/lib/noderunner` per registro/token/backup. `/etc/noderunner` è riservata al futuro servizio e non viene letta dal backend attuale.

Guida di migrazione in `deploy/INSTALL.md`, README bilingui aggiornati e changelog Unreleased. Nessuna migrazione automatica, modifica ai dati locali, installazione in directory di sistema o scansione reale. Il checkout di sviluppo rimane `/var/www/html/NodeRunner`. RPM, spec, servizio systemd, privilegi Nmap e verifica SELinux restano da realizzare e collaudare; il template Apache protegge soltanto il checkout di sviluppo.

Verificati 39 test Python, inclusi quattro controlli dei percorsi, 59 controlli JavaScript, sintassi del launcher e CLI --help senza scansioni. Pubblicazione sul ramo main tramite il clone Git scrivibile già documentato; non modificare il riferimento .git della copia installata.

## Nome e installazione NodeRunner — 17 ottobre 2026

Nome del prodotto e repository: **NodeRunner**, https://github.com/markhawks/NodeRunner. Directory effettiva verificata: `/var/www/html/NodeRunner`, già rinominata dall'utente. La destinazione NodeScanner proposta nella sessione precedente è superata; non eseguire i vecchi script di migrazione.

Aggiornati README inglese/italiano, guida rapida, AGENTS.md e template Apache. Entry point principali: `noderunner.py` e `NodeRunner.html`; i vecchi nomi restano alias compatibili. API backend: `http://localhost:8000`; pagina Apache prevista: `http://localhost/NodeRunner/`, subordinata alla configurazione dell'host.

Il riferimento `.git` nella directory installata restituisce `invalid gitfile format`: è stato lasciato intatto. Il clone di pubblicazione utilizzabile è `/tmp/noderunner-public-dyadg9gz`, ramo main, remoto origin verificato. I file pubblicati sono selezionati esplicitamente; registro, token, backup e promemoria locali restano esclusi. Destinazione di pubblicazione: `origin/main`; il commit comprende anche gli aggiornamenti documentali precedentemente rimasti locali. Verificare la corrispondenza tra HEAD e origin/main dopo la pubblicazione.

Verifiche attuali: **35 test Python e 59 controlli JavaScript superati**, sintassi Apache verificata con configurazione minima isolata e controllo Git delle differenze senza errori. Nessun backend avviato o scansione reale effettuata. La configurazione preparata punta alla nuova directory; l'installazione in `/etc/httpd/conf.d/noderunner.conf` e il riavvio del backend rimangono attività distinte. Nessuna configurazione Apache o unità systemd con riferimenti NodeRunner/HomeNetScanner è stata trovata nella ricerca nelle directory di configurazione disponibili.

## README bilingue — 17 ottobre 2026

`README.md` è la guida principale in inglese visualizzata da GitHub; `README.it.md` conserva integralmente la guida italiana precedente, con collegamenti reciproci per cambiare lingua. Aggiornati avvio da clone, funzioni, API, licenza e rimandi per contributori. Modifica solo documentale: nessun cambio di versione, tag o comportamento. Verificare entrambi i README quando cambia una funzione documentata.

L'aggiornamento grafico v0.1.1 precedente risulta installato e pubblicato: `/tmp/noderunner-branding-result.json` riporta `installed: true`, `pushed: true` e commit `76d12792f6d0a53f7b208583190e02319b17989c`. Questo esito supera le note precedenti di installazione/push da verificare. I README bilingui sono ora sincronizzati anche nella directory installata; vedere la sezione iniziale per lo stato della pubblicazione corrente.

Riferimento aggiornato il **17 ottobre 2026**. Cartella di lavoro: `/var/www/html/NodeRunner`.

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

Originali forniti dall'utente in `/var/www/html/NodeRunner/icons/`: banner, icona NR e wallpaper. Copiati byte per byte in `assets/branding/originals/`, con verifica SHA-256; la cartella di ingresso `/icons/` è esclusa da Git per evitare duplicati. Copie ottimizzate in `static/branding/` e `docs/images/`, documentate in `assets/branding/README.md`, sotto la stessa licenza AGPL-3.0-only del progetto.

L'app usa l'icona NR WebP da 96 px nella barra condivisa, SVG NR semplificato per la favicon e PNG da 180/192/512 px per touch/manifest. Il README usa il banner completo WebP, circa 77 KiB; preview GitHub PNG 1280×640, circa 530 KiB, con ritaglio proporzionale che conserva titolo e sottotitolo. Wallpaper scaricabile, senza cambiare lo sfondo della mappa. Nessuno screenshot reale disponibile: le illustrazioni sono dichiarate promozionali.

Versione **0.1.1**, con voce in APP_RELEASES e CHANGELOG. Verificati **35 test Python e 59 controlli JavaScript**; due regressioni aggiunte per asset annidati consentiti, file non autorizzati e symlink della directory branding verso l'esterno. Il backend conserva una whitelist esatta, con controllo del percorso reale all'interno di static. Occorre riavviarlo per i nuovi asset e poi ricaricare con Ctrl+F5; il riavvio effettua una scansione reale.

Nella sessione grafica precedente la directory installata era di proprietà `nobody` e non scrivibile nel sandbox; nella sessione attuale i file di documentazione sono aggiornabili. Le modifiche sono nel clone Git scrivibile `/tmp/noderunner-public-dyadg9gz`. L'installazione e pubblicazione della grafica sono attestate nella sezione README bilingue; per questo aggiornamento consultare la sezione iniziale. Il tag v0.1.0 rimane intatto. Per la social preview GitHub è necessario caricare manualmente `docs/images/noderunner-social-preview.png` in Settings → Social preview; non basta il commit.

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

Rinominati gli entry point in `noderunner.py`, `NodeRunner.html` e `deploy/apache-noderunner.conf`; i nomi precedenti e `index.html` restano collegamenti compatibili. La cartella installata è `/var/www/html/NodeRunner` e il template Apache punta a questa cartella. `AGENTS.md` usa ora i nomi principali NodeRunner; i comandi precedenti restano validi tramite gli alias.

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
cd /var/www/html/NodeRunner
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

1. Controllare se `/etc/httpd/conf.d/noderunner.conf` è stato installato dopo questa sessione. Al controllo documentato era assente.
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

> Riprendiamo NodeRunner 0.1.3 in /var/www/html/NodeRunner. Leggi AGENTS.md, la sezione Chiusura sessione di SESSION_HANDOFF.md, PROJECT_STATUS.md e deploy/INSTALL.md. Il nuovo RPM Fedora 44 con CAP_NET_RAW/AF_PACKET è pubblicato e ha rilevato MAC in una prova veth isolata; ora occorre verificarlo sulla seconda istanza reale dell’utente, senza confondere i due collaudi. Conserva registro, token, backup e screenshot privati. Non modificare il .git locale non valido; usa /tmp/noderunner-mac-rpm se presente, un nuovo clone GitHub o il bundle privato in .local-session. Controlla modifiche concorrenti prima di intervenire. Non avviare il backend o il servizio durante i test automatici: startup e restart avviano scansioni reali.

Al termine di ogni intervento aggiornare stato, verifiche, attività aperte e questo passaggio di consegne; non includere segreti.
