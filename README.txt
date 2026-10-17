NodeRunner
Map your network. Know every node.
==============

English documentation: README.md
Documentazione italiana: README.it.md

Avvio:
    cd /var/www/html/NodeRunner
    sudo python3 noderunner.py

Aprire http://localhost:8000 e inserire il token del terminale in:
    Settings -> Connection -> Backend token -> SAVE TOKEN

Per riprendere lo sviluppo:
    1. SESSION_HANDOFF.md
    2. PROJECT_STATUS.md
    3. AGENTS.md

Test:
    python3 -m unittest discover -s tests -p 'test_*.py' -v
    node tests/test_frontend.js

Correzioni di sicurezza: docs/SECURITY_REVIEW.md
Configurazione Apache da installare separatamente: deploy/apache-noderunner.conf

Dopo il cambio nome: riavviare il backend e ricaricare con Ctrl+F5.
I vecchi comandi e i dati esistenti restano compatibili.

Layout di sistema per RPM: /usr/share/noderunner (app), /var/lib/noderunner (dati).
Launcher previsto: /usr/bin/noderunner. Migrazione: deploy/INSTALL.md.
Il pacchetto RPM e il servizio systemd restano da preparare.
