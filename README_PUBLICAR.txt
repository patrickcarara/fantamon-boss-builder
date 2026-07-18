<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fantamon Boss Builder</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">F</div>
        <div>
          <h1>Fantamon</h1>
          <p>Boss Builder</p>
        </div>
      </div>

      <button id="newBossBtn" class="primary-btn">+ Novo Boss</button>

      <div class="backup-actions">
        <button id="exportBackupBtn" class="secondary-btn compact-btn">Exportar Backup</button>
        <button id="importBackupBtn" class="secondary-btn compact-btn">Importar Backup</button>
        <input id="importBackupInput" type="file" accept=".json,application/json" class="hidden" />
      </div>

      <label class="search-box">
        <span>🔎</span>
        <input id="bossSearch" type="search" placeholder="Pesquisar boss..." />
      </label>

      <div class="section-title">
        <span>Bosses</span>
        <span id="bossCount" class="count-pill">0</span>
      </div>

      <div id="bossList" class="boss-list"></div>
    </aside>

    <main class="main-content">
      <section id="emptyState" class="empty-state">
        <div class="empty-logo">⚔️</div>
        <h2>Fantamon Boss Builder</h2>
        <p>Cadastre um boss para começar a montar suas estratégias.</p>
        <button id="emptyNewBossBtn" class="primary-btn">Criar primeiro Boss</button>
      </section>

      <section id="builderView" class="builder-view hidden">
        <header class="topbar">
          <div>
            <div class="eyebrow">Boss selecionado</div>
            <h2 id="bossTitle">Boss</h2>
          </div>
          <div class="topbar-actions">
            <button id="favoriteBossBtn" class="icon-btn" title="Favoritar">☆</button>
            <button id="editBossBtn" class="secondary-btn">Editar Boss</button>
            <button id="deleteBossBtn" class="danger-btn">Excluir Boss</button>
          </div>
        </header>

        <div id="exportArea" class="workspace-grid">
          <section class="boss-panel card">
            <div id="bossImageWrap" class="boss-image-wrap">
              <img id="bossImage" alt="Imagem do boss" />
              <div id="bossImagePlaceholder" class="boss-image-placeholder">🐉</div>
            </div>
            <h3 id="bossPanelName">Boss</h3>
            <p class="muted">Estratégia principal:</p>
            <strong id="principalStrategyName">Principal</strong>
          </section>

          <section class="strategy-panel card">
            <div class="strategy-header">
              <div>
                <div class="eyebrow">Estratégia</div>
                <select id="strategySelect"></select>
                <div id="strategyModifiedAt" class="modified-at"></div>
              </div>
              <div class="strategy-actions">
                <button id="newStrategyBtn" class="secondary-btn">+ Nova</button>
                <button id="renameStrategyBtn" class="secondary-btn">Renomear</button>
                <button id="duplicateStrategyBtn" class="secondary-btn">Duplicar</button>
                <button id="setPrincipalBtn" class="secondary-btn">☆ Principal</button>
                <button id="deleteStrategyBtn" class="danger-btn">Excluir</button>
              </div>
            </div>

            <div id="slotsContainer" class="slots-container"></div>

            <label class="notes-field">
              <span>Observações da estratégia</span>
              <textarea id="strategyNotes" placeholder="Ex.: guardar a ultimate para a fase 2..."></textarea>
            </label>
          </section>
        </div>

        <section class="library card">
          <div class="library-header">
            <div>
              <div class="eyebrow">Biblioteca de Skills</div>
              <h3>Arraste as skills para um dos 4 slots</h3>
            </div>

            <label class="class-filter">
              <span>Classe</span>
              <div class="class-selector-row">
                <select id="classSelect"></select>
                <button id="manageClassesBtn" class="secondary-btn compact-btn">Gerenciar Classes</button>
              </div>
            </label>

            <div class="skill-import-actions">
              <button id="addSkillsBtn" class="secondary-btn">+ Adicionar várias Skills</button>
              <input id="skillFilesInput" type="file" accept="image/*" multiple class="hidden" />
            </div>
          </div>

          <div id="skillLibrary" class="skill-library"></div>
          <p class="library-tip">Dica: dê dois cliques em uma skill colocada para removê-la do slot.</p>
        </section>
      </section>
    </main>
  </div>

  <div id="modalBackdrop" class="modal-backdrop hidden">
    <div class="modal">
      <h3 id="modalTitle">Novo Boss</h3>
      <div id="modalFields"></div>
      <div id="bossImageUploadArea" class="modal-field hidden">
        <span>Ou escolher imagem do computador</span>
        <input id="bossImageFileInput" type="file" accept="image/*" />
        <small class="field-help">A imagem será salva junto com o boss no navegador.</small>
      </div>
      <div id="bossImagePreviewWrap" class="boss-preview hidden">
        <img id="bossImagePreview" alt="Prévia da imagem do boss" />
      </div>
      <div class="modal-actions">
        <button id="modalCancelBtn" class="secondary-btn">Cancelar</button>
        <button id="modalConfirmBtn" class="primary-btn">Confirmar</button>
      </div>
    </div>
  </div>

  <div id="classModalBackdrop" class="modal-backdrop hidden">
    <div class="modal class-modal">
      <h3>Gerenciar Classes</h3>

      <div class="class-manager-grid">
        <div>
          <div class="eyebrow">Classes cadastradas</div>
          <div id="classManagerList" class="class-manager-list"></div>
        </div>

        <div class="class-editor">
          <label class="modal-field">
            <span>Nome da classe</span>
            <input id="classNameEditor" type="text" placeholder="Ex.: Assassin" />
          </label>

          <div class="class-editor-actions">
            <button id="addClassBtn" class="primary-btn">+ Adicionar Classe</button>
            <button id="renameClassBtn" class="secondary-btn">Renomear Selecionada</button>
            <button id="deleteClassBtn" class="danger-btn">Excluir Selecionada</button>
          </div>

          <p class="field-help">
            Renomear altera apenas o nome exibido. As skills já salvas continuam ligadas à mesma classe.
          </p>
        </div>
      </div>

      <div class="modal-actions">
        <button id="closeClassManagerBtn" class="primary-btn">Concluir</button>
      </div>
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>
