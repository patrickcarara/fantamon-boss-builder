const STORAGE_KEY = "fantamonBossBuilder_v1";

const DEFAULT_CLASSES = [
  { id: "mage", name: "Mage" },
  { id: "warrior", name: "Warrior" },
  { id: "archer", name: "Archer" },
  { id: "priest", name: "Priest" }
];

const defaultSkills = {
  mage: [],
  warrior: [],
  archer: [],
  priest: []
};

let state = loadState();
let selectedBossId = state.selectedBossId || null;
let selectedStrategyId = null;
let draggedSkill = null;
let modalConfirmAction = null;
let pendingBossImage = "";
let selectedManagedClassId = null;
let mobileSkillPickerTarget = null;
let selectedManagedCharacter = null;
let pendingBossOcrName = "";
let bossOcrBusy = false;

const el = id => document.getElementById(id);

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createEmptySlots() {
  return [1,2,3,4].map((n) => ({
    id: uid("slot"),
    name: "",
    classId: getClasses?.()[0]?.id || "mage",
    className: getClasses?.()[0]?.name || "Mage",
    skills: []
  }));
}

function createStrategy(name = "Principal", principal = false) {
  return {
    id: uid("strategy"),
    name,
    principal,
    notes: "",
    modifiedAt: new Date().toISOString(),
    slots: createEmptySlots()
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.bosses)) {
      if (!saved.customSkills) saved.customSkills = {};
      if (!Array.isArray(saved.classes) || saved.classes.length === 0) {
        saved.classes = DEFAULT_CLASSES.map(c => ({ ...c }));
      }
      if (!Array.isArray(saved.characters)) {
        const existingNames = new Set();
        saved.bosses.forEach(boss => {
          (boss.strategies || []).forEach(strategy => {
            (strategy.slots || []).forEach(slot => {
              const name = String(slot.name || "").trim();
              if (name && !/^Slot\s+\d+$/i.test(name)) existingNames.add(name);
            });
          });
        });
        saved.characters = [...existingNames];
      }
      return saved;
    }
  } catch {}
  return {
    bosses: [],
    selectedBossId: null,
    customSkills: {},
    classes: DEFAULT_CLASSES.map(c => ({ ...c })),
    characters: []
  };
}

function saveState() {
  state.selectedBossId = selectedBossId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Sincroniza com o Firebase somente quando o módulo estiver pronto
    // e este dispositivo tiver permissão de edição.
    if (window.FantamonCloud?.queueSync) {
      window.FantamonCloud.queueSync(state);
    }

    return true;
  } catch (error) {
    console.error("Erro ao salvar dados:", error);

    if (error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014) {
      alert("O armazenamento do navegador está cheio. Remova algumas skills personalizadas ou adicione imagens menores. As alterações mais recentes não foram salvas.");
    } else {
      alert("Não foi possível salvar os dados no navegador.");
    }

    return false;
  }
}

function getSelectedBoss() {
  return state.bosses.find(b => b.id === selectedBossId) || null;
}

function getSelectedStrategy() {
  const boss = getSelectedBoss();
  return boss?.strategies.find(s => s.id === selectedStrategyId) || null;
}

function showModal(title, fields, onConfirm) {
  el("modalTitle").textContent = title;
  el("modalFields").innerHTML = fields
    .filter(f => f.id !== "bossImageInput")
    .map(f => `
      <label class="modal-field">
        <span>${f.label}</span>
        <input id="${f.id}" type="${f.type || "text"}" value="${escapeHtml(f.value || "")}" placeholder="${escapeHtml(f.placeholder || "")}" />
      </label>
    `).join("");

  const hasBossImageField = fields.some(f => f.id === "bossImageInput");
  el("bossImageUploadArea").classList.toggle("hidden", !hasBossImageField);
  el("bossImagePreviewWrap").classList.add("hidden");
  el("bossImageFileInput").value = "";
  pendingBossImage = hasBossImageField ? (fields.find(f => f.id === "bossImageInput")?.value || "") : "";
  pendingBossOcrName = "";
  setBossOcrStatus("");

  el("bossAutoNameHelp")?.classList.add("hidden");
  el("bossNameEditBtn")?.classList.add("hidden");

  const bossNameInput = el("bossNameInput");
  if (bossNameInput) {
    bossNameInput.readOnly = false;
    bossNameInput.classList.remove("locked-name-input");
  }

  if (hasBossImageField && pendingBossImage) {
    el("bossImagePreview").src = pendingBossImage;
    el("bossImagePreviewWrap").classList.remove("hidden");
  }

  modalConfirmAction = onConfirm;
  el("modalBackdrop").classList.remove("hidden");
  setTimeout(() => fields[0] && el(fields[0].id)?.focus(), 0);
}

function hideModal() {
  el("modalBackdrop").classList.add("hidden");
  el("bossImageUploadArea").classList.add("hidden");
  el("bossImagePreviewWrap").classList.add("hidden");
  modalConfirmAction = null;
  pendingBossImage = "";
  pendingBossOcrName = "";
  setBossOcrStatus("");
  el("bossAutoNameHelp")?.classList.add("hidden");
  el("bossNameEditBtn")?.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}



function normalizeComparableName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function findBossByName(name, excludeBossId = null) {
  const normalized = normalizeComparableName(name);
  if (!normalized) return null;
  return state.bosses.find(b =>
    b.id !== excludeBossId && normalizeComparableName(b.name) === normalized
  ) || null;
}

function showDuplicateBoss(existingBoss) {
  el("duplicateBossMessage").textContent =
    `"${existingBoss.name}" já está cadastrado na sua lista.`;
  el("duplicateBossBackdrop").classList.remove("hidden");
}

function setBossOcrStatus(message, isError = false) {
  const status = el("bossOcrStatus");
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("error", !!isError);
}

function cleanOcrBossName(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const candidates = [];

  for (const line of lines) {
    let match = line.match(/Lv\.?\s*\d+\s+(.+)/i);
    if (match) candidates.push(match[1]);

    // Também aceita linhas que terminam antes de textos comuns da interface.
    if (/^[A-Za-z][A-Za-z' -]{3,40}$/.test(line) &&
        !/^(elite monster|monster|boss|challenge|battle|combat)$/i.test(line)) {
      candidates.push(line);
    }
  }

  for (let candidate of candidates) {
    candidate = candidate
      .replace(/\b(Elite Monster|Monster|Challenge|Battle|Combat)\b.*$/i, "")
      // Remove símbolos e ícones que o OCR possa interpretar junto do nome.
      .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’\-\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // Remove um caractere isolado no fim, comum quando o ícone vira "O", "S", etc.
      .replace(/\s+[A-Za-z]$/g, "")
      .trim();

    if (candidate.length >= 4 && candidate.length <= 50) {
      return candidate
        .toLowerCase()
        .replace(/(^|[\s\-'’])([a-zà-öø-ÿ])/g, (_, sep, letter) => sep + letter.toUpperCase());
    }
  }

  return "";
}

async function recognizeBossNameFromImage(dataUrl) {
  if (!window.Tesseract?.recognize) {
    throw new Error("Biblioteca de OCR não carregada.");
  }

  const result = await window.Tesseract.recognize(dataUrl, "eng", {
    logger: info => {
      if (info.status === "recognizing text" && typeof info.progress === "number") {
        setBossOcrStatus(`Lendo nome do Boss... ${Math.round(info.progress * 100)}%`);
      }
    }
  });

  return cleanOcrBossName(result?.data?.text || "");
}

async function processBossOcr(dataUrl) {
  if (bossOcrBusy) return;
  bossOcrBusy = true;
  pendingBossOcrName = "";
  setBossOcrStatus("Lendo nome do Boss...");

  try {
    const detectedName = await recognizeBossNameFromImage(dataUrl);
    if (!detectedName) {
      setBossOcrStatus("Não consegui identificar o nome automaticamente. Você ainda pode digitá-lo.");
      return;
    }

    pendingBossOcrName = detectedName;
    const input = el("bossNameInput");
    if (input) input.value = detectedName;

    const editingBoss = getSelectedBoss();
    const isEditing = el("modalTitle")?.textContent === "Editar Boss";
    const duplicate = findBossByName(detectedName, isEditing ? editingBoss?.id : null);

    if (duplicate) {
      setBossOcrStatus(`Boss identificado: ${detectedName}. Ele já está cadastrado.`);
      hideModal();
      showDuplicateBoss(duplicate);
      return;
    }

    setBossOcrStatus(`Boss identificado: ${detectedName}`);
  } catch (error) {
    console.error("Erro no OCR do Boss:", error);
    setBossOcrStatus("Não foi possível ler o nome automaticamente. Você pode digitá-lo.", true);
  } finally {
    bossOcrBusy = false;
  }
}

function getCharacters() {
  if (!Array.isArray(state.characters)) state.characters = [];
  return state.characters;
}

function openCharacterManager() {
  const characters = getCharacters();
  selectedManagedCharacter =
    selectedManagedCharacter && characters.includes(selectedManagedCharacter)
      ? selectedManagedCharacter
      : characters[0] || null;

  renderCharacterManager();
  el("characterModalBackdrop").classList.remove("hidden");
}

function closeCharacterManager() {
  el("characterModalBackdrop").classList.add("hidden");
  renderSlots();
}

function renderCharacterManager() {
  const characters = getCharacters();

  el("characterManagerList").innerHTML = characters.length
    ? characters.map(name => `
        <button class="character-manager-item ${name === selectedManagedCharacter ? "active" : ""}"
                data-manage-character="${escapeHtml(name)}">
          ${escapeHtml(name)}
        </button>
      `).join("")
    : `<div class="field-help">Nenhum personagem cadastrado.</div>`;

  el("characterNameEditor").value = selectedManagedCharacter || "";

  document.querySelectorAll("[data-manage-character]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedManagedCharacter = btn.dataset.manageCharacter;
      renderCharacterManager();
    });
  });
}

function addCharacterFromManager() {
  const name = el("characterNameEditor").value.trim();
  if (!name) return alert("Digite o nome do personagem.");

  if (getCharacters().some(item =>
    normalizeComparableName(item) === normalizeComparableName(name)
  )) {
    return alert("Esse personagem já está cadastrado.");
  }

  state.characters.push(name);
  selectedManagedCharacter = name;
  saveState();
  renderCharacterManager();
}

function renameSelectedCharacter() {
  if (!selectedManagedCharacter) return alert("Selecione um personagem.");

  const name = el("characterNameEditor").value.trim();
  if (!name) return alert("Digite o novo nome do personagem.");

  if (getCharacters().some(item =>
    item !== selectedManagedCharacter &&
    normalizeComparableName(item) === normalizeComparableName(name)
  )) {
    return alert("Já existe um personagem com esse nome.");
  }

  const oldName = selectedManagedCharacter;
  const index = state.characters.indexOf(oldName);
  if (index >= 0) state.characters[index] = name;

  state.bosses.forEach(boss => {
    (boss.strategies || []).forEach(strategy => {
      (strategy.slots || []).forEach(slot => {
        if (slot.name === oldName) slot.name = name;
      });
    });
  });

  selectedManagedCharacter = name;
  saveState();
  renderCharacterManager();
}

function deleteSelectedCharacter() {
  if (!selectedManagedCharacter) return alert("Selecione um personagem.");
  if (!confirm(`Excluir o personagem "${selectedManagedCharacter}" da lista?`)) return;

  const removed = selectedManagedCharacter;
  state.characters = getCharacters().filter(name => name !== removed);

  state.bosses.forEach(boss => {
    (boss.strategies || []).forEach(strategy => {
      (strategy.slots || []).forEach(slot => {
        if (slot.name === removed) slot.name = "";
      });
    });
  });

  selectedManagedCharacter = state.characters[0] || null;
  saveState();
  renderCharacterManager();
}

function getClasses() {
  if (!Array.isArray(state.classes) || state.classes.length === 0) {
    state.classes = DEFAULT_CLASSES.map(c => ({ ...c }));
  }
  return state.classes;
}

function classNameById(classId) {
  return getClasses().find(c => c.id === classId)?.name || classId;
}

function makeClassId(name) {
  const baseId = String(name || "classe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "classe";

  let id = baseId;
  let n = 2;
  while (getClasses().some(c => c.id === id)) {
    id = `${baseId}-${n++}`;
  }
  return id;
}

function renderClassSelect() {
  const select = el("classSelect");
  const previous = select.value;
  const classes = getClasses();

  select.innerHTML = classes
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");

  if (classes.some(c => c.id === previous)) {
    select.value = previous;
  } else if (classes.length) {
    select.value = classes[0].id;
  }
}

function openClassManager() {
  const classes = getClasses();
  selectedManagedClassId = selectedManagedClassId && classes.some(c => c.id === selectedManagedClassId)
    ? selectedManagedClassId
    : classes[0]?.id || null;

  renderClassManager();
  el("classModalBackdrop").classList.remove("hidden");
}

function closeClassManager() {
  el("classModalBackdrop").classList.add("hidden");
  renderClassSelect();
  renderSkillLibrary();
  renderSlots();
}

function renderClassManager() {
  const classes = getClasses();

  el("classManagerList").innerHTML = classes.map(c => `
    <button class="class-manager-item ${c.id === selectedManagedClassId ? "active" : ""}"
            data-manage-class-id="${c.id}">
      ${escapeHtml(c.name)}
    </button>
  `).join("");

  const selected = classes.find(c => c.id === selectedManagedClassId);
  el("classNameEditor").value = selected?.name || "";

  document.querySelectorAll("[data-manage-class-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedManagedClassId = btn.dataset.manageClassId;
      renderClassManager();
    });
  });
}

function addClassFromManager() {
  const name = el("classNameEditor").value.trim();
  if (!name) return alert("Digite o nome da nova classe.");

  const id = makeClassId(name);
  state.classes.push({ id, name });
  if (!state.customSkills[id]) state.customSkills[id] = [];

  selectedManagedClassId = id;
  saveState();
  renderClassManager();
}

function renameSelectedClass() {
  const name = el("classNameEditor").value.trim();
  const selected = getClasses().find(c => c.id === selectedManagedClassId);

  if (!selected) return alert("Selecione uma classe.");
  if (!name) return alert("Digite o novo nome da classe.");

  const oldId = selected.id;

  // Cria o novo ID a partir do novo nome, ignorando a própria classe atual
  // na verificação de IDs duplicados.
  const baseId = String(name || "classe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "classe";

  let newId = baseId;
  let n = 2;
  while (getClasses().some(c => c.id === newId && c.id !== oldId)) {
    newId = `${baseId}-${n++}`;
  }

  const classSelect = el("classSelect");
  const wasSelectedInLibrary = classSelect?.value === oldId;

  // Se o ID mudou, migra skills e referências para a nova pasta.
  if (newId !== oldId) {
    if (!state.customSkills) state.customSkills = {};

    const oldSkills = Array.isArray(state.customSkills[oldId])
      ? state.customSkills[oldId]
      : [];
    const existingNewSkills = Array.isArray(state.customSkills[newId])
      ? state.customSkills[newId]
      : [];

    const migratedSkills = oldSkills.map(skill => {
      const updated = { ...skill };

      if (
        typeof updated.image === "string" &&
        updated.image.startsWith(`assets/skills/${oldId}/`)
      ) {
        updated.image = updated.image.replace(
          `assets/skills/${oldId}/`,
          `assets/skills/${newId}/`
        );
      }

      return updated;
    });

    state.customSkills[newId] = [...existingNewSkills, ...migratedSkills];
    delete state.customSkills[oldId];

    // Migra também skills padrão, caso existam futuramente.
    if (Array.isArray(defaultSkills[oldId])) {
      if (!Array.isArray(defaultSkills[newId])) {
        defaultSkills[newId] = defaultSkills[oldId];
      }
      delete defaultSkills[oldId];
    }

    // Atualiza personagens/slots e skills já usadas nas estratégias.
    state.bosses.forEach(boss => {
      boss.strategies.forEach(strategy => {
        strategy.slots.forEach(slot => {
          if (slot.classId === oldId) {
            slot.classId = newId;
            slot.className = name;
          } else if (slot.className === selected.name) {
            slot.className = name;
          }

          if (Array.isArray(slot.skills)) {
            slot.skills.forEach(skill => {
              if (!skill) return;

              if (skill.classId === oldId) skill.classId = newId;
              if (skill.classKey === oldId) skill.classKey = newId;

              if (
                typeof skill.image === "string" &&
                skill.image.startsWith(`assets/skills/${oldId}/`)
              ) {
                skill.image = skill.image.replace(
                  `assets/skills/${oldId}/`,
                  `assets/skills/${newId}/`
                );
              }
            });
          }
        });
      });
    });

    selected.id = newId;
    selectedManagedClassId = newId;
  }

  selected.name = name;

  if (!saveState()) return;

  renderClassManager();
  renderClassSelect();

  if (wasSelectedInLibrary) {
    el("classSelect").value = newId;
  }

  renderSkillLibrary();
  renderSlots();
}

function deleteSelectedClass() {
  const classes = getClasses();
  const selected = classes.find(c => c.id === selectedManagedClassId);

  if (!selected) return alert("Selecione uma classe.");
  if (classes.length <= 1) return alert("É necessário manter pelo menos uma classe.");

  const hasSkills = (state.customSkills?.[selected.id]?.length || 0) > 0 ||
                    (defaultSkills[selected.id]?.length || 0) > 0;

  const message = hasSkills
    ? `A classe "${selected.name}" possui skills cadastradas. Excluir a classe também removerá essas skills personalizadas da biblioteca. Continuar?`
    : `Excluir a classe "${selected.name}"?`;

  if (!confirm(message)) return;

  state.classes = classes.filter(c => c.id !== selected.id);
  if (state.customSkills) delete state.customSkills[selected.id];

  // Preserve existing slot text by moving deleted-class slots to first remaining class.
  const fallbackClass = state.classes[0];
  state.bosses.forEach(boss => {
    boss.strategies.forEach(strategy => {
      strategy.slots.forEach(slot => {
        if (slot.classId === selected.id || slot.className === selected.name) {
          slot.classId = fallbackClass.id;
          slot.className = fallbackClass.name;
        }
      });
    });
  });

  selectedManagedClassId = state.classes[0]?.id || null;
  saveState();
  renderClassManager();
}

function render() {
  renderClassSelect();
  renderBossList();
  const boss = getSelectedBoss();

  el("emptyState").classList.toggle("hidden", !!boss);
  el("builderView").classList.toggle("hidden", !boss);

  if (!boss) {
    if (window.FantamonCloud?.applyPermissions) {
      window.FantamonCloud.applyPermissions();
    }
    return;
  }

  if (!boss.strategies.some(s => s.id === selectedStrategyId)) {
    selectedStrategyId = (boss.strategies.find(s => s.principal) || boss.strategies[0])?.id || null;
  }

  el("bossTitle").textContent = boss.name;
  el("bossPanelName").textContent = boss.name;
  el("favoriteBossBtn").textContent = boss.favorite ? "★" : "☆";
  el("favoriteBossBtn").classList.toggle("star", boss.favorite);

  const img = el("bossImage");
  const placeholder = el("bossImagePlaceholder");
  if (boss.image) {
    img.src = boss.image;
    img.classList.remove("hidden");
    placeholder.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }

  const principal = boss.strategies.find(s => s.principal);
  el("principalStrategyName").textContent = principal?.name || "Nenhuma";

  renderStrategies(boss);
  renderSlots();
  renderSkillLibrary();

  if (window.FantamonCloud?.applyPermissions) {
    window.FantamonCloud.applyPermissions();
  }
}

function renderBossList() {
  const query = el("bossSearch").value.trim().toLowerCase();
  const bosses = [...state.bosses]
    .filter(b => b.name.toLowerCase().includes(query))
    .sort((a,b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  el("bossCount").textContent = state.bosses.length;
  el("bossList").innerHTML = bosses.map(b => {
    const principal = b.strategies.find(s => s.principal)?.name || "Sem estratégia";
    const thumb = b.image
      ? `<img class="boss-thumb" src="${escapeHtml(b.image)}" alt="">`
      : `<div class="boss-thumb">🐉</div>`;
    return `
      <button class="boss-item ${b.id === selectedBossId ? "active" : ""}" data-boss-id="${b.id}">
        ${thumb}
        <span>
          <strong>${escapeHtml(b.name)}</strong>
          <small>⭐ ${escapeHtml(principal)}</small>
        </span>
        <span class="star">${b.favorite ? "★" : ""}</span>
      </button>
    `;
  }).join("");

  document.querySelectorAll("[data-boss-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedBossId = btn.dataset.bossId;
      const boss = getSelectedBoss();
      selectedStrategyId = (boss.strategies.find(s => s.principal) || boss.strategies[0])?.id || null;
      saveState();
      render();
    });
  });
}

function renderStrategies(boss) {
  const select = el("strategySelect");
  select.innerHTML = boss.strategies.map(s =>
    `<option value="${s.id}" ${s.id === selectedStrategyId ? "selected" : ""}>${s.principal ? "⭐ " : ""}${escapeHtml(s.name)}</option>`
  ).join("");

  select.onchange = () => {
    selectedStrategyId = select.value;
    render();
  };

  const strategy = getSelectedStrategy();
  el("strategyCountBadge").textContent = boss.strategies.length;
  el("strategyCountBadge").title = `${boss.strategies.length} estratégia${boss.strategies.length === 1 ? "" : "s"} salva${boss.strategies.length === 1 ? "" : "s"}`;
  el("strategyNotes").value = strategy?.notes || "";
  el("setPrincipalBtn").textContent = strategy?.principal ? "★ Principal" : "☆ Principal";

  if (strategy?.modifiedAt) {
    const modified = new Date(strategy.modifiedAt);
    el("strategyModifiedAt").textContent = `Última alteração: ${modified.toLocaleString("pt-BR")}`;
  } else {
    el("strategyModifiedAt").textContent = "";
  }
}


function isMobileSkillPickerMode() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function getSkillsForClass(classId) {
  return [
    ...(defaultSkills[classId] || []),
    ...(state.customSkills?.[classId] || [])
  ];
}

function closeMobileSkillPicker() {
  mobileSkillPickerTarget = null;
  el("mobileSkillPickerBackdrop").classList.add("hidden");
}

function openMobileSkillPicker(slotId, skillIndex) {
  if (!isMobileSkillPickerMode()) return;
  if (document.body.classList.contains("read-only")) return;

  const strategy = getSelectedStrategy();
  const slot = strategy?.slots.find(s => s.id === slotId);
  if (!slot) return;

  const classId = slot.classId || getClasses().find(c => c.name === slot.className)?.id;
  const skills = getSkillsForClass(classId);

  mobileSkillPickerTarget = { slotId, skillIndex };
  el("mobileSkillPickerClass").textContent = `Classe: ${classNameById(classId)}`;

  if (skills.length === 0) {
    el("mobileSkillPickerGrid").innerHTML = `
      <div class="empty-library-message">
        Nenhuma skill cadastrada para esta classe.
      </div>
    `;
  } else {
    el("mobileSkillPickerGrid").innerHTML = skills.map(skill => `
      <button class="mobile-skill-picker-item"
              data-mobile-skill-id="${escapeHtml(skill.id)}"
              title="${escapeHtml(skill.name)}">
        <img src="${escapeHtml(skill.image)}" alt="${escapeHtml(skill.name)}" />
      </button>
    `).join("");

    document.querySelectorAll("[data-mobile-skill-id]").forEach(button => {
      button.addEventListener("click", () => {
        const selectedSkill = skills.find(s => s.id === button.dataset.mobileSkillId);
        if (!selectedSkill || !mobileSkillPickerTarget) return;

        const currentStrategy = getSelectedStrategy();
        const currentSlot = currentStrategy?.slots.find(s => s.id === mobileSkillPickerTarget.slotId);
        if (!currentSlot) return;

        currentSlot.skills[mobileSkillPickerTarget.skillIndex] = { ...selectedSkill };
        touchStrategy(currentStrategy);
        closeMobileSkillPicker();
        renderSlots();
      });
    });
  }

  const hasSkill = !!slot.skills?.[skillIndex];
  el("mobileSkillPickerRemoveBtn").classList.toggle("hidden", !hasSkill);
  el("mobileSkillPickerBackdrop").classList.remove("hidden");
}

function renderSlots() {
  const strategy = getSelectedStrategy();
  const container = el("slotsContainer");
  if (!strategy) {
    container.innerHTML = "";
    return;
  }

  // Garante que cada personagem tenha exatamente 4 posições de skill.
  strategy.slots.forEach(slot => {
    if (!Array.isArray(slot.skills)) slot.skills = [];
    while (slot.skills.length < 4) slot.skills.push(null);
    if (slot.skills.length > 4) slot.skills = slot.skills.slice(0, 4);
  });

  container.innerHTML = strategy.slots.map((slot, index) => `
    <div class="character-slot">
      <div class="slot-info">
        <div class="slot-title-row">
          <div class="eyebrow">Personagem ${index + 1}</div>
          ${index === 0 ? `<button class="character-gear-btn" data-open-character-manager title="Gerenciar personagens" aria-label="Gerenciar personagens">⚙️</button>` : ""}
        </div>
        <select data-slot-name="${slot.id}">
          <option value="">Selecionar personagem</option>
          ${getCharacters().map(name => `
            <option value="${escapeHtml(name)}" ${slot.name === name ? "selected" : ""}>${escapeHtml(name)}</option>
          `).join("")}
          ${slot.name && !getCharacters().includes(slot.name)
            ? `<option value="${escapeHtml(slot.name)}" selected>${escapeHtml(slot.name)}</option>`
            : ""
          }
        </select>
        <select data-slot-class="${slot.id}">
          ${getClasses().map(c => `
            <option value="${c.id}" ${
              (slot.classId && slot.classId === c.id) ||
              (!slot.classId && slot.className === c.name)
                ? "selected"
                : ""
            }>${escapeHtml(c.name)}</option>
          `).join("")}
        </select>
      </div>

      <div class="skill-slots-grid">
        ${slot.skills.map((skill, skillIndex) => `
          <div class="single-skill-slot ${skill ? "filled" : ""}"
               data-drop-slot="${slot.id}"
               data-skill-index="${skillIndex}">
            ${skill
              ? skillCardHtml(skill, true, slot.id, skillIndex)
              : `<span class="empty-skill-label">Skill ${skillIndex + 1}</span>`
            }
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-slot-name]").forEach(select => {
    select.addEventListener("change", () => {
      const slot = strategy.slots.find(s => s.id === select.dataset.slotName);
      slot.name = select.value;
      touchStrategy(strategy);
    });
  });

  document.querySelectorAll("[data-open-character-manager]").forEach(button => {
    button.addEventListener("click", openCharacterManager);
  });

  document.querySelectorAll("[data-slot-class]").forEach(select => {
    select.addEventListener("change", () => {
      const slot = strategy.slots.find(s => s.id === select.dataset.slotClass);
      slot.classId = select.value;
      slot.className = classNameById(select.value);
      touchStrategy(strategy);
    });
  });

  document.querySelectorAll("[data-drop-slot][data-skill-index]").forEach(zone => {
    zone.addEventListener("dragover", e => {
      e.preventDefault();
      zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));

    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (!draggedSkill) return;

      const slot = strategy.slots.find(s => s.id === zone.dataset.dropSlot);
      const skillIndex = Number(zone.dataset.skillIndex);

      // Uma skill por posição; são 4 posições por personagem.
      slot.skills[skillIndex] = { ...draggedSkill };
      touchStrategy(strategy);
      renderSlots();
    });

    // No celular, tocar no slot abre um seletor visual com os ícones
    // apenas da classe escolhida para aquele personagem.
    zone.addEventListener("click", event => {
      if (!isMobileSkillPickerMode()) return;
      event.preventDefault();
      event.stopPropagation();
      openMobileSkillPicker(
        zone.dataset.dropSlot,
        Number(zone.dataset.skillIndex)
      );
    });
  });

  bindSkillEvents();
}

function skillCardHtml(skill, placed = false, slotId = "", skillIndex = "") {
  return `
    <div class="skill-card" draggable="true"
      title="${escapeHtml(skill.name)}"
      data-tooltip="${escapeHtml(skill.name)}"
      data-skill-id="${skill.id}"
      data-skill-name="${escapeHtml(skill.name)}"
      data-skill-image="${escapeHtml(skill.image)}"
      ${placed ? `data-placed-slot="${slotId}" data-placed-index="${skillIndex}"` : ""}>
      <img src="${escapeHtml(skill.image)}" alt="${escapeHtml(skill.name)}" />
    </div>
  `;
}

function renderSkillLibrary() {
  const classKey = el("classSelect").value;
  const defaultClassSkills = defaultSkills[classKey] || [];
  const customClassSkills = state.customSkills?.[classKey] || [];
  const skills = [...defaultClassSkills, ...customClassSkills];

  if (skills.length === 0) {
    el("skillLibrary").innerHTML = `
      <div class="empty-library-message">
        Nenhuma skill cadastrada para esta classe ainda.<br>
        Use <strong>+ Adicionar várias Skills</strong> para importar imagens.
      </div>
    `;
    return;
  }

  el("skillLibrary").innerHTML = skills.map(s => {
    const card = skillCardHtml(s);
    if (!s.custom) return card;
    return `
      <div class="custom-skill-wrap">
        ${card}
        <button class="remove-custom-skill" data-remove-custom-skill="${s.id}" title="Remover skill">×</button>
      </div>
    `;
  }).join("");

  bindSkillEvents();

  document.querySelectorAll("[data-remove-custom-skill]").forEach(btn => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const skillId = btn.dataset.removeCustomSkill;
      const list = state.customSkills?.[classKey] || [];
      const skill = list.find(s => s.id === skillId);
      if (!skill) return;

      if (!confirm(`Remover a skill "${skill.name}" da biblioteca de ${classKey}?`)) return;

      state.customSkills[classKey] = list.filter(s => s.id !== skillId);
      saveState();
      renderSkillLibrary();
    });
  });
}

function bindSkillEvents() {
  document.querySelectorAll(".skill-card").forEach(card => {
    card.addEventListener("dragstart", () => {
      draggedSkill = {
        id: card.dataset.skillId,
        name: card.dataset.skillName,
        image: card.dataset.skillImage
      };
    });

    card.addEventListener("dragend", () => draggedSkill = null);

    if (card.dataset.placedSlot) {
      card.addEventListener("dblclick", () => {
        const strategy = getSelectedStrategy();
        const slot = strategy.slots.find(s => s.id === card.dataset.placedSlot);
        const skillIndex = Number(card.dataset.placedIndex);
        slot.skills[skillIndex] = null;
        touchStrategy(strategy);
        renderSlots();
      });
    }
  });
}

function touchStrategy(strategy) {
  strategy.modifiedAt = new Date().toISOString();
  saveState();
}

function addBoss() {
  showModal("Novo Boss", [
    { id: "bossNameInput", label: "Nome do Boss gerado", placeholder: "O nome aparecerá aqui após escolher a imagem" },
    { id: "bossImageInput", label: "Imagem do Boss (opcional)", placeholder: "Ex.: assets/bosses/dragon.png" }
  ], () => {
    const name = el("bossNameInput").value.trim();
    if (!name) return alert("Digite o nome do boss.");

    const duplicate = findBossByName(name);
    if (duplicate) {
      hideModal();
      showDuplicateBoss(duplicate);
      return;
    }

    const strategy = createStrategy("Principal", true);
    const boss = {
      id: uid("boss"),
      name,
      image: pendingBossImage,
      favorite: false,
      strategies: [strategy]
    };
    state.bosses.push(boss);
    selectedBossId = boss.id;
    selectedStrategyId = strategy.id;
    saveState();
    hideModal();
    render();
  });

  const bossNameInput = el("bossNameInput");
  if (bossNameInput) {
    bossNameInput.readOnly = true;
    bossNameInput.classList.add("locked-name-input");
  }

  el("bossAutoNameHelp")?.classList.remove("hidden");
  el("bossNameEditBtn")?.classList.remove("hidden");
}


function editBoss() {
  const boss = getSelectedBoss();
  if (!boss) return;
  showModal("Editar Boss", [
    { id: "bossNameInput", label: "Nome do Boss", value: boss.name },
    { id: "bossImageInput", label: "Imagem do Boss", value: boss.image || "", placeholder: "assets/bosses/arquivo.png" }
  ], () => {
    const name = el("bossNameInput").value.trim();
    if (!name) return alert("Digite o nome do boss.");

    const duplicate = findBossByName(name, boss.id);
    if (duplicate) {
      hideModal();
      showDuplicateBoss(duplicate);
      return;
    }

    boss.name = name;
    boss.image = pendingBossImage;
    saveState();
    hideModal();
    render();
  });
}

function newStrategy() {
  const boss = getSelectedBoss();
  showModal("Nova Estratégia", [
    { id: "strategyNameInput", label: "Nome da estratégia", placeholder: "Ex.: Mage + Priest" }
  ], () => {
    const name = el("strategyNameInput").value.trim();
    if (!name) return alert("Digite um nome.");
    const strategy = createStrategy(name, boss.strategies.length === 0);
    boss.strategies.push(strategy);
    selectedStrategyId = strategy.id;
    saveState();
    hideModal();
    render();
  });
}

function renameStrategy() {
  const strategy = getSelectedStrategy();
  if (!strategy) return;
  showModal("Renomear Estratégia", [
    { id: "strategyNameInput", label: "Novo nome", value: strategy.name }
  ], () => {
    const name = el("strategyNameInput").value.trim();
    if (!name) return alert("Digite um nome.");
    strategy.name = name;
    touchStrategy(strategy);
    hideModal();
    render();
  });
}

function duplicateStrategy() {
  const boss = getSelectedBoss();
  const original = getSelectedStrategy();
  if (!original) return;
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = uid("strategy");
  copy.name = `${original.name} (Cópia)`;
  copy.principal = false;
  copy.modifiedAt = new Date().toISOString();
  copy.slots.forEach(slot => slot.id = uid("slot"));
  boss.strategies.push(copy);
  selectedStrategyId = copy.id;
  saveState();
  render();
}

function setPrincipal() {
  const boss = getSelectedBoss();
  const strategy = getSelectedStrategy();
  if (!strategy) return;
  boss.strategies.forEach(s => s.principal = s.id === strategy.id);
  saveState();
  render();
}

function deleteStrategy() {
  const boss = getSelectedBoss();
  const strategy = getSelectedStrategy();
  if (!boss || !strategy) return;
  if (boss.strategies.length === 1) {
    return alert("O boss precisa ter pelo menos uma estratégia.");
  }
  if (!confirm(`Excluir a estratégia "${strategy.name}"?`)) return;
  const wasPrincipal = strategy.principal;
  boss.strategies = boss.strategies.filter(s => s.id !== strategy.id);
  if (wasPrincipal) boss.strategies[0].principal = true;
  selectedStrategyId = (boss.strategies.find(s => s.principal) || boss.strategies[0]).id;
  saveState();
  render();
}


// Editor de recorte da imagem do Boss (proporção 400 x 560)
let cropImage = null;
let cropScale = 1;
let cropMinScale = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDragging = false;
let cropLastX = 0;
let cropLastY = 0;

function drawBossCrop() {
  if (!cropImage) return;

  const canvas = el("cropCanvas");
  const ctx = canvas.getContext("2d");
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "#090d12";
  ctx.fillRect(0, 0, cw, ch);

  const width = cropImage.naturalWidth * cropScale;
  const height = cropImage.naturalHeight * cropScale;

  // Limita o movimento para nunca deixar área vazia dentro do recorte.
  const minX = cw - width;
  const minY = ch - height;
  cropOffsetX = Math.min(0, Math.max(minX, cropOffsetX));
  cropOffsetY = Math.min(0, Math.max(minY, cropOffsetY));

  ctx.drawImage(cropImage, cropOffsetX, cropOffsetY, width, height);
}

function openBossCrop(dataUrl) {
  const img = new Image();

  img.onload = () => {
    cropImage = img;

    const canvas = el("cropCanvas");
    const coverScale = Math.max(
      canvas.width / img.naturalWidth,
      canvas.height / img.naturalHeight
    );

    cropMinScale = coverScale;
    cropScale = coverScale;

    const width = img.naturalWidth * cropScale;
    const height = img.naturalHeight * cropScale;
    cropOffsetX = (canvas.width - width) / 2;
    cropOffsetY = (canvas.height - height) / 2;

    const zoom = el("cropZoom");
    zoom.min = "1";
    zoom.max = "3";
    zoom.step = "0.01";
    zoom.value = "1";

    drawBossCrop();
    el("cropModalBackdrop").classList.remove("hidden");
  };

  img.src = dataUrl;
}

el("bossImageFileInput").addEventListener("change", () => {
  const file = el("bossImageFileInput").files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Escolha um arquivo de imagem válido.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    processBossOcr(dataUrl);
    openBossCrop(dataUrl);
  };
  reader.readAsDataURL(file);
});

el("cropZoom").addEventListener("input", () => {
  if (!cropImage) return;

  const canvas = el("cropCanvas");
  const oldWidth = cropImage.naturalWidth * cropScale;
  const oldHeight = cropImage.naturalHeight * cropScale;

  const centerImageX = (canvas.width / 2 - cropOffsetX) / oldWidth;
  const centerImageY = (canvas.height / 2 - cropOffsetY) / oldHeight;

  cropScale = cropMinScale * Number(el("cropZoom").value);

  const newWidth = cropImage.naturalWidth * cropScale;
  const newHeight = cropImage.naturalHeight * cropScale;

  cropOffsetX = canvas.width / 2 - centerImageX * newWidth;
  cropOffsetY = canvas.height / 2 - centerImageY * newHeight;

  drawBossCrop();
});

const cropCanvas = el("cropCanvas");

cropCanvas.addEventListener("pointerdown", e => {
  if (!cropImage) return;
  cropDragging = true;
  cropLastX = e.clientX;
  cropLastY = e.clientY;
  cropCanvas.setPointerCapture(e.pointerId);
});

cropCanvas.addEventListener("pointermove", e => {
  if (!cropDragging || !cropImage) return;

  const rect = cropCanvas.getBoundingClientRect();
  const scaleX = cropCanvas.width / rect.width;
  const scaleY = cropCanvas.height / rect.height;

  cropOffsetX += (e.clientX - cropLastX) * scaleX;
  cropOffsetY += (e.clientY - cropLastY) * scaleY;

  cropLastX = e.clientX;
  cropLastY = e.clientY;

  drawBossCrop();
});

function stopCropDrag() {
  cropDragging = false;
}

cropCanvas.addEventListener("pointerup", stopCropDrag);
cropCanvas.addEventListener("pointercancel", stopCropDrag);

el("cropCancelBtn").addEventListener("click", () => {
  el("cropModalBackdrop").classList.add("hidden");
  el("bossImageFileInput").value = "";
  cropImage = null;
});

el("cropConfirmBtn").addEventListener("click", () => {
  if (!cropImage) return;

  // Salva o resultado final já recortado em 400 x 560.
  // JPEG reduz bastante o uso do localStorage em comparação com um print inteiro.
  pendingBossImage = el("cropCanvas").toDataURL("image/jpeg", 0.86);

  el("bossImagePreview").src = pendingBossImage;
  el("bossImagePreviewWrap").classList.remove("hidden");
  el("cropModalBackdrop").classList.add("hidden");
  cropImage = null;
});

el("cropModalBackdrop").addEventListener("click", e => {
  if (e.target === el("cropModalBackdrop")) {
    el("cropModalBackdrop").classList.add("hidden");
    el("bossImageFileInput").value = "";
    cropImage = null;
  }
});

function exportBackup() {
  const payload = {
    app: "Fantamon Boss Builder",
    version: "1.2",
    exportedAt: new Date().toISOString(),
    data: state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fantamon-boss-builder-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const importedState = parsed?.data || parsed;

      if (!importedState || !Array.isArray(importedState.bosses)) {
        throw new Error("Formato inválido");
      }

      if (!confirm("Importar este backup substituirá os dados atuais. Continuar?")) return;

      state = importedState;
      selectedBossId = state.selectedBossId || state.bosses[0]?.id || null;
      selectedStrategyId = null;
      saveState();
      render();
      alert("Backup importado com sucesso.");
    } catch {
      alert("Não foi possível importar o arquivo. Verifique se é um backup válido do Fantamon Boss Builder.");
    } finally {
      el("importBackupInput").value = "";
    }
  };
  reader.readAsText(file);
}

el("exportBackupBtn").addEventListener("click", exportBackup);
el("importBackupBtn").addEventListener("click", () => el("importBackupInput").click());
el("importBackupInput").addEventListener("change", () => {
  const file = el("importBackupInput").files?.[0];
  if (file) importBackupFile(file);
});



function filenameToSkillName(filename) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addMultipleSkills(files) {
  const classKey = el("classSelect").value;
  const validFiles = [...files].filter(file => file.type.startsWith("image/"));

  if (validFiles.length === 0) {
    alert("Selecione arquivos de imagem válidos.");
    return;
  }

  if (!state.customSkills) state.customSkills = {};
  if (!Array.isArray(state.customSkills[classKey])) state.customSkills[classKey] = [];

  let added = 0;
  let skipped = 0;

  for (const file of validFiles) {
    // Evita Base64 gigantes no localStorage. 700 KB por arquivo já pode virar quase 1 MB após conversão.
    if (file.size > 700 * 1024) {
      skipped++;
      console.warn("Skill ignorada por ser muito grande:", file.name);
      continue;
    }

    try {
      const image = await fileToDataUrl(file);
      const skill = {
        id: uid(`custom_${classKey}`),
        name: filenameToSkillName(file.name),
        image,
        custom: true
      };

      state.customSkills[classKey].push(skill);

      // Salva uma por vez. Se o armazenamento encher, desfaz apenas a última skill.
      if (!saveState()) {
        state.customSkills[classKey].pop();
        skipped += validFiles.length - added;
        break;
      }

      added++;
    } catch (error) {
      skipped++;
      console.error("Erro ao importar skill:", file.name, error);
    }
  }

  renderSkillLibrary();

  if (added > 0) {
    let message = `${added} skill${added > 1 ? "s" : ""} adicionada${added > 1 ? "s" : ""} à biblioteca de ${el("classSelect").selectedOptions[0].text}.`;
    if (skipped > 0) message += ` ${skipped} arquivo${skipped > 1 ? "s foram" : " foi"} ignorado${skipped > 1 ? "s" : ""}.`;
    alert(message);
  } else if (skipped > 0) {
    alert("Nenhuma skill foi adicionada. O armazenamento pode estar cheio ou as imagens podem ser muito grandes.");
  }
}

el("addSkillsBtn").addEventListener("click", () => {
  el("skillFilesInput").click();
});

el("skillFilesInput").addEventListener("change", async () => {
  const files = el("skillFilesInput").files;
  if (files?.length) await addMultipleSkills(files);
  el("skillFilesInput").value = "";
});

el("newBossBtn").addEventListener("click", addBoss);
el("emptyNewBossBtn").addEventListener("click", addBoss);
el("editBossBtn").addEventListener("click", editBoss);

el("deleteBossBtn").addEventListener("click", () => {
  const boss = getSelectedBoss();
  if (!boss || !confirm(`Excluir o boss "${boss.name}" e todas as estratégias?`)) return;
  state.bosses = state.bosses.filter(b => b.id !== boss.id);
  selectedBossId = state.bosses[0]?.id || null;
  selectedStrategyId = null;
  saveState();
  render();
});

el("favoriteBossBtn").addEventListener("click", () => {
  const boss = getSelectedBoss();
  boss.favorite = !boss.favorite;
  saveState();
  render();
});

el("newStrategyBtn").addEventListener("click", newStrategy);
el("renameStrategyBtn").addEventListener("click", renameStrategy);
el("duplicateStrategyBtn").addEventListener("click", duplicateStrategy);
el("setPrincipalBtn").addEventListener("click", setPrincipal);
el("deleteStrategyBtn").addEventListener("click", deleteStrategy);

el("strategyNotes").addEventListener("input", () => {
  const strategy = getSelectedStrategy();
  if (!strategy) return;
  strategy.notes = el("strategyNotes").value;
  touchStrategy(strategy);
});


el("bossNameEditBtn").addEventListener("click", () => {
  const input = el("bossNameInput");
  if (!input) return;

  input.readOnly = false;
  input.classList.remove("locked-name-input");
  input.focus();
  input.select();
});

el("duplicateBossExitBtn").addEventListener("click", () => {
  el("duplicateBossBackdrop").classList.add("hidden");
});

el("duplicateBossBackdrop").addEventListener("click", event => {
  if (event.target === el("duplicateBossBackdrop")) {
    el("duplicateBossBackdrop").classList.add("hidden");
  }
});

el("closeCharacterManagerBtn").addEventListener("click", closeCharacterManager);
el("addCharacterBtn").addEventListener("click", addCharacterFromManager);
el("renameCharacterBtn").addEventListener("click", renameSelectedCharacter);
el("deleteCharacterBtn").addEventListener("click", deleteSelectedCharacter);

el("characterModalBackdrop").addEventListener("click", event => {
  if (event.target === el("characterModalBackdrop")) closeCharacterManager();
});

el("manageClassesBtn").addEventListener("click", openClassManager);
el("closeClassManagerBtn").addEventListener("click", closeClassManager);
el("addClassBtn").addEventListener("click", addClassFromManager);
el("renameClassBtn").addEventListener("click", renameSelectedClass);
el("deleteClassBtn").addEventListener("click", deleteSelectedClass);

el("classModalBackdrop").addEventListener("click", e => {
  if (e.target === el("classModalBackdrop")) closeClassManager();
});

el("bossSearch").addEventListener("input", renderBossList);
el("classSelect").addEventListener("change", renderSkillLibrary);

el("modalCancelBtn").addEventListener("click", hideModal);
el("modalConfirmBtn").addEventListener("click", () => modalConfirmAction?.());
el("modalBackdrop").addEventListener("click", e => {
  if (e.target === el("modalBackdrop")) hideModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") hideModal();
  if (e.key === "Enter" && !el("modalBackdrop").classList.contains("hidden")) modalConfirmAction?.();
});



el("mobileSkillPickerCloseBtn").addEventListener("click", closeMobileSkillPicker);

el("mobileSkillPickerRemoveBtn").addEventListener("click", () => {
  if (!mobileSkillPickerTarget) return;

  const strategy = getSelectedStrategy();
  const slot = strategy?.slots.find(s => s.id === mobileSkillPickerTarget.slotId);
  if (!slot) return;

  slot.skills[mobileSkillPickerTarget.skillIndex] = null;
  touchStrategy(strategy);
  closeMobileSkillPicker();
  renderSlots();
});

el("mobileSkillPickerBackdrop").addEventListener("click", event => {
  if (event.target === el("mobileSkillPickerBackdrop")) {
    closeMobileSkillPicker();
  }
});


// Interface usada pelo módulo Firebase para atualizar os dados compartilhados
// sem remover os eventos e funções do aplicativo.
window.FantamonApp = {
  getState: () => state,

  replaceSharedData: ({ bosses, classes, customSkills, characters }) => {
    if (Array.isArray(bosses)) {
      state.bosses = bosses;
    }

    if (Array.isArray(classes) && classes.length > 0) {
      state.classes = classes;
    }

    if (customSkills && typeof customSkills === "object") {
      state.customSkills = customSkills;
    }

    if (Array.isArray(characters)) {
      state.characters = characters;
    }

    if (!state.bosses.some(b => b.id === selectedBossId)) {
      selectedBossId = state.bosses[0]?.id || null;
      selectedStrategyId = null;
    }

    // Cache local sem disparar uma gravação de volta ao Firebase.
    try {
      state.selectedBossId = selectedBossId;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Não foi possível atualizar o cache local:", error);
    }

    render();
  },

  render
};


render();
