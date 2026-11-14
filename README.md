# Serata 🎲

Gioco di società per una serata tra amici: uno schermo condiviso (PC/TV) racconta la storia, ognuno gioca dal proprio telefono dopo aver scansionato il QR.

**Gioca:** https://agapitosantangelo.github.io/serata/

1. Apri la pagina sul PC collegato alla TV.
2. Tutti scansionano il QR (o aprono `play.html` e scrivono il codice stanza).
3. Scegli il gioco: *Delitto a Villa Corvara* (giallo, 3+), *La Torre di Brinacorvo* (fantasy, 2+), *Quiz Show* (1+).

Funziona senza server: i telefoni si collegano allo schermo in peer-to-peer (WebRTC via PeerJS, con relay pubblico se la rete lo richiede). Tieni aperta la pagina dello schermo per tutta la partita.

Test della logica: `node --test tests/*.test.mjs`
