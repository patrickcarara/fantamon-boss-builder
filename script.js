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

const el = id => document.getElementById(id);

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createEmptySlots() {
  return [1,2,3,4].map((n) => ({
    id: uid("slot"),
    name: `Slot ${n}`,
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
      return saved;
    }
  } catch {}
  return {
    bosses: [],
    selectedBossId: null,
    customSkills: {},
    classes: DEFAULT_CLASSES.map(c => ({ ...c }))
  };
}

function saveState() {
  state.selectedBossId = selectedBossId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  el("modalFields").innerHTML = fields.map(f => `
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
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
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

  selected.name = name;
  saveState();
  renderClassManager();
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

  if (!boss) return;

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
  el("strategyNotes").value = strategy?.notes || "";
  el("setPrincipalBtn").textContent = strategy?.principal ? "★ Principal" : "☆ Principal";

  if (strategy?.modifiedAt) {
    const modified = new Date(strategy.modifiedAt);
    el("strategyModifiedAt").textContent = `Última alteração: ${modified.toLocaleString("pt-BR")}`;
  } else {
    el("strategyModifiedAt").textContent = "";
  }
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
        <div class="eyebrow">Personagem ${index + 1}</div>
        <input data-slot-name="${slot.id}" value="${escapeHtml(slot.name)}" />
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

  document.querySelectorAll("[data-slot-name]").forEach(input => {
    input.addEventListener("input", () => {
      const slot = strategy.slots.find(s => s.id === input.dataset.slotName);
      slot.name = input.value;
      touchStrategy(strategy);
    });
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
    { id: "bossNameInput", label: "Nome do Boss", placeholder: "Ex.: Ancient Dragon" },
    { id: "bossImageInput", label: "Imagem do Boss (opcional)", placeholder: "Ex.: assets/bosses/dragon.png" }
  ], () => {
    const name = el("bossNameInput").value.trim();
    if (!name) return alert("Digite o nome do boss.");
    const strategy = createStrategy("Principal", true);
    const boss = {
      id: uid("boss"),
      name,
      image: pendingBossImage || el("bossImageInput").value.trim(),
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
    boss.name = name;
    boss.image = pendingBossImage || el("bossImageInput").value.trim();
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


el("bossImageFileInput").addEventListener("change", () => {
  const file = el("bossImageFileInput").files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Escolha um arquivo de imagem válido.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingBossImage = String(reader.result || "");
    el("bossImagePreview").src = pendingBossImage;
    el("bossImagePreviewWrap").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
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

render();
