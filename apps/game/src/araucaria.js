  // araucária adulta, como a de verdade (substitui a do protótipo no build): fuste alto, reto e acinzentado; os
  // galhos saem em verticilos só no terço de cima, sobem em diagonal e viram para o alto na ponta, e as pontas chegam
  // todas à mesma altura. A copa fica um cálice largo e cheio, chato em cima, com as grimpas em pratos grossos
  function araucaria(r, x, y, H) {
    const P = [], E = H / 8, CASCA = [.7, .84, 1.1], R = .22 + .025 * H;
    const ramo = (a, b, r0, r1) => ({ ...gal(a, b, r0, r1, 'casca', 5), tint: CASCA });
    // prato de grimpas: a face de baixo escura dá o volume, a de cima pega a luz
    const VERDE = [.84, .94, 1], prato = (px, py, pz, rx, rz) => { P.push({ ...bol(px, py, pz - rz * .45, rx * .86, rz * .6, 'copaEscura', sd(r), { SG: 10, rugo: .2 }), tint: VERDE }); P.push({ ...bol(px, py, pz, rx, rz, 'agulha', sd(r), { SG: 12, rugo: .22 }), tint: VERDE }); };
    P.push({ ...gal([x, y, 0], [x, y, H * .93], R, R * .5, 'casca', 8), tint: CASCA });
    const topo = H, a0 = r() * 6.3, vs = [[.6, 1, 7], [.69, .84, 7], [.78, .64, 6], [.87, .4, 5]];
    vs.forEach(([fz, fl, nb], v) => {
      const zb = H * fz;
      for (let i = 0; i < nb; i++) {
        const ang = a0 + v * .45 + 2 * Math.PI * i / nb + T(r, -.18, .18), L = (3.7 + .7 * r()) * fl * E, c = Math.cos(ang), s = Math.sin(ang);
        const zt = topo - T(r, 0, .14) * E, p1 = [x + c * L * .62, y + s * L * .62, zb + (zt - zb) * .32], p2 = [x + c * L * .92, y + s * L * .92, zb + (zt - zb) * .72], p3 = [x + c * L, y + s * L, zt];
        P.push(ramo([x, y, zb], p1, .11, .085), ramo(p1, p2, .085, .065), ramo(p2, p3, .065, .05));
        prato(p3[0], p3[1], p3[2], T(r, 1.1, 1.3) * E * (.8 + .2 * fl), T(r, .26, .3) * E);
        // nos galhos de baixo, um tufo menor no meio da curva: a copa ganha corpo por baixo e o topo fica chato
        if (fl > .8) prato(p2[0], p2[1], p2[2], .55 * E, .22 * E);
      }
    });
    // o meio do cálice: pratos mais baixos fecham o centro sem tirar a borda mais alta
    for (let i = 0; i < 4; i++) { const ang = a0 + 2 * Math.PI * (i + .5) / 4, L = 1.1 * E; prato(x + Math.cos(ang) * L, y + Math.sin(ang) * L, topo - .12 * E, 1.15 * E, .26 * E); }
    // galhos secos que ficaram no fuste
    for (let i = 0; i < 3; i++) { const ang = r() * 6.3, z = H * T(r, .4, .55), c = Math.cos(ang), s = Math.sin(ang); P.push(ramo([x, y, z], [x + c * .6, y + s * .6, z - .05], .05, .035), gal([x + c * .6, y + s * .6, z - .05], [x + c * .85, y + s * .85, z - .6], .035, .02, 'madeiraEscura', 4)); }
    return P;
  }
