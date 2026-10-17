# Repository Guidelines

## Project Structure & Module Organization

HomeNetScanner è un monitor LAN con backend Python e frontend HTML/CSS/JavaScript senza framework. `homenetscanner.py` contiene scansioni Nmap, API e persistenza. `HomeNetScanner.html` carica, in ordine, `static/icons.js`, `registry.js`, `settings.js` e `app.js`; gli script condividono lo scope globale. I test sono in `tests/`, le configurazioni in `deploy/`, la revisione di sicurezza in `docs/`.

Prima di proseguire leggere `PROJECT_STATUS.md` e `SESSION_HANDOFF.md`. `support.js` non è caricato dall'applicazione.

## Build, Test, and Development Commands

Non esistono compilazione, package manager o dipendenze Python aggiuntive.

```bash
sudo python3 homenetscanner.py
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_frontend.js
node --check static/app.js
```

Il primo comando avvia server e scansione reale: usarlo soltanto per una prova di rete voluta. Gli altri controllano regressioni e sintassi senza scansioni o socket in ascolto. Il browser usa normalmente `http://localhost:8000`.

## Coding Style & Naming Conventions

Usare quattro spazi e `snake_case` in Python, due spazi e `camelCase` in JavaScript. Conservare lo stile dei file e nomi descrittivi. Non introdurre framework o strumenti di build per correzioni locali. Non è configurato un formatter o linter. Per categorie e icone usare `typeLabel()`, `iconFor()` e `allTypeOptions()`.

## Testing Guidelines

Python usa `unittest`, JavaScript `node:assert/strict` e `vm`. Aggiungere regressioni significative per bug di logica o sicurezza; nomi Python `test_*.py`. Usare file temporanei e Nmap simulato. Nessuna soglia di copertura è configurata. I controlli con DOM simulato richiedono anche verifica manuale quando cambia l'interfaccia.

## Commit & Pull Request Guidelines

Le convenzioni storiche Git non sono state verificabili nell'ambiente. Usare messaggi brevi e imperativi, spiegando problema e risultato. Nelle PR indicare modifiche, verifiche, limiti e configurazioni da attivare separatamente; includere screenshot per cambiamenti visivi.

## Security & Session Continuity

Preservare registro, token e backup; non pubblicarne contenuti. Non trasferire fiducia tramite hostname. Sanificare SVG e proteggere i valori inseriti nell'HTML. Non modificare `.git` o disabilitare il sandbox per aggirare errori. Aggiornare `PROJECT_STATUS.md` e `SESSION_HANDOFF.md` con risultati effettivi e lavoro ancora aperto.
