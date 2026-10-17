# Revisione di sicurezza e correzioni

Data: **17 ottobre 2026**. Questa prima revisione riguarda i problemi verificati nei sorgenti; non certifica l'assenza di altre vulnerabilità.

## Correzioni applicate

| Area | Problema affrontato | Comportamento attuale |
| --- | --- | --- |
| HTML del registro e dei dettagli | IP e identificativi interpolati senza protezione | Valori convertiti in testo con escaping prima dell'inserimento nell'HTML. |
| Icone personalizzate | Markup SVG e riferimenti esterni non affidabili | Lista di forme e attributi consentiti, limite alla profondità e rifiuto di riferimenti `url(...)`. |
| Identità dei dispositivi | Un hostname copiato poteva trasferire fiducia a un nuovo MAC | Corrispondenza proposta per revisione manuale, senza migrazione automatica. |
| JSON e importazioni | Strutture malformate, tipi sbagliati e chiavi come `__proto__` | Validazione su API, lettura del registro, cache del browser e backup importati. |
| Scansione | Errori Nmap presentati come risultato vuoto valido | Errori espliciti HTTP 502; risultato vuoto riuscito gestito separatamente. |
| Target | Valori della CLI non validati come quelli delle API | Canonicalizzazione IPv4 e rifiuto di opzioni Nmap e IPv6 non supportato. |
| Richieste HTTP | Corpi non limitati, letture lente e gestori senza limite | Limite 2 MiB, timeout socket di 15 secondi e massimo 32 gestori contemporanei. |
| File temporanei | Nome prevedibile per la scrittura atomica del registro | File privato generato con `tempfile.mkstemp()`, sincronizzazione e sostituzione atomica. |
| Token e backup | Creazione e accesso ai file privati | Creazione esclusiva con permessi 0600; rifiuto di symlink per il token dove `O_NOFOLLOW` è disponibile. |
| Persistenza | Registro corrotto trattato come vuoto e rete configurata cancellabile dai salvataggi | Errore esplicito, conservazione del target e scrittura su disco prima dell'aggiornamento della configurazione in memoria. |
| Salvataggi del browser | Richieste consecutive potevano arrivare fuori ordine; errori invisibili | Coda di salvataggio per pagina e messaggio di errore visibile. |
| Affidabilità dell'interfaccia | Porte personalizzate non usate, dati in cache mostrati come appena rilevati | Origine del backend rispettata e timestamp effettivo della scansione. |

I permessi del registro, dei backup e del token esistenti sono stati portati a 0600 durante l'intervento precedente senza cambiarne il contenuto. Questa sessione di documentazione non ha riscritto tali dati. Durante il normale uso il backend può aggiornare il registro e creare backup.

Sono stati inoltre corretti i messaggi su gateway non verificati, velocità Ethernet non misurate, significato del flag blocked e scansioni limitate a un sottoinsieme delle porte.

## Evidenze e limiti dei test

I test permanenti sono ora in `tests/`:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_frontend.js
```

Risultato attuale: **33 test Python e 59 controlli JavaScript superati**. Python verifica schema, autenticazione, richieste HTTP, scansioni fallite, persistenza, percorsi statici, concorrenza e file Excel. JavaScript verifica importazioni, escaping, fiducia, indirizzi del backend, timestamp, salvataggi, temi, pagina dedicata ed export filtrato.

L'endpoint `POST /api/export.xlsx` richiede il token e applica i limiti del corpo HTTP. Accetta al massimo 10.000 righe di 14 celle testuali, validate prima della risposta. Il report viene generato in memoria senza leggere token o salvare il registro. I nomi dei dispositivi e gli altri valori sono celle [OOXML inlineStr](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.cell), senza elementi formula o collegamenti esterni. I test includono stringhe che iniziano con `=`, `+`, `-` e `@`, caratteri XML speciali e dati malformati. L'apertura in una suite Office reale resta da verificare.

Nmap viene simulato. Le richieste HTTP attraversano il vero gestore con trasporti in memoria. Gli elementi DOM sono sostituti di prova, non un browser completo. Le prove non aprono porte né modificano il registro reale; possono leggerlo per verificarne la compatibilità. Non sono stati eseguiti penetration test, scansioni reali o verifiche complete nel browser.

## Protezione del server web

Il server Python espone soltanto pagina, API e risorse statiche consentite; le API richiedono `X-NodeRunner-Token`. Questo non protegge automaticamente la directory quando viene servita da un altro server.

Nella configurazione Apache esaminata è presente `AllowOverride None`. Il file [deploy/apache-noderunner.conf](../deploy/apache-noderunner.conf) nega accesso a dati runtime, token, backup, sorgenti e directory private; disabilita anche l'elenco delle directory. **È preparato nel repository e non risulta installato nella configurazione dell'host al controllo documentato.**

La sintassi è stata verificata con una configurazione Apache minima senza listener. La configurazione completa di produzione non era verificabile nel sandbox, che impedisce la creazione di socket. L'installazione e il controllo completo vanno eseguiti dal terminale amministrativo, come indicato nel README.

## Questioni ancora aperte

- Conflitti tra copie complete del registro salvate da browser diversi: l'ultimo salvataggio prevale.
- HTTP senza cifratura e ascolto su tutte le interfacce IPv4; accesso condiviso tramite un unico token.
- Uso abituale di privilegi elevati per Nmap: separazione dei privilegi ancora da progettare.
- Necessità di verificare le regole Apache dall'esterno, compresi backup e directory private.
- Identificazione dei dispositivi euristica; flag e avvisi non sostituiscono controlli sul router.

## Riferimenti tecnici

- [Python: creazione sicura di file temporanei](https://docs.python.org/3/library/tempfile.html).
- [Apache 2.4: direttive di controllo degli accessi](https://httpd.apache.org/docs/2.4/howto/access.html).
