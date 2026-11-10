
// ---- Aves da beira do rio, no mesmo gerador da gente e dos bichos: garça-branca, tapicuru, biguá, quero-quero
// e maritaca. Acrescentado pelo jogo ao fim do gerador do protótipo (que fica como está); cada ave é uma cena a
// mais em SPR3D_GENTE.CENAS, desenhada com a mesma luz. q é o quadro: passo ou batida de asa.
(function (raiz) {
  'use strict';
  const G = raiz.SPR3D_GENTE;
  if (!G) return;
  const C = (r, g, b) => [r / 235, g / 235, b / 235];
  const L = (c) => ({ mat: 'liso', tint: c });
  const gal = (a, b, r0, r1, o) => ({ c: 'galho', a, b, r0, r1, SG: 6, ...o });
  const bol = (x, y, z, rx, ry, rz, o) => ({ c: 'bolha', x, y, z, rx, ry, rz, AN: 4, SG: 9, rugo: 0, seed: 3, ...o });
  const X = 5, Y = 5;
  // pernas finas; no passo uma vai à frente e a outra atrás
  function pernas(P, alt, larg, r, cor, q, passo) {
    const s = q ? 1 : -1;
    for (const l of [1, -1]) {
      const f = passo * (l === 1 ? s : -s), pe = [X + f, Y + l * larg, 0], joelho = [X + f * .5 + .02, Y + l * larg, alt * .5];
      P.push(gal([X - .02, Y + l * larg, alt], joelho, r, r * .9, L(cor)), gal(joelho, pe, r * .9, r * .8, L(cor)), gal(pe, [pe[0] + .1, pe[1], .01], r * .7, r * .5, L(cor)));
    }
  }
  // asas abertas em voo: braço e mão, para cima ou para baixo conforme o quadro
  function asas(P, z, env, larg, cor, ponta, q) {
    const up = q ? 1 : -1;
    for (const l of [1, -1]) {
      const om = [X, Y + l * larg * .2, z], cot = [X - .05, Y + l * env * .5, z + up * env * .18], mao = [X - .2, Y + l * env, z + up * env * .42];
      P.push(gal(om, cot, larg * .4, larg * .35, { ...L(cor), SG: 8 }), gal(cot, mao, larg * .35, larg * .15, { ...L(ponta || cor), SG: 8 }));
      // a membrana: larga junto ao corpo, afinando para a ponta
      P.push(bol(X - .1, Y + l * env * .3, z + up * env * .09, larg * 1.5, env * .3, .03, L(cor)), bol(X - .2, Y + l * env * .72, z + up * env * .3, larg * 1.1, env * .3, .025, L(ponta || cor)));
    }
  }

  // garça-branca-grande: alta, pescoço em S, bico amarelo, pernas pretas
  const BRANCO = C(248, 246, 238), BICO_G = C(232, 182, 56), PERNA_G = C(44, 42, 38);
  function garca(q, bica) {
    const P = [];
    pernas(P, .78, .07, .035, PERNA_G, q, .12);
    P.push(bol(X - .04, Y, .98, .4, .21, .24, L(BRANCO)), gal([X - .34, Y, .96], [X - .56, Y, .88], .12, .05, L(BRANCO)));
    if (bica) {
      P.push(gal([X + .26, Y, 1.02], [X + .48, Y, .8], .08, .06, L(BRANCO)), gal([X + .48, Y, .8], [X + .6, Y, .5], .06, .055, L(BRANCO)), bol(X + .64, Y, .46, .09, .07, .08, L(BRANCO)), gal([X + .68, Y, .42], [X + .78, Y, .16], .03, .01, L(BICO_G)));
    } else {
      P.push(gal([X + .26, Y, 1.04], [X + .12, Y, 1.34], .08, .06, L(BRANCO)), gal([X + .12, Y, 1.34], [X + .3, Y, 1.62], .06, .055, L(BRANCO)), bol(X + .34, Y, 1.65, .1, .07, .075, L(BRANCO)), gal([X + .42, Y, 1.64], [X + .72, Y, 1.6], .032, .01, L(BICO_G)));
    }
    return P;
  }
  function garcaVoo(q, z) {
    const P = [];
    P.push(bol(X, Y, z, .36, .17, .17, L(BRANCO)), gal([X + .3, Y, z + .04], [X + .42, Y, z + .14], .09, .07, L(BRANCO)), bol(X + .46, Y, z + .14, .1, .07, .075, L(BRANCO)), gal([X + .54, Y, z + .13], [X + .82, Y, z + .1], .03, .01, L(BICO_G)));
    for (const l of [1, -1]) P.push(gal([X - .3, Y + l * .05, z - .04], [X - 1.05, Y + l * .05, z - .1], .03, .025, L(PERNA_G)));
    asas(P, z + .05, 1.25, .2, BRANCO, C(232, 230, 220), q);
    return P;
  }

  // tapicuru (tapicuru-de-cara-pelada): escuro com brilho verde, bico longo e curvo cor de carne
  const TAPI = C(50, 56, 44), TAPI_BRILHO = C(74, 96, 62), BICO_T = C(196, 122, 104), CARA = C(200, 140, 124);
  function tapicuru(q, bica) {
    const P = [];
    pernas(P, .42, .06, .028, C(150, 104, 96), q, .1);
    P.push(bol(X - .04, Y, .56, .3, .15, .15, L(TAPI)), bol(X - .1, Y, .6, .22, .155, .1, L(TAPI_BRILHO)), gal([X - .28, Y, .56], [X - .48, Y, .5], .1, .03, L(TAPI)));
    if (bica) {
      P.push(gal([X + .22, Y, .58], [X + .36, Y, .42], .07, .055, L(TAPI)), bol(X + .4, Y, .38, .075, .06, .06, L(CARA)), gal([X + .45, Y, .34], [X + .56, Y, .2], .025, .02, L(BICO_T)), gal([X + .56, Y, .2], [X + .58, Y, .02], .02, .01, L(BICO_T)));
    } else {
      P.push(gal([X + .22, Y, .6], [X + .3, Y, .8], .07, .055, L(TAPI)), bol(X + .34, Y, .84, .075, .06, .065, L(TAPI)), bol(X + .38, Y, .84, .05, .045, .04, L(CARA)), gal([X + .42, Y, .83], [X + .6, Y, .76], .025, .02, L(BICO_T)), gal([X + .6, Y, .76], [X + .7, Y, .6], .02, .01, L(BICO_T)));
    }
    return P;
  }
  function tapicuruVoo(q, z) {
    const P = [];
    P.push(bol(X, Y, z, .28, .13, .13, L(TAPI)), gal([X + .24, Y, z + .02], [X + .42, Y, z + .04], .06, .05, L(TAPI)), bol(X + .46, Y, z + .04, .07, .055, .06, L(CARA)), gal([X + .5, Y, z + .03], [X + .7, Y, z - .02], .022, .018, L(BICO_T)), gal([X + .7, Y, z - .02], [X + .78, Y, z - .14], .018, .01, L(BICO_T)));
    for (const l of [1, -1]) P.push(gal([X - .24, Y + l * .04, z - .04], [X - .62, Y + l * .04, z - .06], .022, .018, L(C(150, 104, 96))));
    asas(P, z + .04, .8, .16, TAPI, TAPI_BRILHO, q);
    return P;
  }

  // biguá: preto, nada baixo com o pescoço em pé e o bico em gancho
  const BIGUA = C(34, 32, 30), BICO_B = C(150, 132, 92);
  function bigua(q) {
    const P = [], r = q ? .02 : 0;
    P.push(bol(X - .04, Y, .06 + r, .4, .16, .1, L(BIGUA)), gal([X - .36, Y, .1 + r], [X - .6, Y, .16 + r], .07, .03, L(BIGUA)));
    P.push(gal([X + .28, Y, .1 + r], [X + .36, Y, .5 + r], .07, .055, L(BIGUA)), bol(X + .4, Y, .54 + r, .08, .065, .07, L(BIGUA)), gal([X + .46, Y, .53 + r], [X + .66, Y, .49 + r], .025, .015, L(BICO_B)));
    return P;
  }
  function biguaVoo(q, z) {
    const P = [];
    P.push(bol(X, Y, z, .34, .13, .12, L(BIGUA)), gal([X + .28, Y, z + .02], [X + .62, Y, z + .06], .065, .05, L(BIGUA)), bol(X + .66, Y, z + .06, .075, .06, .065, L(BIGUA)), gal([X + .72, Y, z + .05], [X + .9, Y, z + .02], .022, .012, L(BICO_B)), gal([X - .3, Y, z], [X - .62, Y, z - .02], .09, .03, L(BIGUA)));
    asas(P, z + .03, .95, .16, BIGUA, C(56, 52, 46), q);
    return P;
  }

  // quero-quero: dorso pardo, peito preto, barriga branca, topete e pernas rosadas
  const PARDO = C(150, 140, 122), PEITO = C(32, 32, 30), BARRIGA = C(240, 236, 226), PERNA_Q = C(200, 104, 104);
  function queroquero(q) {
    const P = [];
    pernas(P, .32, .05, .022, PERNA_Q, q, .07);
    P.push(bol(X - .02, Y, .44, .22, .12, .12, L(PARDO)), bol(X + .02, Y, .38, .17, .1, .08, L(BARRIGA)), bol(X + .12, Y, .46, .09, .1, .1, L(PEITO)), gal([X - .2, Y, .44], [X - .34, Y, .42], .07, .03, L(PEITO)));
    P.push(bol(X + .2, Y, .62, .075, .065, .07, L(PARDO)), gal([X + .14, Y, .68], [X + .02, Y, .74], .015, .01, L(PEITO)), gal([X + .26, Y, .61], [X + .36, Y, .6], .018, .01, L(C(180, 70, 70))));
    return P;
  }
  function queroqueroVoo(q, z) {
    const P = [];
    P.push(bol(X, Y, z, .2, .1, .1, L(PARDO)), bol(X + .2, Y, z + .04, .07, .06, .065, L(PARDO)), gal([X + .26, Y, z + .03], [X + .36, Y, z + .02], .018, .01, L(C(180, 70, 70))));
    asas(P, z + .03, .62, .12, PARDO, PEITO, q);
    return P;
  }

  // maritaca: verde, cauda curta, em bando
  const VERDE = C(78, 150, 62), VERDE2 = C(58, 120, 48);
  function maritaca(q, z) {
    const P = [];
    P.push(bol(X, Y, z, .18, .1, .1, L(VERDE)), bol(X + .17, Y, z + .04, .075, .065, .07, L(C(92, 140, 120))), gal([X + .23, Y, z + .03], [X + .29, Y, z], .03, .015, L(C(220, 200, 150))), gal([X - .16, Y, z], [X - .34, Y, z - .02], .06, .025, L(C(180, 60, 50))));
    asas(P, z + .03, .5, .1, VERDE, VERDE2, q);
    return P;
  }

  // em voo: a ave vai no alto do modelo, para a sombra cair no chão onde deve; V1 é o voo baixo da subida e da descida
  Object.assign(G.CENAS, {
    garca: (q) => garca(q, false), garcaB: () => garca(0, true), garcaV: (q) => garcaVoo(q, 2.6), garcaV1: (q) => garcaVoo(q, 1.1),
    tapicuru: (q) => tapicuru(q, false), tapicuruB: () => tapicuru(0, true), tapicuruV: (q) => tapicuruVoo(q, 2.2), tapicuruV1: (q) => tapicuruVoo(q, 1),
    bigua: (q) => bigua(q), biguaV: (q) => biguaVoo(q, 1.6), biguaV1: (q) => biguaVoo(q, .8),
    queroquero: (q) => queroquero(q), queroqueroV: (q) => queroqueroVoo(q, 1.2), queroqueroV1: (q) => queroqueroVoo(q, .6),
    maritaca: (q) => maritaca(q, 3.2),
  });
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
