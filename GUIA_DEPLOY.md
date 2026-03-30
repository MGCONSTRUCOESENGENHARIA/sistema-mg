# 🚀 GUIA DE DEPLOY — SISTEMA MG
## Do zero ao site no ar em ~1 hora

---

## O QUE É DIFERENTE NESTE SISTEMA

Este sistema foi construído com uma arquitetura correta para operação real de obra:

- **Passagem = funcionário + obra** (nunca valor fixo global)
- **2 obras no mesmo dia** → passagem = (obra1 + obra2) ÷ 2
- **Passagem obrigatória** → cálculo bloqueia se não houver cadastro
- **Cálculo no banco** (PostgreSQL functions) → não depende do frontend
- **Competências com status** → mês aberto/fechado
- **Alertas automáticos** quando passagens estão faltando

---

## ETAPA 1 — Supabase (banco de dados)

1. Acesse **supabase.com** → New project
   - Name: `sistema-mg`
   - Region: South America (São Paulo)
   - Aguarde ~2 minutos

2. Vá em **SQL Editor → New query**

3. Cole todo o conteúdo de `schema.sql` e clique em **Run**
   - Deve aparecer: "Success"
   - Isso cria todas as tabelas, funções e dados iniciais

4. Vá em **Project Settings → API** e copie:
   - `Project URL`
   - `anon public key`

---

## ETAPA 2 — GitHub

1. Crie conta em **github.com**
2. New repository → `sistema-mg` → Create
3. Instale Git: **git-scm.com/download/win**
4. Na pasta do projeto, abra o terminal e execute:

```bash
git init
git add .
git commit -m "Sistema MG v1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/sistema-mg.git
git push -u origin main
```

---

## ETAPA 3 — Arquivo .env.local

Na pasta do projeto, crie o arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...sua_chave...
```

---

## ETAPA 4 — Vercel (hospedagem gratuita)

1. Acesse **vercel.com** → Sign up with GitHub
2. New Project → importe `sistema-mg`
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → aguarde ~3 minutos
5. Seu site estará em: `sistema-mg.vercel.app`

---

## ETAPA 5 — Criar usuários

No Supabase → **Authentication → Users → Invite user**:

| Usuário | Email | Perfil |
|---------|-------|--------|
| Mayko (gestor) | mayko@empresa.com | gestor |
| Escritório | escritorio@empresa.com | escritorio |
| Encarregado Arm. | enc.arm@empresa.com | encarregado |
| Encarregado Carp. | enc.carp@empresa.com | encarregado |

Após criar, configure os perfis no SQL Editor:

```sql
-- Gestor (Mayko — único que pode fechar/reabrir mês)
UPDATE perfis SET perfil = 'gestor' WHERE email = 'mayko@empresa.com';

-- Encarregado de armação
UPDATE perfis
SET perfil = 'encarregado', equipe = 'ARMAÇÃO'
WHERE email = 'enc.arm@empresa.com';

-- Encarregado de carpintaria
UPDATE perfis
SET perfil = 'encarregado', equipe = 'CARPINTARIA'
WHERE email = 'enc.carp@empresa.com';
```

---

## ETAPA 6 — Primeiro uso (ordem obrigatória)

### 1. Configure as passagens ANTES de qualquer lançamento

Acesse **Matriz de Passagens** e defina para cada funcionário × obra:
- **Pra Frente** → vale transporte (informe o valor unitário)
- **Reembolso** → reembolso (informe o valor)
- **MG** → sem passagem (valor = 0)

> ⚠️ Se você não configurar, o cálculo de pagamento será bloqueado.

Use o botão **"Preencher MG"** para funcionar sem preencher 1 a 1.

### 2. Crie uma competência

Acesse **Competências → Novo mês**

### 3. Lance as presenças

Acesse **Presença** → clique em cada célula → selecione obra e fração

Para funcionário em 2 obras no mesmo dia:
- Obra 1: SAVASSI, fração 0,5
- Obra 2: BLL MANGABEIRAS, fração 0,5
- O sistema calcula passagem = (SAVASSI + BLL) ÷ 2 automaticamente

### 4. Registre avulsos

Acesse **Avulsos** para registrar vales e empréstimos ao longo do mês

### 5. Calcule os pagamentos

- **Dia 20**: Adiantamento → clique "Recalcular Tudo"
- **Dia 5**: Pagamento Final → clique "Recalcular Tudo"
- Edite os campos manuais (descontos, hora extra, etc.)

### 6. Feche o mês

Acesse **Competências** → marque como Fechada
- Somente o gestor (Mayko) pode reabrir

---

## REGRAS DE CÁLCULO (implementadas no banco)

### Passagem
```
1 obra no dia   → passagem = valor_passagem(func, obra)
2 obras no dia  → passagem = (pass_obra1 + pass_obra2) / 2
```

### Sem passagem cadastrada
```
→ lança alerta no pagamento
→ não bloqueia a presença
→ bloqueia o cálculo financeiro até corrigir
```

### Café
```
R$ 8,00 por dia trabalhado (tipo NORMAL ou SABADO_EXTRA)
```

### Diárias
```
tipo NORMAL     → conta para 1ª ou 2ª quinzena conforme data
tipo SABADO_EXTRA → conta como extra folha
```

---

## CUSTOS

| Serviço | Gratuito | Limite |
|---------|---------|--------|
| Supabase | ✅ | 500MB, 50k linhas |
| Vercel | ✅ | Ilimitado para sites pequenos |

---

## PRÓXIMAS VERSÕES

- [ ] Relatórios exportação Excel/PDF
- [ ] App mobile para encarregado (celular)
- [ ] Alertas WhatsApp (faltas, fechamento)
- [ ] Cálculo automático de INSS
- [ ] Importação de histórico do Excel antigo
- [ ] Dashboard gerencial com gráficos

---

*Sistema MG v1.0 — Março 2026*
