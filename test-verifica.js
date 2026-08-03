/* Verifica indipendente dei calcoli del motore buste paga.
 * Esegui con: node test-verifica.js
 * Le attese sono ricalcolate a mano con formule scritte in modo indipendente. */
'use strict';
const E = require('./payroll-engine.js');
const P = JSON.parse(JSON.stringify(E.DEFAULT_PARAMS));

let ok = 0, ko = 0;
function eq(nome, avuto, atteso, tol = 0.02) {
  const pass = Math.abs(avuto - atteso) <= tol;
  console.log(`${pass ? '  OK ' : '  ERR'} ${nome}: atteso ${atteso} — ottenuto ${avuto}`);
  pass ? ok++ : ko++;
}

const azienda = { ragioneSociale: 'AZIENDA DI PROVA', dimensione: 'fino5', inailTasso: 5 };

console.log('== TEST 1: elementi retributivi Quadro — riscontro LUL reale (Savills 05/2025) ==');
{
  const emp = { livello: 'QUADRO', dataAssunzione: '2024-04-02', retribuzioneMensile: 4585.71, terzoElemento: 11.36 };
  const el = E.elementiRetribuzione(P, emp, '2025-05-01');
  eq('paga base 05/2025', el.pagaBase, 2122.33, 0.001);
  eq('contingenza', el.contingenza, 540.37, 0.001);
  eq('indennità funzione', el.indennitaFunzione, 260.76, 0.001);
  eq('retribuzione oraria (/168)', el.oraria, 27.29589, 0.0001);   // identica al LUL reale
  eq('retribuzione giornaliera (/26)', el.giornaliera, 176.37346, 0.0001); // identica al LUL reale
}

console.log('== TEST 2: busta LUGLIO 2026 — Quadro al minimo contrattuale, con 14ª ==');
{
  const emp = { livello: 'QUADRO', dataAssunzione: '2026-01-01', quas: true, quadrifor: true, iscrittoPost96: true };
  const inp = { anno: 2026, mese: 7, giorniRetribuiti: 26, giorniLavorati: 22, oreLavorate: 176, giorniDetrazione: 31 };
  const c = E.calcolaBusta(P, azienda, emp, inp, []);

  // --- attese calcolate a mano ---
  const minimo = 2183.09 + 540.37 + 2.07 + 260.76;               // 2986.29
  eq('retribuzione mensile', c.elementi.totale, 2986.29, 0.001);
  const q14 = Math.round(minimo * 6 / 12 * 100) / 100;           // 14ª: 6 mesi (gen-giu 2026) = 1493.15
  eq('quattordicesima (6/12)', (c.voci.find(v => v.cod === '0501') || {}).competenza, q14, 0.01);
  const lordo = minimo + q14;                                     // 4479.44
  eq('totale competenze', c.totCompetenze, 4479.44, 0.01);
  const impInps = Math.round(lordo);                               // 4479
  eq('imponibile INPS (arrot. unità)', c.imponibileInps, impInps, 0);
  const aliq = 9.19 + 0.1667;                                      // fino a 5 dip → FIS 0,1667
  const contrib = Math.round(impInps * aliq) / 100;                // 419.09
  eq('contributi c/dip 9,3567%', c.contributiIvs, 419.09, 0.01);
  eq('Qu.A.S. c/dip (56/12)', (c.voci.find(v => v.cod === '5101') || {}).trattenuta, 4.67, 0.01);
  eq('Quadrifor c/dip (25/12)', (c.voci.find(v => v.cod === '5102') || {}).trattenuta, 2.08, 0.01);
  const impFisc = Math.round((lordo - 419.09 - 4.67 - 2.08) * 100) / 100;  // 4053.60
  eq('imponibile fiscale', c.imponibileFiscale, 4053.60, 0.01);
  // IRPEF 2026: 23% fino 28k, 33% 28-50k su base annualizzata
  const annuo = impFisc * 12;                                      // 48643.20
  const lordaAnnua = 28000 * 0.23 + (annuo - 28000) * 0.33;        // 13252.26
  eq('IRPEF lorda mese', c.irpefLorda, Math.round(lordaAnnua / 12 * 100) / 100, 0.01);
  // reddito annuo di riferimento (per detrazioni): mensile×14 al netto contributi
  const rc = Math.round(2986.29 * 14 * (1 - aliq / 100) * 100) / 100;  // ≈ 37896.19
  eq('reddito annuo riferimento', c.redditoAnnuoRiferimento, rc, 0.5);
  const detrA = 1910 * (50000 - rc) / 22000;                       // fascia 28-50k
  const ultA = 1000 * (40000 - rc) / 8000;                         // ulteriore detr. 32-40k
  const detrMese = Math.round(detrA * 31 / 365 * 100) / 100 + Math.round(ultA * 31 / 365 * 100) / 100;
  eq('detrazioni mese', c.detrazioni, Math.round(detrMese * 100) / 100, 0.02);
  const irpefN = Math.round((lordaAnnua / 12 - detrMese) * 100) / 100;
  eq('IRPEF netta mese', c.irpefNetta, irpefN, 0.03);
  // TFR
  eq('quota TFR lorda (lordo/13,5)', c.quotaTfrLorda, Math.round(lordo / 13.5 * 100) / 100, 0.01);
  eq('FAP 0,50%', c.fap, Math.round(impInps * 0.5) / 100, 0.01);
  // netto
  const trattTot = 419.09 + 4.67 + 2.08 + irpefN;
  const nettoTeorico = lordo - trattTot;
  eq('netto (arrotondato all\'euro)', c.netto, Math.round(nettoTeorico), 0.51);
  // netto = competenze − trattenute + arrotondamento (a pareggio dell'euro)
  eq('quadratura competenze-trattenute-netto', c.totCompetenze - c.totTrattenute + c.arrotondamentoAttuale, c.netto, 0.011);
}

console.log('== TEST 3: buoni pasto elettronici 2026 — esenzione 10 €, eccedenza imponibile ==');
{
  const emp = { livello: 'QUADRO', dataAssunzione: '2026-01-01' };
  const inp = { anno: 2026, mese: 3, giorniRetribuiti: 26, giorniLavorati: 20, oreLavorate: 160,
    giorniDetrazione: 31, buoniPastoGiorni: 20, buoniPastoValore: 12, buoniPastoTipo: 'elettronico' };
  const c = E.calcolaBusta(P, azienda, emp, inp, []);
  const bpEsente = c.voci.find(v => v.cod === '0140'), bpEcc = c.voci.find(v => v.cod === '0141');
  eq('BP quota esente 20×10', bpEsente.competenza, 200, 0.01);
  eq('BP eccedenza 20×2', bpEcc.competenza, 40, 0.01);
  eq('eccedenza nell\'imponibile INPS', c.imponibileInps, Math.round(2986.29 + 40), 0);
}

console.log('== TEST 4: dicembre — 13ª e conguaglio IRPEF su storico annuo ==');
{
  const emp = { livello: 'QUADRO', dataAssunzione: '2026-01-01', quas: true, quadrifor: true };
  const storico = [];
  for (let m = 1; m <= 11; m++) {
    const inp = { anno: 2026, mese: m, giorniRetribuiti: 26, giorniLavorati: 21, oreLavorate: 168,
      giorniDetrazione: new Date(2026, m, 0).getDate() };
    storico.push(E.calcolaBusta(P, azienda, emp, inp, storico));
  }
  const dic = E.calcolaBusta(P, azienda, emp,
    { anno: 2026, mese: 12, giorniRetribuiti: 26, giorniLavorati: 22, oreLavorate: 176, giorniDetrazione: 31 }, storico);
  const v13 = dic.voci.find(v => v.cod === '0500');
  // 13ª calcolata sulla retribuzione di dicembre, che include la tranche CCNL 1/11/2026
  // (paga base 2.249,37): 2.249,37+540,37+2,07+260,76 = 3.052,57
  eq('13ª piena (12/12) su retribuzione dicembre', v13.competenza, 3052.57, 0.01);
  eq('conguaglio presente', dic.conguaglio ? 1 : 0, 1, 0);
  // coerenza: IRPEF annua da conguaglio = lorda(imponibile annuo) − detrazioni effettive
  const cg = dic.conguaglio;
  const attesaLorda = E.irpefLordaAnnua(P, 2026, cg.impFiscAnnuo);
  eq('IRPEF lorda annua conguaglio', cg.lordaAnnua, attesaLorda, 0.01);
  eq('IRPEF trattenuta anno = netta annua', cg.irpefTrattenutaAnno, cg.nettaAnnua, 0.02);
  // imponibile annuo = 12 mensilità + 13ª + 14ª al netto contributi/fondi
  console.log(`     imponibile annuo ${cg.impFiscAnnuo}, IRPEF netta annua ${cg.nettaAnnua}, add.reg ${cg.addRegionaleDovuta}, add.com ${cg.addComunaleDovuta}`);
  // addizionale regionale FVG: 1,23% sull'intero imponibile (oltre 15.000)
  eq('add. regionale FVG 1,23%', cg.addRegionaleDovuta, Math.round(cg.impFiscAnnuo * 1.23) / 100, 0.02);
  eq('add. comunale 0,50%', cg.addComunaleDovuta, Math.round(cg.impFiscAnnuo * 0.50) / 100, 0.02);
  // ratei a dicembre: ferie 26 gg, ROL 72 h, ex-fest 32 h maturati interi
  eq('ferie maturate anno', dic.ratei.ferie.maturato, 26, 0.01);
  eq('ROL maturato anno', dic.ratei.rol.maturato, 72, 0.01);
  eq('ex-festività maturate anno', dic.ratei.exFest.maturato, 32, 0.01);
}

console.log('== TEST 5: massimale contributivo e contributo aggiuntivo 1% (retribuzioni alte) ==');
{
  const emp = { livello: 'QUADRO', dataAssunzione: '2020-01-01', retribuzioneMensile: 9000,
    iscrittoPost96: true, quas: false, quadrifor: false, scattiManuali: 0 };
  const storico = [];
  for (let m = 1; m <= 11; m++) {
    const inp = { anno: 2026, mese: m, giorniRetribuiti: 26, giorniLavorati: 21, oreLavorate: 168,
      giorniDetrazione: new Date(2026, m, 0).getDate() };
    storico.push(E.calcolaBusta(P, azienda, emp, inp, storico));
  }
  const dic = E.calcolaBusta(P, azienda, emp,
    { anno: 2026, mese: 12, giorniRetribuiti: 26, giorniLavorati: 22, oreLavorate: 176, giorniDetrazione: 31 }, storico);
  const progInps = dic.progressivi.impInps;
  console.log(`     progressivo INPS a dicembre: ${progInps} (massimale 122295)`);
  eq('massimale rispettato', progInps <= 122295 ? 1 : 0, 1, 0);
  const conAgg = storico.concat([dic]).reduce((s, b) => s + b.contributoAggiuntivo, 0);
  console.log(`     contributo aggiuntivo 1% totale anno: ${Math.round(conAgg * 100) / 100}`);
  eq('contributo aggiuntivo presente su retribuzione alta', conAgg > 0 ? 1 : 0, 1, 0);
}

console.log('== TEST 6: prospetto CU — quadratura con le buste dell\'anno ==');
{
  const emp = { livello: 'QUADRO', dataAssunzione: '2026-01-01', quas: true, quadrifor: true };
  const bs = [];
  for (let m = 1; m <= 12; m++) {
    const inp = { anno: 2026, mese: m, giorniRetribuiti: 26, giorniLavorati: 21, oreLavorate: 168,
      giorniDetrazione: new Date(2026, m, 0).getDate() };
    bs.push(E.calcolaBusta(P, azienda, emp, inp, bs));
  }
  const cu = E.prospettoCU(P, emp, 2026, bs);
  const sommaImp = bs.reduce((s, b) => s + b.imponibileFiscale, 0);
  eq('CU punto 1 = somma imponibili', cu.p1_redditoLavoroDipTI, Math.round(sommaImp * 100) / 100, 0.02);
  const cg = bs[11].conguaglio;
  eq('CU ritenute = IRPEF conguagliata', cu.p21_ritenuteIrpef, cg.irpefTrattenutaAnno, 0.02);
  eq('CU add.regionale = dovuta conguaglio', cu.p22_addRegionale, cg.addRegionaleDovuta, 0.01);
  eq('CU quote TFR = somma quote mensili', cu.tfrQuoteAnno,
    Math.round(bs.reduce((s, b) => s + b.quotaTfrNetta, 0) * 100) / 100, 0.02);
  console.log(`     CU: reddito ${cu.p1_redditoLavoroDipTI}, ritenute ${cu.p21_ritenuteIrpef}, gg detrazione ${cu.p6_giorniDetrazione}`);
}

console.log(`\n===== RISULTATO: ${ok} verifiche superate, ${ko} fallite =====`);
process.exit(ko ? 1 : 0);
