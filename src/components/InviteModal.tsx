import { useState } from 'react';

interface InviteModalProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
}

export function InviteModal({ roomId, roomName, onClose }: InviteModalProps) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/room/${roomId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Convite: ${roomName}`,
          text: `Venha participar da sala "${roomName}" no PodFalarAgora`,
          url: inviteUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-studio-text">Convidar Participantes</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-studio-bg border border-studio-border rounded-lg p-4">
            <label className="block text-sm text-studio-text-muted mb-2">Link da Sala</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="input flex-1 bg-studio-card font-mono text-sm"
              />
              <button
                onClick={handleCopy}
                className="btn-secondary whitespace-nowrap"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="bg-studio-bg border border-studio-border rounded-lg p-4">
            <label className="block text-sm text-studio-text-muted mb-2">ID da Sala</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId.toUpperCase()}
                readOnly
                className="input flex-1 bg-studio-card font-mono text-lg tracking-widest text-center"
              />
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                className="btn-secondary whitespace-nowrap"
              >
                Copiar
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleShare} className="btn-primary flex-1">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Compartilhar
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">Fechar</button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-studio-border text-center text-sm text-studio-text-muted">
          <p>Compartilhe o link ou o ID da sala para que outros possam entrar.</p>
        </div>
      </div>
    </div>
  );
}