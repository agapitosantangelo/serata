# Serata 🎲

Gioco di società per una serata tra amici: uno schermo condiviso (PC/TV) racconta la storia, ognuno gioca dal proprio telefono dopo aver scansionato il QR.

**Gioca:** https://agapitosantangelo.github.io/serata/

1. Apri la pagina sul PC collegato alla TV.
2. Tutti scansionano il QR (o aprono `play.html` e scrivono il codice stanza).
3. Scegli il gioco e la durata (circa 30 o 60 minuti):
   - *Delitto a Villa Corvara*: giallo con un colpevole segreto tra i giocatori (3+).
   - *La Torre di Brinacorvo*: avventura fantasy cooperativa con dadi, indovinelli e un drago (2+).
   - *Quiz Show*: circa 300 domande facili, medie e difficili, round a sorpresa (punti doppi, lampo, a rischio) e domande bonus (1+).
   - *L’Impostore*: tutti conoscono la parola segreta tranne uno (3+).

Funziona senza server: i telefoni si collegano allo schermo in peer-to-peer (WebRTC via PeerJS). **Collegate tutti i telefoni al Wi‑Fi dello schermo**: i relay pubblici gratuiti di PeerJS non esistono più, quindi da rete mobile (4G/5G) la connessione può non riuscire. Tieni aperta la pagina dello schermo per tutta la partita.

Test della logica: `node --test tests/*.test.mjs`
