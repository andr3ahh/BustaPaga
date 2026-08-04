/* ============================================================
 * BustaPaga — Motore di calcolo buste paga
 * CCNL Terziario, Distribuzione e Servizi (Confcommercio, CNEL H011)
 * Focus: livello QUADRO — parametri 2025/2026
 * Funziona sia nel browser (window.PayrollEngine) sia in Node (module.exports)
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PayrollEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- utilità ----------
  const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  const r5 = (x) => Math.round((x + Number.EPSILON) * 100000) / 100000;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // Limite superiore di uno scaglione. I parametri vengono serializzati in JSON
  // per il salvataggio: Infinity diventa null, quindi l'ultimo scaglione (quello
  // senza tetto) va sempre riletto come illimitato, altrimenti resterebbe non tassato.
  const lim = (v) => (v == null || !isFinite(v)) ? Infinity : v;

  // ============================================================
  // PARAMETRI DI DEFAULT (modificabili dall'interfaccia)
  // ============================================================
  const DEFAULT_PARAMS = {
    ccnl: {
      nome: 'CCNL Terziario Distribuzione e Servizi — Confcommercio',
      codiceCNEL: 'H011',
      mensilita: 14,               // 13ª a dicembre, 14ª a luglio
      divisoreOrario: 168,         // retribuzione oraria = mensile / 168
      divisoreGiornaliero: 26,     // retribuzione giornaliera = mensile / 26
      oreSettimanali: 40,
      // Paga base (minimo tabellare) per livello e decorrenza.
      // Quadro: derivato dalle tranche del rinnovo 22/03/2024
      // (+70/+30/+55/+60/+25 al 4º livello, riparametrate; riscontro
      //  reale: LUL 05/2025 paga base Quadro 2.122,33; nov 2025 2.183,09)
      pagaBase: {
        QUADRO: [
          { dal: '2023-01-01', importo: 2011.85 },
          { dal: '2024-04-01', importo: 2089.18 },
          { dal: '2025-03-01', importo: 2122.33 },
          { dal: '2025-11-01', importo: 2183.09 },
          { dal: '2026-11-01', importo: 2249.37 },
          { dal: '2027-02-01', importo: 2276.99 }
        ],
        '1': [
          { dal: '2023-01-01', importo: 1813.10 },
          { dal: '2024-04-01', importo: 1882.78 },
          { dal: '2025-03-01', importo: 1912.65 },
          { dal: '2025-11-01', importo: 1967.41 },
          { dal: '2026-11-01', importo: 2027.14 },
          { dal: '2027-02-01', importo: 2052.03 }
        ],
        '2': [
          { dal: '2023-01-01', importo: 1568.26 },
          { dal: '2024-04-01', importo: 1628.53 },
          { dal: '2025-03-01', importo: 1654.36 },
          { dal: '2025-11-01', importo: 1701.72 },
          { dal: '2026-11-01', importo: 1753.38 },
          { dal: '2027-02-01', importo: 1774.90 }
        ],
        '3': [
          { dal: '2023-01-01', importo: 1340.53 },
          { dal: '2024-04-01', importo: 1392.04 },
          { dal: '2025-03-01', importo: 1414.12 },
          { dal: '2025-11-01', importo: 1454.60 },
          { dal: '2026-11-01', importo: 1498.76 },
          { dal: '2027-02-01', importo: 1517.16 }
        ],
        '4': [
          { dal: '2023-01-01', importo: 1159.15 },
          { dal: '2024-04-01', importo: 1229.15 },
          { dal: '2025-03-01', importo: 1259.15 },
          { dal: '2025-11-01', importo: 1314.15 },
          { dal: '2026-11-01', importo: 1374.15 },
          { dal: '2027-02-01', importo: 1399.15 }
        ],
        '5': [
          { dal: '2023-01-01', importo: 1047.35 },
          { dal: '2024-04-01', importo: 1110.60 },
          { dal: '2025-03-01', importo: 1137.71 },
          { dal: '2025-11-01', importo: 1187.41 },
          { dal: '2026-11-01', importo: 1241.62 },
          { dal: '2027-02-01', importo: 1264.21 }
        ],
        '6': [
          { dal: '2023-01-01', importo: 946.06 },
          { dal: '2024-04-01', importo: 1003.19 },
          { dal: '2025-03-01', importo: 1027.68 },
          { dal: '2025-11-01', importo: 1072.57 },
          { dal: '2026-11-01', importo: 1121.54 },
          { dal: '2027-02-01', importo: 1141.94 }
        ],
        '7': [
          { dal: '2023-01-01', importo: 810.06 },
          { dal: '2024-04-01', importo: 858.98 },
          { dal: '2025-03-01', importo: 879.95 },
          { dal: '2025-11-01', importo: 918.39 },
          { dal: '2026-11-01', importo: 960.32 },
          { dal: '2027-02-01', importo: 977.79 }
        ]
      },
      contingenza: {
        QUADRO: 540.37, '1': 537.52, '2': 532.54, '3': 527.90,
        '4': 524.22, '5': 521.94, '6': 519.76, '7': 517.51
      },
      terzoElemento: {                 // E.D.R. / terzo elemento nazionale
        QUADRO: 2.07, '1': 2.07, '2': 2.07, '3': 2.07,
        '4': 2.07, '5': 2.07, '6': 2.07, '7': 2.07
      },
      indennitaFunzione: { QUADRO: 260.76 },  // solo Quadri, mensile
      scattoAnzianita: {               // importo di ogni scatto triennale (max 10)
        QUADRO: 25.46, '1': 24.84, '2': 22.83, '3': 21.95,
        '4': 20.66, '5': 20.30, '6': 19.73, '7': 19.47
      },
      maxScatti: 10,
      anniPerScatto: 3,
      // Maturazione annua (rapportata a mese; assunzione entro il 15 = mese intero)
      ferieGiorniAnno: 26,             // settimana 6 gg; usare 22 per settimana 5 gg
      rolOreAnno: 72,                  // aziende >15 dip. (56 fino a 15 dip.)
      exFestivitaOreAnno: 32,          // 4 ex festività × 8 ore
      // Maggiorazioni straordinario
      maggiorazioni: { straordinario: 15, festivo: 30, notturno: 50 }
    },

    // ---------- contributi previdenziali (quota dipendente) ----------
    inps: {
      ivsDipendente: 9.19,             // FPLD aliquota IVS c/dipendente
      fisDipendente: {                 // Fondo Integrazione Salariale (quota dip. = 1/3)
        fino5: 0.1667,                 // aziende fino a 5 dipendenti (tot. 0,50%)
        oltre5: 0.2667                 // aziende oltre 5 dipendenti (tot. 0,80%)
      },
      cigsDipendente: 0.30,            // CIGS c/dip. — solo commercio >50 dipendenti
      perAnno: {
        2025: { massimaleAnnuo: 120607, sogliaAliquotaAggiuntiva: 55448, minimaleGiornaliero: 56.87 },
        2026: { massimaleAnnuo: 122295, sogliaAliquotaAggiuntiva: 56224, minimaleGiornaliero: 58.13 }
      },
      aliquotaAggiuntiva: 1.0,         // 1% oltre la prima fascia di retribuzione pensionabile
      // quota datore (per prospetto costo azienda, aliquota complessiva indicativa)
      aliquotaDatoreCommercio: 29.28
    },

    // ---------- IRPEF ----------
    irpef: {
      scaglioniPerAnno: {
        2024: [ { fino: 28000, aliq: 23 }, { fino: 50000, aliq: 35 }, { fino: Infinity, aliq: 43 } ],
        2025: [ { fino: 28000, aliq: 23 }, { fino: 50000, aliq: 35 }, { fino: Infinity, aliq: 43 } ],
        2026: [ { fino: 28000, aliq: 23 }, { fino: 50000, aliq: 33 }, { fino: Infinity, aliq: 43 } ]
      },
      // Detrazioni lavoro dipendente (art. 13 TUIR)
      detrazioni: {
        fascia1: 1955, fascia1Min: 690, fascia1MinTD: 1380,
        fascia2Base: 1910, fascia2Extra: 1190, fascia2Den: 13000,
        fascia3Base: 1910, fascia3Den: 22000,
        maggiorazione65: 65             // se 25.000 < RC ≤ 35.000
      },
      trattamentoIntegrativo: 1200,     // ex bonus Renzi, RC ≤ 15.000 (o capienza 15-28k)
      // L. 207/2024 (strutturale dal 2025)
      sommaIntegrativa: [               // % sul reddito lavoro dip., RC ≤ 20.000
        { fino: 8500, pct: 7.1 }, { fino: 15000, pct: 5.3 }, { fino: 20000, pct: 4.8 }
      ],
      ulterioreDetrazione: { da: 20000, pieno: 32000, fine: 40000, importo: 1000 }
    },

    // ---------- addizionali ----------
    addizionali: {
      regionale: {                      // default: Lombardia — progressiva per scaglioni
        nome: 'LOMBARDIA',
        scaglioni: [
          { fino: 15000, aliq: 1.23 },
          { fino: 28000, aliq: 1.58 },
          { fino: 50000, aliq: 1.72 },
          { fino: Infinity, aliq: 1.73 }
        ],
        aliquotaUnicaSoprasoglia: false // ogni aliquota si applica alla quota del rispettivo scaglione
      },
      comunale: {                       // default: Milano (cod. F205)
        nome: 'MILANO',
        aliquota: 0.80,
        esenzioneFino: 23000,           // oltre la soglia si applica sull'intero imponibile
        acconto: 30                     // % acconto anno successivo
      },
      rateSaldo: 11,                    // saldo trattenuto in 11 rate (gen-nov)
      rateAcconto: 9                    // acconto comunale in 9 rate (mar-nov)
    },

    // ---------- welfare / esenzioni ----------
    welfare: {
      buonoPastoEsentePerAnno: { 2025: { elettronico: 8, cartaceo: 4 }, 2026: { elettronico: 10, cartaceo: 4 } },
      fringeBenefitSoglia: 1000,        // 2.000 con figli a carico (2025-2027)
      fringeBenefitSogliaFigli: 2000
    },

    // ---------- fondi contrattuali Quadri ----------
    fondi: {
      quas:      { dipAnnuo: 56,  aziendaAnnuoPerAnno: { 2025: 370, 2026: 390 }, iscrizioneAzienda: 340 },
      quadrifor: { dipAnnuo: 25,  aziendaAnnuo: 50 },
      est:       { dipMensile: 2, aziendaMensile: 10 },   // Fondo EST (livelli non Quadro)
      // Ente Bilaterale Terziario: percentuali sulla retribuzione convenzionale
      // (paga base + contingenza), non sulla retribuzione di fatto.
      enteBilaterale: { dipPct: 0.05, aziendaPct: 0.10 },
      // previdenza complementare (es. Fon.Te.): % su retribuzione utile TFR
      fondoPensione: { dipPct: 0.55, aziendaPct: 1.55, tfrPct: 100 }
    },

    // ---------- TFR ----------
    tfr: {
      divisore: 13.5,
      fapPct: 0.50,                     // contributo IVS 0,50% dedotto dalla quota TFR
      impostaSostitutivaRival: 17,
      rivalutazioneAnnuaDefault: 2.0    // 1,5% + 75% indice FOI — aggiornare a consuntivo
    },

    arrotondamentoNetto: true           // netto arrotondato all'euro con riporto mese succ.
  };

  // ============================================================
  // FUNZIONI DI BASE
  // ============================================================
  function pagaBaseAllaData(params, livello, dataRef) {
    const serie = params.ccnl.pagaBase[livello];
    if (!serie) throw new Error('Livello sconosciuto: ' + livello);
    let val = serie[0].importo;
    for (const t of serie) if (dataRef >= t.dal) val = t.importo;
    return val;
  }

  function scattiMaturati(params, dataAssunzione, dataRef) {
    const a = new Date(dataAssunzione), b = new Date(dataRef);
    let anni = b.getFullYear() - a.getFullYear();
    const m = b.getMonth() - a.getMonth();
    if (m < 0 || (m === 0 && b.getDate() < a.getDate())) anni--;
    return clamp(Math.floor(anni / params.ccnl.anniPerScatto), 0, params.ccnl.maxScatti);
  }

  // Elementi fissi della retribuzione mensile
  function elementiRetribuzione(params, emp, dataRef) {
    const liv = emp.livello || 'QUADRO';
    const pb = pagaBaseAllaData(params, liv, dataRef);
    const cont = params.ccnl.contingenza[liv] || 0;
    const terzo = (emp.terzoElemento != null) ? emp.terzoElemento : (params.ccnl.terzoElemento[liv] || 0);
    const indF = params.ccnl.indennitaFunzione[liv] || 0;
    const nScatti = (emp.scattiManuali != null) ? emp.scattiManuali
      : scattiMaturati(params, emp.dataAssunzione, dataRef);
    const scatti = r2(nScatti * (params.ccnl.scattoAnzianita[liv] || 0));
    const minimo = r2(pb + cont + terzo + indF + scatti);
    // superminimo: da importo fisso o derivato dalla retribuzione mensile concordata
    let superminimo = emp.superminimo || 0;
    if (emp.retribuzioneMensile && emp.retribuzioneMensile > minimo)
      superminimo = r2(emp.retribuzioneMensile - minimo);
    const pt = (emp.percPartTime || 100) / 100;
    const totale = r2((minimo + superminimo) * pt);
    return { pagaBase: pb, contingenza: cont, terzoElemento: terzo, indennitaFunzione: indF,
             numScatti: nScatti, scatti, superminimo, minimoContrattuale: minimo,
             percPartTime: (emp.percPartTime || 100), totale,
             oraria: r5(totale / params.ccnl.divisoreOrario),
             giornaliera: r5(totale / params.ccnl.divisoreGiornaliero) };
  }

  // ============================================================
  // IRPEF
  // ============================================================
  function scaglioniAnno(params, anno) {
    const s = params.irpef.scaglioniPerAnno;
    return s[anno] || s[Math.max(...Object.keys(s).map(Number))];
  }

  function irpefLordaAnnua(params, anno, imponibile) {
    let imposta = 0, prev = 0;
    for (const sc of scaglioniAnno(params, anno)) {
      const tetto = lim(sc.fino);
      const q = clamp(imponibile, prev, tetto) - prev;
      if (q > 0) imposta += q * sc.aliq / 100;
      prev = tetto;
      if (imponibile <= tetto) break;
    }
    return r2(imposta);
  }

  // Detrazione annua lavoro dipendente (RC = reddito complessivo, gg su 365)
  function detrazioneLavoroAnnua(params, RC, gg, tempoDeterminato) {
    const d = params.irpef.detrazioni;
    const q = clamp(gg, 0, 365) / 365;
    let det;
    if (RC <= 15000) {
      det = d.fascia1 * q;
      const minimo = tempoDeterminato ? d.fascia1MinTD : d.fascia1Min;
      det = Math.max(det, minimo);
    } else if (RC <= 28000) {
      det = (d.fascia2Base + d.fascia2Extra * (28000 - RC) / d.fascia2Den) * q;
    } else if (RC <= 50000) {
      det = d.fascia3Base * (50000 - RC) / d.fascia3Den * q;
    } else det = 0;
    if (RC > 25000 && RC <= 35000) det += d.maggiorazione65;
    return r2(Math.max(det, 0));
  }

  // Ulteriore detrazione L.207/2024 (RC 20.000-40.000), rapportata al periodo
  function ulterioreDetrazioneAnnua(params, RC, gg) {
    const u = params.irpef.ulterioreDetrazione;
    const q = clamp(gg, 0, 365) / 365;
    if (RC <= u.da || RC > u.fine) return 0;
    if (RC <= u.pieno) return r2(u.importo * q);
    return r2(u.importo * (u.fine - RC) / (u.fine - u.pieno) * q);
  }

  // Somma integrativa L.207/2024 (RC ≤ 20.000): % sul reddito di lavoro dipendente
  function sommaIntegrativaPct(params, RC) {
    if (RC > 20000) return 0;
    for (const f of params.irpef.sommaIntegrativa) if (RC <= lim(f.fino)) return f.pct;
    return 0;
  }

  function addizionaleRegionale(params, imponibile) {
    const reg = params.addizionali.regionale;
    if (reg.aliquotaUnicaSoprasoglia) {
      // aliquota dell'ultimo scaglione il cui limite inferiore è superato,
      // applicata all'intero imponibile (es. Friuli Venezia Giulia)
      let aliq = reg.scaglioni[0].aliq, prev = 0;
      for (const s of reg.scaglioni) { if (imponibile > prev) aliq = s.aliq; prev = lim(s.fino); }
      return r2(imponibile * aliq / 100);
    }
    let imposta = 0, prev = 0;
    for (const s of reg.scaglioni) {
      const tetto = lim(s.fino);
      const q = clamp(imponibile, prev, tetto) - prev;
      if (q > 0) imposta += q * s.aliq / 100;
      prev = tetto;
    }
    return r2(imposta);
  }

  function addizionaleComunale(params, imponibile) {
    const c = params.addizionali.comunale;
    if (imponibile <= (c.esenzioneFino || 0)) return 0;
    return r2(imponibile * c.aliquota / 100);
  }

  // ============================================================
  // CALCOLO BUSTA PAGA MENSILE
  // ============================================================
  /**
   * company: { ragioneSociale, dimensione ('fino5'|'da6a15'|'da16a50'|'oltre50'), ... }
   * emp: anagrafica dipendente (v. index.html)
   * input: {
   *   anno, mese (1-12), giorniLavorati, giorniDetrazione (default gg mese),
   *   ferieGodute (gg), rolGodute (ore), exFestGodute (ore), festivita (gg),
   *   oreStraordinario, oreStraordFestivo, oreStraordNotturno,
   *   bonus, bonusDescrizione, noteSpese, buoniPastoGiorni, buoniPastoValore,
   *   buoniPastoTipo ('elettronico'|'cartaceo'), fringeBenefit,
   *   rataAddRegionale, rataAddComunale, rataAccontoComunale (se null: da storico),
   *   conguaglio (bool — default true a dicembre o cessazione), cessazione (bool),
   *   redditoAnnuoPresunto (override facoltativo)
   * }
   * storico: array di buste salvate (stesso anno, stesso dipendente) per progressivi/conguaglio
   */
  function calcolaBusta(params, company, emp, input, storico) {
    storico = (storico || []).filter(b => b.anno === input.anno && b.mese < input.mese);
    const anno = input.anno, mese = input.mese;
    const dataRef = `${anno}-${String(mese).padStart(2, '0')}-01`;
    const ggMese = new Date(anno, mese, 0).getDate();
    const el = elementiRetribuzione(params, emp, dataRef);
    const cc = params.ccnl;
    const voci = [];
    const add = (v) => { voci.push(v); return v; };

    // ---------- retribuzione ordinaria (mensilizzata) ----------
    const giorniRetribuiti = (input.giorniRetribuiti != null) ? input.giorniRetribuiti : cc.divisoreGiornaliero;
    const quotaMese = giorniRetribuiti >= cc.divisoreGiornaliero ? 1 : giorniRetribuiti / cc.divisoreGiornaliero;
    const retribOrdinaria = r2(el.totale * quotaMese);
    add({ cod: 'Z00001', descr: 'Retribuzione', dec5: true, um: 'GG', qta: giorniRetribuiti,
          base: el.giornaliera, competenza: retribOrdinaria, C: 1, I: 1, T: 1 });

    // voci informative presenze (non modificano il lordo: retribuzione mensilizzata)
    if (input.ferieGodute)   add({ cod: 'Z00250', descr: 'Ferie godute', dec5: true, um: 'GG', qta: input.ferieGodute, base: el.giornaliera, C:0,I:0,T:0, info: true });
    if (input.rolGodute)     add({ cod: 'Z00252', descr: 'Permessi Rol goduti', dec5: true, um: 'ORE', qta: input.rolGodute, base: el.oraria, C:0,I:0,T:0, info: true });
    if (input.exFestGodute)  add({ cod: 'Z00253', descr: "Permessi Ex-Fs goduti", dec5: true, um: 'ORE', qta: input.exFestGodute, base: el.oraria, C:0,I:0,T:0, info: true });
    if (input.festivita)     add({ cod: 'Z00230', descr: "Festivita'", dec5: true, um: 'GG', qta: input.festivita, base: el.giornaliera, C:0,I:0,T:0, info: true });

    // ---------- straordinari ----------
    const st = cc.maggiorazioni;
    const straord = [
      ['Z01001', 'Straordinario feriale',  input.oreStraordinario,  st.straordinario],
      ['Z01002', 'Straordinario festivo',  input.oreStraordFestivo, st.festivo],
      ['Z01003', 'Straordinario notturno', input.oreStraordNotturno, st.notturno]
    ];
    for (const [cod, descr, ore, magg] of straord) {
      if (ore > 0) {
        const base = r5(el.oraria * (1 + magg / 100));
        add({ cod, descr: `${descr} +${magg}%`, um: 'ORE', qta: ore, base, competenza: r2(base * ore), C:1, I:1, T:1 });
      }
    }

    // ---------- mensilità aggiuntive ----------
    // 13ª: erogata a dicembre (maturazione gen-dic); 14ª: a luglio (maturazione lug-giu)
    const mesiRateo = mesiMaturatiNellAnno(emp, anno, mese);
    if (mese === 12 || (input.cessazione && mese !== 7)) {
      const q = (mese === 12 ? mesiRateo : mesiRateo) / 12;
      const imp = r2(el.totale * q);
      if (imp > 0) add({ cod: 'Z50000', descr: "13ma Mensilita'", um: 'MESI', qta: r2(q * 12), base: r5(el.totale / 12), competenza: imp, C:1, I:1, T:1 });
    }
    if (mese === 7 || (input.cessazione && mese !== 12)) {
      const mesi14 = mesi14Maturati(emp, anno, mese, input.cessazione);
      const imp = r2(el.totale * mesi14 / 12);
      if (imp > 0) add({ cod: 'Z50002', descr: "14ma Mensilita'", um: 'MESI', qta: mesi14, base: r5(el.totale / 12), competenza: imp, C:1, I:1, T:1 });
    }

    // ---------- bonus / una tantum ----------
    if (input.bonus > 0)
      add({ cod: 'Z00600', descr: input.bonusDescrizione || 'Bonus / una tantum', competenza: r2(input.bonus), C:1, I:1, T: input.bonusInTfr ? 1 : 0 });

    // ---------- buoni pasto ----------
    let bpEccedenza = 0, bpTotale = 0;
    if (input.buoniPastoGiorni > 0 && input.buoniPastoValore > 0) {
      const wf = params.welfare.buonoPastoEsentePerAnno;
      const soglie = wf[anno] || wf[Math.max(...Object.keys(wf).map(Number))];
      const esente = input.buoniPastoTipo === 'cartaceo' ? soglie.cartaceo : soglie.elettronico;
      bpTotale = r2(input.buoniPastoGiorni * input.buoniPastoValore);
      const quotaEsente = Math.min(input.buoniPastoValore, esente);
      bpEccedenza = r2(input.buoniPastoGiorni * Math.max(0, input.buoniPastoValore - esente));
      add({ cod: 'Z00140', descr: `Buoni pasto ${input.buoniPastoTipo || 'elettronici'} esenti (fino a ${esente.toFixed(2)} E)`,
            um: 'GG', qta: input.buoniPastoGiorni, base: quotaEsente,
            competenza: r2(bpTotale - bpEccedenza), C:0, I:0, T:0, N:0, figurativa: true });
      if (bpEccedenza > 0)
        add({ cod: 'Z00141', descr: 'Buoni pasto quota eccedente', competenza: bpEccedenza, C:1, I:1, T:0, N:0, figurativa: true });
    }

    // ---------- fringe benefit (statistico: concorre se oltre soglia — semplificato: imponibile se flag) ----------
    if (input.fringeBenefit > 0)
      add({ cod: 'Z00921', descr: 'Valore fringe benefits', competenza: r2(input.fringeBenefit),
            C: input.fringeBenefitImponibile ? 1 : 0, I: input.fringeBenefitImponibile ? 1 : 0, T:0, N:0, figurativa: true });

    // ---------- note spese (rimborsi documentati, esenti) ----------
    if (input.noteSpese > 0)
      add({ cod: 'Z00156', descr: 'Rimborso spese documentate', competenza: r2(input.noteSpese), C:0, I:0, T:0, N:1 });

    // ============================================================
    // IMPONIBILE PREVIDENZIALE E CONTRIBUTI
    // ============================================================
    const compC = voci.filter(v => v.C).reduce((s, v) => s + (v.competenza || 0), 0);
    let imponibileInpsEff = r2(compC);
    // massimale contributivo (iscritti post 1/1/1996)
    const inpsY = params.inps.perAnno[anno] || params.inps.perAnno[Math.max(...Object.keys(params.inps.perAnno).map(Number))];
    const progInps = storico.reduce((s, b) => s + (b.imponibileInps || 0), 0);
    if (emp.iscrittoPost96 && progInps + imponibileInpsEff > inpsY.massimaleAnnuo)
      imponibileInpsEff = r2(Math.max(0, inpsY.massimaleAnnuo - progInps));
    const imponibileInps = Math.round(imponibileInpsEff);   // arrotondato all'unità di euro

    const dimensione = company.dimensione || 'fino5';
    let aliqDip = params.inps.ivsDipendente
      + (dimensione === 'fino5' ? params.inps.fisDipendente.fino5 : params.inps.fisDipendente.oltre5)
      + (dimensione === 'oltre50' ? params.inps.cigsDipendente : 0);
    aliqDip = r5(aliqDip);
    const contributiIvs = r2(imponibileInps * aliqDip / 100);

    // aliquota aggiuntiva 1% oltre la prima fascia (verifica su progressivo annuo)
    const sogliaMensile = inpsY.sogliaAliquotaAggiuntiva / 12;
    let contributoAggiuntivo = 0;
    const progConAttuale = progInps + imponibileInps;
    if (progConAttuale > inpsY.sogliaAliquotaAggiuntiva * (mese / 12)) {
      const eccedenzaProg = Math.max(0, progConAttuale - inpsY.sogliaAliquotaAggiuntiva * (mese / 12));
      const eccedenzaMese = Math.min(imponibileInps, eccedenzaProg,
        Math.max(0, imponibileInps - Math.max(0, sogliaMensile * mese - progInps)));
      contributoAggiuntivo = r2(Math.max(0, eccedenzaMese) * params.inps.aliquotaAggiuntiva / 100);
    }

    // Voci contributive esposte separatamente, come nel LUL: importo base = imponibile,
    // riferimento = aliquota applicata, trattenuta = contributo.
    const aliqFis = dimensione === 'fino5' ? params.inps.fisDipendente.fino5 : params.inps.fisDipendente.oltre5;
    const aliqCigs = dimensione === 'oltre50' ? params.inps.cigsDipendente : 0;
    const quotaFis = r2(imponibileInps * aliqFis / 100);
    const quotaCigs = r2(imponibileInps * aliqCigs / 100);
    const quotaIvs = r2(contributiIvs - quotaFis - quotaCigs);
    add({ cod: 'Z00133', descr: `FIS D.Lgs.148/2015 ${dimensione === 'fino5' ? '<5 dip.' : '>5 dip.'}`,
          base: imponibileInps, qta: aliqFis, um: '%', trattenuta: quotaFis });
    add({ cod: 'Z00800', descr: 'I.V.S. c/dipendente',
          base: imponibileInps, qta: params.inps.ivsDipendente, um: '%', trattenuta: quotaIvs });
    if (quotaCigs > 0)
      add({ cod: 'Z00810', descr: 'CIGS c/dipendente',
            base: imponibileInps, qta: aliqCigs, um: '%', trattenuta: quotaCigs });
    if (contributoAggiuntivo > 0)
      add({ cod: 'Z00801', descr: 'Contributo aggiuntivo I.V.S.',
            qta: params.inps.aliquotaAggiuntiva, um: '%', trattenuta: contributoAggiuntivo });

    // ---------- fondi contrattuali ----------
    let trattFondi = 0, quasDip = 0, quadriforDip = 0, estDip = 0;
    const liv = emp.livello || 'QUADRO';
    if (emp.quas === undefined) emp.quas = (liv === 'QUADRO');
    if (liv === 'QUADRO') {
      if (emp.quas)      { quasDip = r2(params.fondi.quas.dipAnnuo / 12);      add({ cod: 'Z31010', descr: 'Contributo Qu.A.S.', trattenuta: quasDip }); }
      if (emp.quadrifor !== false) { quadriforDip = r2(params.fondi.quadrifor.dipAnnuo / 12); add({ cod: 'Z31020', descr: 'Contributo Quadrifor', trattenuta: quadriforDip }); }
    } else if (emp.fondoEst !== false) {
      estDip = params.fondi.est.dipMensile;
      add({ cod: 'Z31000', descr: 'Contributo Fondo EST', trattenuta: estDip });
    }
    // Ente Bilaterale Terziario: base convenzionale = paga base + contingenza
    let ebtDip = 0;
    if (emp.enteBilaterale !== false && params.fondi.enteBilaterale) {
      const baseEbt = r2((el.pagaBase + el.contingenza) * ((emp.percPartTime || 100) / 100));
      ebtDip = r2(baseEbt * params.fondi.enteBilaterale.dipPct / 100);
      if (ebtDip > 0)
        add({ cod: 'Z31005', descr: 'Contributo Ente Bilaterale Terziario',
              base: baseEbt, qta: params.fondi.enteBilaterale.dipPct, um: '%', trattenuta: ebtDip });
    }
    trattFondi = r2(quasDip + quadriforDip + estDip + ebtDip);

    // ---------- previdenza complementare ----------
    const retribUtileTfrMese = r2(voci.filter(v => v.T).reduce((s, v) => s + (v.competenza || 0), 0));
    let fpDip = 0, fpAzienda = 0, tfrAFondo = 0;
    if (emp.fondoPensione) {
      fpDip = r2(retribUtileTfrMese * (emp.fondoPensioneDipPct != null ? emp.fondoPensioneDipPct : params.fondi.fondoPensione.dipPct) / 100);
      fpAzienda = r2(retribUtileTfrMese * (emp.fondoPensioneAzPct != null ? emp.fondoPensioneAzPct : params.fondi.fondoPensione.aziendaPct) / 100);
      if (fpDip > 0) add({ cod: 'ZP8138', descr: 'Trattenuta fondo pensione', trattenuta: fpDip });
    }

    // ============================================================
    // TFR
    // ============================================================
    const quotaTfrLorda = r2(retribUtileTfrMese / params.tfr.divisore);
    const fapMese = r2(imponibileInps * params.tfr.fapPct / 100);
    const quotaTfrNetta = r2(quotaTfrLorda - fapMese);
    if (emp.fondoPensione && (emp.tfrAFondoPct == null || emp.tfrAFondoPct > 0)) {
      tfrAFondo = r2(quotaTfrNetta * ((emp.tfrAFondoPct != null ? emp.tfrAFondoPct : params.fondi.fondoPensione.tfrPct) / 100));
      add({ cod: 'ZP8134', descr: 'Quota T.F.R. a F.do Pensione', competenza: tfrAFondo, C:0, I:0, T:0, N:0, figurativa: true });
    }

    // ============================================================
    // IMPONIBILE FISCALE E IRPEF
    // ============================================================
    const compI = voci.filter(v => v.I).reduce((s, v) => s + (v.competenza || 0), 0);
    const imponibileFiscale = r2(compI - contributiIvs - contributoAggiuntivo - trattFondi - fpDip);

    // reddito annuo di riferimento (per aliquote/detrazioni)
    const redditoAnnuo = input.redditoAnnuoPresunto
      || r2(el.totale * cc.mensilita * ((emp.percPartTime || 100) / 100) * (1 - aliqDip / 100));

    const irpefLordaMese = r2(irpefLordaAnnua(params, anno, imponibileFiscale * 12) / 12);
    const ggDetrazione = (input.giorniDetrazione != null) ? input.giorniDetrazione : ggMese;
    const detrLavAnnua = detrazioneLavoroAnnua(params, redditoAnnuo, 365, emp.tempoDeterminato);
    const detrLavMese = r2(detrLavAnnua * ggDetrazione / 365);
    const ultDetrAnnua = ulterioreDetrazioneAnnua(params, redditoAnnuo, 365);
    const ultDetrMese = r2(ultDetrAnnua * ggDetrazione / 365);
    const detrTot = r2(detrLavMese + ultDetrMese + (input.altreDetrazioni || 0));
    const irpefNettaMese = r2(Math.max(0, irpefLordaMese - detrTot));

    // somma integrativa (RC ≤ 20.000) — competenza esente
    const siPct = sommaIntegrativaPct(params, redditoAnnuo);
    let sommaIntegr = 0;
    if (siPct > 0) {
      sommaIntegr = r2(imponibileFiscale * siPct / 100);
      add({ cod: 'F09586', descr: `Indennita' L.207/24 (${siPct}%)`, competenza: sommaIntegr, C:0, I:0, T:0, N:1 });
    }
    // trattamento integrativo (RC ≤ 15.000, salvo conguaglio)
    let trattIntegr = 0;
    if (redditoAnnuo <= 15000 && irpefLordaAnnua(params, anno, redditoAnnuo) > detrLavAnnua) {
      trattIntegr = r2(params.irpef.trattamentoIntegrativo * ggDetrazione / 365);
      add({ cod: 'F09585', descr: 'Tratt. integrativo L.21/2020', competenza: trattIntegr, C:0, I:0, T:0, N:1 });
    }

    add({ cod: 'F02000', descr: 'Imponibile IRPEF', base: imponibileFiscale, figurativa: true });
    add({ cod: 'F02010', descr: 'IRPEF lorda', base: irpefLordaMese, figurativa: true });
    if (detrTot > 0) add({ cod: 'F02500', descr: 'Detrazioni lav.dip.', base: detrTot, figurativa: true });
    add({ cod: 'F03020', descr: 'Ritenute IRPEF', trattenuta: irpefNettaMese });

    // ============================================================
    // ADDIZIONALI (rate da conguaglio anno precedente)
    // ============================================================
    let rataReg = input.rataAddRegionale || 0;
    let rataCom = input.rataAddComunale || 0;
    let rataAccCom = input.rataAccontoComunale || 0;
    if (rataReg > 0)   add({ cod: 'F09610', descr: `Rata add.reg. ${params.addizionali.regionale.nome}`, trattenuta: r2(rataReg) });
    if (rataCom > 0)   add({ cod: 'F09620', descr: `Rata add.com. ${params.addizionali.comunale.nome}`, trattenuta: r2(rataCom) });
    if (rataAccCom > 0) add({ cod: 'F09630', descr: 'Rata acconto add.com.', trattenuta: r2(rataAccCom) });

    // ============================================================
    // CONGUAGLIO DI FINE ANNO (dicembre o cessazione)
    // ============================================================
    let conguaglio = null;
    const fareConguaglio = input.conguaglio != null ? input.conguaglio : (mese === 12 || input.cessazione);
    if (fareConguaglio) {
      const impFiscAnnuo = r2(storico.reduce((s, b) => s + (b.imponibileFiscale || 0), 0) + imponibileFiscale);
      const irpefTrattenuta = r2(storico.reduce((s, b) => s + (b.irpefNetta || 0), 0));
      const ggAnno = Math.min(365, (storico.length + 1) * 30.42 | 0, 365);
      const ggDetrAnno = input.giorniDetrazioneAnno || Math.min(365, Math.round((storico.length + 1) * (365 / 12)));
      const lordaAnnua = irpefLordaAnnua(params, anno, impFiscAnnuo);
      const detrAnnua = r2(detrazioneLavoroAnnua(params, impFiscAnnuo, ggDetrAnno, emp.tempoDeterminato)
        + ulterioreDetrazioneAnnua(params, impFiscAnnuo, ggDetrAnno));
      const nettaAnnua = r2(Math.max(0, lordaAnnua - detrAnnua));
      const diff = r2(nettaAnnua - irpefTrattenuta - irpefNettaMese);
      if (Math.abs(diff) >= 0.01) {
        if (diff > 0) add({ cod: 'F04000', descr: 'Conguaglio IRPEF a debito', trattenuta: diff });
        else add({ cod: 'F04010', descr: 'Conguaglio IRPEF a credito', competenza: -diff, C:0, I:0, T:0, N:1 });
      }
      const addReg = addizionaleRegionale(params, impFiscAnnuo);
      const addCom = addizionaleComunale(params, impFiscAnnuo);
      conguaglio = { impFiscAnnuo, lordaAnnua, detrAnnua, nettaAnnua,
                     // dopo il conguaglio la ritenuta dell'anno coincide con l'imposta netta
                     // dovuta, sia che il conguaglio risulti a debito sia a credito (rimborso)
                     irpefTrattenutaAnno: r2(irpefTrattenuta + irpefNettaMese + diff),
                     conguaglioIrpef: diff, addRegionaleDovuta: addReg, addComunaleDovuta: addCom,
                     accontoComunale: r2(addCom * params.addizionali.comunale.acconto / 100), giorniDetrazione: ggDetrAnno };
      if (input.cessazione) {
        // addizionali trattenute in unica soluzione a cessazione
        if (addReg > 0) add({ cod: 'F09611', descr: `Add.reg. ${params.addizionali.regionale.nome} (cessazione)`, trattenuta: addReg });
        if (addCom > 0) add({ cod: 'F09621', descr: `Add.com. ${params.addizionali.comunale.nome} (cessazione)`, trattenuta: addCom });
      }
    }

    // ============================================================
    // TOTALI E NETTO
    // ============================================================
    const totCompetenze = r2(voci.filter(v => !v.figurativa).reduce((s, v) => s + (v.competenza || 0), 0));
    const totTrattenute = r2(voci.reduce((s, v) => s + (v.trattenuta || 0), 0));
    let netto = r2(totCompetenze - totTrattenute);
    // arrotondamento all'euro con riporto
    let arrPrec = input.arrotondamentoPrecedente || 0;
    let arrAttuale = 0;
    if (arrPrec) add({ cod: 'ZP9960', descr: 'Arrotond. mese pr.', trattenuta: arrPrec > 0 ? arrPrec : undefined, competenza: arrPrec < 0 ? -arrPrec : undefined, C:0,I:0,T:0,N:1 });
    let nettoConRiporto = r2(netto - arrPrec);
    if (params.arrotondamentoNetto) {
      const nettoArr = Math.round(nettoConRiporto);
      arrAttuale = r2(nettoArr - nettoConRiporto);
      nettoConRiporto = nettoArr;
    }

    // ============================================================
    // RATEI FERIE/PERMESSI
    // ============================================================
    const contaMese = meseMaturaRateo(emp, anno, mese);
    const ferieMat = contaMese ? r5(cc.ferieGiorniAnno * ((emp.percPartTime || 100) / 100) / 12) : 0;
    const rolMat = contaMese ? r5((emp.rolOreAnno || cc.rolOreAnno) * ((emp.percPartTime || 100) / 100) / 12) : 0;
    const exFestMat = contaMese ? r5(cc.exFestivitaOreAnno * ((emp.percPartTime || 100) / 100) / 12) : 0;
    const prev = ultimoStorico(storico);
    const ratei = {
      ferie:  rateo(prev ? prev.ratei && prev.ratei.ferie : null,  emp.ferieResidueIniziali,  ferieMat, input.ferieGodute || 0),
      rol:    rateo(prev ? prev.ratei && prev.ratei.rol : null,    emp.rolResidueIniziali,    rolMat, input.rolGodute || 0),
      exFest: rateo(prev ? prev.ratei && prev.ratei.exFest : null, emp.exFestResidueIniziali, exFestMat, input.exFestGodute || 0)
    };

    // ---------- progressivi ----------
    const progressivi = {
      impInps: r2(progInps + imponibileInps),
      impIrpef: r2(storico.reduce((s, b) => s + (b.imponibileFiscale || 0), 0) + imponibileFiscale),
      irpefPagata: r2(storico.reduce((s, b) => s + (b.irpefNetta || 0), 0) + irpefNettaMese
        + (conguaglio ? Math.max(0, conguaglio.conguaglioIrpef) : 0)),
      contributi: r2(storico.reduce((s, b) => s + (b.contributiDip || 0), 0) + contributiIvs + contributoAggiuntivo),
      tfrAnno: r2(storico.reduce((s, b) => s + (b.quotaTfrNetta || 0), 0) + quotaTfrNetta)
    };

    // ---------- costo azienda (prospetto) ----------
    const inailTasso = company.inailTasso || 0;   // per mille
    const costoAzienda = {
      contributiInps: r2(imponibileInps * (params.inps.aliquotaDatoreCommercio) / 100),
      inail: r2(imponibileInps * inailTasso / 1000),
      quotaTfr: quotaTfrNetta,
      quasAzienda: (liv === 'QUADRO' && emp.quas) ? r2((params.fondi.quas.aziendaAnnuoPerAnno[anno] || 390) / 12) : 0,
      quadriforAzienda: (liv === 'QUADRO' && emp.quadrifor !== false) ? r2(params.fondi.quadrifor.aziendaAnnuo / 12) : 0,
      estAzienda: (liv !== 'QUADRO' && emp.fondoEst !== false) ? params.fondi.est.aziendaMensile : 0,
      fondoPensioneAzienda: fpAzienda,
      buoniPasto: bpTotale
    };
    costoAzienda.totale = r2(totCompetenze + costoAzienda.contributiInps + costoAzienda.inail
      + costoAzienda.quotaTfr + costoAzienda.quasAzienda + costoAzienda.quadriforAzienda
      + costoAzienda.estAzienda + costoAzienda.fondoPensioneAzienda);

    return {
      anno, mese, dataRef, ggMese,
      elementi: el, voci,
      imponibileInps, aliquotaDip: aliqDip,
      contributiDip: r2(contributiIvs + contributoAggiuntivo),
      contributiIvs, contributoAggiuntivo, trattFondi, fpDip,
      imponibileFiscale, irpefLorda: irpefLordaMese,
      detrazioni: detrTot, irpefNetta: irpefNettaMese,
      sommaIntegrativa: sommaIntegr, trattamentoIntegrativo: trattIntegr,
      redditoAnnuoRiferimento: redditoAnnuo,
      retribUtileTfr: retribUtileTfrMese, quotaTfrLorda, fap: fapMese, quotaTfrNetta, tfrAFondo,
      rataAddRegionale: rataReg, rataAddComunale: rataCom, rataAccontoComunale: rataAccCom,
      conguaglio, ratei, progressivi, costoAzienda,
      totCompetenze, totTrattenute,
      arrotondamentoPrecedente: arrPrec, arrotondamentoAttuale: arrAttuale,
      netto: nettoConRiporto,
      giorniDetrazione: ggDetrazione
    };
  }

  // mesi di maturazione ratei nell'anno fino al mese indicato (regola del 15)
  function mesiMaturatiNellAnno(emp, anno, meseFino) {
    let n = 0;
    for (let m = 1; m <= meseFino; m++) if (meseMaturaRateo(emp, anno, m)) n++;
    return n;
  }
  function meseMaturaRateo(emp, anno, mese) {
    const ass = new Date(emp.dataAssunzione);
    const iniMese = new Date(anno, mese - 1, 1), fineMese = new Date(anno, mese, 0);
    if (ass > fineMese) return false;
    if (ass >= iniMese && ass.getDate() > 15) return false;
    if (emp.dataCessazione) {
      const ces = new Date(emp.dataCessazione);
      if (ces < iniMese) return false;
      if (ces <= fineMese && ces.getDate() < 15) return false;
    }
    return true;
  }
  // 14ª: matura da luglio anno precedente a giugno anno corrente
  function mesi14Maturati(emp, anno, mese, cessazione) {
    const ass = new Date(emp.dataAssunzione);
    let n = 0;
    const start = new Date(anno - 1, 6, 1);
    const mesi = [];
    for (let i = 0; i < 12; i++) mesi.push(new Date(anno - 1, 6 + i, 1));
    for (const d of mesi) {
      const fineMese = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      if (ass > fineMese) continue;
      if (ass >= d && ass.getDate() > 15) continue;
      if (emp.dataCessazione) {
        const ces = new Date(emp.dataCessazione);
        if (ces < d) continue;
        if (ces <= fineMese && ces.getDate() < 15) continue;
      }
      n++;
    }
    return n;
  }
  function rateo(prevRateo, residuoIniz, maturatoMese, goduto) {
    const residuoAP = prevRateo ? prevRateo.residuoAP : (residuoIniz || 0);
    const matPrec = prevRateo ? prevRateo.maturato : 0;
    const godPrec = prevRateo ? prevRateo.goduto : 0;
    const maturato = r5(matPrec + maturatoMese);
    const godTot = r5(godPrec + goduto);
    return { residuoAP, maturato, goduto: godTot, saldo: r5(residuoAP + maturato - godTot) };
  }
  function ultimoStorico(storico) {
    if (!storico.length) return null;
    return storico.reduce((a, b) => (b.mese > a.mese ? b : a));
  }

  // ============================================================
  // PROSPETTO CU (Certificazione Unica) — voci principali
  // ============================================================
  function prospettoCU(params, emp, anno, buste) {
    const bs = buste.filter(b => b.anno === anno).sort((a, b) => a.mese - b.mese);
    if (!bs.length) return null;
    const sum = (f) => r2(bs.reduce((s, b) => s + (f(b) || 0), 0));
    const ultima = bs[bs.length - 1];
    const cg = bs.map(b => b.conguaglio).filter(Boolean).pop();
    const impFisc = sum(b => b.imponibileFiscale);
    const ggDetr = cg ? cg.giorniDetrazione : Math.min(365, Math.round(bs.length * 365 / 12));
    return {
      anno, dipendente: emp,
      // Punti principali della CU — sezione dati fiscali
      p1_redditoLavoroDipTI: emp.tempoDeterminato ? 0 : impFisc,   // punto 1: t. indeterminato
      p2_redditoLavoroDipTD: emp.tempoDeterminato ? impFisc : 0,   // punto 2: t. determinato
      p6_giorniDetrazione: ggDetr,
      p21_ritenuteIrpef: cg ? cg.irpefTrattenutaAnno : sum(b => b.irpefNetta),
      p22_addRegionale: cg ? cg.addRegionaleDovuta : addizionaleRegionale(params, impFisc),
      p26_addComunale: cg ? cg.addComunaleDovuta : addizionaleComunale(params, impFisc),
      p29_accontoComunale: cg ? cg.accontoComunale : 0,
      irpefLorda: cg ? cg.lordaAnnua : irpefLordaAnnua(params, anno, impFisc),
      p367_detrazioniLavoro: cg ? cg.detrAnnua : detrazioneLavoroAnnua(params, impFisc, ggDetr, emp.tempoDeterminato),
      p390_sommaIntegrativa: sum(b => b.sommaIntegrativa),
      p400_trattIntegrativo: sum(b => b.trattamentoIntegrativo),
      p441_fringeBenefit: sum(b => (b.voci.find(v => v.cod === 'Z00921') || {}).competenza),
      // dati previdenziali
      imponibileInps: sum(b => b.imponibileInps),
      contributiDip: sum(b => b.contributiDip),
      // sanità integrativa (Quas) e previdenza complementare
      contributiSanitaDip: sum(b => (b.voci.find(v => v.cod === 'Z31010' || v.cod === 'Z31000') || {}).trattenuta),
      previdenzaComplDip: sum(b => b.fpDip),
      tfrQuoteAnno: sum(b => b.quotaTfrNetta),
      tfrAFondoPensione: sum(b => b.tfrAFondo),
      totaleCompetenze: sum(b => b.totCompetenze),
      totaleNetto: sum(b => b.netto),
      mesi: bs.map(b => ({ mese: b.mese, imponibileFiscale: b.imponibileFiscale,
        imponibileInps: b.imponibileInps, irpefNetta: b.irpefNetta, netto: b.netto }))
    };
  }

  return {
    DEFAULT_PARAMS,
    pagaBaseAllaData, scattiMaturati, elementiRetribuzione,
    irpefLordaAnnua, detrazioneLavoroAnnua, ulterioreDetrazioneAnnua, sommaIntegrativaPct,
    addizionaleRegionale, addizionaleComunale,
    calcolaBusta, prospettoCU, mesiMaturatiNellAnno, mesi14Maturati,
    _r2: r2
  };
}));
