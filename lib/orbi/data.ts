/* eslint-disable */
// Dados de demonstração (100% locais), portados de prototipo/js/data.js
// @ts-nocheck


  // ---------------------------------------------------------------------------
  // Cidade fictícia: grade de ruas 0..1600 (1 unidade ≈ 3 metros)
  // Ruas verticais ficam em x = 0,100,...,1600 ; horizontais em y = 0,100,...,1600
  // ---------------------------------------------------------------------------
  const VERTICAL_STREETS = [
    'Rua das Acácias', 'Rua dos Ipês', 'Av. Brasil', 'Rua Tiradentes', 'Av. Paulista',
    'Rua XV de Novembro', 'Rua das Flores', 'Rua Sete de Setembro', 'Av. Central',
    'Rua Dom Pedro II', 'Rua Santa Rita', 'Av. das Nações', 'Rua do Comércio',
    'Rua Bela Vista', 'Rua São João', 'Av. Independência', 'Rua das Palmeiras'
  ];
  const HORIZONTAL_STREETS = [
    'Rua Primavera', 'Rua Monte Alegre', 'Av. Santos Dumont', 'Rua Rio Branco',
    'Av. Getúlio Vargas', 'Rua da Paz', 'Rua Barão do Rio', 'Rua Marechal Deodoro',
    'Av. dos Bandeirantes', 'Rua Esperança', 'Rua Boa Vista', 'Av. Liberdade',
    'Rua Coronel Souza', 'Rua das Mangueiras', 'Rua Aurora', 'Av. do Contorno', 'Rua Horizonte'
  ];
  const AVENUE_EVERY = 4; // ruas com índice múltiplo de 4 são avenidas largas

  const DISTRICTS = ['Centro', 'Jardim América', 'Vila Nova', 'Santa Cecília', 'Bela Vista', 'Parque das Árvores', 'Vila Rica'];

  const DEPOT = { name: 'Centro de Distribuição Orbi', street: 'Av. Central', number: '1000', district: 'Centro', x: 800, y: 850 };

  // Catálogo de endereços (usado pelo gestor ao montar novas rotas)
  // Todos ficam sobre ruas verticais (x múltiplo de 100) para o traçado seguir as vias.
  const ADDRESS_BOOK = [
    { x: 300, y: 250 }, { x: 500, y: 450 }, { x: 1100, y: 350 }, { x: 1300, y: 650 },
    { x: 1200, y: 1150 }, { x: 900, y: 1350 }, { x: 400, y: 1250 }, { x: 200, y: 950 },
    { x: 600, y: 650 }, { x: 1000, y: 550 }, { x: 1400, y: 950 }, { x: 700, y: 1150 },
    { x: 1500, y: 250 }, { x: 100, y: 550 }, { x: 800, y: 150 }, { x: 1000, y: 1450 },
    { x: 1300, y: 1450 }, { x: 300, y: 1450 }, { x: 600, y: 250 }, { x: 1200, y: 850 },
    { x: 500, y: 1050 }, { x: 1500, y: 750 }, { x: 900, y: 950 }, { x: 200, y: 750 }
  ].map((p, i) => ({
    id: 'addr' + (i + 1),
    street: VERTICAL_STREETS[p.x / 100],
    number: String(100 + ((i * 137) % 1800)),
    district: DISTRICTS[i % DISTRICTS.length],
    city: 'São Paulo - SP',
    x: p.x,
    y: p.y
  }));

  const RECIPIENTS = [
    ['Mariana Costa', '(11) 98765-4321'], ['Padaria Pão Dourado', '(11) 3344-5566'],
    ['João Pereira', '(11) 99123-4567'], ['Farmácia Vida', '(11) 3222-1100'],
    ['Beatriz Almeida', '(11) 98111-2233'], ['Mercado Bom Preço', '(11) 3555-7788'],
    ['Rafael Gomes', '(11) 97654-3210'], ['Clínica Sorriso', '(11) 3123-4567'],
    ['Juliana Ribeiro', '(11) 99876-5432'], ['Loja Tech House', '(11) 3666-9900'],
    ['Pedro Henrique', '(11) 98222-3344'], ['Livraria Página', '(11) 3777-1122'],
    ['Fernanda Lima', '(11) 99555-6677'], ['Pet Shop Amigo', '(11) 3888-4455'],
    ['Lucas Martins', '(11) 98444-5566'], ['Escritório Alfa', '(11) 3999-0011']
  ];

  const PACKAGES = [
    ['Caixa média · eletrônicos', 2.4], ['Envelope · documentos', 0.3], ['Caixa grande · utilidades', 6.8],
    ['Pacote · roupas', 1.1], ['Caixa pequena · medicamentos', 0.9], ['Fardo · alimentos', 8.5],
    ['Caixa média · livros', 3.2], ['Pacote · acessórios', 0.7]
  ];

  const SKIP_REASONS = ['Destinatário ausente', 'Estabelecimento fechado', 'Via bloqueada ou em obras', 'Outro motivo'];
  const CANCEL_REASONS = ['Cancelado pelo cliente', 'Endereço inexistente ou incorreto', 'Carga avariada', 'Outro motivo'];

  // Contas de demonstração (valores fictícios, só existem neste protótipo)
  const USERS = [
    { id: 'u1', role: 'DRIVER', name: 'Carlos Silva', email: 'motorista@orbi.demo', password: 'orbi123', phone: '(11) 98000-1111', cnh: '0123456789-0', vehicle: 'Fiat Fiorino · ABC-1D23', vehicleInfo: { ownership: 'COMPANY', model: 'Fiat Fiorino', plate: 'ABC-1D23', company: { insurer: 'Seguradora Exemplo (frota)', policy: 'FROTA-2026-0042', phone: '0800 000 1234' }, personal: { insurer: '', policy: '', phone: '' } }, rating: 4.8, ratingsCount: 126, since: '2025-03-10' },
    { id: 'u3', role: 'DRIVER', name: 'Marcos Lima', email: 'marcos@orbi.demo', password: 'orbi123', phone: '(11) 98000-2222', cnh: '9876543210-1', vehicle: 'Renault Kangoo · XYZ-9K87', vehicleInfo: { ownership: 'PERSONAL', model: 'Renault Kangoo', plate: 'XYZ-9K87', company: { insurer: '', policy: '', phone: '' }, personal: { insurer: '', policy: '', phone: '' } }, rating: 4.6, ratingsCount: 88, since: '2025-06-22' },
    { id: 'u4', role: 'DRIVER', name: 'Paula Rocha', email: 'paula@orbi.demo', password: 'orbi123', phone: '(11) 98000-3333', cnh: '5555666677-2', vehicle: 'Honda CG 160 · MOT-4E56', vehicleInfo: { ownership: 'PERSONAL', model: 'Honda CG 160', plate: 'MOT-4E56', company: { insurer: '', policy: '', phone: '' }, personal: { insurer: 'Seguro Moto Demo', policy: 'MT-778812', phone: '0800 000 5678' } }, rating: 4.9, ratingsCount: 203, since: '2024-11-05' },
    { id: 'u2', role: 'ADMIN', name: 'Ana Souza', email: 'gestor@orbi.demo', password: 'orbi123', phone: '(11) 98000-0000', company: 'Orbi Logística', title: 'Gestora de operações' },
    { id: 'u5', role: 'ADMIN', name: 'Roberto Almeida', email: 'empresa@orbi.demo', password: 'orbi123', phone: '(11) 98000-5555', company: 'Orbi Logística', title: 'Diretor da empresa' }
  ];

  const REVIEWS = [
    { driverId: 'u1', stars: 5, text: 'Entregou antes do horário, muito educado!', author: 'Mariana C.' },
    { driverId: 'u1', stars: 5, text: 'Pacote em perfeito estado.', author: 'Farmácia Vida' },
    { driverId: 'u1', stars: 4, text: 'Tudo certo, só ligou um pouco em cima da hora.', author: 'João P.' },
    { driverId: 'u3', stars: 5, text: 'Rápido e atencioso.', author: 'Loja Tech House' },
    { driverId: 'u4', stars: 5, text: 'Excelente!', author: 'Pedro H.' }
  ];

  // ---------------------------------------------------------------------------
  // Montagem das rotas iniciais
  // ---------------------------------------------------------------------------
  let stopSeq = 1;
  function makeStop(addrIdx, recIdx, pkgIdx, status, extra) {
    const a = ADDRESS_BOOK[addrIdx];
    const r = RECIPIENTS[recIdx % RECIPIENTS.length];
    const p = PACKAGES[pkgIdx % PACKAGES.length];
    return Object.assign({
      id: 's' + (stopSeq++),
      recipient: r[0],
      phone: r[1],
      street: a.street, number: a.number, district: a.district, city: a.city,
      x: a.x, y: a.y,
      status: status || 'PENDING',
      reason: null,
      at: null,
      proof: null,
      packages: [{ desc: p[0], weight: p[1] }]
    }, extra || {});
  }

  function minutesAgo(m) { return new Date(Date.now() - m * 60000).toISOString(); }

  function buildRoutes() {
    stopSeq = 1;
    return [
      {
        id: 'r101', code: 'RT-101', driverId: 'u1', status: 'ASSIGNED', window: '08:00 – 12:00',
        createdAt: minutesAgo(600), startedAt: null, finishedAt: null,
        stops: [makeStop(8, 0, 0), makeStop(1, 1, 1), makeStop(0, 2, 2), makeStop(18, 3, 3), makeStop(14, 4, 4), makeStop(9, 5, 5)]
      },
      {
        id: 'r102', code: 'RT-102', driverId: 'u1', status: 'IN_PROGRESS', window: '09:00 – 13:00',
        createdAt: minutesAgo(500), startedAt: minutesAgo(70), finishedAt: null,
        stops: [
          makeStop(22, 6, 6, 'COMPLETED', { at: minutesAgo(55), proof: { receiver: 'Rafael Gomes', doc: '', note: '', photo: true } }),
          makeStop(19, 7, 7, 'SKIPPED', { at: minutesAgo(40), reason: 'Estabelecimento fechado', reportDist: 12 }),
          makeStop(3, 8, 0), makeStop(10, 9, 1), makeStop(4, 10, 2)
        ]
      },
      {
        id: 'r103', code: 'RT-103', driverId: 'u1', status: 'DELAYED', window: '07:00 – 10:00',
        createdAt: minutesAgo(800), startedAt: null, finishedAt: null,
        stops: [makeStop(7, 11, 3), makeStop(23, 12, 4), makeStop(13, 13, 5), makeStop(20, 14, 6)]
      },
      {
        id: 'r099', code: 'RT-099', driverId: 'u1', status: 'COMPLETED', window: 'Ontem · 13:00 – 17:00',
        createdAt: minutesAgo(2000), startedAt: minutesAgo(1700), finishedAt: minutesAgo(1500),
        stops: [
          makeStop(5, 15, 7, 'COMPLETED', { at: minutesAgo(1650), proof: { receiver: 'Recepção', doc: '', note: '', photo: true } }),
          makeStop(15, 0, 1, 'COMPLETED', { at: minutesAgo(1620), proof: { receiver: 'Mariana Costa', doc: '', note: '', photo: false } }),
          makeStop(16, 1, 2, 'CANCELLED', { at: minutesAgo(1590), reason: 'Endereço inexistente ou incorreto', reportDist: 18, comments: [{ by: 'Carlos Silva', role: 'DRIVER', text: 'A rua termina no número 1300, esse número não existe. Confirmei com dois vizinhos.', at: minutesAgo(1585) }, { by: 'Ana Souza', role: 'ADMIN', text: 'Obrigada! Vou pedir ao cliente o endereço correto.', at: minutesAgo(1500) }] }),
          makeStop(11, 2, 3, 'COMPLETED', { at: minutesAgo(1540), proof: { receiver: 'João Pereira', doc: '123.456.789-00', note: 'Deixado na portaria com o Sr. Antônio', photo: true }, reportDist: 9 })
        ]
      },
      {
        id: 'r098', code: 'RT-098', driverId: 'u1', status: 'COMPLETED', window: 'Ontem · 08:00 – 12:00',
        createdAt: minutesAgo(2600), startedAt: minutesAgo(2400), finishedAt: minutesAgo(2250),
        stops: [
          makeStop(2, 3, 4, 'COMPLETED', { at: minutesAgo(2380), proof: { receiver: 'Farmácia Vida', doc: '', note: '', photo: true } }),
          makeStop(12, 4, 5, 'COMPLETED', { at: minutesAgo(2330), proof: { receiver: 'Beatriz Almeida', doc: '', note: '', photo: true } }),
          makeStop(21, 5, 6, 'COMPLETED', { at: minutesAgo(2290), proof: { receiver: 'Mercado Bom Preço', doc: '', note: '', photo: false } })
        ]
      },
      {
        id: 'r104', code: 'RT-104', driverId: 'u3', status: 'IN_PROGRESS', window: '08:30 – 12:30',
        createdAt: minutesAgo(520), startedAt: minutesAgo(90), finishedAt: null,
        stops: [
          makeStop(6, 9, 0, 'COMPLETED', { at: minutesAgo(70), proof: { receiver: 'Loja Tech House', doc: '', note: '', photo: true } }),
          makeStop(17, 10, 1, 'COMPLETED', { at: minutesAgo(45), proof: { receiver: 'Pedro Henrique', doc: '', note: '', photo: true } }),
          makeStop(11, 11, 2), makeStop(15, 12, 3)
        ]
      },
      {
        id: 'r105', code: 'RT-105', driverId: null, status: 'CREATED', window: '14:00 – 18:00',
        createdAt: minutesAgo(30), startedAt: null, finishedAt: null,
        stops: [makeStop(12, 13, 4), makeStop(2, 14, 5), makeStop(10, 15, 6)]
      }
    ];
  }

  function buildNotifications() {
    return [
      { id: 'n1', userId: 'u1', title: 'Nova rota atribuída', text: 'A rota RT-101 foi atribuída a você para hoje (08:00 – 12:00).', at: minutesAgo(600), read: false, link: '#/d/route/r101' },
      { id: 'n2', userId: 'u1', title: 'Rota atrasada', text: 'A rota RT-103 passou da janela de início. Inicie assim que possível.', at: minutesAgo(25), read: false, link: '#/d/route/r103' },
      { id: 'n3', userId: 'u1', title: 'Nova avaliação ⭐ 5', text: '"Entregou antes do horário, muito educado!" — Mariana C.', at: minutesAgo(1400), read: true, link: '#/d/profile' },
      { id: 'n4', userId: 'u2', title: 'Entrega cancelada', text: 'RT-099 · Parada 3 cancelada: Endereço inexistente ou incorreto.', at: minutesAgo(1590), read: true, link: '#/a/route/r099' },
      { id: 'n5', userId: 'u2', title: 'Rota sem motorista', text: 'RT-105 foi criada e ainda não tem motorista atribuído.', at: minutesAgo(30), read: false, link: '#/a/route/r105' }
    ];
  }

  
export const D: any = {
    VERTICAL_STREETS, HORIZONTAL_STREETS, AVENUE_EVERY, DISTRICTS, DEPOT, ADDRESS_BOOK, RECIPIENTS, PACKAGES,
    SKIP_REASONS, CANCEL_REASONS,
    seed() {
      return {
        version: 1,
        resetAt: new Date().toISOString(),
        deletedRoutes: [],
        session: null,
        onboarded: false,
        locationPermission: 'ask', // ask | granted | denied
        settings: { theme: 'auto', offline: false, server: 'demo', mapHeadingUp: true },
        users: JSON.parse(JSON.stringify(USERS)),
        reviews: JSON.parse(JSON.stringify(REVIEWS)),
        routes: buildRoutes(),
        notifications: buildNotifications(),
        syncQueue: [],
        incidents: [],
        chatRead: {},
        chats: {
          r104: [
            { id: 'm1', from: 'u2', role: 'ADMIN', name: 'Ana Souza', text: 'Marcos, a Clínica Sorriso pediu a entrega até as 11h.', kind: 'text', at: minutesAgo(80), meta: null },
            { id: 'm2', from: 'u3', role: 'DRIVER', name: 'Marcos Lima', text: 'Ok, já estou indo para lá.', kind: 'text', at: minutesAgo(78), meta: null }
          ],
          r102: [
            { id: 'm3', from: 'u2', role: 'ADMIN', name: 'Ana Souza', text: 'Bom dia, Carlos! Qualquer imprevisto me avise por aqui.', kind: 'text', at: minutesAgo(75), meta: null }
          ]
        },
        lastSync: new Date().toISOString(),
        routeCounter: 106,
        company: {
          name: 'Orbi Logística Ltda.', cnpj: '00.000.000/0001-00', phone: '(11) 3000-0000', email: 'contato@orbi.demo',
          depot: 'Av. Central, 1000 · Centro · São Paulo - SP',
          goals: { successRate: 92, onTime: 90 },
          fleetInsurance: { insurer: 'Seguradora Exemplo (frota)', policy: 'FROTA-2026-0042', phone: '0800 000 1234' }
        }
      };
    }
  };
