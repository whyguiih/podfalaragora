interface SettingsModalProps {
  onClose: () => void;
  audioInputs: MediaDeviceInfo[];
  selectedInput: string;
  onInputChange: (deviceId: string) => void;
}

export function SettingsModal({ onClose, audioInputs, selectedInput, onInputChange }: SettingsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-studio-text">Configurações de Áudio</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-studio-text mb-3">Dispositivo de Entrada (Microfone)</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-studio-bg border border-studio-border rounded-lg cursor-pointer hover:border-studio-accent/50 transition-colors">
                <input
                  type="radio"
                  name="audioInput"
                  value="default"
                  checked={selectedInput === 'default'}
                  onChange={(e) => onInputChange(e.target.value)}
                  className="w-4 h-4 accent-studio-accent"
                />
                <div className="flex-1">
                  <p className="text-studio-text">Dispositivo Padrão do Sistema</p>
                  <p className="text-xs text-studio-text-muted">Usa a configuração padrão do navegador/SO</p>
                </div>
              </label>

              {audioInputs.map((input) => (
                <label
                  key={input.deviceId}
                  className="flex items-center gap-3 p-3 bg-studio-bg border border-studio-border rounded-lg cursor-pointer hover:border-studio-accent/50 transition-colors"
                >
                  <input
                    type="radio"
                    name="audioInput"
                    value={input.deviceId}
                    checked={selectedInput === input.deviceId}
                    onChange={(e) => onInputChange(e.target.value)}
                    className="w-4 h-4 accent-studio-accent"
                  />
                  <div className="flex-1">
                    <p className="text-studio-text">{input.label || `Microfone ${input.deviceId.slice(0, 8)}...`}</p>
                    <p className="text-xs text-studio-text-muted font-mono">{input.deviceId}</p>
                  </div>
                </label>
              ))}

              {audioInputs.length === 0 && (
                <p className="text-studio-text-muted text-center py-4">Nenhum microfone detectado</p>
              )}
            </div>
          </div>

          <div className="border-t border-studio-border pt-6">
            <h3 className="text-lg font-medium text-studio-text mb-3">Qualidade de Gravação</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-studio-text-muted">Taxa de Amostragem</span>
                <span className="text-studio-text font-mono">48 kHz</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-studio-text-muted">Profundidade de Bits</span>
                <span className="text-studio-text font-mono">32-bit float (interno)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-studio-text-muted">Canais</span>
                <span className="text-studio-text font-mono">Estéreo (2)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-studio-text-muted">Formato de Exportação</span>
                <span className="text-studio-text font-mono">WAV (PCM)</span>
              </div>
            </div>
          </div>

          <div className="border-t border-studio-border pt-6">
            <h3 className="text-lg font-medium text-studio-text mb-3">Rede</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-studio-text-muted">STUN Servers</span>
                <span className="text-studio-text font-mono">Google STUN</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-studio-text-muted">Conexão</span>
                <span className="text-studio-text font-mono">P2P Mesh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-primary">Salvar e Fechar</button>
        </div>
      </div>
    </div>
  );
}