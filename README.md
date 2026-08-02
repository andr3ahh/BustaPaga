# BustaPaga — Sistema di calcolo e generazione buste paga

Sistema **HTML** (nessuna installazione: si apre `index.html` nel browser) per calcolare,
generare, archiviare e ristampare buste paga secondo il **CCNL Terziario, Distribuzione e
Servizi — Confcommercio (CNEL H011)**, con focus sul **livello Quadro**.
La grafica del cedolino replica il Libro Unico del Lavoro in stile Zucchetti
dell'esempio fornito (ASD Eventi Sportivi Palmanova).

## Avvio

### Online (GitHub Pages)

Il repository include un workflow (`.github/workflows/deploy-pages.yml`) che pubblica
automaticamente il sistema come sito web a ogni push:

**https://andr3ahh.github.io/BustaPaga/**

Il sito pubblicato è **protetto da password**: la pagina viene cifrata in AES-256
([StatiCrypt](https://github.com/robinmoisson/staticrypt)) durante il deploy e all'apertura
chiede la password di accesso; senza password il contenuto è un blob crittografato illeggibile.
La spunta "ricordami" evita di reinserirla per 30 giorni sullo stesso browser.

Requisiti una tantum:
1. **Password di accesso**: Settings → **Secrets and variables** → **Actions** →
   **New repository secret** → nome `PAGES_PASSWORD`, valore = la password scelta
   (senza questo secret il deploy si ferma con errore esplicito).
2. **Repository pubblico** (con il piano GitHub gratuito Pages non funziona sui repo privati:
   Settings → General → Danger Zone → Change visibility), oppure piano Pro/Team.
3. Se il primo deploy non parte da solo: Settings → **Pages** → Source: **GitHub Actions**,
   poi rilanciare il workflow dalla scheda Actions.

Per cambiare password: aggiornare il secret `PAGES_PASSWORD` e rilanciare il workflow.

Note privacy: su GitHub è pubblicato **solo il codice del sistema** (visibile nel repo se
pubblico); il **sito** invece è accessibile solo con la password. I dati inseriti
(aziende, dipendenti, buste paga) restano esclusivamente nel browser di chi lo usa
(localStorage) e non vengono mai inviati a GitHub o ad altri server.

### In locale (senza internet)

1. Scaricare i file `index.html` e `payroll-engine.js` nella stessa cartella.
2. Aprire `index.html` con un browser (Chrome/Edge/Firefox).
3. I dati sono salvati automaticamente nel browser (localStorage). Usare
   **Archivio → Esporta backup JSON** per il salvataggio su file e il trasferimento su altri PC.

## Funzionalità

| Area | Contenuto |
|---|---|
| **Aziende** | Ragione sociale, indirizzo, codice fiscale/P.IVA, posizione INPS, **P.A.T. INAIL** + voce di tariffa + tasso, dimensione aziendale (determina FIS/CIGS), sede, dati legali. Multi-azienda. |
| **Dipendenti** | Anagrafica completa, livello CCNL (default Quadro), data assunzione, **RAL / retribuzione mensile** (scomposta automaticamente in paga base + contingenza + terzo elemento + indennità di funzione + scatti + *superminimo assorbibile*), part-time, contratto TD/TI, residui ferie/ROL/ex-festività, Qu.A.S., Quadrifor, previdenza complementare, IBAN. |
| **Elabora busta** | Presenze del mese, **ferie/permessi goduti** (con ratei residuo/maturato/goduto/saldo), straordinari (+15/30/50%), **bonus/una tantum**, **note spese esenti**, **buoni pasto** (esenzione €10 elettronici dal 2026, €8 fino al 2025, €4 cartacei; eccedenza assoggettata), fringe benefit, rate addizionali (suggerite dal conguaglio dell'anno precedente), 13ª automatica a dicembre, 14ª a luglio, **conguaglio fiscale di fine anno/cessazione**, arrotondamento del netto con riporto. |
| **Archivio** | Tutte le buste salvate restano **rigenerabili e ristampabili**; esporta/importa backup JSON. |
| **Prospetto CU** | Calcolo delle principali voci della Certificazione Unica (redditi punto 1/2, giorni detrazione, ritenute, addizionali, somma integrativa L.207/24, trattamento integrativo, previdenza, sanità integrativa, TFR) dall'archivio dell'anno. Non genera il modello ufficiale. |
| **Parametri** | Tutti i valori (tranche CCNL, aliquote, scaglioni, fondi, soglie) sono modificabili senza toccare il codice. |

## Regole di calcolo implementate

- **Minimi Quadro** (rinnovo CCNL 22/03/2024): paga base 2.089,18 (04/2024) → 2.122,33 (03/2025)
  → 2.183,09 (11/2025) → 2.249,37 (11/2026) → 2.276,99 (02/2027); contingenza 540,37;
  terzo elemento 2,07; **indennità di funzione 260,76**; scatti triennali 25,46 (max 10).
  Divisori CCNL: orario **/168**, giornaliero **/26** — riscontrati al centesimo su un LUL reale
  di Quadro Commercio (retribuzione oraria 27,29589 e giornaliera 176,37346 riprodotte esattamente).
- **Contributi c/dipendente**: IVS 9,19% + FIS 0,1667% (≤5 dip.) / 0,2667% (>5) + CIGS 0,30% (>50);
  **contributo aggiuntivo 1%** oltre € 56.224/anno (2026); **massimale contributivo € 122.295**
  (iscritti post 1996); imponibile arrotondato all'unità di euro.
- **IRPEF**: scaglioni 2025 (23/35/43) e 2026 (23/**33**/43); detrazioni lavoro dipendente art. 13 TUIR
  (con maggiorazione €65 per RC 25-35k); **somma integrativa L.207/2024** (RC ≤ 20.000: 7,1/5,3/4,8%);
  **ulteriore detrazione** €1.000 (RC 20-32k, a scalare fino a 40k); trattamento integrativo €1.200;
  **conguaglio annuale** a dicembre/cessazione con ricalcolo su imponibile effettivo.
- **Addizionali**: regionale FVG (0,70% ≤15k; 1,23% sull'intero oltre) e comunale Palmanova
  (0,50%, esenzione ≤ €18.000) — entrambe configurabili; calcolate a conguaglio e trattenute
  a rate nell'anno successivo (11 rate saldo, 9 rate acconto comunale 30%).
- **Fondi Quadri**: Qu.A.S. €56/anno dip. + €390/anno azienda (2026; iscrizione €340 una tantum);
  Quadrifor €25 dip. + €50 azienda; Fondo EST per livelli non Quadro; previdenza complementare
  (es. Fon.Te.) 0,55% dip. + 1,55% azienda + TFR. *(Fondir/For.Te. sono fondi interprofessionali
  finanziati con lo 0,30% INPS a carico azienda: nessuna trattenuta in busta.)*
- **TFR**: quota = retribuzione utile / 13,5 − 0,50% FAP; progressivo annuo; destinazione a fondo pensione.
- **Mensilità aggiuntive**: 13ª (matura gen-dic, erogata a dicembre), 14ª (matura lug-giu, erogata a
  luglio), con regola del 15 per i ratei mensili.
- **Netto** arrotondato all'euro con riporto al mese successivo (come da LUL di esempio).

## Verifica dei calcoli

`node test-verifica.js` esegue **39 verifiche** con valori attesi ricalcolati a mano in modo
indipendente (elementi retributivi contro un LUL reale, mensilità aggiuntive, contributi, IRPEF e
detrazioni, buoni pasto, conguaglio, massimale, contributo 1%, ratei, prospetto CU). Tutte superate.

## Limiti (da conoscere)

- Non gestisce: malattia/maternità/infortunio con integrazione INPS, CIG, ANF/AUU, pignoramenti,
  lavoro intermittente, apprendistato, detrazioni per familiari a carico (inseribili come
  "altre detrazioni" manuali).
- Le addizionali comunali di comuni diversi da Palmanova e gli aggiornamenti normativi futuri
  (nuove tranche CCNL, aliquote, massimali, coefficiente di rivalutazione TFR) vanno inseriti
  nella scheda **Parametri**.
- Strumento di supporto gestionale: **non sostituisce il consulente del lavoro** per gli
  adempimenti ufficiali (LUL vidimato, UniEmens, CU telematica).

## Fonti utilizzate per i parametri

- Tabelle e rinnovo CCNL Commercio Confcommercio: [lexplain.it](https://www.lexplain.it/tabelle-retributive-ccnl-commercio-2024-2027/), [fiscoetasse.com](https://www.fiscoetasse.com/approfondimenti/12192-ccnl-commercio-rinnovo-2024-testo-e-tabelle-aumenti.html), [gigroup.it](https://www.gigroup.it/job-space-ccnl-commercio-retribuzione-e-stipendio/), [bustaia.it](https://www.bustaia.it/guida-ccnl/commercio), [leggeinchiaro.it](https://leggeinchiaro.it/ccnl-commercio-confcommercio-tabelle-retributive/)
- Quadri (indennità di funzione, Qu.A.S., Quadrifor): [manageritalia.it](https://www.manageritalia.it/servizi-manageritalia/rinnovo-ccnl-terziario-le-novita-per-i-quadri/), [quas.it](https://www.quas.it/Content/Index/Aziende-Contributi%20Quadri), [contrattocommercio.it](https://www.contrattocommercio.it/art-109-investimenti-formativi-quadrifor/)
- IRPEF 2026 e detrazioni: [fiscomania.com](https://fiscomania.com/aliquote-irpef/), [geps.it](https://www.geps.it/la-nuova-legge-di-bilancio-2026-l-199-2025-trattamento-integrativo-e-detrazioni-irpef-per-lavoro-dipendente-disciplina-applicabile-nel-2026-11566/), [cafacli.it](https://www.cafacli.it/it/notizie-fisco/irpef-2026-sconto-di-due-punti-sulla-seconda-aliqu_2328_idnews/)
- Minimali/massimali INPS 2026 (circ. 6/2026): [inps.it](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.lavoratori-dipendenti-limite-minimo-di-retribuzione-giornaliera-2026.html), [fiscoetasse.com](https://www.fiscoetasse.com/normativa-prassi/13549-retribuzioni-minime-e-massimali-contributivi-2026-i-nuovi-importi.html)
- Buoni pasto 2026: [ipsoa.it](https://www.ipsoa.it/documents/quotidiano/2025/11/04/buoni-pasto-elettronici-esenzione-fiscale-sale-10-euro-2026), [edenred.it](https://www.edenred.it/blog/guida-buoni-pasto/aumento-soglia-esenzione-buoni-pasto-10-euro/)
- Addizionali FVG/comuni: [calcolonetto.it](https://www.calcolonetto.it/guide/regione/friuli-venezia-giulia/), [regione.fvg.it](https://www.regione.fvg.it/rafvg/cms/RAFVG/GEN/tributi/), [comune.palmanova.ud.it](https://www.comune.palmanova.ud.it)
- Ferie/ROL/mensilità: [leggeinchiaro.it](https://leggeinchiaro.it/ccnl-commercio-confcommercio-ferie-permessi-rol/), [insindacabili.it](https://insindacabili.it/quattordicesima-commercio-2026-quando-viene-pagata/)
