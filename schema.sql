-- ============================================================
-- SISTEMA MG — SCHEMA COMPLETO v1.0
-- Execute no Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type perfil_tipo as enum ('gestor', 'escritorio', 'encarregado', 'funcionario');
create type equipe_tipo as enum ('ARMAÇÃO', 'CARPINTARIA');
create type tipo_passagem as enum ('PRA FRENTE', 'REEMBOLSO', 'MG', 'NÃO TEM');
create type competencia_status as enum ('ABERTA', 'FECHADA');
create type obra_status as enum ('ATIVA', 'INATIVA', 'CONCLUIDA');
create type presenca_tipo as enum ('NORMAL', 'FALTA', 'ATESTADO', 'AUSENTE', 'SAIU', 'SABADO_EXTRA');
create type avulso_tipo as enum ('Vale', 'Empréstimo', 'Desconto', 'Adiantamento');
create type pagamento_status as enum ('PENDENTE', 'CALCULADO', 'APROVADO');

-- ============================================================
-- PERFIS (usuários do sistema)
-- ============================================================
create table perfis (
  id          uuid primary key references auth.users on delete cascade,
  nome        text not null,
  email       text not null unique,
  perfil      perfil_tipo not null default 'escritorio',
  equipe      equipe_tipo,          -- null = acesso a ambas
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============================================================
-- FUNCIONÁRIOS
-- ============================================================
create table funcionarios (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  cpf           text,
  equipe        equipe_tipo not null,
  funcao        text not null default 'Operário',
  empresa       text,
  valor_diaria  numeric(10,2) not null check (valor_diaria >= 0),
  salario_base  numeric(10,2) not null check (salario_base >= 0),
  usuario_id    uuid references perfis(id),   -- vínculo para autoatendimento
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============================================================
-- OBRAS
-- ============================================================
create table obras (
  id        uuid primary key default uuid_generate_v4(),
  codigo    text not null unique,
  nome      text not null unique,
  status    obra_status not null default 'ATIVA',
  criado_em timestamptz not null default now()
);

-- ============================================================
-- FUNCIONÁRIO × OBRA × PASSAGEM  ← TABELA CRÍTICA
-- Passagem é sempre funcionário + obra, nunca valor fixo global
-- ============================================================
create table funcionario_obra_passagem (
  id             uuid primary key default uuid_generate_v4(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  obra_id        uuid not null references obras(id) on delete cascade,
  tipo_passagem  tipo_passagem not null,
  valor_passagem numeric(10,2) not null check (valor_passagem >= 0),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (funcionario_id, obra_id)   -- uma regra por par
);

-- ============================================================
-- COMPETÊNCIAS (meses)
-- ============================================================
create table competencias (
  id          uuid primary key default uuid_generate_v4(),
  mes_ano     text not null unique,   -- formato "2026-03"
  status      competencia_status not null default 'ABERTA',
  fechado_por uuid references perfis(id),
  fechado_em  timestamptz,
  criado_em   timestamptz not null default now()
);

-- ============================================================
-- PRESENÇAS  ← estrutura normalizada, sem texto livre
-- ============================================================
create table presencas (
  id             uuid primary key default uuid_generate_v4(),
  competencia_id uuid not null references competencias(id),
  funcionario_id uuid not null references funcionarios(id),
  data           date not null,
  tipo           presenca_tipo not null default 'NORMAL',
  -- obra principal (obrigatória para tipo NORMAL e SABADO_EXTRA)
  obra_id        uuid references obras(id),
  fracao         numeric(4,2) check (fracao > 0 and fracao <= 1),
  -- obra secundária (apenas quando split 50/50)
  obra2_id       uuid references obras(id),
  fracao2        numeric(4,2) check (fracao2 > 0 and fracao2 <= 1),
  -- constraint: fracao + fracao2 <= 1
  registrado_por uuid references perfis(id),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  -- uma presença por funcionário por dia
  unique (funcionario_id, data),
  -- frações devem somar <= 1
  check (
    (fracao is null and fracao2 is null) or
    (fracao is not null and fracao2 is null and fracao <= 1) or
    (fracao is not null and fracao2 is not null and fracao + fracao2 <= 1)
  ),
  -- obra2 só existe se obra1 existe
  check (obra2_id is null or obra_id is not null),
  -- tipo NORMAL precisa de obra e fração
  check (
    tipo != 'NORMAL' or (obra_id is not null and fracao is not null)
  )
);

-- ============================================================
-- AVULSOS (vales, empréstimos, descontos)
-- ============================================================
create table avulsos (
  id             uuid primary key default uuid_generate_v4(),
  competencia_id uuid not null references competencias(id),
  funcionario_id uuid not null references funcionarios(id),
  data           date not null,
  tipo           avulso_tipo not null,
  valor          numeric(10,2) not null check (valor > 0),
  observacao     text,
  registrado_por uuid references perfis(id),
  criado_em      timestamptz not null default now()
);

-- ============================================================
-- PAGAMENTOS FINAIS
-- ============================================================
create table pagamentos (
  id                   uuid primary key default uuid_generate_v4(),
  competencia_id       uuid not null references competencias(id),
  funcionario_id       uuid not null references funcionarios(id),
  tipo                 text not null check (tipo in ('adiantamento','pagamento_final')),

  -- calculados automaticamente (não editar manualmente)
  total_diarias        numeric(10,2) not null default 0,
  total_extras         numeric(10,2) not null default 0,  -- sábados
  dias_uteis_mes       int not null default 0,
  total_faltas         int not null default 0,
  valor_diarias        numeric(10,2) not null default 0,  -- diarias * valor_diaria
  total_passagem       numeric(10,2) not null default 0,
  total_cafe           numeric(10,2) not null default 0,  -- R$8 por dia
  total_avulsos        numeric(10,2) not null default 0,

  -- editáveis pelo escritório
  hora_extra           numeric(10,2) not null default 0,
  complemento          numeric(10,2) not null default 0,
  outros_desc          numeric(10,2) not null default 0,
  desc_materiais       numeric(10,2) not null default 0,
  desc_emprestimo      numeric(10,2) not null default 0,
  desc_acerto          numeric(10,2) not null default 0,
  desc_pensao          numeric(10,2) not null default 0,
  desc_dsr             numeric(10,2) not null default 0,
  desc_sindicato       numeric(10,2) not null default 0,
  desc_inss            numeric(10,2) not null default 0,

  -- resultado
  total_pagamento      numeric(10,2) not null default 0,
  total_contra_cheque  numeric(10,2) not null default 0,

  status               pagamento_status not null default 'PENDENTE',
  alertas              text[],   -- lista de erros/avisos do cálculo
  aprovado_por         uuid references perfis(id),
  aprovado_em          timestamptz,
  observacao           text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),

  unique (competencia_id, funcionario_id, tipo)
);

-- ============================================================
-- PASSAGENS POR QUINZENA (resultado do cálculo)
-- ============================================================
create table passagens_quinzena (
  id             uuid primary key default uuid_generate_v4(),
  competencia_id uuid not null references competencias(id),
  funcionario_id uuid not null references funcionarios(id),
  quinzena       int not null check (quinzena in (1, 2)),
  total_passagem numeric(10,2) not null default 0,
  total_cafe     numeric(10,2) not null default 0,
  valor_gasto    numeric(10,2) not null default 0,
  recebido_ant   numeric(10,2) not null default 0,
  saldo_vt       numeric(10,2) not null default 0,
  dias_proj      int not null default 0,
  valor_proj     numeric(10,2) not null default 0,
  adicional      numeric(10,2) not null default 0,
  alertas        text[],
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (competencia_id, funcionario_id, quinzena)
);

-- ============================================================
-- RATEIO MENSAL (calculado)
-- ============================================================
create table rateio_mensal (
  id             uuid primary key default uuid_generate_v4(),
  competencia_id uuid not null references competencias(id),
  obra_id        uuid not null references obras(id),
  total_armacao  numeric(10,2) not null default 0,
  total_carpintaria numeric(10,2) not null default 0,
  total_geral    numeric(10,2) not null default 0,
  percentual     numeric(6,4) not null default 0,
  criado_em      timestamptz not null default now(),
  unique (competencia_id, obra_id)
);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end; $$;

create trigger tg_perfis_upd          before update on perfis          for each row execute function set_updated_at();
create trigger tg_funcionarios_upd    before update on funcionarios    for each row execute function set_updated_at();
create trigger tg_fop_upd             before update on funcionario_obra_passagem for each row execute function set_updated_at();
create trigger tg_presencas_upd       before update on presencas       for each row execute function set_updated_at();
create trigger tg_pagamentos_upd      before update on pagamentos      for each row execute function set_updated_at();
create trigger tg_passagens_quin_upd  before update on passagens_quinzena for each row execute function set_updated_at();

-- ============================================================
-- TRIGGER: criar perfil ao registrar usuário
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into perfis (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'perfil')::perfil_tipo, 'escritorio')
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- FUNÇÃO CENTRAL: CALCULAR PASSAGEM DO DIA
-- Regra: 1 obra = valor direto | 2 obras = (pass1 + pass2) / 2
-- ============================================================
create or replace function calcular_passagem_dia(
  p_funcionario_id uuid,
  p_obra_id        uuid,
  p_obra2_id       uuid default null
) returns numeric language plpgsql as $$
declare
  v_pass1 numeric := 0;
  v_pass2 numeric := 0;
begin
  -- Busca passagem da obra 1
  select valor_passagem into v_pass1
  from funcionario_obra_passagem
  where funcionario_id = p_funcionario_id
    and obra_id = p_obra_id
    and tipo_passagem != 'MG'
    and tipo_passagem != 'NÃO TEM';

  if not found then
    raise exception 'PASSAGEM_NAO_CADASTRADA:funcionario=%,obra=%', p_funcionario_id, p_obra_id;
  end if;

  if p_obra2_id is null then
    return v_pass1;
  end if;

  -- Busca passagem da obra 2
  select valor_passagem into v_pass2
  from funcionario_obra_passagem
  where funcionario_id = p_funcionario_id
    and obra_id = p_obra2_id
    and tipo_passagem != 'MG'
    and tipo_passagem != 'NÃO TEM';

  if not found then
    raise exception 'PASSAGEM_NAO_CADASTRADA:funcionario=%,obra=%', p_funcionario_id, p_obra2_id;
  end if;

  -- 2 obras: soma dividida por 2
  return (v_pass1 + v_pass2) / 2.0;
end; $$;

-- ============================================================
-- FUNÇÃO: CALCULAR PAGAMENTO COMPLETO DE UM FUNCIONÁRIO
-- Chamada pelo backend após encerrar lançamentos
-- ============================================================
create or replace function calcular_pagamento(
  p_competencia_id uuid,
  p_funcionario_id uuid,
  p_tipo           text  -- 'adiantamento' ou 'pagamento_final'
) returns uuid language plpgsql as $$
declare
  v_func          funcionarios%rowtype;
  v_comp          competencias%rowtype;
  v_pres          presencas%rowtype;
  v_total_diarias numeric := 0;
  v_total_extras  numeric := 0;
  v_valor_diarias numeric := 0;
  v_total_pass    numeric := 0;
  v_total_cafe    numeric := 0;
  v_total_avulsos numeric := 0;
  v_faltas        int := 0;
  v_dias_uteis    int := 0;
  v_alertas       text[] := '{}';
  v_pass_dia      numeric;
  v_cafe_dia      constant numeric := 8.0;
  v_fim_quinzena  date;
  v_id_pag        uuid;
begin
  select * into v_func from funcionarios where id = p_funcionario_id;
  select * into v_comp from competencias where id = p_competencia_id;

  -- Calcular fim da 1ª quinzena
  v_fim_quinzena := (v_comp.mes_ano || '-15')::date;

  -- Iterar sobre as presenças do período
  for v_pres in
    select * from presencas
    where competencia_id = p_competencia_id
      and funcionario_id = p_funcionario_id
      and (p_tipo = 'pagamento_final'
           or (p_tipo = 'adiantamento' and data <= v_fim_quinzena))
    order by data
  loop
    v_dias_uteis := v_dias_uteis + 1;

    -- Ausências
    if v_pres.tipo in ('FALTA','ATESTADO','AUSENTE','SAIU') then
      if v_pres.tipo = 'FALTA' then v_faltas := v_faltas + 1; end if;
      continue;
    end if;

    -- Diárias
    if v_pres.tipo = 'NORMAL' then
      v_total_diarias := v_total_diarias + coalesce(v_pres.fracao, 1)
                       + coalesce(v_pres.fracao2, 0);
    elsif v_pres.tipo = 'SABADO_EXTRA' then
      v_total_extras := v_total_extras + coalesce(v_pres.fracao, 1)
                      + coalesce(v_pres.fracao2, 0);
    end if;

    -- Passagem
    begin
      v_pass_dia := calcular_passagem_dia(
        p_funcionario_id, v_pres.obra_id, v_pres.obra2_id
      );
      v_total_pass := v_total_pass + v_pass_dia
                    * (coalesce(v_pres.fracao, 1) + coalesce(v_pres.fracao2, 0));
    exception when others then
      v_alertas := array_append(v_alertas, sqlerrm);
    end;

    -- Café R$8 por dia trabalhado
    v_total_cafe := v_total_cafe + v_cafe_dia;
  end loop;

  -- Valor em R$
  v_valor_diarias := (v_total_diarias + v_total_extras) * v_func.valor_diaria;

  -- Avulsos
  select coalesce(sum(valor), 0) into v_total_avulsos
  from avulsos
  where competencia_id = p_competencia_id
    and funcionario_id = p_funcionario_id
    and (p_tipo = 'pagamento_final'
         or (p_tipo = 'adiantamento' and data <= v_fim_quinzena));

  -- Upsert do pagamento
  insert into pagamentos (
    competencia_id, funcionario_id, tipo,
    total_diarias, total_extras, dias_uteis_mes, total_faltas,
    valor_diarias, total_passagem, total_cafe, total_avulsos,
    total_pagamento, total_contra_cheque, alertas, status
  ) values (
    p_competencia_id, p_funcionario_id, p_tipo,
    v_total_diarias, v_total_extras, v_dias_uteis, v_faltas,
    v_valor_diarias, v_total_pass, v_total_cafe, v_total_avulsos,
    v_valor_diarias + v_total_pass + v_total_cafe - v_total_avulsos,
    v_valor_diarias + v_total_pass + v_total_cafe - v_total_avulsos,
    v_alertas,
    case when array_length(v_alertas, 1) > 0 then 'PENDENTE' else 'CALCULADO' end
  )
  on conflict (competencia_id, funcionario_id, tipo)
  do update set
    total_diarias = excluded.total_diarias,
    total_extras  = excluded.total_extras,
    dias_uteis_mes = excluded.dias_uteis_mes,
    total_faltas  = excluded.total_faltas,
    valor_diarias = excluded.valor_diarias,
    total_passagem = excluded.total_passagem,
    total_cafe    = excluded.total_cafe,
    total_avulsos = excluded.total_avulsos,
    total_pagamento = excluded.total_pagamento,
    total_contra_cheque = excluded.total_contra_cheque,
    alertas       = excluded.alertas,
    status        = excluded.status,
    atualizado_em = now()
  returning id into v_id_pag;

  return v_id_pag;
end; $$;

-- ============================================================
-- FUNÇÃO: CALCULAR RATEIO DO MÊS
-- ============================================================
create or replace function calcular_rateio(p_competencia_id uuid)
returns void language plpgsql as $$
declare
  v_obra record;
  v_arm  numeric;
  v_carp numeric;
  v_grand numeric := 0;
begin
  -- Limpar rateio anterior
  delete from rateio_mensal where competencia_id = p_competencia_id;

  -- Para cada obra ativa
  for v_obra in select id, nome from obras where status = 'ATIVA' loop
    -- Armação
    select coalesce(sum(
      (p.fracao + coalesce(p.fracao2, 0)) * f.valor_diaria
    ), 0) into v_arm
    from presencas p
    join funcionarios f on f.id = p.funcionario_id
    where p.competencia_id = p_competencia_id
      and f.equipe = 'ARMAÇÃO'
      and (p.obra_id = v_obra.id or p.obra2_id = v_obra.id)
      and p.tipo in ('NORMAL', 'SABADO_EXTRA');

    -- Carpintaria
    select coalesce(sum(
      (p.fracao + coalesce(p.fracao2, 0)) * f.valor_diaria
    ), 0) into v_carp
    from presencas p
    join funcionarios f on f.id = p.funcionario_id
    where p.competencia_id = p_competencia_id
      and f.equipe = 'CARPINTARIA'
      and (p.obra_id = v_obra.id or p.obra2_id = v_obra.id)
      and p.tipo in ('NORMAL', 'SABADO_EXTRA');

    if v_arm + v_carp > 0 then
      v_grand := v_grand + v_arm + v_carp;
      insert into rateio_mensal (competencia_id, obra_id, total_armacao, total_carpintaria, total_geral)
      values (p_competencia_id, v_obra.id, v_arm, v_carp, v_arm + v_carp);
    end if;
  end loop;

  -- Calcular percentuais
  if v_grand > 0 then
    update rateio_mensal
    set percentual = total_geral / v_grand
    where competencia_id = p_competencia_id;
  end if;
end; $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table perfis enable row level security;
alter table funcionarios enable row level security;
alter table obras enable row level security;
alter table funcionario_obra_passagem enable row level security;
alter table competencias enable row level security;
alter table presencas enable row level security;
alter table avulsos enable row level security;
alter table pagamentos enable row level security;
alter table passagens_quinzena enable row level security;
alter table rateio_mensal enable row level security;

-- Perfis: cada um vê o próprio, gestor/escritório veem todos
create policy "perfil_self" on perfis for select using (auth.uid() = id);
create policy "perfil_admin" on perfis for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);

-- Funcionários, obras, passagens: autenticados leem, admin escreve
create policy "func_read"  on funcionarios for select using (auth.role() = 'authenticated');
create policy "func_write" on funcionarios for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);
create policy "obras_read"  on obras for select using (auth.role() = 'authenticated');
create policy "obras_write" on obras for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);
create policy "fop_read"  on funcionario_obra_passagem for select using (auth.role() = 'authenticated');
create policy "fop_write" on funcionario_obra_passagem for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);

-- Competências, presenças, avulsos: escritório/encarregado escrevem
create policy "comp_read"   on competencias for select using (auth.role() = 'authenticated');
create policy "comp_write"  on competencias for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);
create policy "pres_read"   on presencas for select using (auth.role() = 'authenticated');
create policy "pres_write"  on presencas for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio','encarregado'))
);
create policy "av_read"     on avulsos for select using (auth.role() = 'authenticated');
create policy "av_write"    on avulsos for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);

-- Pagamentos: escritório/gestor gerenciam; funcionário vê o próprio
create policy "pag_admin"   on pagamentos for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);
create policy "pag_func"    on pagamentos for select using (
  funcionario_id in (select id from funcionarios where usuario_id = auth.uid())
);
create policy "pass_admin"  on passagens_quinzena for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);
create policy "pass_func"   on passagens_quinzena for select using (
  funcionario_id in (select id from funcionarios where usuario_id = auth.uid())
);
create policy "rateio_read" on rateio_mensal for select using (auth.role() = 'authenticated');
create policy "rateio_write" on rateio_mensal for all using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.perfil in ('gestor','escritorio'))
);

-- ============================================================
-- DADOS INICIAIS — OBRAS
-- ============================================================
insert into obras (codigo, nome, status) values
  ('BLL',   'BLL MANGABEIRAS',      'ATIVA'),
  ('CJ',    'CIDADE JARDIM',        'ATIVA'),
  ('FULG',  'FULGENCIO',            'ATIVA'),
  ('PISC',  'PISCINA SERRA',        'ATIVA'),
  ('NIQ',   'NIQUELINA',            'ATIVA'),
  ('SAV',   'SAVASSI',              'ATIVA'),
  ('VIL',   'VILAÇA',               'ATIVA'),
  ('BARR',  'BARREIRO',             'ATIVA'),
  ('PLAN',  'PLANALTO',             'ATIVA'),
  ('FERN',  'FERNANDO',             'ATIVA'),
  ('GAL',   'GALPÃO',               'ATIVA'),
  ('INH',   'INHOTIM',              'ATIVA'),
  ('AGILE', 'CASA AGILE',           'ATIVA'),
  ('3MAR',  'TRÊS MARIAS',          'ATIVA'),
  ('LUZ',   'CONTENÇÃO LUZ E CIA',  'ATIVA')
on conflict do nothing;

-- ============================================================
-- DADOS INICIAIS — FUNCIONÁRIOS ARMAÇÃO
-- ============================================================
insert into funcionarios (nome, equipe, valor_diaria, salario_base) values
  ('Adeiso Pereira de Jesus',              'ARMAÇÃO', 240, 4000),
  ('Adriano Gomes Rosa',                   'ARMAÇÃO', 180, 2800),
  ('Adriano Silva de Jesus',               'ARMAÇÃO', 200, 2800),
  ('Anderson Fernando Farias',             'ARMAÇÃO', 220, 4000),
  ('Claudio Gonçalves Pereira',            'ARMAÇÃO', 160, 2800),
  ('Dielson José Trindade',                'ARMAÇÃO', 270, 5500),
  ('Eder Jeronimo de Almeida',             'ARMAÇÃO', 170, 2800),
  ('Emerson Pereira',                      'ARMAÇÃO', 180, 2800),
  ('Felipe Salgado Ferreira',              'ARMAÇÃO', 200, 2800),
  ('Genildo Cordeiro de Jesus',            'ARMAÇÃO', 160, 2800),
  ('Geraldo Matuzinho Dias da Silva',      'ARMAÇÃO', 250, 4000),
  ('Gilberto Mendes Braga',                'ARMAÇÃO', 250, 4000),
  ('Gilcimar Rodrigues Franca',            'ARMAÇÃO', 150, 2800),
  ('Iuri Dias Nonato',                     'ARMAÇÃO', 180, 2800),
  ('Laureano dos Santos Ferreira da Costa','ARMAÇÃO', 160, 2800),
  ('Lucas Gabriel dos Santos Nascimento',  'ARMAÇÃO', 150, 2800),
  ('Lucas Vieira da Rocha Lacerda',        'ARMAÇÃO', 170, 2800),
  ('Marcos Martins Da Costa',              'ARMAÇÃO', 200, 2800),
  ('Pablo Rangel Salgado dos Santos',      'ARMAÇÃO', 120, 1800),
  ('Silverio Alves',                       'ARMAÇÃO', 190, 2800),
  ('Tarcisio Chaves Aguilar',              'ARMAÇÃO', 180, 2800),
  ('Weverton Leandro de Oliveira',         'ARMAÇÃO', 190, 2800),
  ('Edivaldo Sebastião de Sousa',          'ARMAÇÃO', 180, 2800)
on conflict do nothing;

-- CARPINTARIA
insert into funcionarios (nome, equipe, valor_diaria, salario_base) values
  ('Agnaldo Lacerda',                      'CARPINTARIA', 180, 2800),
  ('Ailton Antonio da Silva',              'CARPINTARIA', 150, 2800),
  ('Alexandre Pereira da Silva',           'CARPINTARIA', 240, 4000),
  ('Anderson Silva de Alexandre',          'CARPINTARIA', 200, 2800),
  ('Arvanio Alves de Souza',               'CARPINTARIA', 120, 2050),
  ('Bruno Augusto Gomes Pinheiro',         'CARPINTARIA', 220, 2800),
  ('Daniel Xavier Santos',                 'CARPINTARIA', 230, 2800),
  ('Diomar Honorato Ferreira',             'CARPINTARIA', 300, 5500),
  ('Dionisio Fernandes dos Santos',        'CARPINTARIA', 220, 2800),
  ('Edimar Silva dos Santos',              'CARPINTARIA', 150, 2050),
  ('Edvaldo Sergio Angelo',                'CARPINTARIA', 200, 2800),
  ('Emerson Ferreira da Silva',            'CARPINTARIA', 330, 4000),
  ('Erick Santos Nascimento',              'CARPINTARIA', 140, 2050),
  ('Evanildo Alves de Souza',              'CARPINTARIA', 160, 2800),
  ('Fabiano Azevedo Silva',                'CARPINTARIA', 140, 2050),
  ('Fernando da Cruz Oliveira',            'CARPINTARIA', 200, 2800),
  ('Gerson Domingos da Silva',             'CARPINTARIA', 260, 4000),
  ('Gilberto Ferreira de Almeida',         'CARPINTARIA', 200, 2800),
  ('Italo Gustavo Santos Pereira',         'CARPINTARIA', 140, 2050),
  ('João Sardanha',                        'CARPINTARIA', 200, 2800),
  ('Joel Alves Diniz',                     'CARPINTARIA', 130, 1800),
  ('Joel Aparecido Santiago',              'CARPINTARIA', 170, 2800),
  ('José Carlos Ferreira de Sousa',        'CARPINTARIA', 180, 2800),
  ('José Otoni',                           'CARPINTARIA', 270, 4000),
  ('José Pereira de Oliveira',             'CARPINTARIA', 230, 4000),
  ('Julio Esdras de Souza Malta',          'CARPINTARIA', 190, 2800),
  ('Kaio Pereira Sales',                   'CARPINTARIA', 160, 2800),
  ('Lafayete Máximo Rodrigues',            'CARPINTARIA', 230, 2800),
  ('Leandro da Silva Santos',              'CARPINTARIA', 200, 2800),
  ('Leandro José Trindade',                'CARPINTARIA', 300, 5500),
  ('Luciano Marcelo Fernandes da Silva',   'CARPINTARIA', 110, 1800),
  ('Luiz Gonzaga dos Santos Silva',        'CARPINTARIA', 270, 4000),
  ('Marciano Barbosa Moreira',             'CARPINTARIA', 120, 1800),
  ('Márcio Lima do Nascimento',            'CARPINTARIA', 230, 2800),
  ('Mauro Alves Martins',                  'CARPINTARIA', 150, 2800),
  ('Nilton Luiz Ferreira',                 'CARPINTARIA', 180, 2800),
  ('Osnaldo Soares Magalhães',             'CARPINTARIA', 330, 4000),
  ('Péricles Martins da Silva',            'CARPINTARIA', 160, 2800),
  ('Rafael Silva',                         'CARPINTARIA', 180, 2800),
  ('Renato Ferreira Raimundo',             'CARPINTARIA', 250, 2800),
  ('Roberto Carlos Gonçalves dos Santos',  'CARPINTARIA', 120, 1740),
  ('Ronei Fernandes Silva',                'CARPINTARIA', 230, 2800),
  ('Ruan Rodrigo Santos da Costa',         'CARPINTARIA', 140, 2050),
  ('Sandro Lúcio Cardoso de Jesus',        'CARPINTARIA', 170, 2800),
  ('Sidney Pereira da Silva',              'CARPINTARIA', 250, 4000),
  ('Tobias Lucio de Souza',                'CARPINTARIA', 200, 2800),
  ('Valdinei Sergio Angelo',               'CARPINTARIA', 200, 2800),
  ('Vitor Julio Coelho Palmeira',          'CARPINTARIA', 200, 2800),
  ('Wallace Vitor de Abreu',               'CARPINTARIA', 200, 2800),
  ('Walmir Oliveira',                      'CARPINTARIA', 180, 2800),
  ('Wesley Magno Andrade',                 'CARPINTARIA', 160, 2800),
  ('Guilherme Nunes Barbosa',              'CARPINTARIA', 100, 1800)
on conflict do nothing;

-- ============================================================
-- VIEW: presença completa (útil para relatórios)
-- ============================================================
create or replace view v_presencas as
select
  p.id,
  p.data,
  p.tipo,
  p.fracao,
  p.fracao2,
  f.nome          as funcionario,
  f.equipe,
  f.valor_diaria,
  o1.nome         as obra,
  o1.codigo       as obra_codigo,
  o2.nome         as obra2,
  o2.codigo       as obra2_codigo,
  c.mes_ano       as competencia,
  c.status        as competencia_status
from presencas p
join funcionarios f  on f.id = p.funcionario_id
join competencias c  on c.id = p.competencia_id
left join obras o1   on o1.id = p.obra_id
left join obras o2   on o2.id = p.obra2_id;

-- ============================================================
-- VIEW: matriz de passagens (para conferência)
-- ============================================================
create or replace view v_matriz_passagens as
select
  f.nome          as funcionario,
  f.equipe,
  o.nome          as obra,
  fop.tipo_passagem,
  fop.valor_passagem
from funcionario_obra_passagem fop
join funcionarios f on f.id = fop.funcionario_id
join obras        o on o.id = fop.obra_id
order by f.equipe, f.nome, o.nome;
