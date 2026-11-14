# Serata 🎲

Gioco di società per una serata tra amici: uno schermo condiviso (PC/TV) racconta la storia, ognuno gioca dal proprio telefono dopo aver scansionato il QR.

**Gioca:** https://agapitosantangelo.github.io/serata/

1. Apri la pagina sul PC collegato alla TV.
2. Tutti scansionano il QR (o aprono `play.html` e scrivono il codice stanza).
3. Scegli il gioco e la durata (circa 30 o 60 minuti).

**Avventure** (nessuna domanda: scelte d’azione, ruoli segreti, patti, tradimenti e finali multipli):
- *Delitto a Villa Corvara*: giallo con un colpevole tra voi e un possibile complice (3+).
- *La Torre di Brinacorvo*: fantasy con cuori in comune, forse un servo del drago, battaglia finale (3+).
- *Il Rifugio dei Colpi*: horror in un rifugio sui Sibillini, una Cosa tra voi e un muro che bussa (3+).
- *La Notte del Noce*: horror folk nel Sannio, una janara tra voi e cavalle stregate (3+).
- *L’Isola del Lazzaretto*: horror nella laguna, un marchiato tra voi e un ufficiale che offre la salvezza a chi denuncia (3+).

**Giochi veloci**:
- *Quiz Show*: circa 300 domande, round a sorpresa (punti doppi, lampo, a rischio) e domande bonus (1+).
- *L’Impostore*: tutti conoscono la parola segreta tranne uno (3+).

Funziona senza server: i telefoni si collegano allo schermo in peer-to-peer (WebRTC via PeerJS). **Collegate tutti i telefoni al Wi‑Fi dello schermo**: i relay pubblici gratuiti di PeerJS non esistono più, quindi da rete mobile (4G/5G) la connessione può non riuscire. Tieni aperta la pagina dello schermo per tutta la partita.

Test della logica: `node --test tests/*.test.mjs`
