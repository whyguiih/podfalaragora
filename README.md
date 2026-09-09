# PodFalarAgora - Estúdio Web de Gravação e Podcast

Um aplicativo de gravação de áudio multipista direto no navegador. O usuário entra em uma "sala", convida outras pessoas e o app grava o áudio de cada um separadamente (em alta qualidade) e sincroniza tudo no final.

## Funcionalidades

- **Salas de Gravação**: Crie salas privadas com ID único
- **Convite Simples**: Compartilhe link ou ID da sala
- **Gravação Multi-track**: Cada participante gravado separadamente em alta qualidade (48kHz, 32-bit float interno)
- **Tempo Real**: WebRTC mesh para áudio de baixa latência entre participantes
- **Sincronização Automática**: Alinhamento preciso de trilhas no final
- **Exportação Flexível**: WAV (16/24/32-bit), MP3, trilhas individuais ou mix estéreo
- **Controles de Áudio**: Mute, volume por participante, seleção de microfone
- **Visualização**: Medidores de nível em tempo real, waveform

## Stack Tecnológica

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand (com persistência)
- **Real-time/Backend**: Supabase (Realtime + Postgres)
- **Áudio**: WebRTC + Web Audio API + AudioWorklet
- **Encoding**: Web Worker para WAV PCM

## Pré-requisitos

- Node.js 18+
- Conta no Supabase (gratuita)

## Configuração Rápida

### 1. Clone e Instale

```bash
cd podfalaragora
npm install
```

### 2. Configure o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **Settings > API** e copie:
   - Project URL → `VITE_SUPABASE_URL`
   - Anon Public Key → `VITE_SUPABASE_ANON_KEY`
3. Crie o arquivo `.env`:

```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Configure o Banco de Dados

No **SQL Editor** do Supabase, execute:

```sql
-- Habilitar extensões necessárias
create extension if not exists "uuid-ossp";

-- Tabela de salas
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid not null,
  participants jsonb not null default '{}',
  is_recording boolean not null default false,
  recording_started_at bigint,
  created_at bigint not null default extract(epoch from now()) * 1000,
  updated_at bigint not null default extract(epoch from now()) * 1000
);

-- Tabela de gravações
create table recordings (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  tracks jsonb not null default '[]',
  started_at bigint not null,
  ended_at bigint,
  status text not null default 'recording',
  mixed_audio_url text,
  created_at bigint not null default extract(epoch from now()) * 1000
);

-- Índices para performance
create index idx_rooms_owner on rooms(owner_id);
create index idx_recordings_room on recordings(room_id);

-- RLS (Row Level Security) - permissivo para desenvolvimento
alter table rooms enable row level security;
alter table recordings enable row level security;

create policy "Allow all for authenticated" on rooms for all using (true);
create policy "Allow all for authenticated" on recordings for all using (true);

-- Realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table recordings;
```

### 4. Execute

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

## Uso

1. Acesse `http://localhost:3000`
2. Digite seu nome
3. **Criar Sala**: Dê um nome e clique em "Criar Sala e Entrar"
4. **Entrar na Sala**: Compartilhe o ID (ex: `A1B2C3D4`) ou o link completo
5. Permita acesso ao microfone quando solicitado
6. Clique em **Iniciar Gravação** - todos os participantes começam a gravar
7. Clique em **Parar Gravação** - processamento automático
8. Vá em **Gravações** para exportar trilhas individuais ou mix estéreo

## Arquitetura de Áudio

```
┌─────────────────────────────────────────────────────────────┐
│                        Navegador                            │
├─────────────────────────────────────────────────────────────┤
│  MediaStream (getUserMedia)                                 │
│       │                                                     │
│       ▼                                                     │
│  AudioContext (48kHz)                                       │
│       │                                                     │
│       ├──▶ AnalyserNode (nível visual)                      │
│       │                                                     │
│       ▼                                                     │
│  AudioWorkletNode (recording-processor)                     │
│       │                                                     │
│       ├──▶ Buffers Float32Array por canal                   │
│       │                                                     │
│       ▼                                                     │
│  PostMessage → Main Thread → Web Worker (WAV encoding)      │
│       │                                                     │
│       ▼                                                     │
│  Blob WAV → Download / Supabase Storage                     │
└─────────────────────────────────────────────────────────────┘
```

### WebRTC Mesh

- Cada participante conecta-se a todos os outros (full mesh)
- Adequado para até ~8 participantes
- Para escalar, migrar para SFU (mediasoup, LiveKit, etc.)

### Sincronização

- Timestamp do servidor (Supabase) como referência
- `recording_started_at` armazenado no banco
- Cada trilha tem `startTime` local
- Alinhamento por offset de tempo no pós-processamento

## Estrutura do Projeto

```
src/
├── components/       # Componentes React
│   ├── LandingPage.tsx
│   ├── RoomPage.tsx
│   ├── RecordingPage.tsx
│   ├── ParticipantTrack.tsx
│   ├── RecordingControls.tsx
│   ├── InviteModal.tsx
│   └── SettingsModal.tsx
├── hooks/            # Custom hooks
│   ├── useWebRTC.ts
│   ├── useAudioRecording.ts
│   └── useAudioExport.ts
├── store/            # Zustand store
│   └── index.ts
├── utils/            # Utilitários
│   └── supabase.ts
├── workers/          # Web Workers (source)
│   ├── recording-processor.ts
│   └── wav-encoder.ts
├── types/            # TypeScript types
│   ├── index.ts
│   └── database.ts
├── styles/           # CSS global
│   └── index.css
├── App.tsx
└── main.tsx

public/
├── recording-processor.js  # AudioWorklet compilado
├── wav-encoder.js          # Web Worker compilado
└── favicon.svg
```

## Scripts Disponíveis

```bash
npm run dev       # Servidor de desenvolvimento
npm run build     # Build de produção (typecheck + vite build)
npm run preview   # Preview do build
npm run lint      # ESLint
npm run typecheck # TypeScript check
```

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Sim |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase | Sim |

## Limitações Conhecidas

1. **Mesh WebRTC**: Funciona bem até ~8 participantes. Para mais, use SFU.
2. **Safari/iOS**: Requer interação do usuário antes de `getUserMedia` e `AudioContext`.
3. **Firefox**: `MediaRecorder` não suporta WAV nativo (usa AudioWorklet).
4. **HTTPS Obrigatório**: WebRTC e `getUserMedia` requerem contexto seguro (localhost ok).

## Roadmap

- [ ] SFU (mediasoup) para escalabilidade
- [ ] Gravação de vídeo (opcional)
- [ ] Transcrição automática (Whisper API)
- [ ] Edição de timeline no navegador
- [ ] Upload para Supabase Storage
- [ ] Compartilhamento de link com expiração
- [ ] Temas personalizados

## Licença

MIT